import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { BuyRequestsService } from './buy-requests.service';
import { UnresolvableAddressError } from 'src/integrations/agrotrack/pricing/local-shipping-cost-estimator.service';

describe('BuyRequestsService.estimateShippingCost', () => {
  const buildService = (estimateImpl: jest.Mock) => {
    const localShippingCostEstimator = { estimate: estimateImpl };
    const service = new BuyRequestsService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      localShippingCostEstimator as any,
    );
    return { service };
  };

  const dto = {
    pickupState: 'Kano',
    pickupLga: 'Kano Municipal',
    deliveryState: 'Lagos',
    deliveryLga: 'Ikeja',
    cargoPriority: 'standard',
  };

  it('returns the estimate in camelCase, wrapped in the standard response envelope', async () => {
    const estimateImpl = jest.fn().mockResolvedValue({
      estimated_cost: 19500,
      base_rate: 15000,
      distance_charge: 4500,
      distance_km: 100,
      priority_multiplier: 1.0,
      distance_method: 'osrm',
    });
    const { service } = buildService(estimateImpl);

    const result = await service.estimateShippingCost(dto as any);

    expect(estimateImpl).toHaveBeenCalledWith({
      pickupState: 'Kano',
      pickupLga: 'Kano Municipal',
      deliveryState: 'Lagos',
      deliveryLga: 'Ikeja',
      cargoPriority: 'standard',
    });
    expect(result).toEqual({
      statusCode: 200,
      message: 'Cost estimate calculated successfully.',
      data: {
        estimatedCost: 19500,
        baseRate: 15000,
        distanceCharge: 4500,
        distanceKm: 100,
        priorityMultiplier: 1.0,
        distanceMethod: 'osrm',
      },
    });
  });

  it('turns UnresolvableAddressError into a 400 BadRequestException', async () => {
    const estimateImpl = jest
      .fn()
      .mockRejectedValue(
        new UnresolvableAddressError('Could not locate pickup address'),
      );
    const { service } = buildService(estimateImpl);

    await expect(service.estimateShippingCost(dto as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('turns an unexpected error into a 500 InternalServerErrorException', async () => {
    const estimateImpl = jest.fn().mockRejectedValue(new Error('boom'));
    const { service } = buildService(estimateImpl);

    await expect(service.estimateShippingCost(dto as any)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
