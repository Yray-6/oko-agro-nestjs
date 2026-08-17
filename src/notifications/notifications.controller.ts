import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { 
    ContactMessageResponseDto,
    GetNotificationResponseDto, GetNotificationsResponseDto, MarkAllAsReadResponseDto, 
    MarkAsReadResponseDto 
} from './dtos/response.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { User, UserRole } from 'src/users/entities/user.entity';
import { GetNotificationsQueryDto } from './dtos/get-notifications-query.dto';
import { ContactBuyerDto } from './dtos/contact-buyer.dto';
import { Roles } from 'src/auth/decorators/roles.decorators';
import { RolesGuard } from 'src/auth/guards/roles-guard';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
    constructor(
        private readonly notificationsService: NotificationsService,
    ) {}

    @Get()
    @ApiOperation({ summary: 'Retrieve notifications for authenticated user', description: 'Returns paginated notifications belonging to the current user' })
    @ApiResponse({ 
        status: 200, description: 'Notifications retrieved successfully',
        type: GetNotificationsResponseDto
    })
    @HttpCode(HttpStatus.OK)
    async getNotifications( @CurrentUser() user: User, @Query() query: GetNotificationsQueryDto) {
        return this.notificationsService.getNotifications(user, query);
    }

    @Put('read-all')
    @ApiOperation({ summary: 'Mark all notification as read',  description: 'Marks all unread notifications for the authenticated user as read' })
    @ApiResponse({
        status: 200, description: 'All notifications marked as read',
        type: MarkAllAsReadResponseDto
    })
    @HttpCode(HttpStatus.OK)
    async markAllAsRead( @CurrentUser() user: User) {
        return this.notificationsService.markAllAsRead(user);
    }

    @Put('read/:id')
    @ApiOperation({ summary: 'Mark a notification as read',  description: 'Marks a single notification as read for the authenticated user' })
    @ApiParam({ name: 'id', description: 'Notification ID', example: 'uuid' })
    @ApiResponse({
        status: 200, description: 'Notification marked as read',
        type: MarkAsReadResponseDto
    })
    @HttpCode(HttpStatus.OK)
    async markAsRead( @Param('id', ParseUUIDPipe) notificationId: string, @CurrentUser() user: User) {
        return this.notificationsService.markAsRead(notificationId, user);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get notification by ID',  description: 'Retrieve a notification by ID. Notification must belong to the authenticated user.' })
    @ApiParam({ name: 'id', description: 'Notification ID', example: 'uuid' })
    @ApiResponse({
        status: 200, description: 'Notification retrieved successfully',
        type: GetNotificationResponseDto
    })
    @HttpCode(HttpStatus.OK)
    async getNotificationById( @Param('id', ParseUUIDPipe) notificationId: string, @CurrentUser() user: User) {
        return this.notificationsService.getNotificationById(notificationId, user);
    }

    @Post('contact-seller')
    @ApiOperation({ summary: 'Contact a buyer (processor) about a buy request',})
    @ApiResponse({
        status: 201,
        description: 'Contact message sent successfully',
        type: ContactMessageResponseDto
    })
    @Roles(UserRole.FARMER)
    @UseGuards(RolesGuard)
    @HttpCode(HttpStatus.CREATED)
    async contactBuyer( @CurrentUser() farmer: User, @Body() dto: ContactBuyerDto ) {
        return this.notificationsService.contactBuyer(dto, farmer);
    }
}
