import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const script = fileURLToPath(new URL('../scripts/migrate-ecs.mjs', import.meta.url));
for (const outcome of ['success', 'nonzero', 'snapshot-failure', 'wait-failure'])
  test(`deployment retains rollback references on ${outcome} without contacting AWS`, () => {
    const dir = mkdtempSync(join(process.env.BB_THREAD_STORAGE ?? tmpdir(), 'deploy-test-'));
    const mock = join(dir, 'aws');
    writeFileSync(
      mock,
      `#!/usr/bin/env node
const fs=require('node:fs');const args=process.argv.slice(2);fs.appendFileSync(process.env.MOCK_CALLS,JSON.stringify(args)+'\\n');
const action=args[0]+' '+args[1];
if(process.env.MOCK_RESULT==='snapshot-failure'&&action==='rds create-db-cluster-snapshot')process.exit(1);
if(process.env.MOCK_RESULT==='wait-failure'&&action==='ecs wait')process.exit(1);
const results={'ecs describe-services':{services:[{taskDefinition:'previous-task',networkConfiguration:{awsvpcConfiguration:{subnets:['private-subnet'],securityGroups:['service-sg'],assignPublicIp:'DISABLED'}}}]},'rds create-db-cluster-snapshot':{},'ecs run-task':{tasks:[{taskArn:'migration-task'}]},'ecs describe-tasks':{tasks:[{containers:[{name:'app',exitCode:process.env.MOCK_RESULT==='nonzero'?1:0}]}]}};
if(action.endsWith(' wait'))process.exit(0);
if(!results[action])process.exit(2);
console.log(JSON.stringify(results[action]));
`,
      { mode: 0o755 },
    );
    const child = spawnSync(process.execPath, [script], {
      cwd: dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: dir + delimiter + process.env.PATH,
        AUTH_RELEASE_READY: 'true',
        RESTORE_REHEARSAL_REFERENCE: 'reviewed-restore',
        ECS_CLUSTER: 'cluster',
        ECS_SERVICE: 'service',
        TASK_DEFINITION_ARN: 'next-task',
        RDS_CLUSTER_IDENTIFIER: 'database',
        MOCK_RESULT: outcome,
        MOCK_CALLS: join(dir, 'calls.jsonl'),
        GITHUB_OUTPUT: join(dir, 'github-output'),
      },
    });
    const evidence = JSON.parse(readFileSync(join(dir, 'migration-release.json'), 'utf8'));
    assert.equal(evidence.previousTaskDefinition, 'previous-task');
    assert.ok(evidence.snapshotId);
    assert.equal(evidence.phase, outcome === 'success' ? 'migration-complete' : 'failed');
    assert.equal(child.status, outcome === 'success' ? 0 : 1);
    if (outcome !== 'snapshot-failure') assert.equal(evidence.migrationTask, 'migration-task');
    const calls = readFileSync(join(dir, 'calls.jsonl'), 'utf8');
    assert.ok(!calls.includes('update-service'));
  });
