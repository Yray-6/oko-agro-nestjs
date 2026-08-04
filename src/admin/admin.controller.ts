import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/auth/decorators/roles.decorators';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles-guard';
import { User, UserRole } from 'src/users/entities/user.entity';
import { AdminService } from './admin.service';
import { 
    CreateAdminResponseDto, DashboardOverviewResponseDto, 
    DeleteAdminResponseDto, GetAdminsResponseDto, TopPerformingRegionsResponseDto, TopPerformingUsersResponseDto, UpdateAdminPwdResponseDto, UpdateUserResponseDto 
} from './dtos/response.dto';
import { CreateAdminUserDto } from './dtos/create-admin-user.dto';
import { UpdateUserStatusDto } from './dtos/update-user-status.dto';
import { UpdateAdminPasswordDto } from './dtos/update-admin-password.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { GetAllAdminsQueryDto } from './dtos/get-all-admins-query.dto';
import { ProductInventoriesService } from 'src/product-inventories/product-inventories.service';
import { GetInventoriesQueryDto } from 'src/product-inventories/dtos/get-inventories-query.dto';
import { TopPerformingUsersQueryDto } from './dtos/top-performing-users-query.dto';
import { TopPerformingRegionsQueryDto } from './dtos/top-performing-regions-query.dto';
import { GetInventoriesResponseDto, GetProductInventoriesResponseDto } from 'src/product-inventories/dtos/response.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
    constructor(
        private readonly adminService: AdminService,
        private readonly productInventoriesService: ProductInventoriesService
    ) {}

    @Get('dashboard/overview')
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Get admin dashboard overview stats' })
    @ApiResponse({ status: 200, description: "Dashboard stats fetched successfully", type: DashboardOverviewResponseDto })
    @HttpCode(HttpStatus.OK)
    async getDashboardOverview() {
        return this.adminService.getDashboardOverview();
    }

    @Get('top-performing-users')
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    @ApiOperation({ 
        summary: "Get top performing users (famers & processors)",
        description: 'Filtering on role: `farmer`, or, `processor`.',
    })
    @ApiResponse({ status: 200, description: "Top performing users fetched successfully", type: TopPerformingUsersResponseDto })
    @HttpCode(HttpStatus.OK)
    async topPerformingUsers( @Query() query: TopPerformingUsersQueryDto ) {
        return this.adminService.topPerformingUsers(query);
    }

    @Get('top-performing-regions')
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    @ApiOperation({ 
        summary: "Get top performing regions (states in a country)",
        description: 'Filtering on country: e.g Nigeria',
    })
    @ApiResponse({ status: 200, description: "Top performing regions fetched successfully", type: TopPerformingRegionsResponseDto })
    @HttpCode(HttpStatus.OK)
    async topPerformingRegions( @Query() query: TopPerformingRegionsQueryDto ) {
        return this.adminService.topPerformingRegions(query);
    }

    @Post('create-admin')
    @Roles(UserRole.SUPER_ADMIN)   // Only super_admin can access
    @ApiOperation({ summary: "Create a new Admin user (Only super admin)" })
    @ApiResponse({ status: 201, description: "Admin user created successfully", type: CreateAdminResponseDto})
    async createAdmin(@Body() dto: CreateAdminUserDto,) {
        return this.adminService.createAdmin(dto);
    }

    @Patch('update-status')
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: "Enable or disable a user account" })
    @ApiResponse({ status: 200, description: "User status updated", type: UpdateUserResponseDto})
    async updateUserStatus(@Body() dto: UpdateUserStatusDto,
    ) {
        return this.adminService.updateUserStatus(dto);
    }

    @Post('/update-admin-password')
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: "Update admin password" })
    @ApiResponse({ status: 200, description: "Password updated successfully", type: UpdateAdminPwdResponseDto})
    async updateAdminPassword(@CurrentUser() currentUser: User, @Body() dto: UpdateAdminPasswordDto
    ) {
        return this.adminService.updateAdminPassword(dto, currentUser);
    }

    @ApiOperation({ 
        summary: 'Inventories fetched successfully with pagination metadata.',
        description: `
            Retrieves a paginated list of product inventory logs.

            This endpoint allows administrators to:

            • Search inventory logs by product name or crop type name  
            • Filter logs by inventory type (addition, reservation, release, deduction)  
            • Paginate results using pageNumber and pageSize  

            Results are ordered by most recent inventory activity first.
            `,
    })
    @ApiResponse({ status: 200, description: 'Inventories fetched successfully with pagination metadata.', type: GetInventoriesResponseDto })
    @Get('inventories')
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    @UseGuards(RolesGuard)
    @HttpCode(HttpStatus.OK)
    async getInventories(@Query() query: GetInventoriesQueryDto
    ) {
        return this.productInventoriesService.getInventories(query);
    }

    @ApiOperation({ summary: 'Get all inventory logs of a product' })
    @ApiParam({ name: 'id', description: 'Product ID', example: 'uuid' })
    @ApiResponse({ status: 200, description: "Product inventory logs fetched successfully", type: GetProductInventoriesResponseDto })
    @Get('inventories/product/:id')
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FARMER)
    @UseGuards(RolesGuard)
    @HttpCode(HttpStatus.OK)
    async getProductInventories(@Param('id') id: string) {
        return this.productInventoriesService.getProductInventories(id);
    }

    @Get('all-admins')
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    @ApiOperation({ 
        summary: "Get all admin users (Admin & Super Admin) with pagination and filtering",
        description: 'Filtering on role: `admin`, or, `super_admin`.',
    })
    @ApiResponse({ status: 200, description: "Admins fetched successfully", type: GetAdminsResponseDto,
    })
    async getAllAdmins( @Query() query: GetAllAdminsQueryDto ) {
        return this.adminService.getAllAdmins(query);
    }

    @Delete(':userId')
    @Roles(UserRole.SUPER_ADMIN) // Only super_admin can access
    @ApiOperation({ summary: "Delete an admin user (SUPER ADMIN only)" })
    @ApiParam({ name: 'userId', description: 'Admin user ID to delete', example: 'uuid' })
    @ApiResponse({ status: 200, description: "Admin deleted", type: DeleteAdminResponseDto})
    async deleteAdmin(@Param('userId') userId: string) {
        return this.adminService.deleteAdmin(userId);
    }
}
