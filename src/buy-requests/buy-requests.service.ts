import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, MoreThan, Repository } from 'typeorm';
import { BuyRequest, BuyRequestStatus, OrderState } from './entities/buy-request.entity';
import { Crop } from 'src/crops/entities/crop.entity';
import { QualityStandard } from 'src/quality-standards/entities/quality-standard.entity';
import { Product } from 'src/products/entities/product.entity';
import { CreateBuyRequestDto } from './dtos/create-buy-request.dto';
import { User, UserRole } from 'src/users/entities/user.entity';
import { handleServiceError } from 'src/common/utils/error-handler.util';
import { UsersService } from 'src/users/users.service';
import { instanceToPlain } from 'class-transformer';
import { UpdateBuyRequestStatusDto } from './dtos/update-buy-request-status.dto';
import { UpdateBuyRequestDto } from './dtos/update-buy-request.dto';
import { UpdateOrderStateDto } from './dtos/update-order-state.dto';
import { UpdateTrackingDto } from './dtos/update-tracking.dto';
import { OngoingBuyRequestOrdersQueryDto } from './dtos/ongoing-buy-request-orders-query.dto';
import { detectMimeTypeFromBase64, isValidBase64SizeGeneric, PO_SUPPORTED_MIME_TYPES, SUPPORTED_MIME_TYPES } from 'src/common/utils/base64.util';
import { PurchaseOrderDocFilesService } from 'src/purchase-order-doc-files/purchase-order-doc-files.service';
import { UpdatePurchaseOrderDocDto } from './dtos/update-purchase-order-doc.dto';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationType, RelatedEntityType } from 'src/notifications/entities/notification.entity';
import { DirectBuyRequestDto } from './dtos/direct-buy-request.dto';
import { GetAllBuyRequestsQueryDto } from './dtos/get-all-buy-requests.query.dto';
import { ProductInventoriesService } from 'src/product-inventories/product-inventories.service';
import Decimal from 'decimal.js';
import { ProductInventory, ProductInventoryType } from 'src/product-inventories/entities/product-inventory.entity';

@Injectable()
export class BuyRequestsService {
    private readonly logger = new Logger(BuyRequestsService.name);
    
    constructor(
        @InjectRepository(BuyRequest) private readonly buyRequestsRepository: Repository<BuyRequest>,
        @InjectRepository(Crop) private readonly cropsRepository: Repository<Crop>,
        @InjectRepository(QualityStandard) private readonly qualityStandardRepository: Repository<QualityStandard>,
        @InjectRepository(Product) private readonly productsRepository: Repository<Product>,
        @InjectRepository(User) private readonly usersRepository: Repository<User>,
        private readonly usersService: UsersService,
        private readonly fileService: PurchaseOrderDocFilesService,
        private readonly notificationsService: NotificationsService,
        private readonly productInventoriesService: ProductInventoriesService,  
        private readonly dataSource: DataSource,
    ) {}

    
    async create(dto: CreateBuyRequestDto, buyer: User): Promise<any> {
        const { cropId, qualityStandardId, productId, sellerId, purchaseOrderDoc, ...rest } = dto;

        try{
            if (dto.isGeneral){
                if(dto.sellerId) throw new BadRequestException(`General buy request doesn't require a sellerId to be provided at initiation`);
                if(dto.productId) throw new BadRequestException(`General buy request doesn't require a productId to be provided at initiation`);
                if(purchaseOrderDoc) throw new BadRequestException(`General buy request creation doesn't require purchaseOrderDoc upload`);
            }else{
                if(!dto.sellerId) throw new BadRequestException(`buyRequest requires a sellerId to be provided at initiation`);
                if(!dto.productId) throw new BadRequestException(`buyRequest requires a productId to be provided at initiation`);
                if(!purchaseOrderDoc) throw new BadRequestException(`buyRequest requires purchaseOrderDoc upload`);
            }

            // Allowed docsize - 2mb
            const docSize = 1 * 1024 * 1024;

            if (purchaseOrderDoc){
                const detected = detectMimeTypeFromBase64(purchaseOrderDoc);

                if (!detected || !PO_SUPPORTED_MIME_TYPES.includes(detected)) {
                    throw new BadRequestException( 'PurchaseOrderDoc must be DOC or PDF format.' );
                }

                // Validate size: 1MB
                if (!isValidBase64SizeGeneric(purchaseOrderDoc, docSize)) {
                    throw new BadRequestException('PurchaseOrderDoc must be 1MB or less.');
                }
            }

            const crop = await this.cropsRepository.findOne({ where: { id: dto.cropId } });
            if (!crop) throw new BadRequestException('Invalid cropId');

            let qualityStandard: QualityStandard | null = null;
            if (dto.qualityStandardId) {
                qualityStandard = await this.qualityStandardRepository.findOne({
                    where: { id: dto.qualityStandardId, },
                });

                if (dto.qualityStandardId && !qualityStandard)
                    throw new BadRequestException('Invalid qualityStandardId');
            }

            let product: Product | null = null;

            if (dto.productId) {
                product = await this.productsRepository.findOne({
                    where: { id: dto.productId, isDeleted: false },
                    relations: ['owner', 'cropType']
                });
                if (!product) throw new BadRequestException('Invalid productId');
            }

            if (dto.productId && product && product.cropType.id !== dto.cropId){
                throw new BadRequestException(`Seller's product crop type: ${product.cropType.name} should match the crop type required on BuyRequest`);
            }

            const requestNumber = await this.generateRequestNumber();

            const seller = dto.sellerId ? await this.usersService.findUserEntity(dto.sellerId) : null;

            if (seller && seller.role !== UserRole.FARMER) {
                throw new BadRequestException('Seller must be a farmer');
            }

            const buyRequest = this.buyRequestsRepository.create({
                ...rest,
                cropType: crop,
                qualityStandardType: qualityStandard,
                buyer,
                seller,
                product,
                requestNumber,
                status: BuyRequestStatus.PENDING,
            });

            const savedBuyRequest = await this.buyRequestsRepository.save(buyRequest);

            // Upload doc
            if (purchaseOrderDoc){
                const uploadedDoc = await this.fileService.uploadFile(purchaseOrderDoc, `PurchaseOrderDoc`, savedBuyRequest);
                // Attach OneToOne so TypeORM does not break
                savedBuyRequest.purchaseOrderDoc = uploadedDoc;
            }
            
            await this.buyRequestsRepository.save(savedBuyRequest);

            // Not-General: Notify the seller request is directed to
            if (!dto.isGeneral && seller){
                await this.notificationsService.createNotification({
                    user: seller,
                    type: NotificationType.BuyRequest,
                    title: `Direct Buy Request REQ-${requestNumber}`,
                    message: 
                        `You have received a direct buy request REQ-${requestNumber} From ${buyer?.companyName?.toUpperCase()}. \n` + `Buyer location: ${buyer.state}, ${buyer.country}`, 
                    relatedEntityType: RelatedEntityType.BuyRequest,
                    relatedEntityId: savedBuyRequest.id
                });
            }

            if (dto.isGeneral){
                const farmers = await this.usersRepository.find({
                    where: {
                        role: UserRole.FARMER,
                        isDeleted: false,
                    },
                });

                for (const farmer of farmers) {
                    await this.notificationsService.createNotification({
                        user: farmer,
                        type: NotificationType.System,
                        title: `New General BuyRequest Availability`,
                        message:
                            `New general buyer's request REQ-${savedBuyRequest.requestNumber} is now available on the system. Processor is asking for a ${crop.name.toUpperCase()} product.`,
                        relatedEntityType: RelatedEntityType.BuyRequest,
                        relatedEntityId: savedBuyRequest.id
                    });
                }
            }

            return {
                statusCode: 201,
                message: 'BuyRequest created successfully!',
                data: instanceToPlain(savedBuyRequest)
            };
        }catch(error){
            handleServiceError(error, 'An error occurred, while creating BuyRequest');
        }
    }

