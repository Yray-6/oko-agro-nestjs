import { ApiProperty } from '@nestjs/swagger';

export class LocationStateDto {
  @ApiProperty({ example: 'Lagos' })
  state: string;

  @ApiProperty({
    example: ['Agege', 'Ikeja', 'Surulere'],
    type: [String],
  })
  lgas: string[];
}
