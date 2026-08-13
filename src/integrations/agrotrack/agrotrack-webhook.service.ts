import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgroTrackWebhookEvent } from './entities/agrotrack-webhook-event.entity';
import { BuyRequest, AgroTrackStatus } from 'src/buy-requests/entities/buy-request.entity';
import { WebhookOrderStatusChangedDto } from './dtos/webhook-event.dto';

@Injectable()
export class AgroTrackWebhookService {
  private readonly logger = new Logger(AgroTrackWebhookService.name);

  constructor(
    @InjectRepository(AgroTrackWebhookEvent) private readonly eventsRepository: Repository<AgroTrackWebhookEvent>,
    @InjectRepository(BuyRequest) private readonly buyRequestsRepository: Repository<BuyRequest>,
  ) {}

  async handleStatusChanged(dto: WebhookOrderStatusChangedDto): Promise<{ statusCode: number; message: string }> {
    const alreadyProcessed = await this.eventsRepository.findOne({ where: { eventId: dto.event_id } });
    if (alreadyProcessed) {
      return { statusCode: 200, message: 'Event already processed' };
    }

    const buyRequest = await this.buyRequestsRepository.findOne({ where: { id: dto.oko_request_id } });

    if (!buyRequest) {
      this.logger.warn(`Webhook for unknown oko_request_id ${dto.oko_request_id} (event ${dto.event_id})`);
    } else {
      const occurredAt = new Date(dto.occurred_at);
      const isStale = buyRequest.agroTrackSyncedAt != null && occurredAt < buyRequest.agroTrackSyncedAt;

      if (isStale) {
        this.logger.warn(
          `Ignoring out-of-order webhook for buyRequest ${buyRequest.id}: ` +
          `event occurred_at ${dto.occurred_at} is older than the last synced status`,
        );
      } else {
        // Deliberately limited to these four fields — never orderState or
        // paymentConfirmed. Logistics status must never drive payment state.
        buyRequest.agroTrackStatus = dto.status as AgroTrackStatus;
        buyRequest.agroTrackOrderId = dto.order_id;
        buyRequest.agroTrackTrackingNumber = dto.tracking_number;
        buyRequest.agroTrackSyncedAt = occurredAt;
        await this.buyRequestsRepository.save(buyRequest);
      }
    }

    await this.eventsRepository.save(this.eventsRepository.create({ eventId: dto.event_id }));

    return { statusCode: 200, message: 'Webhook processed' };
  }
}
