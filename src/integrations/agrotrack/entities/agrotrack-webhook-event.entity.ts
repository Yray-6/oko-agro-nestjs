import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Dedup table for inbound AgroTrack webhooks (order.status_changed).
 * A row here means "we've already processed this event_id" — a retried
 * delivery just gets a 200 no-op instead of double-applying a status change.
 */
@Entity('agrotrack_webhook_events')
export class AgroTrackWebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  eventId: string;

  @CreateDateColumn()
  receivedAt: Date;
}
