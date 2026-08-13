import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * Structured pickup/delivery address for one-click AgroTrack shipping.
 * AgroTrack's create contract needs state/LGA precision that isn't captured
 * anywhere on the User/BuyRequest entities today, so this is collected at
 * call time rather than derived — the calling UI is still TBD (see the
 * Phase 3 integration plan), this DTO is what it will eventually submit.
 */
export class ArrangeTransitDto {
  @ApiProperty({ example: 'Kano' })
  @IsString()
  @IsNotEmpty()
  pickupState: string;

  @ApiProperty({ example: 'Kano Municipal' })
  @IsString()
  @IsNotEmpty()
  pickupLga: string;

  @ApiProperty({ example: 'Plot 4, Kano-Zaria Road' })
  @IsString()
  @IsNotEmpty()
  pickupStreetAddress: string;

  @ApiProperty({ example: 'Amina Bello' })
  @IsString()
  @IsNotEmpty()
  pickupContactName: string;

  @ApiProperty({ example: '+2348000000000' })
  @IsString()
  @IsNotEmpty()
  pickupPhone: string;

  @ApiProperty({ example: 'Lagos' })
  @IsString()
  @IsNotEmpty()
  deliveryState: string;

  @ApiProperty({ example: 'Ikeja' })
  @IsString()
  @IsNotEmpty()
  deliveryLga: string;

  @ApiProperty({ example: '12 Allen Avenue' })
  @IsString()
  @IsNotEmpty()
  deliveryStreetAddress: string;

  @ApiProperty({ example: 'Ikeja Processing Co' })
  @IsString()
  @IsNotEmpty()
  deliveryName: string;

  @ApiProperty({ example: '+2348000000002' })
  @IsString()
  @IsNotEmpty()
  deliveryPhone: string;

  @ApiPropertyOptional({ example: 'ops@processor.example.com' })
  @IsOptional()
  @IsEmail()
  deliveryEmail?: string;

  @ApiProperty({ example: 'Grains' })
  @IsString()
  @IsNotEmpty()
  cargoType: string;

  @ApiProperty({ example: 500 })
  @IsNumber()
  cargoWeight: number;

  @ApiProperty({ example: 250000 })
  @IsNumber()
  cargoValue: number;

  @ApiPropertyOptional({
    enum: ['standard', 'express', 'same_day'],
    default: 'standard',
  })
  @IsOptional()
  @IsIn(['standard', 'express', 'same_day'])
  cargoPriority?: string;

  @ApiPropertyOptional({
    description:
      "Farmer acknowledged Oko's one-time shadow-account notice, if this is their first AgroTrack order.",
  })
  @IsOptional()
  @IsBoolean()
  consentAcknowledged?: boolean;
}