    async updateBuyRequest(dto: UpdateBuyRequestDto, currentUser: User,): Promise<any> {
        try {
            const buyRequest = await this.buyRequestsRepository.findOne({
                where: { id: dto.buyRequestId, isDeleted: false },
                relations: ['buyer', 'qualityStandardType'],
            });

            if (!buyRequest) {
                throw new NotFoundException('Buy request not found');
            }

            // Ensure only the buyer who created it can update
            if (buyRequest.buyer.id !== currentUser.id) {
                throw new ForbiddenException('You are not authorized to update this buy request');
            }

            // Block editing
            const editableStatuses = [
                BuyRequestStatus.PENDING,
                BuyRequestStatus.REJECTED,
            ];

            if (!editableStatuses.includes(buyRequest.status)) {
                throw new BadRequestException('BuyRequest cannot be updated');
            }

            // Handle qualityStandard change
            if (dto.qualityStandardId) {
                const qualityStandard = await this.qualityStandardRepository.findOne({
                    where: { id: dto.qualityStandardId },
                });

                if (!qualityStandard) {
                    throw new BadRequestException('Invalid qualityStandardId');
                }

                buyRequest.qualityStandardType = qualityStandard;
            }

            // Map other editable fields
            const editableFields: (keyof UpdateBuyRequestDto)[] = [
                'description',
                'productQuantityKg',
                'pricePerKgOffer',
                'estimatedDeliveryDate',
                'deliveryLocation',
                'preferredPaymentMethod',
            ];

            for (const field of editableFields) {
                if (dto[field] !== undefined && dto[field] !== null) {
                    (buyRequest as any)[field] = dto[field];
                }
            }

            // Reset status to PENDING
            buyRequest.status = BuyRequestStatus.PENDING;

            const saved = await this.buyRequestsRepository.save(buyRequest);

            return {
                statusCode: 200,
                message: 'Buy request updated successfully!',
                data: instanceToPlain(saved),
            };
        } catch (error) {
            handleServiceError(error, 'An error occurred while updating buy request');
        }
    }

