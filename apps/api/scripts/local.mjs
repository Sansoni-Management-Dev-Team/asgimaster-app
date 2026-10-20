import { spawnSync } from 'node:child_process';

const action = process.argv[2];
if (!['up', 'down', 'ps'].includes(action)) throw new Error('Expected up, down or ps');
const project = process.env.AUTH_COMPOSE_PROJECT ?? 'sansoni-auth-local';
if (!/^[a-z0-9][a-z0-9_-]+$/.test(project)) throw new Error('Invalid AUTH_COMPOSE_PROJECT');
const plugin = spawnSync('docker', ['compose', 'version'], { stdio: 'ignore' }).status === 0;
const args = [
  ...(plugin ? ['compose'] : []),
  '-p',
  project,
  '-f',
  'compose.auth.yml',
  action,
  ...(action === 'up' ? ['-d', '--wait'] : []),
];
const result = spawnSync(plugin ? 'docker' : 'docker-compose', args, { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
