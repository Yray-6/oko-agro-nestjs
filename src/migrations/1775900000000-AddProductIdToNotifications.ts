import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProductIdToNotifications1775900000000 implements MigrationInterface {
    name = 'AddProductIdToNotifications1775900000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notifications" ADD "productId" uuid`);
        await queryRunner.query(
            `ALTER TABLE "notifications" ADD CONSTRAINT "FK_notifications_productId" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_notifications_productId"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "productId"`);
    }
}