    async updateStatus1(dto: UpdateBuyRequestStatusDto, currentUser: User,): Promise<any> {
        try {
            const buyRequest = await this.buyRequestsRepository.findOne({
                where: { id: dto.buyRequestId, isDeleted: false },
                relations: ['buyer', 'seller', 'product'],
            });

            if (!buyRequest) throw new NotFoundException('BuyRequest not found');

            const editableStates = [
                OrderState.AWAITING_SHIPPING,
            ];

            if (buyRequest.orderState != null && !editableStates.includes(buyRequest.orderState)) {
                throw new BadRequestException('BuyRequest cannot be updated');
            }
            
            // Only farmer (seller) can update status
            // if (currentUser.role !== 'farmer')
            // throw new BadRequestException('Only farmers can update requests');

            // Case: General request
            if (buyRequest.isGeneral) {
                
                // FOR NOW - isGeneral case needs to be directed to a seller first, bfor its status can be changed
                throw new BadRequestException('BuyRequest is general, contact the buyer');

                // if (dto.status !== BuyRequestStatus.ACCEPTED) {
                //     throw new BadRequestException('Farmer can only accept general buyRequests');
                // }

                // if (!dto.productId) {
                //     throw new BadRequestException('Provide a productId to accept a general buyRequest');
                // }

                // const product = await this.productsRepository.findOne({
                //     where: { id: dto.productId, owner: { id: currentUser.id }, isDeleted: false },
                // });

                // if (!product) {
                //     throw new BadRequestException('Invalid productId or product does not belong to this farmer', );
                // }

                // buyRequest.status = BuyRequestStatus.ACCEPTED; // general can only set status to accepted
                // buyRequest.seller = currentUser;
                // buyRequest.product = product;
                // // OrderState updates
                // buyRequest.orderState = OrderState.AWAITING_SHIPPING;
                // buyRequest.orderStateTime = new Date();
            }
            // Case: Directed buyrequest
            else {

                if (!buyRequest.seller || buyRequest.seller.id !== currentUser.id) {
                    throw new ForbiddenException('This farmer is not authorized to update this request');
                }

                if (
                    ![ BuyRequestStatus.ACCEPTED, BuyRequestStatus.REJECTED, BuyRequestStatus.CANCELLED,].includes(dto.status)
                ) {
                    throw new BadRequestException('Invalid status update for directed buy request',);
                }

                buyRequest.status = dto.status;

                if (dto.status === BuyRequestStatus.ACCEPTED && !dto.productId){
                    throw new BadRequestException('BuyRequest must be accepted with a productId');
                } 

                // If accepted, optionally update product
                if (dto.status === BuyRequestStatus.ACCEPTED && dto.productId) {
                    const product = await this.productsRepository.findOne({
                        where: { id: dto.productId, owner: { id: currentUser.id }, isDeleted: false },
                    });

                    if (!product) {
                        throw new BadRequestException('Invalid productId or product does not belong to this farmer',);
                    }

                    buyRequest.product = product;
                    // OrderState updates
                    buyRequest.orderState = OrderState.AWAITING_SHIPPING;
                    buyRequest.orderStateTime = new Date();

                    // Notification to Buyer
                    await this.notificationsService.createNotification({
                        user: buyRequest.buyer,
                        type: NotificationType.BuyRequest,
                        title: `Buy Request Accepted: REQ-${buyRequest.requestNumber}`,
                        message: 
                            `Your buy request REQ-${buyRequest.requestNumber} has been accepted by ${buyRequest.seller.firstName.toLowerCase()}. \n` + 
                            `The order is now awaiting shipping`, 
                        relatedEntityType: RelatedEntityType.BuyRequest,
                        relatedEntityId: buyRequest.id
                    });
                }

                if (dto.status !== BuyRequestStatus.ACCEPTED) {
                    buyRequest.product = null;
                    // OrderState updates
                    buyRequest.orderState = null;
                    buyRequest.orderStateTime = null;
                }
            }

            const savedBuyRequest = await this.buyRequestsRepository.save(buyRequest);

            // Notification to Buyer
            if (dto.status !== BuyRequestStatus.ACCEPTED) {
                var title = `Buy Request ${savedBuyRequest.status.toLowerCase()}: REQ-${savedBuyRequest.requestNumber}`;
                var message = `Your buy request REQ-${buyRequest.requestNumber} has been ${savedBuyRequest.status.toLowerCase()} by ${buyRequest.seller.firstName.toLowerCase()}.`; 

                await this.notificationsService.createNotification({
                    user: buyRequest.buyer,
                    type: NotificationType.BuyRequest,
                    title,
                    message,
                    relatedEntityType: RelatedEntityType.BuyRequest,
                    relatedEntityId: buyRequest.id
                });
            }
            
            return {
                statusCode: 200,
                message: `BuyRequest status updated successfully`,
                data: instanceToPlain(savedBuyRequest)
            };
        } catch (error) {
            handleServiceError(error, 'An error occurred, while updating BuyRequest status');
        }
    }

