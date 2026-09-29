import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { Events, maskPhone, normalizePhone, OtpChannel, Role, STAFF_ROLES, type UserRegisteredEvent } from '@aci/contracts';
import { APP_CONFIG, InternalHttpClient, OutboxService, RedisService } from '@aci/nest-common';
import type { AuthConfig } from './config';
import { PrismaService } from './prisma.service';
import type { Audience } from './dto';
import type { User } from './generated/prisma';

interface OtpDeliveryResult {
  delivered: boolean;
  channel: OtpChannel;
  provider: string;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AuthConfig,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly http: InternalHttpClient,
    private readonly outbox: OutboxService,
  ) {}

  private hash(challengeId: string, code: string): string {
    return createHmac('sha256', this.config.env.AUTH_OTP_PEPPER).update(`${challengeId}:${code}`).digest('hex');
  }

  private tooMany(message: string, retryAfter: number): never {
    throw new HttpException({ message, code: 'RATE_LIMITED', retryAfterSeconds: retryAfter }, HttpStatus.TOO_MANY_REQUESTS);
  }

  async request(input: { phone: string; channel: OtpChannel; audience: Audience; ip: string; userAgent?: string }) {
    const phone = normalizePhone(input.phone);
    if (!phone) throw new BadRequestException({ message: 'Enter a valid mobile number', code: 'INVALID_PHONE' });
    const env = this.config.env;

    // Abuse controls: per-number cooldown, per-number hourly cap, per-IP hourly cap.
    const cooldownKey = `otp:cooldown:${phone}`;
    const cooldownOk = await this.redis.client.set(cooldownKey, '1', 'EX', env.AUTH_OTP_RESEND_COOLDOWN_SECONDS, 'NX');
    if (cooldownOk !== 'OK') {
      const ttl = await this.redis.client.ttl(cooldownKey);
      this.tooMany('Please wait before requesting another code', Math.max(ttl, 1));
    }
    const perPhone = await this.redis.hit(`otp:phone:${phone}`, env.AUTH_OTP_MAX_PER_HOUR, 3600);
    if (perPhone.limited) this.tooMany('Too many codes requested for this number. Try again later.', perPhone.ttl);
    const perIp = await this.redis.hit(`otp:ip:${input.ip}`, 30, 3600);
    if (perIp.limited) this.tooMany('Too many requests from your network. Try again later.', perIp.ttl);

    // Staff portal: only existing, active staff may log in. We still answer identically so the
    // endpoint cannot be used to discover which numbers belong to staff.
    let allowed = true;
    if (input.audience === 'staff') {
      const user = await this.prisma.user.findUnique({ where: { phone } });
      allowed = !!user && user.status === 'ACTIVE' && STAFF_ROLES.concat(Role.UNIVERSITY_REP).includes(user.role as Role);
    } else {
      const user = await this.prisma.user.findUnique({ where: { phone } });
      if (user && user.status !== 'ACTIVE') allowed = false;
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const challenge = await this.prisma.otpChallenge.create({
      data: {
        phone,
        channel: input.channel,
        purpose: input.audience === 'staff' ? 'STAFF_LOGIN' : 'STUDENT_LOGIN',
        codeHash: 'pending',
        maxAttempts: env.AUTH_OTP_MAX_ATTEMPTS,
        expiresAt: new Date(Date.now() + env.AUTH_OTP_TTL_SECONDS * 1000),
        allowed,
        ip: input.ip,
        userAgent: input.userAgent?.slice(0, 300),
      },
    });
    await this.prisma.otpChallenge.update({ where: { id: challenge.id }, data: { codeHash: this.hash(challenge.id, code) } });

    let channelUsed = input.channel;
    if (allowed) {
      try {
        const r = await this.http.post<OtpDeliveryResult>('notification', '/internal/otp', {
          phone,
          channel: input.channel,
          code,
          ttlMinutes: Math.round(env.AUTH_OTP_TTL_SECONDS / 60),
          fallbackToSms: true,
        });
        channelUsed = r.channel;
        await this.prisma.otpChallenge.update({
          where: { id: challenge.id },
          data: { deliveryStatus: r.delivered ? 'SENT' : 'FAILED', deliveryProvider: r.provider, channel: r.channel },
        });
        if (!r.delivered) throw new Error('not delivered');
      } catch (err) {
        this.logger.error(`OTP delivery failed for ${maskPhone(phone)}: ${(err as Error).message}`);
        await this.redis.client.del(cooldownKey);
        throw new HttpException(
          { message: 'We could not send the code right now. Please try again or use the other channel.', code: 'OTP_DELIVERY_FAILED' },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    }

    return {
      challengeId: challenge.id,
      channel: channelUsed,
      maskedPhone: maskPhone(phone),
      expiresInSeconds: env.AUTH_OTP_TTL_SECONDS,
      resendAfterSeconds: env.AUTH_OTP_RESEND_COOLDOWN_SECONDS,
      ...(env.AUTH_DEV_ECHO_OTP && !this.config.isProd && allowed ? { devCode: code } : {}),
    };
  }

  /** Verifies the code and returns the (possibly newly created) user. */
  async verify(input: { challengeId: string; code: string; ip: string }): Promise<{ user: User; isNewUser: boolean; audience: Audience }> {
    const perIp = await this.redis.hit(`otp:verify-ip:${input.ip}`, 60, 600);
    if (perIp.limited) this.tooMany('Too many attempts. Try again later.', perIp.ttl);

    const invalid = () =>
      new UnauthorizedException({ message: 'The code is incorrect or has expired', code: 'OTP_INVALID' });

    // Atomically count the attempt before comparing, so parallel guesses cannot exceed maxAttempts.
    const bumped = await this.prisma.otpChallenge.updateMany({
      where: { id: input.challengeId, consumedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: this.config.env.AUTH_OTP_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (bumped.count !== 1) throw invalid();
    const ch = await this.prisma.otpChallenge.findUniqueOrThrow({ where: { id: input.challengeId } });

    const expected = Buffer.from(ch.codeHash, 'hex');
    const actual = Buffer.from(this.hash(ch.id, input.code), 'hex');
    if (!ch.allowed || expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      const left = ch.maxAttempts - ch.attempts;
      throw new UnauthorizedException({
        message: left > 0 ? `The code is incorrect. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many wrong attempts. Request a new code.',
        code: 'OTP_INVALID',
        attemptsLeft: Math.max(left, 0),
      });
    }

    const consumed = await this.prisma.otpChallenge.updateMany({
      where: { id: ch.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) throw invalid();

    const audience: Audience = ch.purpose === 'STAFF_LOGIN' ? 'staff' : 'student';
    const existing = await this.prisma.user.findUnique({ where: { phone: ch.phone } });
    if (existing) {
      const user = await this.prisma.user.update({
        where: { id: existing.id },
        data: { lastLoginAt: new Date(), phoneVerifiedAt: existing.phoneVerifiedAt ?? new Date(), preferredOtpChannel: ch.channel },
      });
      return { user, isNewUser: false, audience };
    }
    if (audience === 'staff') throw invalid();

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          phone: ch.phone,
          role: Role.ATHLETE,
          phoneVerifiedAt: new Date(),
          lastLoginAt: new Date(),
          preferredOtpChannel: ch.channel,
        },
      });
      await this.outbox.add<UserRegisteredEvent>(tx, Events.UserRegistered, {
        userId: created.id,
        phone: created.phone,
        role: Role.ATHLETE,
      });
      return created;
    });
    return { user, isNewUser: true, audience };
  }
}
