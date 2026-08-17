import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Pickup/delivery state+LGA pair for a live shipping-cost preview — the
 * subset of ArrangeTransitDto's fields that actually feed the pricing
 * formula (no contact info, weight, or value needed for a quote).
 */
export class EstimateShippingCostDto {
  @ApiProperty({ example: 'Kano' })
  @IsString()
  @IsNotEmpty()
  pickupState: string;

  @ApiProperty({ example: 'Kano Municipal' })
  @IsString()
  @IsNotEmpty()
  pickupLga: string;

  @ApiProperty({ example: 'Lagos' })
  @IsString()
  @IsNotEmpty()
  deliveryState: string;

  @ApiProperty({ example: 'Ikeja' })
  @IsString()
  @IsNotEmpty()
  deliveryLga: string;

  @ApiPropertyOptional({
    enum: ['standard', 'express', 'same_day'],
    default: 'standard',
  })
  @IsOptional()
  @IsIn(['standard', 'express', 'same_day'])
  cargoPriority?: string;
}
