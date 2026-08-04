import { User } from "src/users/entities/user.entity";
import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { ApiProperty } from "@nestjs/swagger";

@Entity('certifications')
export class Certification {
    @ApiProperty({ example: '8hfeiweji9rfwjkowstring64' })
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ApiProperty({ example: 'Organic Certified' })
    @Column({ unique: true })
    name: string;

    @ManyToMany(() => User, (user) => user.certifications)
    users: User[];

    @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
    @CreateDateColumn()
    createdAt: Date;
    
    @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
    @UpdateDateColumn()
    updatedAt: Date;
}
