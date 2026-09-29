import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import { Role } from '@aci/contracts';
import { APP_CONFIG } from '../tokens';
import type { BaseConfig } from '../config';
import { IS_INTERNAL, IS_PUBLIC, ROLES } from './decorators';
import { JwtVerifier } from './jwt-verifier';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Global guard. Every route is authenticated by default (zero-trust: services verify the
 * JWT themselves rather than trusting the gateway). Opt out with @Public() or @Internal().
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: JwtVerifier,
    @Inject(APP_CONFIG) private readonly config: BaseConfig,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    const targets = [ctx.getHandler(), ctx.getClass()];
    const req = ctx.switchToHttp().getRequest();

    if (this.reflector.getAllAndOverride<boolean>(IS_INTERNAL, targets)) {
      const token = req.headers['x-internal-token'];
      if (typeof token !== 'string' || !safeEqual(token, this.config.internalApiToken)) {
        throw new UnauthorizedException({ message: 'Internal endpoint', code: 'INTERNAL_ONLY' });
      }
      return true;
    }

    const header: string | undefined = req.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets);

    if (isPublic) {
      if (bearer) req.user = await this.verifier.verify(bearer).catch(() => undefined);
      return true;
    }
    if (!bearer) throw new UnauthorizedException({ message: 'Authentication required', code: 'AUTH_REQUIRED' });
    req.user = await this.verifier.verify(bearer);

    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, targets);
    if (roles?.length && req.user.role !== Role.SUPER_ADMIN && !roles.includes(req.user.role)) {
      throw new ForbiddenException({ message: 'You do not have access to this resource', code: 'FORBIDDEN' });
    }
    return true;
  }
}
