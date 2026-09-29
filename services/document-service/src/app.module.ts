import { Module } from '@nestjs/common';
import { CoreModule } from '@aci/nest-common';
import { config } from './config';
import { PrismaService } from './prisma.service';
import { StorageService } from './storage.service';
import { DocumentsAdminController, DocumentsController, InternalDocumentsController } from './documents.controller';

@Module({
  imports: [CoreModule.forRoot({ config, prisma: PrismaService })],
  // Admin controller first so /documents/admin/* is not captured by /documents/:id
  controllers: [DocumentsAdminController, DocumentsController, InternalDocumentsController],
  providers: [StorageService],
})
export class AppModule {}
