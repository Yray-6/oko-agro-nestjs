import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgroTrackClientService } from '../agrotrack-client.service';

export interface PricingConfig {
  baseRate: number;
  distanceSurchargePerKm: number;
  expressMultiplier: number;
  sameDayMultiplier: number;
}

// Mirrors admin_api/models.py PlatformSettings field defaults on the
// AgroTrack side — used only if the config endpoint has never been reached.
const FALLBACK_CONFIG: PricingConfig = {
  baseRate: 15000,
  distanceSurchargePerKm: 45,
  expressMultiplier: 1.5,
  sameDayMultiplier: 2.0,
};

const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Fetches and caches AgroTrack's admin-configurable pricing knobs (Platform
 * Settings: base_rate, distance_surcharge_per_km, express_multiplier,
 * same_day_multiplier). These only change when an AgroTrack admin edits
 * Platform Settings, so this is refreshed on a TTL rather than per estimate —
 * refetching on every call would defeat the point of estimating locally.
 *
 * This only ever feeds a PREVIEW (LocalShippingCostEstimatorService). The
 * authoritative price is always computed server-side by AgroTrack itself at
 * order-creation time, so a stale cache here can produce a slightly-off
 * preview but can never affect what's actually billed.
 */
@Injectable()
export class AgroTrackPricingConfigService {
  private readonly logger = new Logger(AgroTrackPricingConfigService.name);
  private cached: { config: PricingConfig; fetchedAt: number } | null = null;

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

  async getConfig(): Promise<PricingConfig> {
    if (this.cached && Date.now() - this.cached.fetchedAt < CACHE_TTL_MS) {
      return this.cached.config;
    }

    try {
      const config = await this.fetchConfig();
      this.cached = { config, fetchedAt: Date.now() };
      return config;
    } catch (err) {
      const fallback = this.cached?.config ?? FALLBACK_CONFIG;
      this.logger.warn(
        `Failed to refresh AgroTrack pricing config, using ${this.cached ? 'stale cache' : 'hardcoded fallback'}: ${(err as Error).message}`,
      );
      return fallback;
    }
  }

  private async fetchConfig(): Promise<PricingConfig> {
    const { headers } = this.agroTrackClient.signRequest();
    const response = await fetch(
      `${this.baseUrl}/api/v1/integrations/oko/pricing-config/`,
      {
        method: 'GET',
        headers: { ...headers },
      },
    );

    const body = (await response.json()) as {
      success: boolean;
      message?: string;
      data?: {
        base_rate: number;
        distance_surcharge_per_km: number;
        express_multiplier: number;
        same_day_multiplier: number;
      };
    };

    if (!response.ok || !body.data) {
      throw new Error(
        body.message ??
          `AgroTrack pricing config fetch failed with status ${response.status}`,
      );
    }

    return {
      baseRate: body.data.base_rate,
      distanceSurchargePerKm: body.data.distance_surcharge_per_km,
      expressMultiplier: body.data.express_multiplier,
      sameDayMultiplier: body.data.same_day_multiplier,
    };
  }
}
