import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgroTrackClientService } from './agrotrack-client.service';
import { AgroTrackIntegrationService } from './agrotrack-integration.service';
import { AgroTrackWebhookService } from './agrotrack-webhook.service';
import { AgroTrackWebhookController } from './agrotrack-webhook.controller';
import { AgroTrackSsoController } from './agrotrack-sso.controller';
import { AgroTrackWebhookEvent } from './entities/agrotrack-webhook-event.entity';
import { BuyRequest } from 'src/buy-requests/entities/buy-request.entity';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AgroTrackWebhookEvent, BuyRequest]),
    AuthModule,
  ],
  controllers: [AgroTrackWebhookController, AgroTrackSsoController],
  providers: [
    AgroTrackClientService,
    AgroTrackIntegrationService,
    AgroTrackWebhookService,
  ],
  exports: [AgroTrackClientService, AgroTrackIntegrationService],
})
export class AgroTrackClientModule {}
