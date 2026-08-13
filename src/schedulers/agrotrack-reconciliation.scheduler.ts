import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BuyRequest,
  AgroTrackStatus,
} from 'src/buy-requests/entities/buy-request.entity';
import { AgroTrackIntegrationService } from 'src/integrations/agrotrack/agrotrack-integration.service';

// The backstop for the outbound webhook mechanism failing systemically —
// NOT the primary correction path. The webhook outbox on AgroTrack's side
// already retries ordinary delivery failures with backoff; this just
// catches the case where that stops working entirely and nobody notices.
// Long interval on purpose — this isn't meant to compete with the webhook.
const STALE_AFTER_MINUTES = 60;

@Injectable()
export class AgroTrackReconciliationScheduler {
  private readonly logger = new Logger(AgroTrackReconciliationScheduler.name);

  constructor(
    @InjectRepository(BuyRequest)
    private readonly buyRequestsRepository: Repository<BuyRequest>,
    private readonly agroTrackIntegration: AgroTrackIntegrationService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async reconcileStaleOrders() {
    if (process.env.RUN_SCHEDULER !== 'true') {
      this.logger.debug('Scheduler disabled (RUN_SCHEDULER not set to true)');
      return;
    }

    const cutoff = new Date(Date.now() - STALE_AFTER_MINUTES * 60 * 1000);

    const staleRequests = await this.buyRequestsRepository
      .createQueryBuilder('buyRequest')
      .where('buyRequest.agroTrackTrackingNumber IS NOT NULL')
      .andWhere(
        'buyRequest.agroTrackStatus IS NULL OR buyRequest.agroTrackStatus NOT IN (:...doneStatuses)',
        {
          doneStatuses: [AgroTrackStatus.COMPLETED, AgroTrackStatus.CANCELLED],
        },
      )
      .andWhere(
        '(buyRequest.agroTrackSyncedAt IS NULL OR buyRequest.agroTrackSyncedAt < :cutoff)',
        { cutoff },
      )
      .andWhere('buyRequest.isDeleted = FALSE')
      .getMany();

    if (!staleRequests.length) {
      this.logger.debug('No stale AgroTrack-linked orders to reconcile');
      return;
    }

    this.logger.log(
      `Reconciling ${staleRequests.length} stale AgroTrack order(s)`,
    );

    for (const buyRequest of staleRequests) {
      try {
        const remoteStatus = await this.agroTrackIntegration.getOrderStatus(
          buyRequest.id,
        );
        if (!remoteStatus) {
          continue; // AgroTrack has no record for this id — nothing to reconcile yet
        }

        buyRequest.agroTrackStatus = remoteStatus.status as AgroTrackStatus;
        buyRequest.agroTrackOrderId = remoteStatus.id;
        buyRequest.agroTrackSyncedAt = new Date();
        await this.buyRequestsRepository.save(buyRequest);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Reconciliation failed for buyRequest ${buyRequest.id}: ${message}`,
        );
      }
    }
  }
}
