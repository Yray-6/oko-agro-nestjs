import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  AgroTrackCancellationRejectedError,
  AgroTrackIntegrationService,
  AgroTrackSenderUnresolvedError,
} from './agrotrack-integration.service';
import { AgroTrackClientService } from './agrotrack-client.service';

describe('AgroTrackIntegrationService', () => {
  let service: AgroTrackIntegrationService;
  let signRequestMock: jest.Mock;

  const config: Record<string, string> = {
    AGROTRACK_BASE_URL: 'https://agrotrack-production.up.railway.app/',
  };

  beforeEach(async () => {
    signRequestMock = jest.fn().mockReturnValue({
      headers: { 'X-Api-Key': 'k', 'X-Timestamp': '1', 'X-Signature': 's' },
      rawBody: '{"signed":true}',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgroTrackIntegrationService,
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

    service = module.get<AgroTrackIntegrationService>(
      AgroTrackIntegrationService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockFetchOnce = (status: number, body: unknown) => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }) as any;
  };

  describe('estimateCost', () => {
    it('strips the trailing slash from AGROTRACK_BASE_URL and posts the right fields', async () => {
      mockFetchOnce(200, { success: true, data: { estimated_cost: 19500 } });

      const result = await service.estimateCost({
        pickupState: 'Kano',
        pickupLga: 'Kano Municipal',
        deliveryState: 'Lagos',
        deliveryLga: 'Ikeja',
      });

      expect(result).toEqual({ estimated_cost: 19500 });
      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe(
        'https://agrotrack-production.up.railway.app/api/v1/public/estimate/',
      );
      const sentBody = JSON.parse(init.body);
      expect(sentBody).toMatchObject({
        pickup_state: 'Kano',
        pickup_lga: 'Kano Municipal',
        delivery_state: 'Lagos',
        delivery_lga: 'Ikeja',
        cargo_priority: 'standard',
      });
    });

    it('throws with the server message on a non-2xx response', async () => {
      mockFetchOnce(400, { success: false, message: 'Invalid state.' });
      await expect(
        service.estimateCost({
          pickupState: 'X',
          pickupLga: 'Y',
          deliveryState: 'Z',
          deliveryLga: 'W',
        }),
      ).rejects.toThrow('Invalid state.');
    });
  });

  describe('createOrder', () => {
    it('signs the payload and sends the exact rawBody, not a re-serialized object', async () => {
      mockFetchOnce(201, {
        success: true,
        data: {
          tracking_number: 'AGT30349900',
          id: 42,
          base_rate: '15000.00',
          distance_surcharge: '4500.00',
          total_cost: '19500.00',
        },
      });

      const result = await service.createOrder({ oko_request_id: 'abc' });

      expect(result).toEqual({
        trackingNumber: 'AGT30349900',
        orderId: 42,
        baseRate: '15000.00',
        distanceSurcharge: '4500.00',
        totalCost: '19500.00',
      });
      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe(
        'https://agrotrack-production.up.railway.app/api/v1/integrations/oko/orders/',
      );
      expect(init.body).toBe('{"signed":true}');
      expect(init.headers['X-Api-Key']).toBe('k');
    });

    it('raises AgroTrackSenderUnresolvedError on 409, distinct from other failures', async () => {
      mockFetchOnce(409, {
        success: false,
        message: 'Sender could not be resolved.',
      });
      await expect(service.createOrder({})).rejects.toBeInstanceOf(
        AgroTrackSenderUnresolvedError,
      );
    });

    it('raises a plain Error on other failures', async () => {
      mockFetchOnce(500, { success: false, message: 'Server error.' });
      const error = await service.createOrder({}).catch((e) => e);
      expect(error).not.toBeInstanceOf(AgroTrackSenderUnresolvedError);
      expect(error.message).toBe('Server error.');
    });
  });

  describe('getOrderStatus', () => {
    it('signs the request bodyless — no payload argument to signRequest', async () => {
      mockFetchOnce(200, {
        success: true,
        data: {
          id: 42,
          tracking_number: 'AGT30349900',
          status: 'in_transit',
          updated_at: '2026-08-14T09:12:00Z',
          estimated_delivery_date: '2026-09-15',
        },
      });

      const result = await service.getOrderStatus('req-1');

      expect(signRequestMock).toHaveBeenCalledWith();
      expect(result).toEqual({
        id: 42,
        trackingNumber: 'AGT30349900',
        status: 'in_transit',
        updatedAt: '2026-08-14T09:12:00Z',
        estimatedDeliveryDate: '2026-09-15',
      });
      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe(
        'https://agrotrack-production.up.railway.app/api/v1/integrations/oko/orders/req-1/',
      );
      expect(init.method).toBe('GET');
    });

    it('defaults estimatedDeliveryDate to null when AgroTrack omits it', async () => {
      mockFetchOnce(200, {
        success: true,
        data: {
          id: 42,
          tracking_number: 'AGT30349900',
          status: 'in_transit',
          updated_at: '2026-08-14T09:12:00Z',
          estimated_delivery_date: null,
        },
      });

      const result = await service.getOrderStatus('req-1');

      expect(result?.estimatedDeliveryDate).toBeNull();
    });

    it('returns null on 404 instead of throwing — no order yet is an expected outcome', async () => {
      mockFetchOnce(404, {
        success: false,
        message: 'No order found for this oko_request_id.',
      });
      const result = await service.getOrderStatus('req-missing');
      expect(result).toBeNull();
    });

    it('throws on other failures', async () => {
      mockFetchOnce(500, { success: false, message: 'Server error.' });
      await expect(service.getOrderStatus('req-1')).rejects.toThrow(
        'Server error.',
      );
    });
  });

  describe('cancelOrder', () => {
    it('signs the request bodyless and posts to the cancel endpoint', async () => {
      mockFetchOnce(200, { success: true, message: 'Order cancelled.' });

      await service.cancelOrder('req-1');

      expect(signRequestMock).toHaveBeenCalledWith();
      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe(
        'https://agrotrack-production.up.railway.app/api/v1/integrations/oko/orders/req-1/cancel/',
      );
      expect(init.method).toBe('POST');
    });

    it('raises AgroTrackCancellationRejectedError on 409, distinct from other failures', async () => {
      mockFetchOnce(409, { success: false, message: 'Already in transit.' });
      await expect(service.cancelOrder('req-1')).rejects.toBeInstanceOf(
        AgroTrackCancellationRejectedError,
      );
    });

    it('raises a plain Error on other failures', async () => {
      mockFetchOnce(500, { success: false, message: 'Server error.' });
      const error = await service.cancelOrder('req-1').catch((e) => e);
      expect(error).not.toBeInstanceOf(AgroTrackCancellationRejectedError);
      expect(error.message).toBe('Server error.');
    });

    it('resolves without a value on success (nothing to return)', async () => {
      mockFetchOnce(200, { success: true, message: 'Order cancelled.' });
      await expect(service.cancelOrder('req-1')).resolves.toBeUndefined();
    });
  });

  describe('issueSsoHandoffToken', () => {
    it('signs oko_user_id and returns the token/expiry on success', async () => {
      mockFetchOnce(201, {
        success: true,
        data: { token: 'abc123', expires_at: '2026-08-14T09:14:00Z' },
      });

      const result = await service.issueSsoHandoffToken('farmer-1');

      expect(result).toEqual({
        token: 'abc123',
        expiresAt: '2026-08-14T09:14:00Z',
      });
      expect(signRequestMock).toHaveBeenCalledWith({ oko_user_id: 'farmer-1' });
      const [url] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe(
        'https://agrotrack-production.up.railway.app/api/v1/integrations/oko/sso/handoff-token/',
      );
    });

    it('returns null on 404 — no linked account is an expected outcome, not an error', async () => {
      mockFetchOnce(404, {
        success: false,
        message: 'No AgroTrack account is linked for this Oko user yet.',
      });
      const result = await service.issueSsoHandoffToken('farmer-unlinked');
      expect(result).toBeNull();
    });

    it('throws on other failures', async () => {
      mockFetchOnce(500, { success: false, message: 'Server error.' });
      await expect(service.issueSsoHandoffToken('farmer-1')).rejects.toThrow(
        'Server error.',
      );
    });
  });
});
