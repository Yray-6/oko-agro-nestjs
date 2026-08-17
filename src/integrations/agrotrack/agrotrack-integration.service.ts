import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgroTrackClientService } from './agrotrack-client.service';

/**
 * Thrown when AgroTrack returns 409 — the farmer's sender identity couldn't
 * be resolved or provisioned. The caller should fall back to the manual
 * "Arrange transit" flow, not treat this as a generic failure.
 */
export class AgroTrackSenderUnresolvedError extends Error {}

/**
 * Thrown when AgroTrack returns 409 on cancel — the shipment is already
 * in transit or further along. The caller should surface this as a real
 * failure ("call the dispatcher"), not retry or silently succeed.
 */
export class AgroTrackCancellationRejectedError extends Error {}

export interface AgroTrackOrderResult {
  trackingNumber: string;
  orderId: number;
  /**
   * Kept as strings, not numbers — these are Postgres numeric/decimal values
   * on both sides (Django's DecimalField serializes as a string, BuyRequest's
   * matching columns are typed decimal/string too, same as paymentAmount).
   * Converting to a JS number risks float-precision drift on money.
   */
  baseRate: string;
  distanceSurcharge: string;
  totalCost: string;
}

export interface AgroTrackEstimate {
  estimated_cost: number;
  base_rate: number;
  distance_charge: number;
  distance_km: number;
  priority_multiplier: number;
  distance_method: string;
}

export interface AgroTrackOrderStatus {
  id: number;
  trackingNumber: string;
  status: string;
  updatedAt: string;
}

export interface AgroTrackSsoHandoff {
  token: string;
  expiresAt: string;
}

/** AgroTrack's standard {success, message, data} response envelope. */
interface AgroTrackEnvelope<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

/**
 * fetch()'s response.json() is typed Promise<any> — this is the one place
 * that `any` gets cast to a known shape, so every call site below works
 * with real types instead of letting `any` spread through the file.
 */
async function readEnvelope<T = unknown>(
  response: Response,
): Promise<AgroTrackEnvelope<T>> {
  return (await response.json()) as AgroTrackEnvelope<T>;
}

/**
 * Calls AgroTrack's public estimate endpoint and the service-authenticated
 * create endpoint (accounts.authentication.ServiceAPIKeyAuthentication /
 * oko_integration.views.OkoOrderCreateView on the Django side).
 */
@Injectable()
export class AgroTrackIntegrationService {
  private readonly logger = new Logger(AgroTrackIntegrationService.name);

  constructor(
    private readonly agroTrackClient: AgroTrackClientService,
    private readonly configService: ConfigService,
  ) {}

  private get baseUrl(): string {
    const url = this.configService.get<string>('AGROTRACK_BASE_URL');
    if (!url) {
      throw new Error('AGROTRACK_BASE_URL is not configured.');
    }
    return url.replace(/\/$/, '');
  }

  async estimateCost(input: {
    pickupState: string;
    pickupLga: string;
    deliveryState: string;
    deliveryLga: string;
    cargoPriority?: string;
  }): Promise<AgroTrackEstimate> {
    const response = await fetch(`${this.baseUrl}/api/v1/public/estimate/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pickup_state: input.pickupState,
        pickup_lga: input.pickupLga,
        delivery_state: input.deliveryState,
        delivery_lga: input.deliveryLga,
        cargo_priority: input.cargoPriority ?? 'standard',
      }),
    });

    const body = await readEnvelope<AgroTrackEstimate>(response);
    if (!response.ok || !body.data) {
      throw new Error(body.message ?? 'AgroTrack estimate request failed');
    }
    return body.data;
  }

  async createOrder(
    payload: Record<string, unknown>,
  ): Promise<AgroTrackOrderResult> {
    const { headers, rawBody } = this.agroTrackClient.signRequest(payload);

    const response = await fetch(
      `${this.baseUrl}/api/v1/integrations/oko/orders/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: rawBody,
      },
    );

    const body = await readEnvelope<{
      tracking_number: string;
      id: number;
      base_rate: string;
      distance_surcharge: string;
      total_cost: string;
    }>(response);

