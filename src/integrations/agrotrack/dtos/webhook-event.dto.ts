import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

/** Matches the payload shape signed by AgroTrack's oko_integration.webhook_signing. */
export class WebhookOrderStatusChangedDto {
  @ApiProperty({ example: 'order.status_changed' })
  @IsString()
  event: string;

  @ApiProperty()
  @IsUUID()
  event_id: string;

  @ApiProperty()
  @IsDateString()
  occurred_at: string;

  @ApiProperty({
    description: "AgroTrack's oko_request_id — this buy request's own id",
  })
  @IsUUID()
  oko_request_id: string;

  @ApiProperty({ example: 'AGT30349900' })
  @IsString()
  tracking_number: string;

  @ApiProperty()
  @IsNumber()
  order_id: number;

  @ApiProperty({ example: 'in_transit' })
  @IsString()
  status: string;

  @ApiProperty({ example: 'pending_pickup' })
  @IsString()
  previous_status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  current_location?: string;
}
