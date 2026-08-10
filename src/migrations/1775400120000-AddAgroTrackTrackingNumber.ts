import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAgroTrackTrackingNumber1775400120000 implements MigrationInterface {
    name = 'AddAgroTrackTrackingNumber1775400120000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "buy_requests" ADD "agroTrackTrackingNumber" character varying`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "buy_requests" DROP COLUMN "agroTrackTrackingNumber"`
        );
    }
}
