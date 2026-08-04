import { Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ProductInventoriesService } from './product-inventories.service';

@ApiTags('inventories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventories')
export class ProductInventoriesController {
    constructor(private readonly productInventoriesService: ProductInventoriesService) {}


}
