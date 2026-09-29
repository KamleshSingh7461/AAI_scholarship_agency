import { Body, Controller, ForbiddenException, Get, HttpCode, Inject, Patch, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Role, STAFF_ROLES } from '@aci/contracts';
import { API, APP_CONFIG, ClientIp, CurrentUser, Public, type AuthUser } from '@aci/nest-common';
import type { AuthConfig } from './config';
import { RequestOtpDto, UpdateMeDto, VerifyOtpDto } from './dto';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';
import { PrismaService } from './prisma.service';
import type { User } from './generated/prisma';

export const REFRESH_COOKIE = 'aci_rt';

export function publicUser(u: User) {
  return {
    id: u.id,
    phone: u.phone,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    status: u.status,
    universityId: u.universityId,
    preferredOtpChannel: u.preferredOtpChannel,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
  };
}

function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

@ApiTags('auth')
@Controller(`${API}/auth`)
export class AuthController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AuthConfig,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  private setRefreshCookie(res: Response, token: string, expires: Date) {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this.config.isProd,
      sameSite: 'strict',
      path: `/${API}/auth`,
      expires,
      domain: this.config.env.AUTH_COOKIE_DOMAIN || undefined,
    });
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE, { path: `/${API}/auth`, domain: this.config.env.AUTH_COOKIE_DOMAIN || undefined });
  }

  /** Browsers cannot add custom headers cross-site without a CORS preflight, so this blocks CSRF on cookie-auth endpoints. */
  private assertCsrfHeader(req: Request) {
    if (req.headers['x-aci-client'] !== 'web') {
      throw new ForbiddenException({ message: 'Missing client header', code: 'CSRF' });
    }
  }

  @Public()
  @Post('otp/request')
  @HttpCode(200)
  requestOtp(@Body() dto: RequestOtpDto, @ClientIp() ip: string, @Req() req: Request) {
    return this.otp.request({ ...dto, ip, userAgent: req.headers['user-agent'] });
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(200)
  async verifyOtp(@Body() dto: VerifyOtpDto, @ClientIp() ip: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { user, isNewUser, audience } = await this.otp.verify({ ...dto, ip });
    const t = await this.tokens.createSession(user, audience, { ip, userAgent: req.headers['user-agent'] });
    this.setRefreshCookie(res, t.refreshToken, t.refreshTokenExpiresAt);
    return { accessToken: t.accessToken, expiresIn: t.accessTokenExpiresIn, isNewUser, user: publicUser(user) };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @ClientIp() ip: string, @Res({ passthrough: true }) res: Response) {
    this.assertCsrfHeader(req);
    const token = readCookie(req, REFRESH_COOKIE);
    if (!token) throw new UnauthorizedException({ message: 'Not logged in', code: 'SESSION_INVALID' });
    try {
      const t = await this.tokens.rotate(token, { ip, userAgent: req.headers['user-agent'] });
      this.setRefreshCookie(res, t.refreshToken, t.refreshTokenExpiresAt);
      return { accessToken: t.accessToken, expiresIn: t.accessTokenExpiresIn, user: publicUser(t.user) };
    } catch (e) {
      this.clearRefreshCookie(res);
      throw e;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.assertCsrfHeader(req);
    const token = readCookie(req, REFRESH_COOKIE);
    if (token) await this.tokens.revokeByToken(token);
    this.clearRefreshCookie(res);
  }

  @Get('me')
  async me(@CurrentUser() u: AuthUser) {
    return publicUser(await this.prisma.user.findUniqueOrThrow({ where: { id: u.id } }));
  }

  @Patch('me')
  async updateMe(@CurrentUser() u: AuthUser, @Body() dto: UpdateMeDto) {
    return publicUser(await this.prisma.user.update({ where: { id: u.id }, data: dto }));
  }

  /** Log out every device. */
  @Post('me/sessions/revoke-all')
  @HttpCode(200)
  async revokeAll(@CurrentUser() u: AuthUser) {
    return { revoked: await this.tokens.revokeAllForUser(u.id, 'USER_REVOKED_ALL') };
  }

  @Public()
  @Get('.well-known/jwks.json')
  jwks() {
    return this.tokens.jwks();
  }

  /** Lets the admin frontend know which roles count as staff without hardcoding. */
  @Public()
  @Get('roles')
  roles() {
    return { staff: STAFF_ROLES, all: Object.values(Role) };
  }
}
