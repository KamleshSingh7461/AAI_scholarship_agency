import { bootstrapService } from '@aci/nest-common';
import { AppModule } from './app.module';
import { config } from './config';

// rawBody: DocuSign Connect HMAC is computed over the exact request bytes.
void bootstrapService(AppModule, { config, title: 'esign service', rawBody: true });
