import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { importSPKI, jwtVerify, type KeyLike } from 'jose';
import type { Role } from '@aci/contracts';
import { APP_CONFIG } from '../tokens';
import type { BaseConfig } from '../config';
import type { AuthUser } from './decorators';

export interface AccessTokenClaims {
  sub: string;
  role: Role;
  phone: string;
  sid: string;
  uni?: string;
  name?: string;
  typ: 'access';
}

@Injectable()
export class JwtVerifier {
  private keyPromise: Promise<KeyLike>;

  constructor(@Inject(APP_CONFIG) private readonly config: BaseConfig) {
    this.keyPromise = importSPKI(config.jwtPublicKey, 'RS256');
  }

  async verify(token: string): Promise<AuthUser> {
    try {
      const { payload } = await jwtVerify(token, await this.keyPromise, {
        issuer: this.config.jwtIssuer,
        audience: this.config.jwtAudience,
        algorithms: ['RS256'],
      });
      const c = payload as unknown as AccessTokenClaims;
      if (c.typ !== 'access' || !c.sub || !c.role) throw new Error('bad claims');
      return { id: c.sub, role: c.role, phone: c.phone, sessionId: c.sid, universityId: c.uni, name: c.name };
    } catch {
      throw new UnauthorizedException({ message: 'Invalid or expired access token', code: 'TOKEN_INVALID' });
    }
  }
}
