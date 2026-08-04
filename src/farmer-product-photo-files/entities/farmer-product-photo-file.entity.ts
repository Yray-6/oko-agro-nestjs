import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from 'src/products/entities/product.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity('farmer_product_photo_files')
export class FarmerProductPhotoFile {
  @ApiProperty({ example: '8hfeiweji9rfwjkowstring64' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'product-photo.jpg' })
  @Column()
  name: string; // ✅ custom filename

  @ApiProperty({ example: 'https://res.cloudinary.com/example/image/upload/v1/photo.jpg' })
  @Column()
  url: string;

  @ApiProperty({ example: 'farmer_product_photos/abc123' })
  @Column()
  publicId: string;

  @ApiProperty({ example: 'Fresh_Cassava_description_1234' })
  @Column()
  description: string; // product.name_description_random4digits

  @ApiPropertyOptional({ example: 'image/jpeg', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  mimeType: string | null;

  @ApiPropertyOptional({ example: '102400', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  size: string | null;

  @ManyToOne(() => Product, (product) => product.photos, { onDelete: 'CASCADE' })
  product: Product;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  @UpdateDateColumn()
  updatedAt: Date;
}