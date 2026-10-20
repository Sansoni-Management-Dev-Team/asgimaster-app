import { parseArgs } from 'node:util';
import { z } from 'zod';
import { loadConfig } from './config.js';
import { createServices } from './services.js';
import { isStaff } from './identity.js';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    role: { type: 'string' },
    'actor-email': { type: 'string' },
  },
});
const command = z.enum(['staff', 'member-fixture']).parse(positionals[0]);
const email = z.email().parse(values.email).toLowerCase(),
  name = z.string().trim().min(1).max(80).parse(values.name);
const config = loadConfig(),
  services = createServices(config);
try {
  if (command === 'staff') {
    const role = z.enum(['staff', 'admin']).parse(values.role);
    const staff = await services.identity.bootstrapStaff(email, name, role);
    console.log(`Named ${role} identity provisioned: ${staff.id}`);
  } else {
    if (config.production || !email.endsWith('@example.test'))
      throw new Error('Synthetic member fixtures require non-production and @example.test email.');
    const actor = await services.identity.byEmail(z.email().parse(values['actor-email']));
    if (!actor || !isStaff(actor.role) || actor.banned)
      throw new Error('A named staff actor is required.');
    const invite = await services.inviteMember(
      actor.id,
      email,
      name,
      'Controlled synthetic fixture',
    );
    console.log(`Synthetic member invitation queued: ${invite.id}`);
  }
} catch {
  console.error(
    'Provisioning failed. Check arguments, identity conflicts and database configuration.',
  );
  process.exitCode = 1;
} finally {
  await services.database.pool.end();
}
