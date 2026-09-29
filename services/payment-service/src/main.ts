import { bootstrapService } from '@aci/nest-common';
import { AppModule } from './app.module';
import { config } from './config';

// rawBody: webhook signatures are computed over the exact bytes the gateway sent.
void bootstrapService(AppModule, { config, title: 'payment service', rawBody: true });
