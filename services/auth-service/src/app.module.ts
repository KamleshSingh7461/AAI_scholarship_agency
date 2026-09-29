import { Module } from '@nestjs/common';
import { CoreModule } from '@aci/nest-common';
import { config } from './config';
import { PrismaService } from './prisma.service';
import { AuthController } from './auth.controller';
import { InternalUsersController, UsersController } from './users.controller';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';

@Module({
  imports: [CoreModule.forRoot({ config, prisma: PrismaService })],
  controllers: [AuthController, UsersController, InternalUsersController],
  providers: [OtpService, TokenService],
})
export class AppModule {}