    async updateOrderState(dto: UpdateOrderStateDto, currentUser: User): Promise<any> {
        try {
            const buyRequest = await this.buyRequestsRepository.findOne({
                where: { id: dto.buyRequestId, isDeleted: false },
                relations: ['buyer', 'seller'],
            });

            if (!buyRequest) {
                throw new NotFoundException('BuyRequest not found');
            }

            if (buyRequest.orderState === OrderState.COMPLETED) {
                throw new ForbiddenException('BuyRequest is completed');
            }

            // ROLE-BASED LOGIC
            const isAdmin = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUPER_ADMIN;
            const isBuyer = currentUser.id === buyRequest.buyer?.id;
            const isSeller = currentUser.id === buyRequest.seller?.id;

            // 1️⃣ Only Admin or Buyer/Seller-Linked-to-Request can access this endpoint
            if (!isAdmin && !isBuyer && !isSeller) {
                throw new ForbiddenException('You are not authorized to update order state for this request');
            }

            // 2️⃣ Handle state-specific permissions
            if (dto.orderState === OrderState.IN_TRANSIT && !isAdmin && !isSeller) {
                throw new ForbiddenException('Only admin or seller can set order state to in_transit');
            }

            if (dto.orderState === OrderState.AWAITING_SHIPPING) {
                throw new ForbiddenException('Order cannot be manually reverted to awaiting_shipping');
            }

            if (dto.orderState === OrderState.DELIVERED && !isAdmin && !isBuyer) {
                throw new ForbiddenException('Only buyer or admin can mark as DELIVERED');
            }

            if (dto.orderState === OrderState.COMPLETED) {
                throw new ForbiddenException('Order completion is automated');
            }

            // ✅ HANDLE ADMIN/SELLER CONFIRM PAYMENT → IN_TRANSIT
            if ((isAdmin || isSeller) && dto.orderState === OrderState.IN_TRANSIT) {
                let quantity: Decimal;
                let pricePerKg: Decimal;

                try {
                    quantity = new Decimal(buyRequest.productQuantityKg);
                    pricePerKg = new Decimal(buyRequest.pricePerKgOffer);
                } catch {
                    throw new BadRequestException(
                        'Invalid productQuantityKg or pricePerKgOffer format',
                    );
                }

                const totalAmount = quantity.mul(pricePerKg).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
                
                buyRequest.paymentAmount = totalAmount.toString(); // store as string
                buyRequest.paymentConfirmed = true;
                buyRequest.paymentConfirmedAt = new Date();

                // Notification to Buyer
                await this.notificationsService.createNotification({
                    user: buyRequest.buyer,
                    type: NotificationType.BuyRequest,
                    title: `Order In Transit: REQ-${buyRequest.requestNumber}`,
                    message: `Buy request REQ-${buyRequest.requestNumber} order is in transit.`,
                    relatedEntityType: RelatedEntityType.BuyRequest,
                    relatedEntityId: buyRequest.id
                });
            }

            // ✅ Update orderState + orderStateTime
            buyRequest.orderState = dto.orderState;
            buyRequest.orderStateTime = new Date();

            const updatedBuyRequest = await this.buyRequestsRepository.save(buyRequest);

            // Notification to Seller
            if(buyRequest.seller != null){
                var title = `Order Delivered: REQ-${buyRequest.requestNumber}`;
                var message = `Your buy request REQ-${buyRequest.requestNumber} has been delivered to ${buyRequest.buyer.companyName?.toUpperCase()}.`; 

                await this.notificationsService.createNotification({
                    user: buyRequest.seller,
                    type: NotificationType.BuyRequest,
                    title,
                    message,
                    relatedEntityType: RelatedEntityType.BuyRequest,
                    relatedEntityId: buyRequest.id
                });
            }

            return {
                statusCode: 200,
                message: `Order state updated to ${dto.orderState}`,
                data: instanceToPlain(updatedBuyRequest),
            };
        } catch (error) {
            handleServiceError(error, 'An error occurred while updating order state');
        }
    }

