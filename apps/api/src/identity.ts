import { randomUUID } from 'node:crypto';
import { and, eq, gt, sql } from 'drizzle-orm';
import type { Database } from './db/database.js';
import {
  audit,
  invites,
  memberLogins,
  members,
  outbox,
  session,
  user,
  verification,
} from './db/schema.js';
import { AppError } from './errors.js';

export const isStaff = (role: string | null | undefined) => role === 'admin' || role === 'staff';
export async function logAudit(
  database: Database,
  actorId: string,
  action: string,
  targetId: string,
  detail: object,
) {
  await database.db.insert(audit).values({ id: randomUUID(), actorId, action, targetId, detail });
}
export function createIdentity(database: Database) {
  const { db, transaction } = database;
  async function eligible(userId: string, accept = false, otp = false) {
    return transaction(async () => {
      const [login] = await db.select().from(user).where(eq(user.id, userId)).for('update');
      if (!login || login.banned) return false;
      const staffAllowed = isStaff(login.role) && otp;
      const [mapping] = await db.select().from(memberLogins).where(eq(memberLogins.userId, userId));
      if (!mapping || mapping.disabled) return staffAllowed;
      if (mapping.established) return true;
      const [invite] = await db
        .select()
        .from(invites)
        .where(
          and(
            eq(invites.memberId, mapping.memberId),
            eq(invites.status, 'pending'),
            gt(invites.expiresAt, new Date()),
          ),
        )
        .for('update');
      if (!invite) return staffAllowed;
      if (accept) {
        await db
          .update(invites)
          .set({ status: 'accepted', acceptedAt: new Date() })
          .where(eq(invites.id, invite.id));
        await db
          .update(memberLogins)
          .set({ established: true })
          .where(eq(memberLogins.userId, userId));
        await logAudit(database, userId, 'invite.accept', invite.id, {
          memberId: mapping.memberId,
        });
      }
      return true;
    });
  }
  async function byEmail(email: string) {
    return (await db.select().from(user).where(eq(user.email, email.toLowerCase())))[0];
  }
  async function bootstrapStaff(email: string, name: string, role: 'admin' | 'staff') {
    return transaction(async () => {
      // Serialize bootstrap against invites for the same email before a user row exists.
      await db.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${email.toLowerCase()},0))`,
      );
      const existing = await byEmail(email);
      if (existing) {
        if (existing.role === 'user') {
          const [promoted] = await db
            .update(user)
            .set({ role })
            .where(eq(user.id, existing.id))
            .returning();
          await logAudit(database, promoted.id, 'staff.grant', promoted.id, { role });
          return promoted;
        }
        if (existing.role !== role)
          throw new AppError(
            409,
            'IDENTITY_EXISTS',
            'An identity already exists with a different role.',
          );
        return existing;
      }
      const [created] = await db
        .insert(user)
        .values({ id: randomUUID(), email: email.toLowerCase(), name, role, emailVerified: false })
        .returning();
      await logAudit(database, created.id, 'staff.bootstrap', created.id, { role });
      return created;
    });
  }
  async function provisionMember(actorId: string, email: string, displayName: string) {
    return transaction(async () => {
      await db.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${email.toLowerCase()},0))`,
      );
      const existing = await byEmail(email);
      if (existing) {
        await db.select().from(user).where(eq(user.id, existing.id)).for('update');
        const [mapping] = await db
          .select()
          .from(memberLogins)
          .where(eq(memberLogins.userId, existing.id));
        if (mapping || !isStaff(existing.role))
          throw new AppError(409, 'IDENTITY_EXISTS', 'This email already has a member login.');
      }
      const id = randomUUID(),
        userId = existing?.id ?? randomUUID();
      if (!existing)
        await db
          .insert(user)
          .values({
            id: userId,
            email: email.toLowerCase(),
            name: displayName,
            role: 'user',
            emailVerified: false,
          });
      await db.insert(members).values({ id, email: email.toLowerCase(), displayName });
      await db.insert(memberLogins).values({ userId, memberId: id });
      await logAudit(database, actorId, 'member.provision', id, {});
      return { id, userId };
    });
  }
  // Invalidate all outstanding passwordless credentials, including magic-link
  // identifiers whose values contain the email. Tokens themselves remain hashed.
  async function cancelCredentials(userId: string) {
    const login = await byUserId(userId);
    if (!login) return;
    await db
      .delete(verification)
      .where(
        sql`${verification.identifier} = ${'sign-in-otp-' + login.email} or (case when ${verification.value} like '{%' then ${verification.value}::jsonb->>'email' else null end) = ${login.email}`,
      );
    await db
      .update(outbox)
      .set({ status: 'cancelled', encryptedPayload: null })
      .where(and(eq(outbox.userId, userId), eq(outbox.status, 'pending')));
  }
  async function byUserId(id: string) {
    return (await db.select().from(user).where(eq(user.id, id)))[0];
  }
  async function replaceInvite(actorId: string, memberId: string, reason: string) {
    return transaction(async () => {
      const [mapping] = await db
        .select()
        .from(memberLogins)
        .where(eq(memberLogins.memberId, memberId));
      if (!mapping) throw new AppError(404, 'MEMBER_NOT_FOUND', 'Member not found.');
      await db.select().from(user).where(eq(user.id, mapping.userId)).for('update');
      // Re-read after obtaining the lock shared with session issue and revoke.
      const [current] = await db
        .select()
        .from(memberLogins)
        .where(eq(memberLogins.userId, mapping.userId));
      if (current.established || current.disabled)
        throw new AppError(
          409,
          'INVITE_UNAVAILABLE',
          'This member cannot receive a new invitation.',
        );
      await db
        .update(invites)
        .set({ status: 'revoked', revokedAt: new Date() })
        .where(and(eq(invites.memberId, memberId), eq(invites.status, 'pending')));
      await cancelCredentials(mapping.userId);
      await db.delete(session).where(eq(session.userId, mapping.userId));
      const [invite] = await db
        .insert(invites)
        .values({
          id: randomUUID(),
          memberId,
          createdBy: actorId,
          expiresAt: new Date(Date.now() + 7 * 86400000),
        })
        .returning();
      await logAudit(database, actorId, 'invite.create', invite.id, { memberId, reason });
      return { ...invite, userId: mapping.userId };
    });
  }
  async function revokeInvite(actorId: string, inviteId: string, reason: string) {
    return transaction(async () => {
      const [invite] = await db.select().from(invites).where(eq(invites.id, inviteId));
      if (!invite) throw new AppError(404, 'INVITE_NOT_FOUND', 'Invitation not found.');
      const [mapping] = await db
        .select()
        .from(memberLogins)
        .where(eq(memberLogins.memberId, invite.memberId));
      await db.select().from(user).where(eq(user.id, mapping.userId)).for('update');
      const [current] = await db
        .select()
        .from(invites)
        .where(eq(invites.id, inviteId))
        .for('update');
      if (current.status === 'revoked') return;
      if (current.status !== 'pending')
        throw new AppError(409, 'INVITE_ACCEPTED', 'An accepted invitation cannot be revoked.');
      await db
        .update(invites)
        .set({ status: 'revoked', revokedAt: new Date() })
        .where(eq(invites.id, inviteId));
      await cancelCredentials(mapping.userId);
      await db.delete(session).where(eq(session.userId, mapping.userId));
      await logAudit(database, actorId, 'invite.revoke', inviteId, { reason });
    });
  }
  return {
    eligible,
    byEmail,
    byUserId,
    bootstrapStaff,
    provisionMember,
    replaceInvite,
    revokeInvite,
    cancelCredentials,
  };
}
export type Identity = ReturnType<typeof createIdentity>;
