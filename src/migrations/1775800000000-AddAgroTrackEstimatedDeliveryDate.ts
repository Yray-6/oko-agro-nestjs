import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAgroTrackEstimatedDeliveryDate1775800000000
  implements MigrationInterface
{
  name = 'AddAgroTrackEstimatedDeliveryDate1775800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "buy_requests" ADD "agroTrackEstimatedDeliveryDate" date`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "buy_requests" DROP COLUMN "agroTrackEstimatedDeliveryDate"`,
    );
  }
}
