import { and, eq, gt } from 'drizzle-orm';
import type { Config } from './config.js';
import { createDatabase } from './db/database.js';
import { createIdentity, isStaff } from './identity.js';
import { createMail, type Transport } from './mail.js';
import { createAuth } from './auth.js';
import { invites, memberLogins, members } from './db/schema.js';
import { AppError } from './errors.js';
import { createMemberDirectory } from './member-directory.js';
import { createMemberSources } from './member-sources.js';

export function createServices(config: Config, transport?: Transport) {
  const database = createDatabase(config.database);
  const identity = createIdentity(database);
  const mail = createMail(database, identity, config, transport);
  const auth = createAuth(database, identity, mail, config);
  const memberDirectory = createMemberDirectory(
    database,
    createMemberSources(config.memberSources),
  );
  async function inviteMember(
    actorId: string,
    email: string,
    displayName: string,
    reason: string,
    resend = false,
  ) {
    return database.transaction(async () => {
      let login = await identity.byEmail(email);
      let memberId: string;
      if (!login) {
        const provisioned = await identity.provisionMember(actorId, email, displayName);
        memberId = provisioned.id;
        login = (await identity.byUserId(provisioned.userId))!;
      } else {
        const [mapping] = await database.db
          .select()
          .from(memberLogins)
          .where(eq(memberLogins.userId, login.id));
        if (!mapping && isStaff(login.role))
          memberId = (await identity.provisionMember(actorId, email, displayName)).id;
        else if (!mapping || mapping.established || mapping.disabled)
          throw new AppError(
            409,
            'INVITE_UNAVAILABLE',
            'This email cannot receive a new invitation.',
          );
        else memberId = mapping.memberId;
        // Repeated create submits do not rotate credentials or duplicate mail.
        const [pending] = await database.db
          .select()
          .from(invites)
          .where(
            and(
              eq(invites.memberId, memberId),
              eq(invites.status, 'pending'),
              gt(invites.expiresAt, new Date()),
            ),
          );
        if (pending && !resend) return pending;
      }
      const invite = await identity.replaceInvite(actorId, memberId, reason);
      const headers = new Headers({ origin: config.url });
      await auth.api.signInMagicLink({ headers, body: { email: login.email } });
      await auth.api.sendVerificationOTP({
        headers,
        body: { email: login.email, type: 'sign-in' },
      });
      return invite;
    });
  }
  async function resendInvite(actorId: string, inviteId: string, reason: string) {
    const [member] = await database.db
      .select({ email: members.email, displayName: members.displayName })
      .from(invites)
      .innerJoin(members, eq(invites.memberId, members.id))
      .where(eq(invites.id, inviteId));
    if (!member) throw new AppError(404, 'INVITE_NOT_FOUND', 'Invitation not found.');
    return inviteMember(actorId, member.email, member.displayName, reason, true);
  }
  return { config, database, identity, mail, auth, inviteMember, resendInvite, memberDirectory };
}
export type Services = ReturnType<typeof createServices>;
