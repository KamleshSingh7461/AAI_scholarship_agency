import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CoreModule } from '@aci/nest-common';
import { config } from './config';
import { PrismaService } from './prisma.service';
import { Clients } from './clients';
import { ApplicationStateMachine } from './state-machine';
import { ApplicationService } from './application.service';
import { AwardService } from './award.service';
import { LifecycleService } from './lifecycle.service';
import { ApplicationEventHandlers } from './event.handlers';
import { MyApplicationsController, StaffApplicationsController } from './applications.controller';
import { InternalAwardsController, MyAwardsController, RenewalsController, StaffAwardsController } from './awards.controller';

@Module({
  imports: [CoreModule.forRoot({ config, prisma: PrismaService }), ScheduleModule.forRoot()],
  // "mine" controllers first so /applications/mine and /awards/mine are not captured by /:id
  controllers: [
    MyApplicationsController,
    StaffApplicationsController,
    MyAwardsController,
    RenewalsController,
    StaffAwardsController,
    InternalAwardsController,
  ],
  providers: [Clients, ApplicationStateMachine, ApplicationService, AwardService, LifecycleService, ApplicationEventHandlers],
})
export class AppModule {}