    /**
     * Link an AgroTrack tracking number to a buy request.
     * Does not change orderState or paymentConfirmed (Phase 2).
     */
    async updateTracking(dto: UpdateTrackingDto, currentUser: User): Promise<any> {
        try {
            const buyRequest = await this.buyRequestsRepository.findOne({
                where: { id: dto.buyRequestId, isDeleted: false },
                relations: ['buyer', 'seller', 'cropType', 'qualityStandardType', 'product'],
            });

            if (!buyRequest) {
                throw new NotFoundException('BuyRequest not found');
            }

            const isAdmin =
                currentUser.role === UserRole.ADMIN ||
                currentUser.role === UserRole.SUPER_ADMIN;
            const isBuyer = currentUser.id === buyRequest.buyer?.id;
            const isSeller = currentUser.id === buyRequest.seller?.id;

            if (!isAdmin && !isBuyer && !isSeller) {
                throw new ForbiddenException(
                    'You are not authorized to link tracking for this request',
                );
            }

            const tracking = dto.agroTrackTrackingNumber
                .trim()
                .replace(/^#/, '')
                .toUpperCase();

            if (!tracking) {
                throw new BadRequestException('agroTrackTrackingNumber is required');
            }

            buyRequest.agroTrackTrackingNumber = tracking;
            const updated = await this.buyRequestsRepository.save(buyRequest);

            return {
                statusCode: 200,
                message: 'AgroTrack tracking number linked successfully',
                data: instanceToPlain(updated),
            };
        } catch (error) {
            handleServiceError(error, 'An error occurred while linking AgroTrack tracking');
        }
    }

    async getAllBuyRequests( query: GetAllBuyRequestsQueryDto, ): Promise<any> {
        try {
            const pageNumber = query.pageNumber ? Number(query.pageNumber) : 1;
            const pageSize = query.pageSize ? Number(query.pageSize) : 20;
            const skip = (pageNumber - 1) * pageSize;

            const qb = this.buyRequestsRepository
                .createQueryBuilder('buyRequest')
                .leftJoinAndSelect('buyRequest.cropType', 'cropType')
                .leftJoinAndSelect('buyRequest.buyer', 'buyer')
                .leftJoinAndSelect('buyRequest.seller', 'seller')
                .leftJoinAndSelect('buyRequest.product', 'product')
                .leftJoinAndSelect('buyRequest.ratings', 'ratings')
                .where('buyRequest.isDeleted = FALSE')
                .orderBy('buyRequest.createdAt', 'DESC');

            // 🔹 Filter: General buy requests
            if (query.isGeneral !== undefined) {
                qb.andWhere('buyRequest.isGeneral = :isGeneral', {
                    isGeneral: query.isGeneral,
                });
            }

            // 🔹 Search: crop name OR delivery location
            if (query.search) {
                qb.andWhere(
                    `
                    cropType.name ILIKE :search
                    OR buyRequest.deliveryLocation ILIKE :search
                    `,
                    {
                        search: `%${query.search}%`,
                    },
                );
            }

            const [items, totalRecord] = await qb
                .skip(skip)
                .take(pageSize)
                .getManyAndCount();

            return {
                statusCode: 200,
                message: 'Buyrequests fetched successfully',
                data: {
                    items: instanceToPlain(items),
                    totalRecord,
                    pageNumber,
                    pageSize,
                },
            };
        } catch (error) {
            // this.logger.error( 'Error while fetching buy requests',error.stack,);
            handleServiceError( error, 'An error occurred while fetching buy requests', );
        }
    }

    async findGeneralRequests(): Promise<any> {
        try {
            const now = new Date();
            const oneWeekAgo = new Date(now);
            oneWeekAgo.setDate(now.getDate() - 7);

            const buyRequests = await this.buyRequestsRepository.find({
                where: {
                    isGeneral: true,
                    isDeleted: false,
                    status: BuyRequestStatus.PENDING,
                    createdAt: MoreThan(oneWeekAgo),
                },
                order: { createdAt: 'DESC' },
            });

            return {
                statusCode: 200,
                message: 'General buy requests fetched successfully',
                data: buyRequests,
            };
        } catch (error) {
            handleServiceError(error, 'An error occurred, while fetching general BuyRequest');
        }
    }

    async findMyBuyRequests(
        currentUser: User,
        status?: BuyRequestStatus,
        pageNumber: number = 1,
        pageSize: number = 20,
    ): Promise<any> {
        try {
            const skip = (pageNumber - 1) * pageSize;

            // Determine allowed statuses based on role
            let allowedStatuses: BuyRequestStatus[];

            if (currentUser.role === UserRole.FARMER) {
                // Farmers can only see requests where they are the seller
                // and only if status is ACCEPTED or REJECTED
                allowedStatuses = [
                    BuyRequestStatus.PENDING,
                    BuyRequestStatus.ACCEPTED, 
                    BuyRequestStatus.REJECTED
                ];
            } else if (currentUser.role === UserRole.PROCESSOR) {
                // Processors (buyers) can see all
                allowedStatuses = [
                    BuyRequestStatus.PENDING,
                    BuyRequestStatus.ACCEPTED,
                    BuyRequestStatus.REJECTED,
                    BuyRequestStatus.CANCELLED,
                ];
            } else {
                throw new ForbiddenException('Only farmers and processors can view buy requests');
            }

            // Narrow down status filter if provided
            if (status && !allowedStatuses.includes(status)) {
                throw new ForbiddenException(`You are not allowed to view requests with status ${status}`);
            }

            // QueryBuilder for robust relational filtering
            const qb = this.buyRequestsRepository
                .createQueryBuilder('buyRequest')
                .leftJoinAndSelect('buyRequest.cropType', 'cropType')
                .leftJoinAndSelect('buyRequest.qualityStandardType', 'qualityStandardType')
                .leftJoinAndSelect('buyRequest.buyer', 'buyer')
                .leftJoinAndSelect('buyRequest.seller', 'seller')
                .leftJoinAndSelect('buyRequest.product', 'product')
                .leftJoinAndSelect('buyRequest.purchaseOrderDoc', 'purchaseOrderDoc')
                .leftJoinAndSelect('buyRequest.ratings', 'ratings')
                .where('buyRequest.isDeleted = false');

            if (status) {
                qb.andWhere('buyRequest.status = :status', { status });
            } else {
                qb.andWhere('buyRequest.status IN (:...statuses)', { statuses: allowedStatuses });
            }

            if (currentUser.role === UserRole.FARMER) {
                qb.andWhere('buyRequest.sellerId = :userId', { userId: currentUser.id });
            } else if (currentUser.role === UserRole.PROCESSOR) {
                qb.andWhere('buyRequest.buyerId = :userId', { userId: currentUser.id });
            }

            qb.orderBy('buyRequest.createdAt', 'DESC')
                .skip(skip)
                .take(pageSize);

            const [items, totalRecord] = await qb.getManyAndCount();

            return {
                statusCode: 200,
                message: 'Buy requests fetched successfully',
                data: {
                    items: instanceToPlain(items),
                    totalRecord,
                    pageNumber,
                    pageSize,
                },
            };
        } catch (error) {
            handleServiceError(error, 'An error occurred while fetching buy requests');
        }
    }

    async findOngoingBuyRequestOrders(query: OngoingBuyRequestOrdersQueryDto) {
        try {
            const {
                search,
                state,
                pageNumber = 1,
                pageSize = 20,
            } = query;

            const skip = (pageNumber - 1) * pageSize;

            const qb = this.buyRequestsRepository
                .createQueryBuilder('buyRequest')
                .leftJoinAndSelect('buyRequest.buyer', 'buyer')
                .leftJoinAndSelect('buyRequest.seller', 'seller')
                .leftJoinAndSelect('buyRequest.product', 'product')
                .leftJoinAndSelect('buyRequest.purchaseOrderDoc', 'purchaseOrderDoc')
                .leftJoinAndSelect('buyRequest.ratings', 'ratings')
                .where('buyRequest.isDeleted = false');

            // Apply state filter
            if (state) {
                qb.andWhere('buyRequest.orderState = :state', { state });
            } else {
                qb.andWhere(
                    'buyRequest.orderState IN (:...states)',
                    {
                        states: [
                            OrderState.AWAITING_SHIPPING,
                            OrderState.IN_TRANSIT,
                            OrderState.DELIVERED,
                            OrderState.COMPLETED,
                        ],
                    },
                );
            }

            // Apply search filter
            if (search) {
            qb.andWhere(
                `(
                    LOWER(buyer.firstName) LIKE :s OR
                    LOWER(buyer.lastName) LIKE :s OR
                    LOWER(buyer.farmAddress) LIKE :s OR
                    LOWER(buyer.country) LIKE :s OR
                    LOWER(buyer.state) LIKE :s OR
                    LOWER(buyer.farmName) LIKE :s OR

                    LOWER(seller.firstName) LIKE :s OR
                    LOWER(seller.lastName) LIKE :s OR
                    LOWER(seller.farmAddress) LIKE :s OR
                    LOWER(seller.country) LIKE :s OR
                    LOWER(seller.state) LIKE :s OR
                    LOWER(seller.farmName) LIKE :s OR

                    LOWER(product.name) LIKE :s
                )`,
                { s: `%${search.toLowerCase()}%` },
            );
            }

            qb.orderBy('buyRequest.createdAt', 'DESC')
                .skip(skip)
                .take(pageSize);

            const [items, totalRecord] = await qb.getManyAndCount();

            return {
                statusCode: 200,
                message: 'Ongoing buyrequest orders fetched successfully',
                data: {
                    items: instanceToPlain(items),
                    totalRecord,
                    pageNumber,
                    pageSize,
                },
            };
        } catch (error) {
            handleServiceError( error, 'An error occurred while fetching ongoing buy requests');
        }
    }

    async findBuyRequest(buyRequestId: string): Promise<any> {
        try {
            const buyRequest = await this.buyRequestsRepository.findOne({
                where: {
                    id: buyRequestId,
                    isDeleted: false,
                },
                relations: ['buyer', 'seller', 'product', 'qualityStandardType', 'purchaseOrderDoc', 'ratings']
            });

            if (!buyRequest) {
                throw new NotFoundException(`buyRequest not found`);
            }

            return {
                statusCode: 200,
                message: 'BuyRequest fetched successfully',
                data: instanceToPlain(buyRequest),
            };
        } catch (error) {
            handleServiceError(error, 'An error occurred while fetching buyRequest');
        }
    }

    async findUserBuyRequests(userId: string): Promise<any> {
        try {
            // Check if user exists
            const user = await this.usersService.findUserEntity(userId);
            if (!user) throw new NotFoundException('User not found');

            // Determine which relation to filter by (buyer/seller)
            const query = this.buyRequestsRepository.createQueryBuilder('buyRequest')
                .leftJoinAndSelect('buyRequest.cropType', 'cropType')
                .leftJoinAndSelect('buyRequest.qualityStandardType', 'qualityStandardType')
                .leftJoinAndSelect('buyRequest.buyer', 'buyer')
                .leftJoinAndSelect('buyRequest.seller', 'seller')
                .leftJoinAndSelect('buyRequest.product', 'product')
                .leftJoinAndSelect('buyRequest.purchaseOrderDoc', 'purchaseOrderDoc')
                .leftJoinAndSelect('buyRequest.ratings', 'ratings')
                .where('buyRequest.isDeleted = false');

            if (user.role === UserRole.FARMER) {
                // Farmer: seller side — only accepted or rejected requests
                query.andWhere('seller.id = :userId', { userId })
                    .andWhere('buyRequest.status IN (:...statuses)', {
                        statuses: [
                            BuyRequestStatus.PENDING,
                            BuyRequestStatus.ACCEPTED, 
                            BuyRequestStatus.REJECTED
                        ],
                    });
            } else if (user.role === UserRole.PROCESSOR) {
                // Processor: buyer side — can see all their requests
                query.andWhere('buyer.id = :userId', { userId })
                    .andWhere('buyRequest.status IN (:...statuses)', {
                        statuses: [
                            BuyRequestStatus.PENDING,
                            BuyRequestStatus.ACCEPTED,
                            BuyRequestStatus.REJECTED,
                            BuyRequestStatus.CANCELLED,
                        ],
                    });
            } else {
                throw new BadRequestException('User role not authorized to view buy requests');
            }

            const buyRequests = await query
                .orderBy('buyRequest.createdAt', 'DESC')
                .getMany();


            return {
                statusCode: 200,
                message: 'User buy requests fetched successfully',
                data: buyRequests
            };
        } catch (error) {
            handleServiceError(error, 'An error occurred while fetching user buy requests');
        }
    }

    async directBuyRequest( buyRequestId: string, dto: DirectBuyRequestDto, buyer: User): Promise<any> {
        try {
            const buyRequest = await this.buyRequestsRepository.findOne({
                where: {
                    id: buyRequestId,
                    isDeleted: false,
                },
                relations: ['buyer', 'seller'],
            });

            if (!buyRequest) {
                throw new NotFoundException('BuyRequest not found');
            }

            // Buyer must own the request
            if (buyRequest.buyer.id !== buyer.id) {
                throw new ForbiddenException( 'You are not allowed to direct this buy request' );
            }

            // Must be general
            if (!buyRequest.isGeneral) {
                throw new BadRequestException('Only general buy requests can be directed');
            }

            // Already directed
            if (buyRequest.seller) {
                throw new BadRequestException( 'Buy request has already been directed to a seller');
            }

            // Validate seller
            const seller = await this.usersService.findUserEntity(dto.sellerId);

            if (!seller || seller.role !== UserRole.FARMER) {
                throw new BadRequestException( 'Selected seller must be a valid farmer', );
            }

            // Direct request
            buyRequest.seller = seller;
            buyRequest.isGeneral = false;

            const saved = await this.buyRequestsRepository.save(buyRequest);

            // Notify seller
            await this.notificationsService.createNotification({
                user: seller,
                type: NotificationType.BuyRequest,
                title: `Direct Buy Request REQ-${buyRequest.requestNumber}`,
                message:
                    `You have received a direct buy request REQ-${buyRequest.requestNumber} from ${buyer?.companyName?.toUpperCase()}. \n` +
                    `Buyer location: ${buyer.state}, ${buyer.country}`,
                relatedEntityType: RelatedEntityType.BuyRequest,
                relatedEntityId: buyRequest.id,
            });

            return {
                statusCode: 200,
                message: 'Buy request directed successfully',
                data: {
                    id: saved.id,
                    sellerId: seller.id,
                },
            };
        } catch (error) {
            handleServiceError(error, 'An error occurred, failed to direct buy request');
        }
    }

    async uploadPurchaseOrderDoc(dto: UpdatePurchaseOrderDocDto): Promise<any> {
        try {
            const detected = detectMimeTypeFromBase64(dto.purchaseOrderDoc);

            if (!detected || !PO_SUPPORTED_MIME_TYPES.includes(detected)) {
                throw new BadRequestException( 'PurchaseOrderDoc must be DOC or PDF format.' );
            }

            // Allowed docsize - 2mb
            const docSize = 1 * 1024 * 1024;

            // Validate size
            if (!isValidBase64SizeGeneric(dto.purchaseOrderDoc, docSize)) {
                throw new BadRequestException('PurchaseOrderDoc must be 1MB or less.');
            }

            const buyRequest = await this.buyRequestsRepository.findOne({
                where: { id: dto.buyRequestId, isDeleted: false },
                relations: ['purchaseOrderDoc'],
            });

            if (!buyRequest) {
                throw new NotFoundException(`buyRequest not found`);
            }

            // if old purchase order doc exists
            if(buyRequest.purchaseOrderDoc){
                await this.fileService.removeFile(buyRequest.purchaseOrderDoc.id); 
            }

            // Upload doc
            const uploaded = await this.fileService.uploadFile(dto.purchaseOrderDoc, `PurchaseOrderDoc`, buyRequest);

            buyRequest.purchaseOrderDoc = uploaded;
            await this.buyRequestsRepository.save(buyRequest);

            return {
                statusCode: 201,
                message: 'Purchase order doc uploaded successfully',
                data: uploaded,
            };
        }catch (error) {
            handleServiceError(error, 'An error occurred while uploading document');
        }
    }

    async removePurchaseOrderDoc(documentId: string) {
        try {
            return await this.fileService.removeFile(documentId); // throws the correct removeFile-method exceptions
        } catch (error) {
            handleServiceError(error, 'An error occurred while removing document');
        }
    }

    async deleteRequest(id: string, currentUser: User): Promise<any> {
        try {
            const buyRequest = await this.buyRequestsRepository.findOne({ 
                where: { id },
                relations: [
                    'buyer',
                    'seller',
                ],
            });
            if (!buyRequest || buyRequest.isDeleted) throw new NotFoundException('BuyRequest not found');

            if (currentUser.id !== buyRequest.buyer.id) throw new ForbiddenException('Not authorized to delete this request');

            if (buyRequest.status !== BuyRequestStatus.PENDING) throw new ForbiddenException('BuyRequest cannot be deleted');

            buyRequest.isDeleted = true;
            await this.buyRequestsRepository.save(buyRequest);

            return {
                statusCode: 200,
                message: 'BuyRequest deleted successfully',
            };
        } catch (error) {
            this.logger.error(`Failed to delete buyrequest: ${id}`, error.stack);
            handleServiceError(error, 'An error occurred, while deleting BuyRequest');
        }
    }

    // ********************************************************************************************
    // ********************************************************************************************
    // ********************************************************************************************
    // ********************************************************************************************

    async updateStatus( dto: UpdateBuyRequestStatusDto, currentUser: User): Promise<any> {
        try {
            return await this.dataSource.transaction(async (manager) => {

                const buyRequestRepo = manager.getRepository(BuyRequest);
                const productRepo = manager.getRepository(Product);

                const buyRequest = await buyRequestRepo.findOne({
                    where: { id: dto.buyRequestId, isDeleted: false },
                    relations: ['buyer', 'seller', 'product'],
                });

                if (!buyRequest) throw new NotFoundException('BuyRequest not found');

                if (buyRequest.status === BuyRequestStatus.CANCELLED) throw new BadRequestException('BuyRequest cannot be updated');

                const editableStates = [OrderState.AWAITING_SHIPPING];

                if ( buyRequest.orderState != null && !editableStates.includes(buyRequest.orderState)){
                    throw new BadRequestException('BuyRequest cannot be updated');
                }

                if (buyRequest.isGeneral) {
                    throw new BadRequestException( 'BuyRequest is general, contact the buyer' );
                }

                if (!buyRequest.seller || buyRequest.seller.id !== currentUser.id) {
                    throw new ForbiddenException( 'This farmer is not authorized to update this request' );
                }

                if (
                    ![
                        BuyRequestStatus.ACCEPTED,
                        BuyRequestStatus.REJECTED,
                        BuyRequestStatus.CANCELLED,
                    ].includes(dto.status)
                ) {
                    throw new BadRequestException( 'Invalid status update for directed buy request' );
                }

                /* =========================================
                ACCEPTED
                ========================================= */

                if (dto.status === BuyRequestStatus.ACCEPTED) {

                    if (!dto.productId)
                        throw new BadRequestException(
                            'BuyRequest must be accepted with a productId',
                        );

                    const product = await productRepo.findOne({
                        where: {
                            id: dto.productId,
                            owner: { id: currentUser.id },
                            isDeleted: false,
                        },
                    });

                    if (!product)
                        throw new BadRequestException(
                            'Invalid productId or product does not belong to this farmer',
                        );

                    buyRequest.product = product;
                    buyRequest.status = dto.status;
                    buyRequest.orderState = OrderState.AWAITING_SHIPPING;
                    buyRequest.orderStateTime = new Date();

                    await buyRequestRepo.save(buyRequest);

                    // 🔥 RESERVE STOCK
                    await this.productInventoriesService.reserveStock(
                        product.id,
                        buyRequest.productQuantityKg,
                        buyRequest.id,
                        manager,
                    );

                    // Notification
                    await this.notificationsService.createNotification({
                        user: buyRequest.buyer,
                        type: NotificationType.BuyRequest,
                        title: `Buy Request Accepted: REQ-${buyRequest.requestNumber}`,
                        message:
                            `Your buy request REQ-${buyRequest.requestNumber} has been accepted by ${buyRequest.seller.firstName.toLowerCase()}.\n` +
                            `The order is now awaiting shipping`,
                        relatedEntityType: RelatedEntityType.BuyRequest,
                        relatedEntityId: buyRequest.id,
                    });
                }

                /* =========================================
                REJECTED / CANCELLED
                ========================================= */

                if (
                    dto.status === BuyRequestStatus.REJECTED ||
                    dto.status === BuyRequestStatus.CANCELLED
                ) {
                    const previousProduct = buyRequest.product;
                    buyRequest.status = dto.status;
                    buyRequest.product = null;
                    buyRequest.orderState = null;
                    buyRequest.orderStateTime = null;

                    await buyRequestRepo.save(buyRequest);

                    const reservation = await manager.findOne(ProductInventory, {
                        where: {
                            buyRequest: { id: buyRequest.id },
                            type: ProductInventoryType.RESERVATION
                        },
                    });

                    if (reservation && previousProduct) {
                        await this.productInventoriesService.releaseStock(
                            previousProduct.id,
                            buyRequest.productQuantityKg, // reservation.quantityKg, // safer
                            buyRequest.id,
                            manager,
                        );
                    }

                    const title = `Buy Request ${dto.status.toLowerCase()}: REQ-${buyRequest.requestNumber}`;
                    const message =
                        `Your buy request REQ-${buyRequest.requestNumber} has been ${dto.status.toLowerCase()} by ${buyRequest.seller.firstName.toLowerCase()}.`;

                    await this.notificationsService.createNotification({
                        user: buyRequest.buyer,
                        type: NotificationType.BuyRequest,
                        title,
                        message,
                        relatedEntityType: RelatedEntityType.BuyRequest,
                        relatedEntityId: buyRequest.id,
                    });
                }

                return {
                    statusCode: 200,
                    message: `BuyRequest status updated successfully`,
                    data: instanceToPlain(buyRequest),
                };
            });

        } catch (error) {
            handleServiceError(
                error,
                'An error occurred while updating BuyRequest status',
            );
        }
    }

    // Generate sequential requestNumber
    private async generateRequestNumber(): Promise<number> {
        const last = await this.buyRequestsRepository.find({
            order: { requestNumber: 'DESC' },
            take: 1,
        });

        if (last.length === 0) return 100001;
        return Number(last[0].requestNumber) + 1;
    }

}