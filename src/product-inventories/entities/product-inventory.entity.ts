import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { Product } from 'src/products/entities/product.entity';
import { BuyRequest } from 'src/buy-requests/entities/buy-request.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ProductInventoryType {
    ADDITION = 'addition',
    RESERVATION = 'reservation',
    RELEASE = 'release',
    DEDUCTION = 'deduction',
}

@Entity('product_inventories')
export class ProductInventory {
    @ApiProperty({ example: '8hfeiweji9rfwjkowstring64' })
    @PrimaryGeneratedColumn('uuid')
    id: string;

    /**
     * Related product
     */
    @ApiPropertyOptional({ type: () => Product })
    @ManyToOne(() => Product, (product) => product.inventories, {
        onDelete: 'CASCADE',
    })
    product: Product;

    /**
     * Related buy request (nullable)
     * Used for reservation / release / deduction tracking
     */
    @ApiPropertyOptional({ type: () => BuyRequest, nullable: true })
    @ManyToOne(() => BuyRequest, (buyRequest) => buyRequest.inventoryMovements, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    buyRequest: BuyRequest | null;

    /**
     * Quantity moved (always in KG)
     */
    @ApiProperty({ example: '100.00' })
    @Column({ type: 'decimal', precision: 30, scale: 2 })
    quantityKg: string;

    /**
     * Movement type
     */
    @ApiProperty({ enum: ProductInventoryType, example: ProductInventoryType.ADDITION })
    @Column({
        type: 'enum',
        enum: ProductInventoryType,
    })
    type: ProductInventoryType;

    @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
    @CreateDateColumn()
    createdAt: Date;

    @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
    @UpdateDateColumn()
    updatedAt: Date;
}
