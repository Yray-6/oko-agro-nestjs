import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAgroTrackPricingFields1775700000000 implements MigrationInterface {
    name = 'AddAgroTrackPricingFields1775700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "buy_requests" ADD "agroTrackBaseRate" numeric(30,2)`
        );
        await queryRunner.query(
            `ALTER TABLE "buy_requests" ADD "agroTrackDistanceSurcharge" numeric(30,2)`
        );
        await queryRunner.query(
            `ALTER TABLE "buy_requests" ADD "agroTrackTotalCost" numeric(30,2)`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "buy_requests" DROP COLUMN "agroTrackTotalCost"`
        );
        await queryRunner.query(
            `ALTER TABLE "buy_requests" DROP COLUMN "agroTrackDistanceSurcharge"`
        );
        await queryRunner.query(
            `ALTER TABLE "buy_requests" DROP COLUMN "agroTrackBaseRate"`
        );
    }
}
