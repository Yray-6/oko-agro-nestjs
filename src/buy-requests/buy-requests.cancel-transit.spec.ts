import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BuyRequestsService } from './buy-requests.service';
import { UserRole } from 'src/users/entities/user.entity';
import { AgroTrackStatus } from './entities/buy-request.entity';
import { AgroTrackCancellationRejectedError } from 'src/integrations/agrotrack/agrotrack-integration.service';

describe('BuyRequestsService.cancelAgroTrackShipment', () => {
  const farmer = { id: 'farmer-1', role: UserRole.FARMER };
  const processor = { id: 'processor-1', role: UserRole.PROCESSOR };
  const admin = { id: 'admin-1', role: UserRole.ADMIN };

  const buildService = (buyRequest: any, cancelOrderImpl?: jest.Mock) => {
    const buyRequestsRepository = {
      findOne: jest.fn().mockResolvedValue(buyRequest),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };
    const agroTrackIntegration = {
      cancelOrder: cancelOrderImpl ?? jest.fn().mockResolvedValue(undefined),
    };
    const service = new BuyRequestsService(
      buyRequestsRepository as any, {} as any, {} as any, {} as any, {} as any,
      {} as any, {} as any, {} as any, {} as any, {} as any,
      agroTrackIntegration as any,
    );
    return { service, buyRequestsRepository, agroTrackIntegration };
  };

  it('cancels the shipment and marks agroTrackStatus cancelled', async () => {
    const buyRequest = { id: 'br-1', seller: farmer, agroTrackTrackingNumber: 'AGT30349900' };
    const { service, buyRequestsRepository, agroTrackIntegration } = buildService(buyRequest);

    const result = await service.cancelAgroTrackShipment('br-1', farmer as any);

    expect(agroTrackIntegration.cancelOrder).toHaveBeenCalledWith('br-1');
    expect(buyRequestsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ agroTrackStatus: AgroTrackStatus.CANCELLED }),
    );
    expect(result.data.agroTrackStatus).toBe(AgroTrackStatus.CANCELLED);
  });

  it('surfaces a 409 from AgroTrack as ConflictException, not a silent success', async () => {
    const buyRequest = { id: 'br-1', seller: farmer, agroTrackTrackingNumber: 'AGT30349900' };
    const { service, buyRequestsRepository } = buildService(
      buyRequest,
      jest.fn().mockRejectedValue(new AgroTrackCancellationRejectedError('Already in transit.')),
    );

    await expect(service.cancelAgroTrackShipment('br-1', farmer as any)).rejects.toThrow(ConflictException);
    expect(buyRequestsRepository.save).not.toHaveBeenCalled();
  });

  it('rejects a request with nothing linked to cancel', async () => {
    const buyRequest = { id: 'br-1', seller: farmer, agroTrackTrackingNumber: null };
    const { service, agroTrackIntegration } = buildService(buyRequest);

    await expect(service.cancelAgroTrackShipment('br-1', farmer as any)).rejects.toThrow(BadRequestException);
    expect(agroTrackIntegration.cancelOrder).not.toHaveBeenCalled();
  });

  it('rejects a processor who is not the farmer on this request', async () => {
    const buyRequest = { id: 'br-1', seller: farmer, agroTrackTrackingNumber: 'AGT30349900' };
    const { service } = buildService(buyRequest);

    await expect(service.cancelAgroTrackShipment('br-1', processor as any)).rejects.toThrow(ForbiddenException);
  });

  it('allows an admin to cancel on behalf of the farmer', async () => {
    const buyRequest = { id: 'br-1', seller: farmer, agroTrackTrackingNumber: 'AGT30349900' };
    const { service, buyRequestsRepository } = buildService(buyRequest);

    await service.cancelAgroTrackShipment('br-1', admin as any);

    expect(buyRequestsRepository.save).toHaveBeenCalled();
  });

  it('throws NotFoundException for an unknown buy request', async () => {
    const { service } = buildService(null);
    await expect(service.cancelAgroTrackShipment('missing', farmer as any)).rejects.toThrow(NotFoundException);
  });
});
