import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  OneToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Crop } from 'src/crops/entities/crop.entity';
import { User } from 'src/users/entities/user.entity';
import { FarmerProductPhotoFile } from 'src/farmer-product-photo-files/entities/farmer-product-photo-file.entity';
import { Event } from 'src/events/entities/event.entity';
import { BuyRequest } from 'src/buy-requests/entities/buy-request.entity';
import { ProductInventory } from 'src/product-inventories/entities/product-inventory.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// export enum ProductQuantityUnit {
//   KILOGRAM = 'kilogram',
//   TONNE = 'tonne',
// }

export enum ProductPriceCurrency {
  NGN = 'ngn'
}

export enum ProductApprovalStatus {
  PENDING = 'pending',     // waiting for admin review
  APPROVED = 'approved',   // visible on platform
  REJECTED = 'rejected',   // rejected by admin
}

@Entity('products')
export class Product {
  @ApiProperty({ example: '8hfeiweji9rfwjkowstring64' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Fresh Cassava' })
  @Column({ type: 'varchar' })
  name: string;

  @ApiPropertyOptional({ type: () => Crop })
  @ManyToOne(() => Crop, (crop) => crop.products, { eager: false })
  cropType: Crop;

  /**
   * Total quantity available (in KG)
   * Stored as DECIMAL(30,2) for very large precision-safe values
   */
  @ApiProperty({ example: '1000.00' })
  @Column({ type: 'decimal', precision: 30, scale: 2, default: 0 })
  quantityKg: string;

  /**
   * Reserved quantity (ACCEPTED but not COMPLETED)
   */
  @ApiProperty({ example: '50.00' })
  @Column({ type: 'decimal', precision: 30, scale: 2, default: 0 })
  reservedQuantityKg: string;

  /**
   * Price per KG (2 decimal fixed)
   */
  @ApiProperty({ example: '250.00' })
  @Column({ type: 'decimal', precision: 30, scale: 2 })
  pricePerKg: string;

  @ApiProperty({ enum: ProductPriceCurrency, example: ProductPriceCurrency.NGN })
  @Column({ type: 'enum', enum: ProductPriceCurrency, default: ProductPriceCurrency.NGN })
  priceCurrency: ProductPriceCurrency;

  @ApiPropertyOptional({ example: 'Lagos, Nigeria', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  locationAddress: string | null;

  @ApiProperty({ enum: ProductApprovalStatus, example: ProductApprovalStatus.PENDING })
  @Column({ type: 'enum', enum: ProductApprovalStatus, default: ProductApprovalStatus.PENDING })
  approvalStatus: ProductApprovalStatus;

  @ApiPropertyOptional({ type: () => User })
  @ManyToOne(() => User, (user) => user.products, { onDelete: 'CASCADE' })
  owner: User;

  @ApiPropertyOptional({ type: () => [FarmerProductPhotoFile] })
  @OneToMany(() => FarmerProductPhotoFile, (photo) => photo.product, { cascade: true })
  photos: FarmerProductPhotoFile[];

  @ApiPropertyOptional({ type: () => Event, nullable: true })
  @OneToOne(() => Event, (event) => event.product, { nullable: true, cascade: true })
  harvestEvent: Event | null;

  @OneToMany(() => BuyRequest, (buyRequest) => buyRequest.product)
  buyRequests: BuyRequest[];

  /**
   * Inventory movement history
   */
  @OneToMany(() => ProductInventory, (inventory) => inventory.product)
  inventories: ProductInventory[];

  @ApiProperty({ example: false })
  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  @UpdateDateColumn()
  updatedAt: Date;
}
