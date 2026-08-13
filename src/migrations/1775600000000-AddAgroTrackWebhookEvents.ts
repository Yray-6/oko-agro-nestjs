import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAgroTrackWebhookEvents1775600000000
  implements MigrationInterface
{
  name = 'AddAgroTrackWebhookEvents1775600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "agrotrack_webhook_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "eventId" uuid NOT NULL, "receivedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_agrotrack_webhook_events_eventId" UNIQUE ("eventId"), CONSTRAINT "PK_agrotrack_webhook_events_id" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "agrotrack_webhook_events"`);
  }
}
