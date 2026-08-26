import { AgroTrackWebhookService } from './agrotrack-webhook.service';
import { AgroTrackStatus } from 'src/buy-requests/entities/buy-request.entity';
import { WebhookOrderStatusChangedDto } from './dtos/webhook-event.dto';

describe('AgroTrackWebhookService', () => {
  const basePayload: WebhookOrderStatusChangedDto = {
    event: 'order.status_changed',
    event_id: 'evt-1',
    occurred_at: '2026-08-14T09:12:00Z',
    oko_request_id: 'br-1',
    tracking_number: 'AGT30349900',
    order_id: 123,
    status: 'in_transit',
    previous_status: 'pending_pickup',
  };

  const buildService = (buyRequest: any, existingEvent: any = null) => {
    const eventsRepository = {
      findOne: jest.fn().mockResolvedValue(existingEvent),
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const buyRequestsRepository = {
      findOne: jest.fn().mockResolvedValue(buyRequest),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };
    const service = new AgroTrackWebhookService(
      eventsRepository as any,
      buyRequestsRepository as any,
    );
    return { service, eventsRepository, buyRequestsRepository };
  };

  it('updates agroTrackStatus/agroTrackOrderId/agroTrackSyncedAt only — never orderState or paymentConfirmed', async () => {
    const buyRequest = {
      id: 'br-1',
      agroTrackSyncedAt: null,
      orderState: 'awaiting_shipping',
      paymentConfirmed: false,
    };
    const { service, buyRequestsRepository } = buildService(buyRequest);

    await service.handleStatusChanged(basePayload);

    const saved = buyRequestsRepository.save.mock.calls[0][0];
    expect(saved.agroTrackStatus).toBe(AgroTrackStatus.IN_TRANSIT);
    expect(saved.agroTrackOrderId).toBe(123);
    expect(saved.agroTrackTrackingNumber).toBe('AGT30349900');
    expect(saved.agroTrackSyncedAt).toEqual(new Date('2026-08-14T09:12:00Z'));
    expect(saved.orderState).toBe('awaiting_shipping'); // untouched
    expect(saved.paymentConfirmed).toBe(false); // untouched
  });

  it('is idempotent — a repeat event_id is a no-op, not a second update', async () => {
    const { service, buyRequestsRepository } = buildService(
      { id: 'br-1', agroTrackSyncedAt: null },
      { eventId: 'evt-1' }, // already processed
    );

    const result = await service.handleStatusChanged(basePayload);

    expect(buyRequestsRepository.save).not.toHaveBeenCalled();
    expect(result.message).toMatch(/already processed/i);
  });

  it('ignores an out-of-order webhook older than the last synced status', async () => {
    const buyRequest = {
      id: 'br-1',
      agroTrackSyncedAt: new Date('2026-08-14T10:00:00Z'),
      agroTrackStatus: AgroTrackStatus.DELIVERED,
    };
    const { service, buyRequestsRepository, eventsRepository } =
      buildService(buyRequest);

    await service.handleStatusChanged(basePayload); // occurred_at is earlier than agroTrackSyncedAt

    expect(buyRequestsRepository.save).not.toHaveBeenCalled();
    // still recorded as processed, so a retry of this same stale event doesn't loop forever
    expect(eventsRepository.save).toHaveBeenCalled();
  });

  it('still records the event as processed for an unknown oko_request_id, without throwing', async () => {
    const { service, buyRequestsRepository, eventsRepository } =
      buildService(null);

    const result = await service.handleStatusChanged(basePayload);

    expect(buyRequestsRepository.save).not.toHaveBeenCalled();
    expect(eventsRepository.save).toHaveBeenCalled();
    expect(result.statusCode).toBe(200);
  });

  it('applies estimated_delivery_date when the payload carries one', async () => {
    const buyRequest = { id: 'br-1', agroTrackSyncedAt: null };
    const { service, buyRequestsRepository } = buildService(buyRequest);

    await service.handleStatusChanged({
      ...basePayload,
      estimated_delivery_date: '2026-09-15',
    });

    const saved = buyRequestsRepository.save.mock.calls[0][0];
    expect(saved.agroTrackEstimatedDeliveryDate).toBe('2026-09-15');
  });

  it('clears agroTrackEstimatedDeliveryDate when the payload explicitly carries null', async () => {
    const buyRequest = {
      id: 'br-1',
      agroTrackSyncedAt: null,
      agroTrackEstimatedDeliveryDate: '2026-09-01',
    };
    const { service, buyRequestsRepository } = buildService(buyRequest);

    await service.handleStatusChanged({
      ...basePayload,
      estimated_delivery_date: null,
    });

    const saved = buyRequestsRepository.save.mock.calls[0][0];
    expect(saved.agroTrackEstimatedDeliveryDate).toBeNull();
  });

  it('leaves agroTrackEstimatedDeliveryDate untouched when the payload omits the field entirely', async () => {
    const buyRequest = {
      id: 'br-1',
      agroTrackSyncedAt: null,
      agroTrackEstimatedDeliveryDate: '2026-09-01',
    };
    const { service, buyRequestsRepository } = buildService(buyRequest);

    await service.handleStatusChanged(basePayload); // no estimated_delivery_date key at all

    const saved = buyRequestsRepository.save.mock.calls[0][0];
    expect(saved.agroTrackEstimatedDeliveryDate).toBe('2026-09-01');
  });
});
