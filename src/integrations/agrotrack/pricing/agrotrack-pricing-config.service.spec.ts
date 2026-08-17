import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AgroTrackPricingConfigService } from './agrotrack-pricing-config.service';
import { AgroTrackClientService } from '../agrotrack-client.service';

describe('AgroTrackPricingConfigService', () => {
  let service: AgroTrackPricingConfigService;
  let signRequestMock: jest.Mock;

  const config: Record<string, string> = {
    AGROTRACK_BASE_URL: 'https://agrotrack-production.up.railway.app/',
  };

  beforeEach(async () => {
    signRequestMock = jest.fn().mockReturnValue({
      headers: { 'X-Api-Key': 'k', 'X-Timestamp': '1', 'X-Signature': 's' },
      rawBody: '',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgroTrackPricingConfigService,
        {
          provide: AgroTrackClientService,
          useValue: { signRequest: signRequestMock },
        },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => config[key] },
        },
      ],
    }).compile();

    service = module.get<AgroTrackPricingConfigService>(
      AgroTrackPricingConfigService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  const mockFetchOnce = (status: number, body: unknown) => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }) as any;
  };

  it('fetches and maps the pricing config from AgroTrack, stripping the trailing slash from the base URL', async () => {
    mockFetchOnce(200, {
      success: true,
      data: {
        base_rate: 15000,
        distance_surcharge_per_km: 45,
        express_multiplier: 1.5,
        same_day_multiplier: 2.0,
      },
    });

    const result = await service.getConfig();

    expect(result).toEqual({
      baseRate: 15000,
      distanceSurchargePerKm: 45,
      expressMultiplier: 1.5,
      sameDayMultiplier: 2.0,
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://agrotrack-production.up.railway.app/api/v1/integrations/oko/pricing-config/',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('caches the config and does not refetch within the TTL', async () => {
    mockFetchOnce(200, {
      success: true,
      data: {
        base_rate: 15000,
        distance_surcharge_per_km: 45,
        express_multiplier: 1.5,
        same_day_multiplier: 2.0,
      },
    });

    await service.getConfig();
    await service.getConfig();

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('refetches after the TTL expires', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick'] });
    mockFetchOnce(200, {
      success: true,
      data: {
        base_rate: 15000,
        distance_surcharge_per_km: 45,
        express_multiplier: 1.5,
        same_day_multiplier: 2.0,
      },
    });

    await service.getConfig();
    jest.advanceTimersByTime(6 * 60 * 1000);
    await service.getConfig();

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('falls back to the hardcoded default config when never successfully fetched', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

    const result = await service.getConfig();

    expect(result).toEqual({
      baseRate: 15000,
      distanceSurchargePerKm: 45,
      expressMultiplier: 1.5,
      sameDayMultiplier: 2.0,
    });
  });

  it('falls back to the last-known-good cache, not the hardcoded default, if a later refresh fails', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick'] });
    mockFetchOnce(200, {
      success: true,
      data: {
        base_rate: 20000,
        distance_surcharge_per_km: 50,
        express_multiplier: 1.6,
        same_day_multiplier: 2.1,
      },
    });
    await service.getConfig();

    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
    jest.advanceTimersByTime(6 * 60 * 1000);
    const result = await service.getConfig();

    expect(result).toEqual({
      baseRate: 20000,
      distanceSurchargePerKm: 50,
      expressMultiplier: 1.6,
      sameDayMultiplier: 2.1,
    });
  });

  it('throws a clear error internally on a non-2xx response (caught and turned into a fallback by getConfig)', async () => {
    mockFetchOnce(500, { success: false, message: 'Internal error' });

    const result = await service.getConfig();

    // No prior cache and a failed fetch -> hardcoded fallback, not a thrown error.
    expect(result).toEqual({
      baseRate: 15000,
      distanceSurchargePerKm: 45,
      expressMultiplier: 1.5,
      sameDayMultiplier: 2.0,
    });
  });
});
