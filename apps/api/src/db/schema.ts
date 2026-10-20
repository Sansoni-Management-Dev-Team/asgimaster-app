import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema.js';
import type { OnboardingRecord } from '@mlai-sansoni/contracts';

export * from './auth-schema.js';
const time = (name: string) => timestamp(name, { withTimezone: true });
export const members = pgTable('members', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: time('created_at').notNull().defaultNow(),
});
export const memberLogins = pgTable('member_logins', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  memberId: text('member_id')
    .notNull()
    .unique()
    .references(() => members.id),
  established: boolean('established').notNull().default(false),
  disabled: boolean('disabled').notNull().default(false),
});
export const invites = pgTable(
  'invites',
  {
    id: text('id').primaryKey(),
    memberId: text('member_id')
      .notNull()
      .references(() => members.id),
    status: text('status').$type<'pending' | 'accepted' | 'revoked'>().notNull().default('pending'),
    expiresAt: time('expires_at').notNull(),
    createdAt: time('created_at').notNull().defaultNow(),
    acceptedAt: time('accepted_at'),
    revokedAt: time('revoked_at'),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id),
  },
  (t) => [
    uniqueIndex('one_pending_invite')
      .on(t.memberId)
      .where(sql`${t.status} = 'pending'`),
    check('invite_status', sql`${t.status} in ('pending','accepted','revoked')`),
  ],
);
export const onboarding = pgTable('onboarding_answers', {
  memberId: text('member_id')
    .primaryKey()
    .references(() => members.id),
  record: jsonb('record').$type<OnboardingRecord>().notNull(),
  updatedAt: time('updated_at').notNull().defaultNow(),
});
export const idempotency = pgTable(
  'idempotency',
  {
    memberId: text('member_id')
      .notNull()
      .references(() => members.id),
    key: text('key').notNull(),
    requestHash: text('request_hash').notNull(),
    response: jsonb('response').$type<OnboardingRecord>().notNull(),
    createdAt: time('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.memberId, t.key] })],
);
export const audit = pgTable('audit_log', {
  id: text('id').primaryKey(),
  actorId: text('actor_id')
    .notNull()
    .references(() => user.id),
  action: text('action').notNull(),
  targetId: text('target_id').notNull(),
  detail: jsonb('detail').notNull(),
  createdAt: time('created_at').notNull().defaultNow(),
});
export const outbox = pgTable(
  'email_outbox',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    inviteId: text('invite_id').references(() => invites.id),
    kind: text('kind').$type<'magic-link' | 'otp' | 'invite'>().notNull(),
    // Credentials are encrypted at rest; plaintext exists only while sending to the transport.
    encryptedPayload: text('encrypted_payload'),
    status: text('status')
      .$type<'pending' | 'sent' | 'failed' | 'expired' | 'cancelled'>()
      .notNull()
      .default('pending'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: time('next_attempt_at').notNull().defaultNow(),
    expiresAt: time('expires_at').notNull(),
    sentAt: time('sent_at'),
    lastError: text('last_error'),
    createdAt: time('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('outbox_pending_idx').on(t.status, t.nextAttemptAt),
    check('outbox_status', sql`${t.status} in ('pending','sent','failed','expired','cancelled')`),
  ],
);
