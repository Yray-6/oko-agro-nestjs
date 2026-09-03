import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { Notification, NotificationType, RelatedEntityType } from './entities/notification.entity';
import { BuyRequest } from 'src/buy-requests/entities/buy-request.entity';
import { Product, ProductApprovalStatus } from 'src/products/entities/product.entity';
import { User, UserRole } from 'src/users/entities/user.entity';

const mockFarmer = {
  id: 'farmer-1',
  firstName: 'John',
  lastName: 'Doe',
  state: 'Delta',
  country: 'Nigeria',
  role: UserRole.FARMER,
} as User;

const mockProcessor = {
  id: 'processor-1',
  firstName: 'Jane',
  lastName: 'Corp',
  role: UserRole.PROCESSOR,
} as User;

const mockBuyRequest = {
  id: 'br-1',
  isDeleted: false,
  buyer: mockProcessor,
  seller: null,
  product: null,
  cropType: { id: 'crop-1', name: 'Cassava' },
} as unknown as BuyRequest;

const mockProduct = {
  id: 'product-1',
  name: 'Fresh Cassava',
  owner: { id: 'farmer-1' },
  cropType: { id: 'crop-1', name: 'Cassava' },
  approvalStatus: ProductApprovalStatus.APPROVED,
  quantityKg: '1000.00',
  reservedQuantityKg: '200.00',
  isDeleted: false,
} as unknown as Product;

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notificationsRepo: any;
  let buyRequestsRepo: any;
  let productsRepo: any;

  beforeEach(async () => {
    notificationsRepo = {
      create: jest.fn().mockImplementation((data) => ({ ...data, id: 'notif-1', isRead: false, createdAt: new Date() })),
      save: jest.fn().mockImplementation((n) => Promise.resolve(n)),
      count: jest.fn().mockResolvedValue(0),
    };
    buyRequestsRepo = {
      findOne: jest.fn().mockResolvedValue({ ...mockBuyRequest }),
    };
    productsRepo = {
      findOne: jest.fn().mockResolvedValue({ ...mockProduct }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useValue: notificationsRepo },
        { provide: getRepositoryToken(BuyRequest), useValue: buyRequestsRepo },
        { provide: getRepositoryToken(Product), useValue: productsRepo },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('contactBuyer', () => {
    it('should create a contact notification with a valid productId', async () => {
      const result = await service.contactBuyer(
        { buyRequestId: 'br-1', processorId: 'processor-1', productId: 'product-1' },
        mockFarmer,
      );

      expect(result.statusCode).toBe(201);
      expect(result.data.productId).toBe('product-1');
      expect(result.data.cropId).toBe('crop-1');
      expect(notificationsRepo.save).toHaveBeenCalled();
    });

    it('should create a contact notification without productId', async () => {
      const result = await service.contactBuyer(
        { buyRequestId: 'br-1', processorId: 'processor-1' },
        mockFarmer,
      );

      expect(result.statusCode).toBe(201);
      expect(result.data.productId).toBeNull();
    });

    it('should reject when product does not belong to farmer', async () => {
      productsRepo.findOne.mockResolvedValueOnce({
        ...mockProduct,
        owner: { id: 'other-farmer' },
      });

      await expect(
        service.contactBuyer(
          { buyRequestId: 'br-1', processorId: 'processor-1', productId: 'product-1' },
          mockFarmer,
        ),
      ).rejects.toThrow('Selected product does not belong to you');
    });

    it('should reject when product is not approved', async () => {
      productsRepo.findOne.mockResolvedValueOnce({
        ...mockProduct,
        approvalStatus: ProductApprovalStatus.PENDING,
      });

      await expect(
        service.contactBuyer(
          { buyRequestId: 'br-1', processorId: 'processor-1', productId: 'product-1' },
          mockFarmer,
        ),
      ).rejects.toThrow('Selected product is not approved');
    });

    it('should reject when product has no available inventory', async () => {
      productsRepo.findOne.mockResolvedValueOnce({
        ...mockProduct,
        quantityKg: '200.00',
        reservedQuantityKg: '200.00',
      });

      await expect(
        service.contactBuyer(
          { buyRequestId: 'br-1', processorId: 'processor-1', productId: 'product-1' },
          mockFarmer,
        ),
      ).rejects.toThrow('Selected product has no available inventory');
    });

    it('should reject when product crop does not match buy request crop', async () => {
      productsRepo.findOne.mockResolvedValueOnce({
        ...mockProduct,
        cropType: { id: 'crop-999', name: 'Rice' },
      });

      await expect(
        service.contactBuyer(
          { buyRequestId: 'br-1', processorId: 'processor-1', productId: 'product-1' },
          mockFarmer,
        ),
      ).rejects.toThrow('Selected product crop does not match the buy request crop');
    });

    it('should reject when product not found', async () => {
      productsRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.contactBuyer(
          { buyRequestId: 'br-1', processorId: 'processor-1', productId: 'product-1' },
          mockFarmer,
        ),
      ).rejects.toThrow('Selected product not found');
    });

    it('should reject when buy request already has a seller', async () => {
      buyRequestsRepo.findOne.mockResolvedValueOnce({
        ...mockBuyRequest,
        seller: { id: 'some-farmer' },
      });

      await expect(
        service.contactBuyer(
          { buyRequestId: 'br-1', processorId: 'processor-1' },
          mockFarmer,
        ),
      ).rejects.toThrow('This buy request has already been directed to a seller');
    });
  });
});
