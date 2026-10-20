// Deployment entrypoint only. Run after review/restore readiness is recorded;
// never invoke this script as part of local testing.
import { execFileSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};
if (required('AUTH_RELEASE_READY') !== 'true')
  throw new Error('Auth release readiness has not been approved');
required('RESTORE_REHEARSAL_REFERENCE');
const cluster = required('ECS_CLUSTER'),
  service = required('ECS_SERVICE'),
  taskDefinition = required('TASK_DEFINITION_ARN'),
  databaseCluster = required('RDS_CLUSTER_IDENTIFIER');
const aws = (args) => {
  try {
    return JSON.parse(
      execFileSync('aws', [...args, '--output', 'json', '--no-cli-pager'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }) || 'null',
    );
  } catch {
    throw new Error(`AWS ${args[0]} ${args[1]} failed`);
  }
};
const wait = (args) => {
  try {
    execFileSync('aws', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    throw new Error(`AWS ${args[0]} wait failed`);
  }
};
const current = aws(['ecs', 'describe-services', '--cluster', cluster, '--services', service]);
if (current.failures?.length || current.services?.length !== 1)
  throw new Error('Cannot resolve the existing ECS service');
const existing = current.services[0];
if (!existing.networkConfiguration?.awsvpcConfiguration)
  throw new Error('Missing ECS service network configuration');
const snapshotId = `sansoni-before-migration-${Date.now()}`;
aws([
  'rds',
  'create-db-cluster-snapshot',
  '--db-cluster-identifier',
  databaseCluster,
  '--db-cluster-snapshot-identifier',
  snapshotId,
]);
wait([
  'rds',
  'wait',
  'db-cluster-snapshot-available',
  '--db-cluster-snapshot-identifier',
  snapshotId,
]);
const started = aws([
  'ecs',
  'run-task',
  '--cluster',
  cluster,
  '--task-definition',
  taskDefinition,
  '--launch-type',
  'FARGATE',
  '--count',
  '1',
  '--network-configuration',
  JSON.stringify(existing.networkConfiguration),
  '--overrides',
  JSON.stringify({
    containerOverrides: [{ name: 'app', command: ['node', 'dist/db/migrate.js'] }],
  }),
]);
if (started.failures?.length || started.tasks?.length !== 1)
  throw new Error('Migration task did not start');
const task = started.tasks[0].taskArn;
wait(['ecs', 'wait', 'tasks-stopped', '--cluster', cluster, '--tasks', task]);
const stopped = aws(['ecs', 'describe-tasks', '--cluster', cluster, '--tasks', task]);
if (
  stopped.failures?.length ||
  stopped.tasks?.[0]?.containers?.find((c) => c.name === 'app')?.exitCode !== 0
)
  throw new Error('Migration task failed; the ECS service has not been updated');
const evidence = {
  snapshotId,
  migrationTask: task,
  previousTaskDefinition: existing.taskDefinition,
  nextTaskDefinition: taskDefinition,
  restoreRehearsalReference: process.env.RESTORE_REHEARSAL_REFERENCE,
};
writeFileSync('migration-release.json', JSON.stringify(evidence, null, 2) + '\n');
if (process.env.GITHUB_OUTPUT)
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `previous-task-definition=${existing.taskDefinition}\nmigration-task=${task}\nsnapshot=${snapshotId}\n`,
  );
console.log(
  'Snapshot available and migration task exited successfully. Service update may proceed.',
);
