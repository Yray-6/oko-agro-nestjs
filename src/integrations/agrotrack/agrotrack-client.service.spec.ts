import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { AgroTrackClientService } from './agrotrack-client.service';

describe('AgroTrackClientService', () => {
  const config: Record<string, string> = {
    AGROTRACK_API_KEY: 'test-key',
    AGROTRACK_HMAC_SECRET: 'test-secret',
  };

  const buildService = async (overrides: Record<string, string> = config) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgroTrackClientService,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => overrides[key] },
        },
      ],
    }).compile();

    return module.get<AgroTrackClientService>(AgroTrackClientService);
  };

  it('signs a request with headers that verify against an independently computed HMAC', async () => {
    const service = await buildService();
    const payload = { oko_request_id: 'b6e2', cargo_weight: 1200 };

    const { headers, rawBody } = service.signRequest(payload);

    expect(headers['X-Api-Key']).toBe('test-key');
    expect(rawBody).toBe(JSON.stringify(payload));

    const expectedSignature = crypto
      .createHmac('sha256', config.AGROTRACK_HMAC_SECRET)
      .update(`${headers['X-Timestamp']}.${rawBody}`)
      .digest('hex');

    expect(headers['X-Signature']).toBe(expectedSignature);
  });

  it('produces a fresh timestamp and signature on every call — not a cached/reused value', async () => {
    const service = await buildService();
    const first = service.signRequest({ a: 1 });
    const second = service.signRequest({ a: 2 });

    expect(first.headers['X-Signature']).not.toBe(
      second.headers['X-Signature'],
    );
  });

  it('throws if AGROTRACK_API_KEY is missing', async () => {
    const service = await buildService({ ...config, AGROTRACK_API_KEY: '' });
    expect(() => service.signRequest({})).toThrow(/not configured/);
  });

  it('throws if AGROTRACK_HMAC_SECRET is missing', async () => {
    const service = await buildService({
      ...config,
      AGROTRACK_HMAC_SECRET: '',
    });
    expect(() => service.signRequest({})).toThrow(/not configured/);
  });

  it('signs an empty raw body when called with no argument — for a bodyless GET', async () => {
    const service = await buildService();
    const { headers, rawBody } = service.signRequest();

    expect(rawBody).toBe('');
    const expectedSignature = crypto
      .createHmac('sha256', config.AGROTRACK_HMAC_SECRET)
      .update(`${headers['X-Timestamp']}.`)
      .digest('hex');
    expect(headers['X-Signature']).toBe(expectedSignature);
  });
});
