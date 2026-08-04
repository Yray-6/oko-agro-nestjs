import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { QualityStandardsService } from './quality-standards.service';
import { Roles } from 'src/auth/decorators/roles.decorators';
import { UserRole } from 'src/users/entities/user.entity';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles-guard';
import { QualityStandard } from './entities/quality-standard.entity';
import { CreateQualityStandardDto } from './dtos/create-quality-standard.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('quality-standards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard,RolesGuard)
@Controller('quality-standards')
export class QualityStandardsController {
    constructor(private readonly certificationsService: QualityStandardsService) {}

    @ApiOperation({ summary: 'Create a new quality standard (admin only)' })
    @ApiResponse({ status: 201, description: 'Quality standard created successfully', type: QualityStandard })
    @Post('create')
    @Roles(UserRole.ADMIN,UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.CREATED)
    async create(@Body() createQualityStandardDto: CreateQualityStandardDto): Promise<QualityStandard> {
        return this.certificationsService.create(createQualityStandardDto);
    }

    @ApiOperation({ summary: 'List all quality standards' })
    @ApiResponse({ status: 200, description: 'Quality standards fetched successfully', type: QualityStandard, isArray: true })
    @Get()
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FARMER, UserRole.PROCESSOR)
    @HttpCode(HttpStatus.OK)
    async findAll(): Promise<QualityStandard[]> {
        return this.certificationsService.findAll();
    }
}
