import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationAudience, NotificationType, RelatedEntityType } from './entities/notification.entity';
import { CreateNotificationPayload } from './interfaces/create-notification-payload';
import { User } from 'src/users/entities/user.entity';
import { GetNotificationsQueryDto } from './dtos/get-notifications-query.dto';
import { handleServiceError } from 'src/common/utils/error-handler.util';
import { ContactBuyerDto } from './dtos/contact-buyer.dto';
import { BuyRequest } from 'src/buy-requests/entities/buy-request.entity';
import { Product, ProductApprovalStatus } from 'src/products/entities/product.entity';
import { instanceToPlain } from 'class-transformer';
import Decimal from 'decimal.js';

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);
    
    constructor(
        @InjectRepository(Notification) private readonly notificationsRepository: Repository<Notification>,
        @InjectRepository(BuyRequest) private readonly buyRequestsRepository: Repository<BuyRequest>,
        @InjectRepository(Product) private readonly productsRepository: Repository<Product>,
    ) {}

    async createNotification( payload: CreateNotificationPayload): Promise<Notification> {
        const audience = payload.audience ?? NotificationAudience.USER;

        if (audience === NotificationAudience.USER && !payload.user) {
            throw new BadRequestException('User is required for USER notifications');
        }

        if (
            (audience === NotificationAudience.ADMINS || audience === NotificationAudience.SYSTEM) 
            && payload.user
        ) {
            throw new BadRequestException('User must be null for ADMIN or SYSTEM notifications');
        }

        const notification = this.notificationsRepository.create(
            {
                user: payload.user ?? null,
                audience,
                type: payload.type,
                title: payload.title,
                message: payload.message,
                relatedEntityType: payload.relatedEntityType,
                relatedEntityId: payload.relatedEntityId,
                senderId: payload.senderId ?? null,
                senderName: payload.senderName ?? null,
                isRead: false,
                isDeleted: false,
            } as Partial<Notification>,
        );

        return this.notificationsRepository.save(notification);
    }

    async getNotifications( user: User, query: GetNotificationsQueryDto ) {
        try {
            const { pageNumber, pageSize, type, isRead } = query;
            const skip = (pageNumber - 1) * pageSize;

            const qb = this.notificationsRepository
                .createQueryBuilder('notification')
                .leftJoinAndSelect('notification.user', 'user')
                .where('notification.isDeleted = FALSE')
                .andWhere('notification.userId = :userId', { userId: user.id })
                .orderBy('notification.createdAt', 'DESC');

            if (type) {
                qb.andWhere('notification.type = :type', { type });
            }

            if (isRead !== undefined) {
                qb.andWhere('notification.isRead = :isRead', { isRead });
            }

            qb.select([
                'notification.id',
                'notification.type',
                'notification.title',
                'notification.message',
                'notification.relatedEntityType',
                'notification.relatedEntityId',
                'notification.senderId',
                'notification.senderName',
                'notification.productId',
                'notification.isRead',
                'notification.createdAt',
                'notification.updatedAt',
                'user.id',
                'user.firstName',
                'user.lastName',
                'user.email',
            ]);

            const [items, totalRecord] = await qb
                .skip(skip)
                .take(pageSize)
                .getManyAndCount();

            const unreadCount = await this.notificationsRepository.count({
                where: {
                    user: { id: user.id },
                    isRead: false,
                    isDeleted: false,
                },
            });

            return {
                statusCode: 200,
                message: 'Notifications retrieved successfully',
                data: {
                    items,
                    totalRecord,
                    pageNumber,
                    pageSize,
                    unreadCount,
                },
            };
        } catch (error) {
            this.logger.error( `Failed to retrieve notifications for user ${user.id}`, error.stack,);
            handleServiceError(error, 'An error occurred while retrieving user notifications');
        }
    }

    async getNotificationById( notificationId: string, user: User): Promise<any> {
        try {
            const notification = await this.notificationsRepository.findOne({
                where: {
                    id: notificationId,
                    user: { id: user.id },
                    isDeleted: false,
                },
                relations: {
                    user: true,
                },
                select: {
                    id: true,
                    type: true,
                    title: true,
                    message: true,
                    relatedEntityType: true,
                    relatedEntityId: true,
                    senderId: true,
                    senderName: true,
                    productId: true,
                    isRead: true,
                    createdAt: true,
                    updatedAt: true,
                    user: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            });

            if (!notification) {
                throw new NotFoundException('Notification not found');
            }

            return {
                statusCode: 200,
                message: 'Notification retrieved successfully',
                data: instanceToPlain(notification),
            };
        } catch (error) {
            this.logger.error( `Failed to fetch notification ${notificationId} for user ${user.id}`, error.stack);
            handleServiceError(error, 'An error occurred while retrieving user notification');
        }
    }

    async markAsRead(notificationId: string, user: User): Promise<any> {
        try {
            const notification = await this.notificationsRepository.findOne({
                where: {
                    id: notificationId,
                    user: { id: user.id },
                    isDeleted: false,
                },
            });

            if (!notification) {
                throw new NotFoundException( 'Notification not found or does not belong to user' );
            }

            // If already read
            if (notification.isRead) {
                return {
                    statusCode: 200,
                    message: 'Notification already marked as read',
                    data: {
                        id: notification.id,
                        isRead: true,
                    },
                };
            }

            notification.isRead = true;
            await this.notificationsRepository.save(notification);

            return {
                statusCode: 200,
                message: 'Notification marked as read',
                data: {
                    id: notification.id,
                    isRead: true,
                },
            };
        } catch (error) {
            this.logger.error(`Failed to mark notification ${notificationId} as read`, error.stack,);
            handleServiceError(error, 'An error occurred, failed to mark notification as read');
        }
    }

    async markAllAsRead(user: User): Promise<any> {
        try {
            const result = await this.notificationsRepository
                .createQueryBuilder()
                .update(Notification)
                .set({ isRead: true })
                .where('userId = :userId', { userId: user.id })
                .andWhere('isRead = false')
                .andWhere('isDeleted = false')
                .execute();

            return {
                statusCode: 200,
                message: 'All notifications marked as read',
                data: {
                    markedCount: result.affected ?? 0,
                },
            };
        } catch (error) {
            this.logger.error(`Failed to mark all notifications as read for user ${user.id}`, error.stack,);
            handleServiceError(error, 'An error occurred, failed to mark all notifications as read');
        }
    }

    async contactBuyer( dto: ContactBuyerDto, farmer: User): Promise<any> {
        try {
            const buyRequest = await this.buyRequestsRepository.findOne({
                where: { id: dto.buyRequestId, isDeleted: false },
                relations: ['buyer', 'seller', 'product', 'cropType'],
            });

            if (!buyRequest) {
                throw new NotFoundException('Buy request not found');
            }

             if (buyRequest.seller) {
                throw new BadRequestException(
                    'This buy request has already been directed to a seller and can no longer be contacted.',
                );
            }

            // Ensure processor matches request buyer
            if (buyRequest.buyer.id !== dto.processorId) {
                throw new ForbiddenException('This buy request does not belong to the specified processor' );
            }

            // Validate selected product if provided
            let validatedProductId: string | null = null;
            if (dto.productId) {
                const product = await this.productsRepository.findOne({
                    where: { id: dto.productId, isDeleted: false },
                    relations: ['owner', 'cropType'],
                });

                if (!product) {
                    throw new NotFoundException('Selected product not found');
                }
                if (product.owner?.id !== farmer.id) {
                    throw new ForbiddenException('Selected product does not belong to you');
                }
                if (product.approvalStatus !== ProductApprovalStatus.APPROVED) {
                    throw new BadRequestException('Selected product is not approved');
                }
                const available = new Decimal(product.quantityKg).minus(product.reservedQuantityKg);
                if (available.lte(0)) {
                    throw new BadRequestException('Selected product has no available inventory');
                }
                if (buyRequest.cropType && product.cropType && product.cropType.id !== buyRequest.cropType.id) {
                    throw new BadRequestException('Selected product crop does not match the buy request crop');
                }
                validatedProductId = product.id;
            }

            const processor = buyRequest.buyer;

            const farmerName = `${farmer.firstName.toLowerCase()} ${farmer.lastName.toLowerCase()}`;
            const cropName = buyRequest.cropType?.name || 'agricultural products';

            const message =
            dto.message ||
            `Hi, I'm ${farmerName} and I have ${cropName} available. ` +
            `You can view my profile and direct your request, send a purchase order, or contact me.\n` +
            `Farm is located in ${farmer.state}, ${farmer.country}.`;

            const notification = await this.createNotification({
                user: processor,
                type: NotificationType.Contact_Message,
                title: `New Contact Message from ${farmerName}`,
                message,
                senderId: farmer.id,
                senderName: farmerName,
                relatedEntityType: RelatedEntityType.BuyRequest,
                relatedEntityId: buyRequest.id,
            });

            // Persist productId on the notification row
            if (validatedProductId) {
                notification.productId = validatedProductId;
                await this.notificationsRepository.save(notification);
            }

            // Derive cropId from the product for the response
            const cropId = validatedProductId
                ? (await this.productsRepository.findOne({ where: { id: validatedProductId }, relations: ['cropType'] }))?.cropType?.id ?? null
                : null;

            return {
                statusCode: 201,
                message: 'Contact message sent successfully',
                data: {
                    id: notification.id,
                    type: notification.type,
                    title: notification.title,
                    message: notification.message,
                    senderId: farmer.id,
                    senderName: farmerName,
                    recipientId: processor.id,
                    relatedEntityType: notification.relatedEntityType,
                    relatedEntityId: notification.relatedEntityId,
                    productId: validatedProductId,
                    cropId,
                    isRead: notification.isRead,
                    createdAt: notification.createdAt,
                },
            };
        } catch (error) {
            this.logger.error( `Failed to send contact message: ${error.message}` );
            handleServiceError(error, 'An error occurred while sending contact message');
        }
    }


}
