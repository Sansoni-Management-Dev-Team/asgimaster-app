import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from './db/database.js';
import { memberLogins, user } from './db/schema.js';
import { AppError } from './errors.js';
import { logAudit } from './identity.js';

export const staffChange = z.object({
  email: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  name: z.string().trim().min(1).max(80),
  role: z.enum(['staff', 'admin']),
  reason: z.string().trim().min(1).max(500),
});
export const staffRoleChange = z.object({
  role: z.enum(['user', 'staff', 'admin']),
  expectedRole: z.enum(['staff', 'admin']),
  reason: z.string().trim().min(1).max(500),
});
export function createStaffManagement(database: Database) {
  const { db } = database;
  async function requireAdmin(actorId: string) {
    const [actor] = await db.select().from(user).where(eq(user.id, actorId));
    if (!actor || actor.role !== 'admin' || actor.banned)
      throw new AppError(403, 'ADMIN_REQUIRED', 'Admin access is required.');
    return actor;
  }
  async function list(actorId: string, query: string, role: string, page: number) {
    await requireAdmin(actorId);
    const rows = await db
      .select({ person: user, memberId: memberLogins.memberId })
      .from(user)
      .leftJoin(memberLogins, eq(user.id, memberLogins.userId))
      .where(
        and(
          role ? eq(user.role, role) : inArray(user.role, ['staff', 'admin']),
          query
            ? or(
                sql`position(lower(${query}) in lower(${user.name})) > 0`,
                sql`position(lower(${query}) in lower(${user.email})) > 0`,
              )
            : undefined,
        ),
      )
      .orderBy(asc(user.name), asc(user.id))
      .limit(51)
      .offset((page - 1) * 50);
    return { rows: rows.slice(0, 50), hasNext: rows.length > 50 };
  }
  async function get(actorId: string, id: string) {
    await requireAdmin(actorId);
    const [person] = await db.select().from(user).where(eq(user.id, id));
    if (!person || !['staff', 'admin'].includes(person.role ?? ''))
      throw new AppError(404, 'STAFF_NOT_FOUND', 'Staff account not found.');
    return person;
  }
  async function change(actorId: string, id: string | null, input: unknown) {
    const values = id ? staffRoleChange.parse(input) : staffChange.parse(input);
    return database.transaction(async () => {
      // One lock covers both actor and target checks, including concurrent mutual
      // demotions. Email locks are shared with member invitation/bootstrap writes.
      await db.execute(
        sql`select pg_advisory_xact_lock(hashtextextended('staff-role-management',0))`,
      );
      await requireAdmin(actorId);
      let target;
      if (!id && 'email' in values) {
        await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${values.email},0))`);
        [target] = await db.select().from(user).where(eq(user.email, values.email)).for('update');
        if (target && target.role !== 'user')
          throw new AppError(
            409,
            'STAFF_EXISTS',
            'This login already has a role. Use its existing staff entry.',
          );
        if (!target) {
          [target] = await db
            .insert(user)
            .values({
              id: randomUUID(),
              email: values.email,
              name: values.name,
              role: values.role,
              emailVerified: false,
            })
            .returning();
          await logAudit(database, actorId, 'staff.grant', target!.id, {
            before: null,
            after: values.role,
            reason: values.reason,
          });
          return target!;
        }
      } else if (id) {
        [target] = await db.select().from(user).where(eq(user.id, id)).for('update');
        if (!target || !('expectedRole' in values) || target.role !== values.expectedRole)
          throw new AppError(
            409,
            'STAFF_CHANGED',
            'This account changed. Reload Staff & Admin and review it before trying again.',
          );
      }
      if (!target) throw new AppError(404, 'STAFF_NOT_FOUND', 'Staff account not found.');
      if (target.banned && values.role !== 'user')
        throw new AppError(
          409,
          'ACCOUNT_BLOCKED',
          'This account is blocked. Resolve its account status through the controlled support process.',
        );
      if (target.role === 'admin' && values.role !== 'admin' && !target.banned) {
        const admins = await db
          .select({ id: user.id })
          .from(user)
          .where(
            and(eq(user.role, 'admin'), or(eq(user.banned, false), sql`${user.banned} is null`)),
          );
        if (admins.length <= 1)
          throw new AppError(
            409,
            'LAST_ADMIN',
            'Keep at least one active admin. Add another admin before removing this access.',
          );
      }
      if (target.role === values.role) return target;
      const [updated] = await db
        .update(user)
        .set({ role: values.role })
        .where(eq(user.id, target.id))
        .returning();
      await logAudit(
        database,
        actorId,
        values.role === 'user'
          ? 'staff.revoke'
          : target.role === 'user'
            ? 'staff.grant'
            : 'staff.role_change',
        target.id,
        { before: target.role, after: values.role, reason: values.reason },
      );
      return updated!;
    });
  }
  return { requireAdmin, list, get, change };
}
