import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHash, createPublicKey, randomBytes, randomUUID } from 'node:crypto';
import { exportJWK, importPKCS8, SignJWT, type JWK, type KeyLike } from 'jose';
import { APP_CONFIG } from '@aci/nest-common';
import type { AuthConfig } from './config';
import { PrismaService } from './prisma.service';
import type { User } from './generated/prisma';
import type { Audience } from './dto';

export interface IssuedTokens {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  sessionId: string;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly keyPromise: Promise<KeyLike>;
  readonly kid: string;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AuthConfig,
    private readonly prisma: PrismaService,
  ) {
    this.keyPromise = importPKCS8(config.jwtPrivateKey, 'RS256');
    this.kid = sha256(config.jwtPublicKey).slice(0, 16);
  }

  async jwks(): Promise<{ keys: JWK[] }> {
    const jwk = await exportJWK(createPublicKey(this.config.jwtPublicKey));
    return { keys: [{ ...jwk, kid: this.kid, alg: 'RS256', use: 'sig' }] };
  }

  private async signAccess(user: User, sessionId: string): Promise<string> {
    return new SignJWT({
      role: user.role,
      phone: user.phone,
      sid: sessionId,
      uni: user.universityId ?? undefined,
      name: user.fullName ?? undefined,
      typ: 'access',
    })
      .setProtectedHeader({ alg: 'RS256', kid: this.kid })
      .setSubject(user.id)
      .setIssuer(this.config.jwtIssuer)
      .setAudience(this.config.jwtAudience)
      .setIssuedAt()
      .setJti(randomUUID())
      .setExpirationTime(`${this.config.env.AUTH_ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(await this.keyPromise);
  }

  async createSession(user: User, audience: Audience, meta: { ip?: string; userAgent?: string }): Promise<IssuedTokens> {
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + this.config.env.AUTH_REFRESH_TOKEN_TTL_DAYS * 86400_000);
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: sha256(refreshToken),
        family: randomUUID(),
        audience,
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 300),
        expiresAt,
      },
    });
    return {
      accessToken: await this.signAccess(user, session.id),
      accessTokenExpiresIn: this.config.env.AUTH_ACCESS_TOKEN_TTL_SECONDS,
      refreshToken,
      refreshTokenExpiresAt: expiresAt,
      sessionId: session.id,
    };
  }

  /**
   * Refresh-token rotation. Each refresh token is single-use; presenting an already-rotated
   * token means it was stolen, so the entire session family is revoked.
   */
  async rotate(refreshToken: string, meta: { ip?: string; userAgent?: string }): Promise<IssuedTokens & { user: User }> {
    const hash = sha256(refreshToken);
    const session = await this.prisma.session.findUnique({ where: { refreshTokenHash: hash }, include: { user: true } });
    if (!session) throw new UnauthorizedException({ message: 'Session expired, please log in again', code: 'SESSION_INVALID' });

    if (session.revokedAt) {
      if (session.revokedReason === 'ROTATED') {
        this.logger.warn(`Refresh token reuse detected for user ${session.userId}; revoking family ${session.family}`);
        await this.prisma.session.updateMany({
          where: { family: session.family, revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: 'REUSE_DETECTED' },
        });
      }
      throw new UnauthorizedException({ message: 'Session expired, please log in again', code: 'SESSION_INVALID' });
    }
    if (session.expiresAt < new Date() || session.user.status !== 'ACTIVE') {
      throw new UnauthorizedException({ message: 'Session expired, please log in again', code: 'SESSION_INVALID' });
    }

    const newToken = randomBytes(48).toString('base64url');
    const next = await this.prisma.$transaction(async (tx) => {
      const created = await tx.session.create({
        data: {
          userId: session.userId,
          refreshTokenHash: sha256(newToken),
          family: session.family,
          audience: session.audience,
          ip: meta.ip,
          userAgent: meta.userAgent?.slice(0, 300),
          expiresAt: session.expiresAt, // absolute lifetime does not extend on rotation
          lastUsedAt: new Date(),
        },
      });
      // Conditional update guards against two concurrent refreshes with the same token.
      const res = await tx.session.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'ROTATED', replacedById: created.id },
      });
      if (res.count !== 1) throw new UnauthorizedException({ message: 'Session already refreshed', code: 'SESSION_RACE' });
      return created;
    });

    return {
      user: session.user,
      accessToken: await this.signAccess(session.user, next.id),
      accessTokenExpiresIn: this.config.env.AUTH_ACCESS_TOKEN_TTL_SECONDS,
      refreshToken: newToken,
      refreshTokenExpiresAt: next.expiresAt,
      sessionId: next.id,
    };
  }

  async revokeByToken(refreshToken: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { refreshTokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'LOGOUT' },
    });
  }

  async revokeAllForUser(userId: string, reason: string): Promise<number> {
    const r = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return r.count;
  }
}
