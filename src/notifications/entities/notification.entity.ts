import { User } from "src/users/entities/user.entity";
import { Product } from "src/products/entities/product.entity";
import { Column, CreateDateColumn, Entity, Index, ManyToOne, JoinColumn, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";


export enum NotificationType {
  BuyRequest = 'buy_request',
  OrderStatus = 'order_status',
  Contact_Message = 'contact_message',
  Dispute = 'dispute',
  System = 'system',
  Rating = 'rating'
}

export enum RelatedEntityType {
  BuyRequest = 'buy_request',
  Product = 'product',
  Dispute = 'dispute', 
  Event = 'event',  
}

export enum NotificationAudience {
  USER = 'user',        // personal notification
  ADMINS = 'admins',    // visible to all admins + super_admin
  SYSTEM = 'system',    // visible to all users
}

export enum NotificationChannel {
  APP = 'app',
  SMS = 'sms',
  EMAIL = 'email',
}

@Entity('notifications')
@Index(['user', 'isRead'])
@Index(['user', 'createdAt'])
@Index(['audience', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.notifications, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  user: User | null;

  @Column({
    type: 'enum',
    enum: NotificationAudience,
    default: NotificationAudience.USER,
  })
  audience: NotificationAudience;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'enum', enum: RelatedEntityType })
  relatedEntityType: RelatedEntityType;

  @Column({ type: 'uuid', nullable: true })
  relatedEntityId: string | null;

  @Column({ type: 'uuid', nullable: true })
  senderId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  senderName: string | null;

  @Column({ default: false })
  isRead: boolean;

  @Column({
    type: 'enum',
    enum: NotificationChannel,
    default: NotificationChannel.APP,
  })
  channel: NotificationChannel;

  @Column({ default: false })
  sent: boolean;

  @Column({ type: 'text', nullable: true })
  failureReason: string | null;

  @Column({ type: 'varchar', nullable: true })
  externalMessageId: string | null; // Twilio SID

  /** Selected product from the farmer's contact offer (nullable) */
  @ManyToOne(() => Product, { nullable: true, eager: false, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'productId' })
  product: Product | null;

  @Column({ type: 'uuid', nullable: true })
  productId: string | null;

  @Column({ default: false })
  isDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
