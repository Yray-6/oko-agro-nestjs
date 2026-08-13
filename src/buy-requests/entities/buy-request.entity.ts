import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { Crop } from 'src/crops/entities/crop.entity';
import { QualityStandard } from 'src/quality-standards/entities/quality-standard.entity';
import { User } from 'src/users/entities/user.entity';
import { Product } from 'src/products/entities/product.entity';
import { PurchaseOrderDocFile } from 'src/purchase-order-doc-files/entities/purchase-order-doc-file.entity';
import { Dispute } from 'src/disputes/entities/dispute.entity';
import { Rating } from 'src/ratings/entities/rating.entity';
import { ProductInventory } from 'src/product-inventories/entities/product-inventory.entity';

export enum BuyRequestStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled', 
}

export enum PaymentMethod {
  PAY_ON_DELIVERY = 'pay_on_delivery',
  CASH_AND_CARRY = 'cash_and_carry',
  FIVE_DAYS_PD = 'five_days_post_delivery',
  FIFTEEN_DAYS_PD = 'fifteen_days_post_delivery',
  THIRTY_DAYS_PD = 'thirty_days_post_delivery',
}

// export enum BuyRequestQuantityUnit {
//   KILOGRAM = 'kilogram',
//   TONNE = 'tonne',
// }

export enum OrderState {
  AWAITING_SHIPPING = 'awaiting_shipping',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  COMPLETED = 'completed',
}

// AgroTrack's own status vocabulary — deliberately not merged with OrderState.
// AgroTrack's "in_transit" is not the same event as Oko's (which also gates
// paymentConfirmed); this enum exists so the two never get conflated.
export enum AgroTrackStatus {
  NEW_REQUEST = 'new_request',
  ASSIGNED = 'assigned',
  PENDING_PICKUP = 'pending_pickup',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}


@Entity('buy_requests')
export class BuyRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bigint', unique: true })
  requestNumber: number; // sequential unique number

  // @Column({ type: 'varchar', nullable: true })
  @Column({ type: 'varchar' })
  description: string | null;

  @ManyToOne(() => Crop, { eager: false })
  cropType: Crop;

  @ManyToOne(() => QualityStandard, { nullable: true })
  qualityStandardType: QualityStandard | null;

   /**
   * Requested quantity (normalized to KG)
   */
  @Column({ type: 'decimal', precision: 30, scale: 2 })
  productQuantityKg: string;

  /**
   * Offered price per KG
   */
  @Column({ type: 'decimal', precision: 30, scale: 2 })
  pricePerKgOffer: string;

  @Column({ type: 'timestamptz' })
  estimatedDeliveryDate: Date;

  @Column({ type: 'varchar' })
  deliveryLocation: string;

  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.PAY_ON_DELIVERY })
  preferredPaymentMethod: PaymentMethod;

  @Column({ type: 'enum', enum: BuyRequestStatus, default: BuyRequestStatus.PENDING })
  status: BuyRequestStatus;

  @Column({ default: false })
  isGeneral: boolean;

  @ManyToOne(() => User, (user) => user.buyRequestsAsBuyer, { eager: false })
  buyer: User;

  @ManyToOne(() => User, (user) => user.buyRequestsAsSeller, { nullable: true })
  seller: User | null;
  
  @ManyToOne(() => Product, (product) => product.buyRequests, { nullable: true })
  product: Product | null;

  /**
   * Inventory history entries linked to this request
   */
  @OneToMany(() => ProductInventory, (inventory) => inventory.buyRequest)
  inventoryMovements: ProductInventory[];

  @OneToOne( () => PurchaseOrderDocFile, (po) => po.buyRequest, { cascade: true, nullable: true })
  purchaseOrderDoc: PurchaseOrderDocFile | null;

  @Column({ type: 'enum', enum: OrderState, nullable: true })
  orderState: OrderState | null;

  @Column({ type: 'timestamptz', nullable: true })
  orderStateTime: Date | null;

  @OneToMany(() => Dispute, (d) => d.buyRequest)
  disputes: Dispute[];

  @OneToMany(() => Rating, (rating) => rating.buyRequest)
  ratings: Rating[];

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'decimal', precision: 30, scale: 2, nullable: true })
  paymentAmount: string | null;

  @Column({ type: 'boolean', default: false })
  paymentConfirmed: boolean; 

  @Column({ type: 'timestamptz', nullable: true })
  paymentConfirmedAt: Date | null;

  /** AgroTrack tracking number linked from Phase 2 handoff (optional). */
  @Column({ type: 'varchar', nullable: true })
  agroTrackTrackingNumber: string | null;

  /** AgroTrack's internal order id — needed for reconciliation calls, not just display. */
  @Column({ type: 'int', nullable: true })
  agroTrackOrderId: number | null;

  /**
   * Mirrors AgroTrack's shipment status via webhook/reconciliation.
   * Deliberately separate from paymentConfirmed — logistics status must
   * never drive payment state on its own.
   */
  @Column({ type: 'enum', enum: AgroTrackStatus, nullable: true })
  agroTrackStatus: AgroTrackStatus | null;

  /** Last successful webhook or reconciliation timestamp — drives staleness alerts. */
  @Column({ type: 'timestamptz', nullable: true })
  agroTrackSyncedAt: Date | null;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}