import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { DisputesService } from './disputes.service';
import { RolesGuard } from 'src/auth/guards/roles-guard';
import { User, UserRole } from 'src/users/entities/user.entity';
import { Roles } from 'src/auth/decorators/roles.decorators';
import { GetAllDisputesQueryDto } from './dtos/get-all-disputes-query.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { CreateDisputeDto } from './dtos/create-dispute.dto';
import { 
    CreateDisputeResponseDto, GetAllDisputesResponseDto, GetDisputeResponseDto, 
    RejectDisputeResponseDto, ResolveDisputeResponseDto 
} from './dtos/response.dto';

@ApiTags('disputes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('disputes')
export class DisputesController {
    constructor(private readonly disputesService: DisputesService) {}

    @Post('create')
    @ApiOperation({ summary: 'Create a dispute', description: 'Allows a buyer or seller involved in a buy request to raise a dispute'})
    @ApiResponse({ status: 201, description: 'Dispute created successfully', type: CreateDisputeResponseDto})
    async createDispute( @Body() dto: CreateDisputeDto, @CurrentUser() currentUser: User,) {
        return await this.disputesService.createDispute( dto, currentUser);
    }

    @ApiOperation({ summary: 'Fetch disputes', description: 'Allows admin to query all disputes',})
    @ApiResponse({status: 200, description: 'Disputes retrieved successfully', type: GetAllDisputesResponseDto})
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    @Get('all')
    getAllDisputes(@Query() query: GetAllDisputesQueryDto) {
        return this.disputesService.getAllDisputes(query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get dispute by ID', description: 'Returns a dispute if the requester is an admin or involved in the buy request',})
    @ApiParam({ name: 'id', description: 'Dispute ID', example: 'uuid' })
    @ApiResponse({ status: 200, description: 'Dispute retrieved successfully', type: GetDisputeResponseDto})
    async getDisputeById( @Param('id', ParseUUIDPipe) disputeId: string, @CurrentUser() currentUser: User,) {
        return await this.disputesService.getDisputeById( disputeId, currentUser,);
    }

    @Patch(':id/resolve')
    @ApiOperation({ summary: 'Resolve a dispute', description: 'Allows admin to resolve an open or under-review dispute',})
    @ApiParam({ name: 'id', description: 'Dispute ID', example: 'uuid' })
    @ApiResponse({status: 200, description: 'Dispute resolved successfully', type: ResolveDisputeResponseDto})
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    async resolveDispute( @Param('id', ParseUUIDPipe) disputeId: string, @CurrentUser() currentUser: User) {
        return await this.disputesService.resolveDispute(disputeId, currentUser);
    }

    @Patch(':id/reject')
    @ApiOperation({ summary: 'Reject a dispute', description: 'Allows admin to reject an open or under-review dispute',})
    @ApiParam({ name: 'id', description: 'Dispute ID', example: 'uuid' })
    @ApiResponse({ status: 200, description: 'Dispute rejected successfully', type: RejectDisputeResponseDto})
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    async rejectDispute( @Param('id', ParseUUIDPipe) disputeId: string, @CurrentUser() currentUser: User,) {
        return await this.disputesService.rejectDispute(disputeId, currentUser );
    }

}
