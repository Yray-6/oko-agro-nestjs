import { User } from "src/users/entities/user.entity";
import { Product } from "src/products/entities/product.entity";
import { Event } from "src/events/entities/event.entity";
import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, OneToMany, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { ApiProperty } from "@nestjs/swagger";

@Entity('crops')
export class Crop {
    @ApiProperty({ example: '8hfeiweji9rfwjkowstring64' })
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ApiProperty({ example: 'Guava' })
    @Column({ unique: true })
    name: string;

    // ✅ Many users can relate to many crops (registration selection)
    @ManyToMany(() => User, (user) => user.crops)
    users: User[];

    // ✅ One crop can be linked to many products
    @OneToMany(() => Product, (product) => product.cropType)
    products: Product[];

    // ✅ One crop can be linked to many events
    @OneToMany(() => Event, (event) => event.crop)
    events: Event[];

    @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
    @CreateDateColumn()
    createdAt: Date;

    @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
    @UpdateDateColumn()
    updatedAt: Date;
}
