import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BuyRequest, OrderState } from 'src/buy-requests/entities/buy-request.entity';
import { handleServiceError } from 'src/common/utils/error-handler.util';
import { normalizeEmail } from 'src/common/utils/email.util';
import { Product, ProductApprovalStatus } from 'src/products/entities/product.entity';
import { User, UserRole } from 'src/users/entities/user.entity';
import { ILike, In, Not, Repository } from 'typeorm';
import { CreateAdminUserDto } from './dtos/create-admin-user.dto';
import { UpdateUserStatusDto } from './dtos/update-user-status.dto';
import { AuthService } from 'src/auth/auth.service';
import { UpdateAdminPasswordDto } from './dtos/update-admin-password.dto';
import * as bcrypt from 'bcrypt';
import { GetAllAdminsQueryDto } from './dtos/get-all-admins-query.dto';
import { instanceToPlain } from 'class-transformer';
import { TopPerformingUsersQueryDto } from './dtos/top-performing-users-query.dto';
import { TopPerformingRegionsQueryDto } from './dtos/top-performing-regions-query.dto';

@Injectable()
export class AdminService {
    private readonly logger = new Logger(AdminService.name);

    constructor(
        @InjectRepository(User)
        private readonly usersRepository: Repository<User>,

        @InjectRepository(BuyRequest)
        private readonly buyRequestsRepository: Repository<BuyRequest>,

        @InjectRepository(Product)
        private readonly productsRepository: Repository<Product>,

        private readonly authService: AuthService,
    ) {}

