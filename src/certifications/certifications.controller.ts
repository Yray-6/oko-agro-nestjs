import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Roles } from 'src/auth/decorators/roles.decorators';
import { UserRole } from 'src/users/entities/user.entity';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles-guard';
import { CertificationsService } from './certifications.service';
import { Certification } from './entities/certification.entity';
import { CreateCertificationDto } from './dtos/create-certification.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('certifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard,RolesGuard)
@Controller('certifications')
export class CertificationsController {
    constructor(private readonly certificationsService: CertificationsService) {}

    @ApiOperation({ summary: 'Create a new certification (admin only)' })
    @ApiResponse({ status: 201, description: 'Certification created successfully', type: Certification })
    @Post('create')
    @Roles(UserRole.ADMIN,UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.CREATED)
    async create(@Body() createCertificationDto: CreateCertificationDto): Promise<Certification> {
        return this.certificationsService.create(createCertificationDto);
    }

    @ApiOperation({ summary: 'List all certifications' })
    @ApiResponse({ status: 200, description: 'Certifications fetched successfully', type: Certification, isArray: true })
    @Get()
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FARMER, UserRole.PROCESSOR)
    @HttpCode(HttpStatus.OK)
    async findAll(): Promise<Certification[]> {
        return this.certificationsService.findAll();
    }
}
