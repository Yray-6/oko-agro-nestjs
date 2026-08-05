import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { CropsService } from './crops.service';
import { Crop } from './entities/crop.entity';
import { CreateCropDto } from './dtos/create-crop.dto';
import { Roles } from 'src/auth/decorators/roles.decorators';
import { UserRole } from 'src/users/entities/user.entity';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles-guard';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('crops')
@Controller('crops')
export class CropsController {
    constructor(private readonly cropsService: CropsService) {}

    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a new crop (admin only)' })
    @ApiResponse({ status: 201, description: 'Crop created successfully', type: Crop })
    @Post('create')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.CREATED)
    async create(@Body() createCropDto: CreateCropDto): Promise<Crop> {
        return this.cropsService.create(createCropDto);
    }

    @ApiOperation({ summary: 'List all crops (public)' })
    @ApiResponse({ status: 200, description: 'Crops fetched successfully', type: Crop, isArray: true })
    @Get()
    @HttpCode(HttpStatus.OK)
    async findAll(): Promise<Crop[]> {
        return this.cropsService.findAll();
    }
}
