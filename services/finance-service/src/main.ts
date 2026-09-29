import { bootstrapService } from '@aci/nest-common';
import { AppModule } from './app.module';
import { config } from './config';

void bootstrapService(AppModule, { config, title: 'finance service' });
