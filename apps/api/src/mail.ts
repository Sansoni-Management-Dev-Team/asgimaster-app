import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { and, eq, lte, sql } from 'drizzle-orm';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import nodemailer from 'nodemailer';
import type { Config } from './config.js';
import type { Database } from './db/database.js';
import { invites, memberLogins, outbox } from './db/schema.js';
import type { Identity } from './identity.js';

type Mail = { to: string; subject: string; text: string };
export type Transport = (mail: Mail) => Promise<void>;
export function createMail(
  database: Database,
  identity: Identity,
  config: Config,
  transport?: Transport,
) {
  const key = Buffer.from(config.outboxKey, 'base64');
  const seal = (mail: Mail) => {
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(mail), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
  };
  const open = (payload: string): Mail => {
    const bytes = Buffer.from(payload, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString(),
    );
  };
  const smtp =
    config.mailTransport === 'capture'
      ? nodemailer.createTransport({
          host: config.smtpHost,
          port: config.smtpPort,
          secure: false,
          ignoreTLS: true,
          logger: false,
          debug: false,
          connectionTimeout: 5000,
          socketTimeout: 5000,
          disableFileAccess: true,
          disableUrlAccess: true,
        })
      : undefined;
  const ses =
    config.mailTransport === 'ses'
      ? new SESv2Client({
          region: config.region,
          maxAttempts: 1,
          requestHandler: { requestTimeout: 5000, connectionTimeout: 3000 },
        })
      : undefined;
  const send: Transport =
    transport ??
    (async (mail) => {
      if (smtp) {
        await smtp.sendMail({ from: config.mailFrom, ...mail });
        return;
      }
      await ses!.send(
        new SendEmailCommand({
          FromEmailAddress: config.mailFrom,
          Destination: { ToAddresses: [mail.to] },
          Content: {
            Simple: {
              Subject: { Data: mail.subject, Charset: 'UTF-8' },
              Body: { Text: { Data: mail.text, Charset: 'UTF-8' } },
            },
          },
        }),
      );
    });
  async function enqueue(
    userId: string,
    kind: 'otp' | 'magic-link' | 'invite',
    mail: Mail,
    expiresAt: Date,
    inviteId?: string,
  ) {
    if (kind === 'otp') {
      // A rotated code must supersede queued copies before delivery.
      await database.db
        .update(outbox)
        .set({ status: 'cancelled', encryptedPayload: null })
        .where(
          and(eq(outbox.userId, userId), eq(outbox.kind, 'otp'), eq(outbox.status, 'pending')),
        );
    }
    const [pending] = await database.db
      .select({ id: invites.id })
      .from(invites)
      .innerJoin(memberLogins, eq(invites.memberId, memberLogins.memberId))
      .where(and(eq(memberLogins.userId, userId), eq(invites.status, 'pending')));
    inviteId ??= pending?.id;
    await database.db.insert(outbox).values({
      id: randomUUID(),
      userId,
      kind,
      encryptedPayload: seal(mail) as string,
      expiresAt,
      inviteId,
    });
  }
  async function drain(limit = 20) {
    let processed = 0;
    for (let i = 0; i < limit; i++) {
      const [candidate] = await database.db
        .select()
        .from(outbox)
        .where(and(eq(outbox.status, 'pending'), lte(outbox.nextAttemptAt, sql`now()`)))
        .orderBy(outbox.createdAt)
        .limit(1);
      if (!candidate) break;
      const found = await database.transaction(async () => {
        const eligible = await identity.eligible(candidate.userId, false, candidate.kind === 'otp');
        const [row] = await database.db
          .select()
          .from(outbox)
          .where(
            and(
              eq(outbox.id, candidate.id),
              eq(outbox.status, 'pending'),
              eq(outbox.attempts, candidate.attempts),
            ),
          )
          .limit(1)
          .for('update', { skipLocked: true });
        if (!row) return false;
        // Lock order matches invite revoke/session issue, preventing late mail for
        // revoked credentials. Delivery is at least once across a process crash.
        if (!eligible) {
          await database.db
            .update(outbox)
            .set({ status: 'cancelled', encryptedPayload: null, lastError: 'Eligibility changed.' })
            .where(eq(outbox.id, row.id));
          return true;
        }
        const invitation = row.inviteId
          ? (await database.db.select().from(invites).where(eq(invites.id, row.inviteId)))[0]
          : undefined;
        if (
          (row.inviteId && (!invitation || invitation.status !== 'pending')) ||
          row.expiresAt.getTime() <= Date.now()
        ) {
          await database.db
            .update(outbox)
            .set({
              status: 'expired',
              encryptedPayload: null,
              lastError: 'Message expired before delivery.',
            })
            .where(eq(outbox.id, row.id));
          return true;
        }
        try {
          await send(open(row.encryptedPayload!));
          await database.db
            .update(outbox)
            .set({
              status: 'sent',
              attempts: row.attempts + 1,
              sentAt: new Date(),
              encryptedPayload: null,
              lastError: null,
            })
            .where(eq(outbox.id, row.id));
        } catch {
          const failed = row.attempts + 1 >= 5;
          await database.db
            .update(outbox)
            .set({
              status: failed ? 'failed' : 'pending',
              attempts: row.attempts + 1,
              nextAttemptAt: new Date(Date.now() + Math.min(60000, 1000 * 2 ** row.attempts)),
              lastError: 'Mail transport rejected or could not confirm delivery.',
              ...(failed ? { encryptedPayload: null } : {}),
            })
            .where(eq(outbox.id, row.id));
        }
        return true;
      });
      if (!found) break;
      processed++;
    }
    return processed;
  }
  return { enqueue, drain };
}
export type MailService = ReturnType<typeof createMail>;
