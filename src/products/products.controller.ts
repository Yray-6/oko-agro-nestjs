import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CreateProductDto } from './dtos/create-product.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { User, UserRole } from 'src/users/entities/user.entity';
import { Roles } from 'src/auth/decorators/roles.decorators';
import { RolesGuard } from 'src/auth/guards/roles-guard';
import { UpdateProductDto } from './dtos/update-product.dto';
import { UpdateProductPhotosDto } from './dtos/update-product-photos.dto';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UpdateProductApprovalDto } from './dtos/update-product-approval.dto';
import { 
    ProductApprovalStatusResponseDto, ProductListingsResponseDto,
    ProductFindByUserIdResponseDto, ProductApprovedFindByUserIdResponseDto,
    ProductCreateResponseDto, ProductUpdateResponseDto, ProductFindResponseDto,
    ProductDeleteResponseDto, ProductPhotosUploadResponseDto, ProductPhotoDeleteResponseDto,
} from './dtos/response.dto';
import { ProductListingQueryDto } from './dtos/product-listing-query.dto';

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
    constructor(private readonly productsService: ProductsService) {}
    
    @ApiOperation({ summary: 'Create a new product (farmers only)' })
    @ApiResponse({ status: 201, description: 'Product created successfully', type: ProductCreateResponseDto })
    @Post('create')
    @Roles(UserRole.FARMER)
    @UseGuards(RolesGuard)
    @HttpCode(HttpStatus.CREATED)
    async createProduct(@Body() dto: CreateProductDto, @CurrentUser() currentUser: User) {
        return this.productsService.createProduct(dto, currentUser);
    }

    @ApiOperation({ summary: 'Update a product (Only user who created the event can update)' })
    @ApiResponse({ status: 200, description: 'Product updated successfully', type: ProductUpdateResponseDto })
    @Patch('update')
    @Roles(UserRole.FARMER)
    @UseGuards(RolesGuard)
    @HttpCode(HttpStatus.OK)
    async updateProduct(@Body() dto: UpdateProductDto, @CurrentUser() currentUser: User) {
        return this.productsService.updateProduct(dto, currentUser);
    }

    @ApiOperation({ summary: `Fetch a user's list of products with :userId (Only owner user and Admin user can access)` })
    @ApiParam({ name: 'userId', description: 'Owner user ID', example: 'uuid' })
    @ApiResponse({status: 200, description: 'Successfully fetched approved user products', type: ProductFindByUserIdResponseDto})
    @Get('user/:userId')
    @Roles(UserRole.FARMER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
    @UseGuards(RolesGuard)
    @HttpCode(HttpStatus.OK)
    async findUserProducts(@Param('userId') userId: string, @CurrentUser() currentUser: User) {
        return this.productsService.findUserProducts(userId, currentUser);
    }

    @ApiOperation({ summary: 'Fetch approved products belonging to a specific user' })
    @ApiParam({ name: 'userId', description: 'Owner user ID', example: 'uuid' })
    @ApiResponse({status: 200, description: 'Successfully fetched approved user products', type: ProductApprovedFindByUserIdResponseDto})
    @Get('approved/user/:userId')
    @HttpCode(HttpStatus.OK)
    async findApprovedUserProducts(@Param('userId') userId: string) {
        return this.productsService.findApprovedUserProducts(userId);
    }


    @ApiOperation({ 
        summary: 'Admin access only: Fetch product listings pending/approved/rejected',
        description: 'Allows an admin to fetch product listings. Filtering on `pending`, `approved`, or `rejected`.',
    })
    @ApiResponse({ status: 200, description: 'Product listings fetched successfully', type: ProductListingsResponseDto})
    @Get('listings')
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    @UseGuards(RolesGuard)
    async findProductListings( @Query() query: ProductListingQueryDto ) {
        return this.productsService.findProductListings(query);
    }

    @ApiOperation({ summary: 'Fetch product with :productId' })
    @ApiParam({ name: 'productId', description: 'Product ID', example: 'uuid' })
    @ApiResponse({ status: 200, description: 'Product fetched successfully', type: ProductFindResponseDto })
    @Get(':productId')
    @HttpCode(HttpStatus.OK)
    async findProduct(@Param('productId') productId: string) {
        return this.productsService.findProduct(productId);
    }

    @ApiOperation({
        summary: 'Approve or reject a product (Only admin can access)',
        description: 'Allows an admin to approve or reject a product listing. Set `approvalStatus` to `approve` or `reject`.',
    })
    @ApiResponse({ status: 200, description: 'Product approval status updated successfully', type: ProductApprovalStatusResponseDto})
    @Patch('approval')
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    @UseGuards(RolesGuard)
    @HttpCode(HttpStatus.OK)
    async updateProductApproval(@Body() dto: UpdateProductApprovalDto) {
        return this.productsService.updateProductApproval(dto);
    }

    @ApiOperation({ summary: `Delete a product photo (Only the owner)` })
    @ApiParam({ name: 'photoId', description: 'Product photo ID', example: 'uuid' })
    @ApiResponse({ status: 200, description: 'Product photo deleted successfully', type: ProductPhotoDeleteResponseDto })
    @Delete('remove-photo/:photoId')
    @Roles(UserRole.FARMER)
    @UseGuards(RolesGuard)
    @HttpCode(HttpStatus.OK)
    async removeProductPhoto(@Param('photoId') photoId: string) {
        return this.productsService.removeProductPhoto(photoId);
    }

    @ApiOperation({ summary: `Upload photo(s) for a product (Only the owner` })
    @ApiResponse({ status: 201, description: 'Product photos uploaded successfully', type: ProductPhotosUploadResponseDto })
    @Post('upload-photo')
    @HttpCode(HttpStatus.CREATED)
    async uploadProductPhotos(@Body() dto: UpdateProductPhotosDto) {
        return this.productsService.uploadProductPhotos(dto);
    }

    @ApiOperation({ summary: `Delete a product (Only the owner can deleted)` })
    @ApiParam({ name: 'productId', description: 'Product ID', example: 'uuid' })
    @ApiResponse({ status: 200, description: 'Product deleted successfully', type: ProductDeleteResponseDto })
    @Delete(':productId')
    @Roles(UserRole.FARMER)
    @UseGuards(RolesGuard)
    @HttpCode(HttpStatus.OK)
    async deleteProduct(@Param('productId') productId: string, @CurrentUser() currentUser: User) {
        return this.productsService.deleteProduct(productId, currentUser);
    }
}
