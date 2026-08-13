import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface SignedRequestHeaders {
  'X-Api-Key': string;
  'X-Timestamp': string;
  'X-Signature': string;
}

export interface SignedRequest {
  headers: SignedRequestHeaders;
  /**
   * The exact bytes that were signed. Whatever HTTP call eventually sends
   * this request (Package 3) MUST send this literal string as the body —
   * letting an HTTP client re-serialize the original object risks a
   * different byte sequence (key order, whitespace) than what was hashed,
   * which AgroTrack's signature check would then reject.
   */
  rawBody: string;
}

/**
 * Signs outbound requests to AgroTrack's service-to-service endpoints.
 *
 * Nothing calls this yet — the actual create-order HTTP call is Package 3 —
 * but the signing contract is fixed now so both sides agree on it: HMAC-SHA256
 * over "{unix timestamp}.{raw JSON body}", matching AgroTrack's
 * ServiceAPIKeyAuthentication (accounts/authentication.py) header-for-header.
 */
@Injectable()
export class AgroTrackClientService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Omit `body` for a bodyless request (e.g. the reconciliation GET) — Django's
   * ServiceAPIKeyAuthentication signs over the request's actual raw bytes,
   * which is empty for a GET with no payload, not the string "undefined" or
   * "{}". Passing an empty object here would sign the wrong bytes and every
   * such call would fail verification.
   */
  signRequest(body?: unknown): SignedRequest {
    const apiKey = this.configService.get<string>('AGROTRACK_API_KEY');
    const secret = this.configService.get<string>('AGROTRACK_HMAC_SECRET');

    if (!apiKey || !secret) {
      throw new Error(
        'AgroTrack integration is not configured (AGROTRACK_API_KEY / AGROTRACK_HMAC_SECRET).',
      );
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = body === undefined ? '' : JSON.stringify(body);
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    return {
      headers: {
        'X-Api-Key': apiKey,
        'X-Timestamp': timestamp,
        'X-Signature': signature,
      },
      rawBody,
    };
  }
}
