import type pg from 'pg';
import type {
  PlatformFeedback,
  PlatformFeedbackDTO,
} from '../../../domain/feedback/PlatformFeedback.ts';
import type { FeedbackRepository } from '../../../domain/feedback/FeedbackRepository.ts';

interface FeedbackRow {
  id: string;
  sender_name: string;
  email: string;
  feedback_type: string;
  platform_module: string;
  subject: string;
  message: string;
  created_at: Date;
}

function toDTO(row: FeedbackRow): PlatformFeedbackDTO {
  return {
    id: row.id,
    senderName: row.sender_name,
    email: row.email,
    feedbackType: row.feedback_type as PlatformFeedbackDTO['feedbackType'],
    platformModule: row.platform_module,
    subject: row.subject,
    message: row.message,
    createdAt: row.created_at.toISOString(),
  };
}

/** PostgreSQL adapter for the platform feedback bounded context. */
export class PostgresFeedbackRepository implements FeedbackRepository {
  private readonly pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  async loadAll(): Promise<PlatformFeedbackDTO[]> {
    const result = await this.pool.query<FeedbackRow>(
      'SELECT * FROM platform_feedback ORDER BY created_at ASC'
    );
    return result.rows.map(toDTO);
  }

  async save(feedback: PlatformFeedback): Promise<PlatformFeedbackDTO[]> {
    await this.pool.query(
      `INSERT INTO platform_feedback (
         id, sender_name, email, feedback_type, platform_module,
         subject, message, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO NOTHING`,
      [
        feedback.id,
        feedback.senderName.value,
        feedback.email,
        feedback.feedbackType,
        feedback.platformModule,
        feedback.subject.value,
        feedback.message.value,
        feedback.createdAt,
      ]
    );
    return this.loadAll();
  }

  async count(): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM platform_feedback'
    );
    return Number(result.rows[0]?.count ?? 0);
  }
}
