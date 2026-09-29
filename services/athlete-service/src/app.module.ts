import { Module } from '@nestjs/common';
import { CoreModule } from '@aci/nest-common';
import { config } from './config';
import { PrismaService } from './prisma.service';
import { AthleteService } from './athlete.service';
import { AthleteAdminController, AthleteSelfController, InternalAthleteController } from './athlete.controller';

@Module({
  imports: [CoreModule.forRoot({ config, prisma: PrismaService })],
  // Self controller first so /athletes/me is not matched by /athletes/:id
  controllers: [AthleteSelfController, AthleteAdminController, InternalAthleteController],
  providers: [AthleteService],
})
export class AppModule {}
