import { Injectable } from '@nestjs/common';
import { AgroTrackPricingConfigService } from './agrotrack-pricing-config.service';
import { resolveDistance, UnresolvableAddressError } from './geo.util';
import { AgroTrackEstimate } from '../agrotrack-integration.service';

export { UnresolvableAddressError };

export interface ShippingCostEstimateInput {
  pickupState: string;
  pickupLga: string;
  deliveryState: string;
  deliveryLga: string;
  cargoPriority?: string;
}

/**
 * Local replica of AgroTrack's estimate_cost() (public_api/pricing.py):
 *   estimated_cost = (base_rate + distance_km * per_km) * priority_multiplier
 *
 * Runs entirely on Oko's side — geocoding and road-distance calls go
 * straight to Nominatim/OSRM instead of round-tripping through AgroTrack —
 * cutting an extra network hop out of every price preview a farmer sees
 * while filling out the arrange-transit form.
 *
 * This is a PREVIEW only. The authoritative price is always computed
 * server-side by AgroTrack itself at order-creation time
 * (AgroTrackIntegrationService.createOrder) — never accepted from a client,
 * on either side of this integration.
 */
@Injectable()
export class LocalShippingCostEstimatorService {
  constructor(private readonly pricingConfig: AgroTrackPricingConfigService) {}

  async estimate(input: ShippingCostEstimateInput): Promise<AgroTrackEstimate> {
    const priority = input.cargoPriority ?? 'standard';
    const config = await this.pricingConfig.getConfig();

    const multiplierMap: Record<string, number> = {
      standard: 1.0,
      express: config.expressMultiplier,
      same_day: config.sameDayMultiplier,
    };
    // Callers validate cargoPriority via the DTO before reaching here — this
    // default is defense-in-depth, not a documented guarantee.
    const multiplier = multiplierMap[priority] ?? 1.0;

    const pickupAddress = `${input.pickupLga}, ${input.pickupState}`;
    const deliveryAddress = `${input.deliveryLga}, ${input.deliveryState}`;

    const { distanceKm, method } = await resolveDistance(
      pickupAddress,
      deliveryAddress,
    );

    const distanceCharge =
      Math.round(distanceKm * config.distanceSurchargePerKm * 100) / 100;
    const estimatedCost =
      Math.round((config.baseRate + distanceCharge) * multiplier * 100) / 100;

    return {
      estimated_cost: estimatedCost,
      base_rate: config.baseRate,
      distance_charge: distanceCharge,
      distance_km: distanceKm,
      priority_multiplier: multiplier,
      distance_method: method,
    };
  }
}
