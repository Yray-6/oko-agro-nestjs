import { Body, Controller, DefaultValuePipe, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { BuyRequestsService } from './buy-requests.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Roles } from 'src/auth/decorators/roles.decorators';
import { User, UserRole } from 'src/users/entities/user.entity';
import { RolesGuard } from 'src/auth/guards/roles-guard';
import { CreateBuyRequestDto } from './dtos/create-buy-request.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { UpdateBuyRequestDto } from './dtos/update-buy-request.dto';
import { UpdateBuyRequestStatusDto } from './dtos/update-buy-request-status.dto';
import { BuyRequestStatus } from './entities/buy-request.entity';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { 
    BuyRequestCreateResponseDto, BuyRequestDeleteResponseDto, 
    BuyRequestGeneralListResponseDto, BuyRequestListResponseDto, 
    BuyRequestUpdateResponseDto, BuyRequestUpdateStatusResponseDto,
    BuyRequestFindResponseDto, BuyRequestFindByUserIdResponseDto,
    BuyRequestUpdateOrderStateResponseDto,BuyRequestOngoingOrderListResponseDto,
    BuyRequestUpdateTrackingResponseDto,
    PurchaseOrderDeleteResponseDto, DirectBuyRequestResponseDto,
    GetAllBuyRequestsResponseDto
} from './dtos/response.dto';
import { UpdateOrderStateDto } from './dtos/update-order-state.dto';
import { UpdateTrackingDto } from './dtos/update-tracking.dto';
import { OngoingBuyRequestOrdersQueryDto } from './dtos/ongoing-buy-request-orders-query.dto';
import { UpdatePurchaseOrderDocDto } from './dtos/update-purchase-order-doc.dto';
import { DirectBuyRequestDto } from './dtos/direct-buy-request.dto';
import { GetAllBuyRequestsQueryDto } from './dtos/get-all-buy-requests.query.dto';

@ApiTags('buy-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('buy-requests')
export class BuyRequestsController {
    constructor(private readonly buyRequestsService: BuyRequestsService) {}

    @Get()
    @ApiOperation({ summary: 'Get all buy requests (paginated)', description: 'Accessible to all authenticated users',})
    @ApiResponse({ status: 200, description: 'Buy requests fetched successfully', type: GetAllBuyRequestsResponseDto  })
    @HttpCode(HttpStatus.OK)
    async getAllBuyRequests( @Query() query: GetAllBuyRequestsQueryDto, ) {
        return this.buyRequestsService.getAllBuyRequests(query);
    }

    // 🔹 Create a new buy request (processors only)
    @ApiOperation({ summary: 'Create a new buy request (processors only)' })
    @ApiResponse({ status: 201, description: "Successfully created buyRequest", type: BuyRequestCreateResponseDto })
    @Post('create')
    @Roles(UserRole.PROCESSOR)
    @UseGuards(RolesGuard)
    @HttpCode(HttpStatus.CREATED)
    async create(@Body() dto: CreateBuyRequestDto, @CurrentUser() buyer: User, ) {
        return this.buyRequestsService.create(dto, buyer);
    }

    // 🔹 Update an existing buy request (processors only, their own request)
    @ApiOperation({ summary: 'Update an existing buy request (processors only, their own request)' })
    @ApiResponse({ status: 200, description: "Successfully updated buy request", type: BuyRequestUpdateResponseDto })
    @Put('update')
    @Roles(UserRole.PROCESSOR)
    @UseGuards(RolesGuard)
    @HttpCode(HttpStatus.OK)
    async updateBuyRequest(@Body() dto: UpdateBuyRequestDto, @CurrentUser() currentUser: User ) {
        return this.buyRequestsService.updateBuyRequest(dto, currentUser);
    }

    // 🔹 Update status (farmers only)
    @ApiOperation({ summary: 'Update buy request status (farmers only)' })
    @ApiResponse({ status: 200, description: "Successfully updated buy request status", type: BuyRequestUpdateStatusResponseDto })
    @Put('update-status')
    @Roles(UserRole.FARMER)
    @UseGuards(RolesGuard)
    @HttpCode(HttpStatus.OK)
    async updateStatus(@Body() dto: UpdateBuyRequestStatusDto, @CurrentUser() currentUser: User) {
        return this.buyRequestsService.updateStatus(dto, currentUser);
    }

    // 🔹 Update order state
    @ApiOperation({ summary: 'Update order state of a BuyRequest' })
    @ApiResponse({ status: 200, description: 'Successfully updated buy request order state', type: BuyRequestUpdateOrderStateResponseDto })
    @Put('update-order-state')
    // @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.PROCESSOR)
    // @UseGuards(RolesGuard)
    @HttpCode(HttpStatus.OK)
    async updateOrderState( @Body() dto: UpdateOrderStateDto, @CurrentUser() currentUser: User,) {
        return this.buyRequestsService.updateOrderState(dto, currentUser);
    }

    // 🔹 Link AgroTrack tracking (does not change orderState / payment)
    @ApiOperation({
        summary: 'Link AgroTrack tracking number to a BuyRequest',
        description: 'Seller (farmer), buyer (processor), or admin. Does not change orderState or paymentConfirmed.',
    })
    @ApiResponse({ status: 200, description: 'Tracking linked successfully', type: BuyRequestUpdateTrackingResponseDto })
    @Put('update-tracking')
    @HttpCode(HttpStatus.OK)
    async updateTracking(@Body() dto: UpdateTrackingDto, @CurrentUser() currentUser: User) {
        return this.buyRequestsService.updateTracking(dto, currentUser);
    }

    // 🔹 Fetch all general requests (visible to farmers, returning pending requests - not older than 1 week)
    @ApiOperation({ summary: 'Fetch all general requests (visible to farmers only). Route returns pending requests, not older than 1 week' })
    @ApiResponse({ status: 200, description: "Successfully fetched general buy request", type: BuyRequestGeneralListResponseDto })
    @Get('general')
    @Roles(UserRole.FARMER)
    @UseGuards(RolesGuard)
    @HttpCode(HttpStatus.OK)
    async findGeneralRequests() {
        return this.buyRequestsService.findGeneralRequests();
    }

    // 🔹 Fetch requests linked to current user (farmer → seller / processor → buyer)
    @ApiOperation({ summary: 'Fetch requests linked to current user: (farmer → seller / processor → buyer) both can access' })
    @ApiResponse({ status: 200, description: "Successfully fetched buy request", type: BuyRequestListResponseDto })
    @ApiQuery({ name: 'status', required: false, type: String, description: `Search by buy request's status field` })
    @ApiQuery({ name: 'pageNumber', required: false, type: Number, description: 'Page number (default: 1)' })
    @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Page size (default: 20)' })
    @Get('my-requests')
    @HttpCode(HttpStatus.OK)
    async findMyBuyRequests(
        @CurrentUser() currentUser: User,
        @Query('status') status?: BuyRequestStatus,
        @Query('pageNumber', new DefaultValuePipe(1), ParseIntPipe) pageNumber?: number,
        @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize?: number,
    ) {
        return this.buyRequestsService.findMyBuyRequests(
            currentUser,
            status,
            pageNumber,
            pageSize,
        );
    }

    @ApiOperation({ 
        summary: 'Admin Only Access: Fetch BuyRequest ongoing buyrequest orders',
        description: 'Allows an admin to fetch buyresquests. Filtering on `awaiting_shipping`, `in_transit`, `delivered` or, `completed`.',
    })
    @ApiResponse({ status: 200, description: 'Ongoing buyrequest orders fetched successfully', type: BuyRequestOngoingOrderListResponseDto})
    @Get('ongoing-buyrequest')
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    @UseGuards(RolesGuard)
    @HttpCode(HttpStatus.OK)
    async findOngoingBuyRequestOrders(
        @Query() query: OngoingBuyRequestOrdersQueryDto
    ) {
        return this.buyRequestsService.findOngoingBuyRequestOrders(query);
    }

    @ApiOperation({ summary: 'Fetch buyRequest with :buyRequestId' })
    @ApiParam({ name: 'buyRequestId', description: 'Buy request ID', example: 'uuid' })
    @ApiResponse({ status: 200, description: "Successfully fetched buyRequest", type: BuyRequestFindResponseDto })
    @Get(':buyRequestId')
    @HttpCode(HttpStatus.OK)
    async findBuyRequest(@Param('buyRequestId') buyRequestId: string) {
        return this.buyRequestsService.findBuyRequest(buyRequestId);
    }

    @ApiOperation({ summary: `Fetch a user's list buyRequests with :userId` })
    @ApiParam({ name: 'userId', description: 'User ID', example: 'uuid' })
    @ApiResponse({ status: 200, description: "Successfully fetched user's buyRequests", type: BuyRequestFindByUserIdResponseDto })
    @Get('user/:userId')
    @Roles(UserRole.PROCESSOR, UserRole.FARMER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
    @UseGuards(RolesGuard)
    @HttpCode(HttpStatus.OK)
    async findUserBuyRequests(@Param('userId') userId: string) {
        return this.buyRequestsService.findUserBuyRequests(userId);
    }

    @Put('direct/:buyRequestId')
    @ApiOperation({ summary: 'Direct a general buy request to a preferred seller'})
    @ApiParam({ name: 'buyRequestId', description: 'Buy request ID', example: 'uuid' })
    @ApiResponse({ status: 200, description: 'Buy request directed successfully', type: DirectBuyRequestResponseDto })
    @Roles(UserRole.PROCESSOR)
    @UseGuards(RolesGuard)
    @HttpCode(HttpStatus.OK)
    async directBuyRequest( 
        @Param('buyRequestId') buyRequestId: string, 
        @Body() dto: DirectBuyRequestDto, 
        @CurrentUser() buyer: User,
    ) {
        return this.buyRequestsService.directBuyRequest( buyRequestId,dto, buyer,);
    }

    @ApiOperation({ summary: `Upload PurchaseOrderDoc for a buyRequest (Only the owner` })
    @ApiResponse({ status: 200, description: "Successfully uploaded purchase order doc", type: PurchaseOrderDeleteResponseDto })
    @Post('upload-purchase-order')
    @HttpCode(HttpStatus.CREATED)
    async uploadPurchaseOrderDoc(@Body() dto: UpdatePurchaseOrderDocDto) {
        return this.buyRequestsService.uploadPurchaseOrderDoc(dto);
    }

    @ApiOperation({ summary: 'Delete a purchase order doc (only the ower)' })
    @ApiParam({ name: 'documentId', description: 'Purchase order document ID', example: 'uuid' })
    @ApiResponse({ status: 200, description: "Successfully deleted purchase order doc", type: PurchaseOrderDeleteResponseDto })
    @Delete('remove-purchase-order/:documentId')
    @Roles(UserRole.PROCESSOR)
    @UseGuards(RolesGuard)
    @HttpCode(HttpStatus.OK)
    async removePurchaseOrderDoc(@Param('documentId') documentId: string) {
        return this.buyRequestsService.removePurchaseOrderDoc(documentId);
    }

    // 🔹 Delete a request (soft delete, processors only)
    @ApiOperation({ summary: 'Delete a request (processors only)' })
    @ApiParam({ name: 'buyRequestId', description: 'Buy request ID', example: 'uuid' })
    @ApiResponse({ status: 200, description: "Successfully deleted buy request", type: BuyRequestDeleteResponseDto })
    @Delete(':buyRequestId')
    @Roles(UserRole.PROCESSOR)
    @UseGuards(RolesGuard)
    @HttpCode(HttpStatus.OK)
    async deleteRequest( @Param('buyRequestId') buyRequestId: string, @CurrentUser() currentUser: User ) {
        return this.buyRequestsService.deleteRequest(buyRequestId, currentUser);
    }
}
