import { Module } from '@nestjs/common';
import { CoreModule } from '@aci/nest-common';
import { config } from './config';
import { PrismaService } from './prisma.service';
import { FxClient } from './fx.client';
import { ProgramService } from './program.service';
import { SeatService } from './seat.service';
import { AgreementAllocationController, UniversityController } from './university.controller';
import { CatalogController, InternalUniversityController, ProgramController } from './program.controller';

@Module({
  imports: [CoreModule.forRoot({ config, prisma: PrismaService })],
  controllers: [UniversityController, AgreementAllocationController, ProgramController, CatalogController, InternalUniversityController],
  providers: [FxClient, ProgramService, SeatService],
})
export class AppModule {}
