import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateTrackingDto {
  @ApiProperty({
    example: '3bfb2b2a-1d11-4b26-9124-3c5f9d1a4d8e',
    description: 'The ID of the BuyRequest to link AgroTrack tracking to',
  })
  @IsString()
  @IsNotEmpty()
  buyRequestId: string;

  @ApiProperty({
    example: 'ABC123XYZ45',
    description: 'AgroTrack tracking number (11 alphanumeric characters)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  @Matches(/^[A-Za-z0-9#_-]+$/, {
    message: 'agroTrackTrackingNumber must be alphanumeric',
  })
  agroTrackTrackingNumber: string;
}
