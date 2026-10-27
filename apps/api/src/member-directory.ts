import { asc, desc, eq, or, sql } from 'drizzle-orm';
import type { Database } from './db/database.js';
import { invites, memberLogins, members } from './db/schema.js';
import { inspectSources, type MemberSource } from './member-sources.js';

export const directoryPageSize = 50;

export function createMemberDirectory(database: Database, sources: MemberSource[]) {
  const { db } = database;
  async function list(query: string, page: number) {
    const rows = await db
      .select({ member: members, login: memberLogins })
      .from(members)
      .leftJoin(memberLogins, eq(members.id, memberLogins.memberId))
      .where(
        query
          ? or(
              sql`position(lower(${query}) in lower(${members.displayName})) > 0`,
              sql`position(lower(${query}) in lower(${members.email})) > 0`,
              eq(members.id, query),
            )
          : undefined,
      )
      .orderBy(asc(members.displayName), asc(members.id))
      .limit(directoryPageSize + 1)
      .offset((page - 1) * directoryPageSize);
    return { rows: rows.slice(0, directoryPageSize), hasNext: rows.length > directoryPageSize };
  }
  async function get(id: string) {
    const [row] = await db
      .select({ member: members, login: memberLogins })
      .from(members)
      .leftJoin(memberLogins, eq(members.id, memberLogins.memberId))
      .where(eq(members.id, id));
    if (!row) return null;
    const invitations = await db
      .select()
      .from(invites)
      .where(eq(invites.memberId, id))
      .orderBy(desc(invites.createdAt), desc(invites.id))
      .limit(100);
    return { ...row, invitations, sources: await inspectSources(sources, id) };
  }
  return { list, get, sources: () => inspectSources(sources) };
}
