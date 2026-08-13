import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAgroTrackIntegrationFields1775500000000 implements MigrationInterface {
    name = 'AddAgroTrackIntegrationFields1775500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TYPE "public"."buy_requests_agrotrackstatus_enum" AS ENUM('new_request', 'assigned', 'pending_pickup', 'in_transit', 'delivered', 'completed', 'cancelled')`
        );
        await queryRunner.query(
            `ALTER TABLE "buy_requests" ADD "agroTrackOrderId" integer`
        );
        await queryRunner.query(
            `ALTER TABLE "buy_requests" ADD "agroTrackStatus" "public"."buy_requests_agrotrackstatus_enum"`
        );
        await queryRunner.query(
            `ALTER TABLE "buy_requests" ADD "agroTrackSyncedAt" TIMESTAMP WITH TIME ZONE`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "buy_requests" DROP COLUMN "agroTrackSyncedAt"`
        );
        await queryRunner.query(
            `ALTER TABLE "buy_requests" DROP COLUMN "agroTrackStatus"`
        );
        await queryRunner.query(
            `ALTER TABLE "buy_requests" DROP COLUMN "agroTrackOrderId"`
        );
        await queryRunner.query(
            `DROP TYPE "public"."buy_requests_agrotrackstatus_enum"`
        );
    }
}
