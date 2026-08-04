import { Controller, DefaultValuePipe, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FarmerListResponseDto, ProcessorListResponseDto, UserFindResponseDto, AllUsersResponseDto } from './dtos/response.dto';
import { FindAllUsersQueryDto } from './dtos/find-all-users-query.dto';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @ApiOperation({ summary: `Fetch processors on the system` })
    @ApiResponse({ status: 200, description: "Successfully fetched processors", type: ProcessorListResponseDto })
    @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by farmName, state, country, or farmAddress' })
    @ApiQuery({ name: 'pageNumber', required: false, type: Number, description: 'Page number (default: 1)' })
    @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Page size (default: 20)' })
    @Get('processors')
    @HttpCode(HttpStatus.OK)
    async findProcessors(
        @CurrentUser() currentUser: any,
        @Query('search') search?: string,
        @Query('pageNumber', new DefaultValuePipe(1), ParseIntPipe) pageNumber?: number,
        @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize?: number,
    ) {
        return this.usersService.findProcessors(currentUser, search, pageNumber, pageSize);
    }

    @ApiOperation({ summary: `Fetch farmers on the system` })
    @ApiResponse({ status: 200, description: "Successfully fetched Farmers", type: FarmerListResponseDto })
    @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by farmName, state, country, or farmAddress' })
    @ApiQuery({ name: 'pageNumber', required: false, type: Number, description: 'Page number (default: 1)' })
    @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Page size (default: 20)' })
    @Get('farmers')
    @HttpCode(HttpStatus.OK)
    async findFarmers(
        @CurrentUser() currentUser: any,
        @Query('search') search?: string,
        @Query('pageNumber', new DefaultValuePipe(1), ParseIntPipe) pageNumber?: number,
        @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize?: number,
    ) {
        return this.usersService.findFarmers(currentUser, search, pageNumber, pageSize);
    }

    @ApiOperation({
        summary: 'Find all users (excluding admins)',
        description: 'Returns paginated list of users filtered by optional search',
    })
    @ApiResponse({ status: 200, description: 'Paginated users result returned successfully', type: AllUsersResponseDto })
    @Get('all-users')
    async findAllUsers(
        @Query() query: FindAllUsersQueryDto,
    ) {
        return this.usersService.findAllUsers(query);
    }

    @ApiOperation({ summary: 'Fetch user on the system with :userId' })
    @ApiParam({ name: 'userId', description: 'User ID', example: 'uuid' })
    @ApiResponse({ status: 200, description: "Successfully fetched user", type: UserFindResponseDto })
    @Get(':userId')
    @HttpCode(HttpStatus.OK)
    findUser(@Param('userId') userId: string){
        return this.usersService.findUser(userId);
    }
}