    async getDashboardOverview() {
        try {
            // 1️⃣ Total Users (exclude admin & super admin)
            const totalUsers = await this.usersRepository.count({
                where: { 
                    role: Not(In([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
                    isDeleted: false
                }
            });

            // 2️⃣ Total Transactions Value
            // (sum of paymentAmount where orderState = 'in_transit', 'delivered' or 'completed')
            const transactions = await this.buyRequestsRepository
                .createQueryBuilder('br')
                .select('SUM(CAST(br.paymentAmount AS DECIMAL))', 'total')
                .where('br.orderState IN (:...states)', { 
                    states: [OrderState.IN_TRANSIT, OrderState.DELIVERED, OrderState.COMPLETED]
                })
                .andWhere('br.isDeleted = FALSE')
                .getRawOne();

            const totalTransactionValue = transactions?.total
                ? Number(transactions.total)
                : 0;

            // 3️⃣ Completed Orders
            const completedOrders = await this.buyRequestsRepository
                .createQueryBuilder('br')
                .where('br.orderState = :state', { state: OrderState.COMPLETED })
                .andWhere('br.isDeleted = FALSE')
                .getCount();

            // 4️⃣ Pending Listings
            const pendingListings = await this.productsRepository.count({
                where: { approvalStatus: ProductApprovalStatus.PENDING, isDeleted: false },
            });

            return {
                statusCode: 200,
                message: 'Dashboard stats fetched successfully',
                data: {
                    totalUsers,
                    totalTransactionValue,
                    completedOrders,
                    pendingListings,
                },
            };
        } catch (error) {
            handleServiceError(error, 'Failed to fetch dashboard stats');
        }
    }

    async topPerformingUsers(query: TopPerformingUsersQueryDto) {
        try {
            const { role } = query;

            if (!role || !['farmer', 'processor'].includes(role)) {
                throw new BadRequestException('Role must be either farmer or processor');
            }

            let orderField = '';

            if (role === 'farmer') {
                orderField = 'totalFarmerSalesAmount';
            }

            if (role === 'processor') {
                orderField = 'totalProcessorPurchasesAmount';
            }

            const users = await this.usersRepository.find({
                where: {  
                    role: role ? role : In([UserRole.FARMER, UserRole.PROCESSOR]),
                    isDeleted: false
                },
                order: { [orderField]: 'DESC' },
                take: 10,
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    totalFarmerSalesAmount: true,
                    totalProcessorPurchasesAmount: true,
                    createdAt: true,
                },
            });

            const mappedUsers = users.map(user => ({
                id: user.id,
                name: `${user.firstName} ${user.lastName}`,
                role: user.role,
                performanceAmount:
                    role === 'farmer'
                    ? user.totalFarmerSalesAmount
                    : user.totalProcessorPurchasesAmount,
                country: user.country,
                ordersCompleted: user.buyRequestCompleted
            }));

            return {
                statusCode: 200,
                message: 'Top performing users fetched successfully',
                data: {
                    users: mappedUsers,
                    totalRecord: mappedUsers.length
                },
            };

        } catch (error) {
            this.logger.error('Error while fetching top performing users', error.stack );
            handleServiceError( error,'An error occurred while fetching top performing users' );
        }
    }

    async topPerformingRegions(query: TopPerformingRegionsQueryDto) {
        try {
            const country = query.country || 'Nigeria';

            const rawRegions = await this.usersRepository
                .createQueryBuilder('user')
                .select('user.state', 'state')
                .addSelect('user.country', 'country')
                .addSelect('SUM(user.totalFarmerSalesAmount)', 'totalCompletedAmount')
                .addSelect('COUNT(user.id)', 'totalUsers')
                .where('user.country = :country', { country })
                .andWhere('user.isDeleted = :isDeleted', { isDeleted: false })
                .andWhere('user.state IS NOT NULL')
                .andWhere("user.state != ''")
                .groupBy('user.state')
                .addGroupBy('user.country')
                .orderBy('SUM(user.totalFarmerSalesAmount)', 'DESC')
                .limit(10)
                .getRawMany();

            const regions = rawRegions.map((region) => ({
                state: region.state,
                country: region.country,
                totalCompletedAmount: region.totalCompletedAmount,
                totalUsers: Number(region.totalUsers),
            }));

            return {
                statusCode: 200,
                message: 'Top performing regions fetched successfully',
                data: {
                    regions,
                    totalRecord: regions.length,
                }
            };

        } catch (error) {
            this.logger.error('Error while fetching top performing regions', error.stack );
            handleServiceError( error, 'An error occurred while fetching top performing regions' );
        }
    }

    async createAdmin(dto: CreateAdminUserDto) {
        try {
            const normalizedEmail = normalizeEmail(dto.email);

            // Check existing user
            const existing = await this.usersRepository.findOne({
                where: { email: ILike(normalizedEmail) },
            });

            if (existing) {
                throw new ConflictException('Email already in use.');
            }

            const hashedPassword = await this.authService.hashPassword(dto.password);

            const newUser = this.usersRepository.create({
                ...dto,
                email: normalizedEmail,
                password: hashedPassword,
                role: UserRole.ADMIN,
                userVerified: true,     // admin does NOT need OTP verification
            });

            const saved = await this.usersRepository.save(newUser);

            return {
                statusCode: 201,
                message: 'Admin user created successfully',
                data: { id: saved.id },
            };
        } catch (error) {
            handleServiceError(error, "Error creating admin user");
        }
    }

    async updateUserStatus(dto: UpdateUserStatusDto) {
        try {
            const user = await this.usersRepository.findOne({ where: { id: dto.userId } });

            if (!user) throw new NotFoundException('User not found');

            user.isDisabled = dto.isDisabled;
            await this.usersRepository.save(user);

            return {
                statusCode: 200,
                message: `User has been ${dto.isDisabled ? 'disabled' : 'enabled'} successfully`,
            };
        } catch (error) {
            handleServiceError(error, 'Failed updating user status');
        }
    }

    async updateAdminPassword( dto: UpdateAdminPasswordDto, currentUser: User) {
        try {
            const { userId, newPassword, confirmPassword } = dto;

            if (newPassword !== confirmPassword) {
                throw new BadRequestException("Passwords do not match.");
            }

            const user = await this.usersRepository.findOne({
                where: { id: userId },
            });

            if (!user) throw new NotFoundException("User not found");

            /** RULE 1 – Only admins and super admins can use this endpoint
                —— Already handled by Guards **/

            /** RULE 2 – Admin/Super Admin cannot change regular user passwords */
            if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
                throw new ForbiddenException( "You cannot change password for regular users" );
            }

            /** RULE 3 – Admin changing another admin? → NOT ALLOWED 
                Only Super Admin can do that */
            if (currentUser.role === UserRole.ADMIN && currentUser.id !== user.id ) {
                throw new ForbiddenException(
                    "Admins can only change their own password"
                );
            }

            /** RULE 4 – SUPER_ADMIN cannot change another SUPER_ADMIN */
            if (
                currentUser.role === UserRole.SUPER_ADMIN &&
                user.role === UserRole.SUPER_ADMIN &&
                currentUser.id !== user.id
            ) {
                throw new ForbiddenException( "You cannot change password for another Super Admin" );
            }

            /** RULE 5 – Prevent setting same password as current */
            const passwordMatches = await bcrypt.compare(newPassword, user.password);
            if (passwordMatches) {
                throw new BadRequestException( "New password cannot be the same as current password" );
            }

            // Hash and save new password
            const hashedPassword = await this.authService.hashPassword(newPassword);
            user.password = hashedPassword;

            await this.usersRepository.save(user);

            return {
                statusCode: 200,
                message: "Password updated successfully",
            };
        } catch (error) {
            handleServiceError(error, "Error updating password");
        }
    }

    async getAllAdmins(query: GetAllAdminsQueryDto) {
        try {
            const {  
                role,
                pageNumber = 1,
                pageSize = 20
            } = query;

            const skip = (pageNumber - 1) * pageSize;

            const qb = this.usersRepository
                .createQueryBuilder('user')
                .where('user.isDeleted = FALSE')
                .andWhere('user.role IN (:...roles)', {
                    roles: role ? [role] : [UserRole.ADMIN, UserRole.SUPER_ADMIN]
                })
                .orderBy('user.createdAt', 'DESC');

            const [items, totalRecords] = await qb.skip(skip).take(pageSize).getManyAndCount();

            return {
                statusCode: 200,
                message: "Admins fetched successfully",
                data: {
                    items: instanceToPlain(items),
                    totalRecords,
                    pageNumber,
                    pageSize
                }
            };

        } catch (error) {
            handleServiceError(error, "Failed to fetch admins");
        }
    }

    async deleteAdmin(userId: string) {
        try {
            const user = await this.usersRepository.findOne({ where: { id: userId } });

            if (!user) throw new NotFoundException('User not found');
            
            if (user.role !== UserRole.ADMIN) {
                throw new BadRequestException('Only admin users can be deleted using this endpoint');
            }

            await this.usersRepository.remove(user);

            return {
                statusCode: 200,
                message: 'Admin user deleted successfully',
            };
        } catch (error) {
            handleServiceError(error, 'Failed deleting admin user');
        }
    }
}
