import { AgroTrackReconciliationScheduler } from './agrotrack-reconciliation.scheduler';
import { AgroTrackStatus } from 'src/buy-requests/entities/buy-request.entity';

describe('AgroTrackReconciliationScheduler', () => {
  const staleRequest = { id: 'br-1', agroTrackTrackingNumber: 'AGT1', agroTrackStatus: AgroTrackStatus.PENDING_PICKUP, agroTrackSyncedAt: null };

  const buildScheduler = (staleRequests: any[], getOrderStatusImpl?: jest.Mock) => {
    const queryBuilder: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(staleRequests),
    };
    const buyRequestsRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };
    const agroTrackIntegration = {
      getOrderStatus: getOrderStatusImpl ?? jest.fn().mockResolvedValue({
        id: 42, trackingNumber: 'AGT1', status: 'in_transit', updatedAt: '2026-08-14T09:00:00Z',
      }),
    };
    const scheduler = new AgroTrackReconciliationScheduler(buyRequestsRepository as any, agroTrackIntegration as any);
    return { scheduler, buyRequestsRepository, agroTrackIntegration };
  };

  const withScheduler = process.env.RUN_SCHEDULER;
  beforeEach(() => { process.env.RUN_SCHEDULER = 'true'; });
  afterEach(() => { process.env.RUN_SCHEDULER = withScheduler; });

  it('does nothing when RUN_SCHEDULER is not true', async () => {
    process.env.RUN_SCHEDULER = 'false';
    const { scheduler, buyRequestsRepository } = buildScheduler([staleRequest]);
    await scheduler.reconcileStaleOrders();
    expect(buyRequestsRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('pulls status for each stale request and updates agroTrackStatus/agroTrackOrderId/agroTrackSyncedAt', async () => {
    const { scheduler, buyRequestsRepository, agroTrackIntegration } = buildScheduler([staleRequest]);

    await scheduler.reconcileStaleOrders();

    expect(agroTrackIntegration.getOrderStatus).toHaveBeenCalledWith('br-1');
    const saved = buyRequestsRepository.save.mock.calls[0][0];
    expect(saved.agroTrackStatus).toBe('in_transit');
    expect(saved.agroTrackOrderId).toBe(42);
    expect(saved.agroTrackSyncedAt).toBeInstanceOf(Date);
  });

  it('skips a request AgroTrack has no record of (404 -> null) without erroring', async () => {
    const { scheduler, buyRequestsRepository } = buildScheduler(
      [staleRequest], jest.fn().mockResolvedValue(null),
    );
    await scheduler.reconcileStaleOrders();
    expect(buyRequestsRepository.save).not.toHaveBeenCalled();
  });

  it("one request's failure doesn't stop the rest of the batch from being processed", async () => {
    const second = { ...staleRequest, id: 'br-2' };
    const getOrderStatus = jest.fn()
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce({ id: 43, trackingNumber: 'AGT2', status: 'delivered', updatedAt: '2026-08-14T09:00:00Z' });

    const { scheduler, buyRequestsRepository } = buildScheduler([staleRequest, second], getOrderStatus);

    await scheduler.reconcileStaleOrders();

    expect(getOrderStatus).toHaveBeenCalledTimes(2);
    expect(buyRequestsRepository.save).toHaveBeenCalledTimes(1); // only the second one succeeded
  });

  it('does nothing when there are no stale requests', async () => {
    const { scheduler, buyRequestsRepository } = buildScheduler([]);
    await scheduler.reconcileStaleOrders();
    expect(buyRequestsRepository.save).not.toHaveBeenCalled();
  });
});
