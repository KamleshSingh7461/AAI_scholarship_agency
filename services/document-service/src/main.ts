import { bootstrapService } from '@aci/nest-common';
import { AppModule } from './app.module';
import { config } from './config';

// Internal callers store generated PDFs/reports as base64 JSON, hence the larger limit.
void bootstrapService(AppModule, { config, title: 'document service', jsonLimit: '30mb' });
