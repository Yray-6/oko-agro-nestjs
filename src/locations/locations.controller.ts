import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LocationStateDto } from './dto/location-state.dto';
import { LocationsService } from './locations.service';

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @ApiOperation({
    summary: 'List Nigerian states and LGAs (public)',
  })
  @ApiQuery({
    name: 'state',
    required: false,
    description: 'When provided, returns LGAs for that state only',
    example: 'Lagos',
  })
  @ApiResponse({
    status: 200,
    description: 'Locations fetched successfully',
    type: LocationStateDto,
    isArray: true,
  })
  @ApiResponse({ status: 404, description: 'State not found' })
  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(
    @Query('state') state?: string,
  ): LocationStateDto | LocationStateDto[] {
    if (state?.trim()) {
      return this.locationsService.findByState(state);
    }
    return this.locationsService.findAll();
  }
}
