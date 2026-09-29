import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '@aci/contracts';

export const IS_PUBLIC = 'aci:is_public';
export const IS_INTERNAL = 'aci:is_internal';
export const ROLES = 'aci:roles';

/** No authentication required (a valid token is still parsed and attached if present). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Service-to-service only: requires the shared x-internal-token header, never reachable via the gateway. */
export const Internal = () => SetMetadata(IS_INTERNAL, true);

/** Restrict to the given roles. SUPER_ADMIN always passes. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export interface AuthUser {
  id: string;
  role: Role;
  phone: string;
  sessionId: string;
  universityId?: string;
  name?: string;
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser | undefined => {
  return ctx.switchToHttp().getRequest().user;
});

export const ClientIp = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest();
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
});
