import { Module } from '@nestjs/common';
import { CoreModule } from '@aci/nest-common';
import { config } from './config';
import { PrismaService } from './prisma.service';
import { LedgerService } from './ledger.service';
import { FinanceEvents } from './finance.events';
import { AnalyticsService } from './analytics.service';
import { ReportsService } from './reports.service';
import { FinanceController, InternalFxController, ReportsController } from './finance.controller';

@Module({
  imports: [CoreModule.forRoot({ config, prisma: PrismaService })],
  controllers: [FinanceController, ReportsController, InternalFxController],
  providers: [LedgerService, FinanceEvents, AnalyticsService, ReportsService],
})
export class AppModule {}
