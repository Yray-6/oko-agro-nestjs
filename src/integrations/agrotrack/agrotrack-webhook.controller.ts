import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AgroTrackWebhookGuard } from './guards/agrotrack-webhook.guard';
import { AgroTrackWebhookService } from './agrotrack-webhook.service';
import { WebhookOrderStatusChangedDto } from './dtos/webhook-event.dto';

/**
 * Receives outbound status webhooks from AgroTrack. Not a browser-facing
 * endpoint — authenticated by HMAC signature (AgroTrackWebhookGuard), not JWT.
 */
@ApiTags('agrotrack-integration')
@Controller('integrations/agrotrack')
export class AgroTrackWebhookController {
  constructor(private readonly webhookService: AgroTrackWebhookService) {}

  @Post('webhook')
  @UseGuards(AgroTrackWebhookGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Receive an AgroTrack status webhook (signed, not JWT-authenticated)',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed or already seen (idempotent)',
  })
  async receiveWebhook(@Body() dto: WebhookOrderStatusChangedDto) {
    return this.webhookService.handleStatusChanged(dto);
  }
}
