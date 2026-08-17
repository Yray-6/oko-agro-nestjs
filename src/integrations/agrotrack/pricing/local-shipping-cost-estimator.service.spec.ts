import { Test, TestingModule } from '@nestjs/testing';
import { LocalShippingCostEstimatorService } from './local-shipping-cost-estimator.service';
import { AgroTrackPricingConfigService } from './agrotrack-pricing-config.service';
import * as geoUtil from './geo.util';

jest.mock('./geo.util', () => ({
  ...jest.requireActual('./geo.util'),
  resolveDistance: jest.fn(),
}));

describe('LocalShippingCostEstimatorService', () => {
  let service: LocalShippingCostEstimatorService;
  let getConfigMock: jest.Mock;
  const resolveDistanceMock = geoUtil.resolveDistance as jest.Mock;

  beforeEach(async () => {
    getConfigMock = jest.fn().mockResolvedValue({
      baseRate: 15000,
      distanceSurchargePerKm: 45,
      expressMultiplier: 1.5,
      sameDayMultiplier: 2.0,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalShippingCostEstimatorService,
        {
          provide: AgroTrackPricingConfigService,
          useValue: { getConfig: getConfigMock },
        },
      ],
    }).compile();

    service = module.get<LocalShippingCostEstimatorService>(
      LocalShippingCostEstimatorService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('applies the standard formula: (base_rate + distance_km * per_km) * multiplier', async () => {
    resolveDistanceMock.mockResolvedValue({
      distanceKm: 100,
      method: 'osrm',
    });

    const result = await service.estimate({
      pickupState: 'Kano',
      pickupLga: 'Kano Municipal',
      deliveryState: 'Lagos',
      deliveryLga: 'Ikeja',
      cargoPriority: 'standard',
    });

    // (15000 + 100*45) * 1.0 = 19500
    expect(result).toEqual({
      estimated_cost: 19500,
      base_rate: 15000,
      distance_charge: 4500,
      distance_km: 100,
      priority_multiplier: 1.0,
      distance_method: 'osrm',
    });
  });

  it('applies the express multiplier from the fetched config', async () => {
    resolveDistanceMock.mockResolvedValue({
      distanceKm: 100,
      method: 'osrm',
    });

    const result = await service.estimate({
      pickupState: 'Kano',
      pickupLga: 'Kano Municipal',
      deliveryState: 'Lagos',
      deliveryLga: 'Ikeja',
      cargoPriority: 'express',
    });

    // (15000 + 4500) * 1.5 = 29250
    expect(result.estimated_cost).toBe(29250);
    expect(result.priority_multiplier).toBe(1.5);
  });

  it('applies the same_day multiplier from the fetched config', async () => {
    resolveDistanceMock.mockResolvedValue({
      distanceKm: 100,
      method: 'osrm',
    });

    const result = await service.estimate({
      pickupState: 'Kano',
      pickupLga: 'Kano Municipal',
      deliveryState: 'Lagos',
      deliveryLga: 'Ikeja',
      cargoPriority: 'same_day',
    });

    // (15000 + 4500) * 2.0 = 39000
    expect(result.estimated_cost).toBe(39000);
    expect(result.priority_multiplier).toBe(2.0);
  });

  it('defaults to standard priority when cargoPriority is omitted', async () => {
    resolveDistanceMock.mockResolvedValue({
      distanceKm: 100,
      method: 'osrm',
    });

    const result = await service.estimate({
      pickupState: 'Kano',
      pickupLga: 'Kano Municipal',
      deliveryState: 'Lagos',
      deliveryLga: 'Ikeja',
    });

    expect(result.priority_multiplier).toBe(1.0);
  });

  it('builds "{lga}, {state}" addresses for geocoding', async () => {
    resolveDistanceMock.mockResolvedValue({ distanceKm: 50, method: 'osrm' });

    await service.estimate({
      pickupState: 'Kano',
      pickupLga: 'Kano Municipal',
      deliveryState: 'Lagos',
      deliveryLga: 'Ikeja',
    });

    expect(resolveDistanceMock).toHaveBeenCalledWith(
      'Kano Municipal, Kano',
      'Ikeja, Lagos',
    );
  });

  it('propagates UnresolvableAddressError from resolveDistance', async () => {
    resolveDistanceMock.mockRejectedValue(
      new geoUtil.UnresolvableAddressError('cannot locate address'),
    );

    await expect(
      service.estimate({
        pickupState: 'Kano',
        pickupLga: 'Kano Municipal',
        deliveryState: 'Lagos',
        deliveryLga: 'Ikeja',
      }),
    ).rejects.toThrow(geoUtil.UnresolvableAddressError);
  });
});