    if (response.status === 409) {
      throw new AgroTrackSenderUnresolvedError(
        body.message ?? 'Sender could not be resolved',
      );
    }
    if (!response.ok || !body.data) {
      this.logger.error(
        `AgroTrack create failed (${response.status}): ${body.message ?? ''}`,
      );
      throw new Error(
        body.message ??
          `AgroTrack create failed with status ${response.status}`,
      );
    }

    return {
      trackingNumber: body.data.tracking_number,
      orderId: body.data.id,
      baseRate: body.data.base_rate,
      distanceSurcharge: body.data.distance_surcharge,
      totalCost: body.data.total_cost,
    };
  }

  /**
   * Pull side of reconciliation — the backstop for when the outbound webhook
   * mechanism has failed systemically. Returns null for a 404 (no order yet
   * for this oko_request_id) rather than throwing, since that's an expected,
   * non-error outcome for a reconciliation sweep.
   */
  async getOrderStatus(
    okoRequestId: string,
  ): Promise<AgroTrackOrderStatus | null> {
    const { headers } = this.agroTrackClient.signRequest();

    const response = await fetch(
      `${this.baseUrl}/api/v1/integrations/oko/orders/${okoRequestId}/`,
      {
        method: 'GET',
        headers: { ...headers },
      },
    );

    if (response.status === 404) {
      return null;
    }

    const body = await readEnvelope<{
      id: number;
      tracking_number: string;
      status: string;
      updated_at: string;
    }>(response);
    if (!response.ok || !body.data) {
      this.logger.error(
        `AgroTrack status pull failed (${response.status}): ${body.message ?? ''}`,
      );
      throw new Error(
        body.message ??
          `AgroTrack status pull failed with status ${response.status}`,
      );
    }

    return {
      id: body.data.id,
      trackingNumber: body.data.tracking_number,
      status: body.data.status,
      updatedAt: body.data.updated_at,
    };
  }

  /**
   * Cancels a not-yet-picked-up shipment. Idempotent on AgroTrack's side —
   * calling this twice is safe. Bodyless request, same signing path as
   * getOrderStatus.
   */
  async cancelOrder(okoRequestId: string): Promise<void> {
    const { headers } = this.agroTrackClient.signRequest();

    const response = await fetch(
      `${this.baseUrl}/api/v1/integrations/oko/orders/${okoRequestId}/cancel/`,
      {
        method: 'POST',
        headers: { ...headers },
      },
    );

    if (response.status === 409) {
      const body = await readEnvelope(response);
      throw new AgroTrackCancellationRejectedError(
        body.message ?? 'Shipment can no longer be cancelled automatically',
      );
    }
    if (!response.ok) {
      const body = await readEnvelope(response);
      this.logger.error(
        `AgroTrack cancel failed (${response.status}): ${body.message ?? ''}`,
      );
      throw new Error(
        body.message ??
          `AgroTrack cancel failed with status ${response.status}`,
      );
    }
  }

  /**
   * Mints a short-lived, single-use token so a farmer already authenticated
   * on Oko can skip a second login on AgroTrack (Package 6). Returns null on
   * 404 — the farmer has no linked AgroTrack account yet (e.g. never
   * arranged a shipment), which is an expected outcome, not an error.
   */
  async issueSsoHandoffToken(
    okoUserId: string,
  ): Promise<AgroTrackSsoHandoff | null> {
    const { headers, rawBody } = this.agroTrackClient.signRequest({
      oko_user_id: okoUserId,
    });

    const response = await fetch(
      `${this.baseUrl}/api/v1/integrations/oko/sso/handoff-token/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: rawBody,
      },
    );

    if (response.status === 404) {
      return null;
    }

    const body = await readEnvelope<{ token: string; expires_at: string }>(
      response,
    );
    if (!response.ok || !body.data) {
      this.logger.error(
        `AgroTrack SSO handoff-token request failed (${response.status}): ${body.message ?? ''}`,
      );
      throw new Error(
        body.message ??
          `AgroTrack SSO handoff-token request failed with status ${response.status}`,
      );
    }

    return {
      token: body.data.token,
      expiresAt: body.data.expires_at,
    };
  }
}
