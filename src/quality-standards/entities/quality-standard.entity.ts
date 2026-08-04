import { BuyRequest } from "src/buy-requests/entities/buy-request.entity";
import { User } from "src/users/entities/user.entity";
import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, OneToMany, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { ApiProperty } from "@nestjs/swagger";

@Entity('quality_standards')
export class QualityStandard {
    @ApiProperty({ example: '8hfeiweji9rfwjkowstring64' })
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ApiProperty({ example: 'Grade A' })
    @Column({ unique: true })
    name: string;

    @ManyToMany(() => User, (user) => user.qualityStandards)
    users: User[];

    // one quality standard can be used by many buy requests
    @OneToMany(() => BuyRequest, (buyRequest) => buyRequest.qualityStandardType)
    buyRequests: BuyRequest[];

    @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
    @CreateDateColumn()
    createdAt: Date;

    @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
    @UpdateDateColumn()
    updatedAt: Date;
}
