import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Request } from 'express';

type WebhookRequest = Request & { rawBody?: Buffer };

const REPLAY_TOLERANCE_SECONDS = 300; // 5 minutes — mirrors AgroTrack's ServiceAPIKeyAuthentication

/**
 * Verifies inbound webhook deliveries from AgroTrack. Mirror image of
 * accounts.authentication.ServiceAPIKeyAuthentication on the Django side —
 * same "{timestamp}.{raw body}" HMAC scheme, but AGROTRACK_WEBHOOK_SECRET
 * instead of the service-auth secret, since these are separate credentials
 * for separate directions of trust.
 */
@Injectable()
export class AgroTrackWebhookGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<WebhookRequest>();

    const signature = request.headers['x-signature'];
    const timestamp = request.headers['x-timestamp'];
    const rawBody = request.rawBody;

    // Express types a repeated header as string[] — that's already a
    // malformed request for a header that should only ever be sent once,
    // so reject it outright rather than guessing how to coerce it.
    if (
      !rawBody ||
      typeof signature !== 'string' ||
      typeof timestamp !== 'string'
    ) {
      throw new UnauthorizedException('Missing webhook signature headers.');
    }

    const secret = this.configService.get<string>('AGROTRACK_WEBHOOK_SECRET');
    if (!secret) {
      throw new UnauthorizedException(
        'Webhook verification is not configured.',
      );
    }

    const requestTime = Number(timestamp);
    if (!Number.isFinite(requestTime)) {
      throw new UnauthorizedException('Invalid timestamp.');
    }
    if (Math.abs(Date.now() / 1000 - requestTime) > REPLAY_TOLERANCE_SECONDS) {
      throw new UnauthorizedException(
        'Request timestamp outside the allowed window.',
      );
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(Buffer.concat([Buffer.from(`${timestamp}.`), rawBody]))
      .digest('hex');

    const provided = Buffer.from(String(signature));
    const expected = Buffer.from(expectedSignature);
    if (
      provided.length !== expected.length ||
      !crypto.timingSafeEqual(provided, expected)
    ) {
      throw new UnauthorizedException('Invalid webhook signature.');
    }

    return true;
  }
}
