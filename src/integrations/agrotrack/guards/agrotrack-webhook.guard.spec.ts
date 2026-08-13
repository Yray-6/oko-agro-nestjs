import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { AgroTrackWebhookGuard } from './agrotrack-webhook.guard';

describe('AgroTrackWebhookGuard', () => {
  const SECRET = 'webhook-secret';

  const buildGuard = (secret: string | undefined = SECRET) =>
    new AgroTrackWebhookGuard({ get: () => secret } as unknown as ConfigService);

  const buildContext = (overrides: {
    signature?: string; timestamp?: string; rawBody?: Buffer;
  }): ExecutionContext => {
    const request = {
      headers: {
        'x-signature': overrides.signature,
        'x-timestamp': overrides.timestamp,
      },
      rawBody: overrides.rawBody,
    };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  };

  const sign = (timestamp: string, rawBody: string) =>
    crypto.createHmac('sha256', SECRET).update(`${timestamp}.${rawBody}`).digest('hex');

  it('allows a correctly signed, fresh request', () => {
    const guard = buildGuard();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = Buffer.from('{"status":"in_transit"}');
    const signature = sign(timestamp, rawBody.toString());

    const result = guard.canActivate(buildContext({ signature, timestamp, rawBody }));
    expect(result).toBe(true);
  });

  it('rejects a request missing signature headers', () => {
    const guard = buildGuard();
    expect(() => guard.canActivate(buildContext({ rawBody: Buffer.from('{}') })))
      .toThrow(UnauthorizedException);
  });

  it('rejects when webhook verification is not configured', () => {
    const guard = buildGuard(undefined);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = Buffer.from('{}');
    expect(() =>
      guard.canActivate(buildContext({ signature: 'whatever', timestamp, rawBody })),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a tampered payload (signature no longer matches)', () => {
    const guard = buildGuard();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signedBody = Buffer.from('{"status":"in_transit"}');
    const signature = sign(timestamp, signedBody.toString());
    const tamperedBody = Buffer.from('{"status":"delivered"}');

    expect(() =>
      guard.canActivate(buildContext({ signature, timestamp, rawBody: tamperedBody })),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a stale timestamp outside the replay window', () => {
    const guard = buildGuard();
    const staleTimestamp = (Math.floor(Date.now() / 1000) - 1000).toString();
    const rawBody = Buffer.from('{}');
    const signature = sign(staleTimestamp, rawBody.toString());

    expect(() =>
      guard.canActivate(buildContext({ signature, timestamp: staleTimestamp, rawBody })),
    ).toThrow(UnauthorizedException);
  });
});
