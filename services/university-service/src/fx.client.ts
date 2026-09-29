import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, InternalHttpClient } from '@aci/nest-common';
import type { UniversityConfig } from './config';

/** Latest USD→INR rate from finance-service, cached for 10 minutes, with a configured fallback. */
@Injectable()
export class FxClient {
  private readonly logger = new Logger(FxClient.name);
  private cache?: { rate4: number; at: number };

  constructor(
    private readonly http: InternalHttpClient,
    @Inject(APP_CONFIG) private readonly config: UniversityConfig,
  ) {}

  async usdInrRate4(): Promise<number> {
    if (this.cache && Date.now() - this.cache.at < 600_000) return this.cache.rate4;
    try {
      const r = await this.http.get<{ usdInrRate4: number }>('finance', '/internal/fx/latest', { timeoutMs: 3000 });
      this.cache = { rate4: r.usdInrRate4, at: Date.now() };
      return r.usdInrRate4;
    } catch (err) {
      this.logger.warn(`FX lookup failed, using default: ${(err as Error).message}`);
      return Math.round(this.config.env.DEFAULT_USD_INR_RATE * 10000);
    }
  }
}
