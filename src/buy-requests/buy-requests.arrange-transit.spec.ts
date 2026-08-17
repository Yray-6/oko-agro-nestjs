import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BuyRequestsService } from './buy-requests.service';
import { ArrangeTransitDto } from './dtos/arrange-transit.dto';
import { UserRole } from 'src/users/entities/user.entity';
import { AgroTrackSenderUnresolvedError } from 'src/integrations/agrotrack/agrotrack-integration.service';

describe('BuyRequestsService.arrangeTransitViaAgroTrack', () => {
  const farmer = {
    id: 'farmer-1',
    firstName: 'Amina',
    lastName: 'Bello',
    email: 'farmer@example.com',
    phoneNumber: '+2348000000000',
    role: UserRole.FARMER,
  };
  const processor = { id: 'processor-1', role: UserRole.PROCESSOR };
  const admin = { id: 'admin-1', role: UserRole.ADMIN };

  const dto: ArrangeTransitDto = {
    pickupState: 'Kano',
    pickupLga: 'Kano Municipal',
    pickupStreetAddress: 'Plot 4',
    pickupContactName: 'Amina Bello',
    pickupPhone: '+2348000000000',
    deliveryState: 'Lagos',
    deliveryLga: 'Ikeja',
    deliveryStreetAddress: '12 Allen Ave',
    deliveryName: 'Ikeja Processing Co',
    deliveryPhone: '+2348000000002',
    cargoType: 'Grains',
    cargoWeight: 500,
    cargoValue: 250000,
  };

  const buildService = (
    buyRequest: any,
    agroTrackOverrides: Partial<Record<'createOrder', jest.Mock>> = {},
  ) => {
    const buyRequestsRepository = {
      findOne: jest.fn().mockResolvedValue(buyRequest),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };
    const agroTrackIntegration = {
      createOrder: jest.fn().mockResolvedValue({
        trackingNumber: 'AGT30349900',
        orderId: 42,
        baseRate: '15000.00',
        distanceSurcharge: '4500.00',
        totalCost: '19500.00',
      }),
      ...agroTrackOverrides,
    };
    const service = new BuyRequestsService(
      buyRequestsRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      agroTrackIntegration as any,
      {} as any,
    );
    return { service, buyRequestsRepository, agroTrackIntegration };
  };

  it('creates the AgroTrack order and stores the tracking number/order id', async () => {
    const buyRequest = {
      id: 'br-1',
      requestNumber: 1042,
      seller: farmer,
      buyer: processor,
      agroTrackTrackingNumber: null,
    };
    const { service, buyRequestsRepository, agroTrackIntegration } =
      buildService(buyRequest);

    const result = await service.arrangeTransitViaAgroTrack(
      'br-1',
      dto,
      farmer as any,
    );

    expect(agroTrackIntegration.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        oko_request_id: 'br-1',
        oko_user_id: 'farmer-1',
        oko_user_email: 'farmer@example.com',
        oko_user_full_name: 'Amina Bello',
        pickup_state: 'Kano',
        delivery_state: 'Lagos',
      }),
    );
    expect(buyRequestsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        agroTrackTrackingNumber: 'AGT30349900',
        agroTrackOrderId: 42,
      }),
    );
    expect(result.data.agroTrackTrackingNumber).toBe('AGT30349900');
    expect(result.requiresManualFallback).toBeUndefined();
  });

  it('stores the AgroTrack-computed price so the frontend gets it immediately, not just the tracking number', async () => {
    const buyRequest = {
      id: 'br-1', requestNumber: 1042, seller: farmer, buyer: processor, agroTrackTrackingNumber: null,
    };
    const { service, buyRequestsRepository } = buildService(buyRequest);

    const result = await service.arrangeTransitViaAgroTrack('br-1', dto, farmer as any);

    const saved = buyRequestsRepository.save.mock.calls[0][0];
    expect(saved.agroTrackBaseRate).toBe('15000.00');
    expect(saved.agroTrackDistanceSurcharge).toBe('4500.00');
    expect(saved.agroTrackTotalCost).toBe('19500.00');
    expect(result.data.agroTrackTotalCost).toBe('19500.00');
  });

  it('never touches orderState or paymentConfirmed', async () => {
    const buyRequest = {
      id: 'br-1',
      requestNumber: 1042,
      seller: farmer,
      buyer: processor,
      agroTrackTrackingNumber: null,
      orderState: null,
      paymentConfirmed: false,
    };
    const { service, buyRequestsRepository } = buildService(buyRequest);

    await service.arrangeTransitViaAgroTrack('br-1', dto, farmer as any);

    const saved = buyRequestsRepository.save.mock.calls[0][0];
    expect(saved.orderState).toBeNull();
    expect(saved.paymentConfirmed).toBe(false);
  });

  it('falls back cleanly when AgroTrack cannot resolve a sender (409)', async () => {
    const buyRequest = {
      id: 'br-1',
      requestNumber: 1042,
      seller: farmer,
      buyer: processor,
      agroTrackTrackingNumber: null,
    };
    const { service, buyRequestsRepository } = buildService(buyRequest, {
      createOrder: jest
        .fn()
        .mockRejectedValue(new AgroTrackSenderUnresolvedError('nope')),
    });

    const result = await service.arrangeTransitViaAgroTrack(
      'br-1',
      dto,
      farmer as any,
    );

    expect(result.requiresManualFallback).toBe(true);
    expect(buyRequestsRepository.save).not.toHaveBeenCalled();
  });

  it("rejects a processor (non-farmer, non-admin) trying to arrange transit for someone else's request", async () => {
    const buyRequest = {
      id: 'br-1',
      requestNumber: 1042,
      seller: farmer,
      buyer: processor,
      agroTrackTrackingNumber: null,
    };
    const { service } = buildService(buyRequest);

    await expect(
      service.arrangeTransitViaAgroTrack('br-1', dto, processor as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows an admin to arrange transit on behalf of the farmer', async () => {
    const buyRequest = {
      id: 'br-1',
      requestNumber: 1042,
      seller: farmer,
      buyer: processor,
      agroTrackTrackingNumber: null,
    };
    const { service, buyRequestsRepository } = buildService(buyRequest);

    await service.arrangeTransitViaAgroTrack('br-1', dto, admin as any);

    expect(buyRequestsRepository.save).toHaveBeenCalled();
  });

  it('throws NotFoundException for an unknown buy request', async () => {
    const { service } = buildService(null);
    await expect(
      service.arrangeTransitViaAgroTrack('missing', dto, farmer as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('is idempotent — a request that already has a tracking number is not re-arranged', async () => {
    const buyRequest = {
      id: 'br-1',
      requestNumber: 1042,
      seller: farmer,
      buyer: processor,
      agroTrackTrackingNumber: 'AGT11111111',
    };
    const { service, buyRequestsRepository, agroTrackIntegration } =
      buildService(buyRequest);

    const result = await service.arrangeTransitViaAgroTrack(
      'br-1',
      dto,
      farmer as any,
    );

    expect(agroTrackIntegration.createOrder).not.toHaveBeenCalled();
    expect(buyRequestsRepository.save).not.toHaveBeenCalled();
    expect(result.message).toMatch(/already/i);
  });
});
