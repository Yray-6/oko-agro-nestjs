import { Injectable, NotFoundException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { LocationStateDto } from './dto/location-state.dto';

@Injectable()
export class LocationsService {
  private readonly locations: LocationStateDto[];

  constructor() {
    const dataPath = join(__dirname, 'data', 'nigeria-states-lgas.json');
    this.locations = JSON.parse(
      readFileSync(dataPath, 'utf-8'),
    ) as LocationStateDto[];
  }

  findAll(): LocationStateDto[] {
    return this.locations;
  }

  findByState(state: string): LocationStateDto {
    const normalized = state.trim().toLowerCase();
    const match = this.locations.find(
      (item) => item.state.toLowerCase() === normalized,
    );

    if (!match) {
      throw new NotFoundException(`State "${state}" not found`);
    }

    return match;
  }
}
