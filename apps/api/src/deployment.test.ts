import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const script = fileURLToPath(new URL('../scripts/migrate-ecs.mjs', import.meta.url));
const workflow = readFileSync(
  new URL('../../../.github/workflows/main.yml', import.meta.url),
  'utf8',
);
const workflowRun = (name: string) => {
  const lines = workflow.split('\n');
  const step = lines.findIndex((line) => line === `      - name: ${name}`);
  assert.ok(step >= 0, `Missing workflow step ${name}`);
  let start = step + 1;
  while (lines[start] !== '        run: |') {
    assert.ok(start < lines.length && !lines[start].startsWith('      - '), `Missing run: ${name}`);
    start++;
  }
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line && !line.startsWith('          ')) break;
    body.push(line.slice(10));
  }
  return body.join('\n');
};

test('workflow retains legacy and prior-release settings across a same-revision retry', () => {
  const dir = mkdtempSync(join(process.env.BB_THREAD_STORAGE ?? tmpdir(), 'release-env-test-'));
  const objects = join(dir, 'objects');
  mkdirSync(objects);
  const legacyKey = 'bucket/service-app-develop/.env';
  mkdirSync(join(objects, 'bucket/service-app-develop'), { recursive: true });
  writeFileSync(join(objects, legacyKey), 'legacy-settings\n');
  writeFileSync(
    join(dir, 'aws'),
    `#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path'),args=process.argv.slice(2);
if(args[0]==='secretsmanager'&&args[1]==='get-secret-value'){
  console.log(fs.readFileSync(process.env.MOCK_SECRET,'utf8'));
}else if(args[0]==='s3'&&args[1]==='cp'){
  const destination=path.join(process.env.MOCK_OBJECTS,args[3].slice('s3://'.length));
  fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(args[2],destination);
}else{console.error('Unexpected fake AWS operation');process.exit(2)}
`,
    { mode: 0o755 },
  );
  if (process.platform === 'darwin')
    writeFileSync(
      join(dir, 'sed'),
      `#!/usr/bin/env node
const args=process.argv.slice(2);if(args[0]==='-i')args.splice(1,0,'');
process.exit(require('node:child_process').spawnSync('/usr/bin/sed',args,{stdio:'inherit'}).status??1);
`,
      { mode: 0o755 },
    );
  const releases: { key: string; contents: string }[] = [];
  for (const attempt of [1, 2]) {
    const work = join(dir, `attempt-${attempt}`);
    mkdirSync(work);
    writeFileSync(
      join(work, 'taskdef.json'),
      readFileSync(new URL('../../../taskdef.json', import.meta.url)),
    );
    const secretKeys = [
      'BETTER_AUTH_SECRET',
      'BETTER_AUTH_URL',
      'OUTBOX_ENCRYPTION_KEY',
      'MAIL_FROM',
      'MAIL_FEEDBACK_TO',
      'DATABASE_CA_BASE64',
      'TRUSTED_PROXY_CIDRS',
      'DATABASE_MAIN_DATABASE',
      'DATABASE_MAIN_HOST',
      'DATABASE_MAIN_PASSWORD',
      'DATABASE_MAIN_PORT',
      'DATABASE_MAIN_USERNAME',
    ];
    const secret = join(work, 'secret.json');
    writeFileSync(
      secret,
      JSON.stringify(Object.fromEntries(secretKeys.map((key) => [key, `fixture-${attempt}`]))),
    );
    const env = {
      ...process.env,
      PATH: dir + delimiter + process.env.PATH,
      GITHUB_ENV: join(work, 'github-env'),
      GITHUB_SHA: 'a'.repeat(40),
      GITHUB_RUN_ID: '123',
      GITHUB_RUN_ATTEMPT: String(attempt),
      PROJECT: 'service',
      ENVIRONMENT: 'develop',
      ENV_FILES_BUCKET: 'bucket',
      MOCK_SECRET: secret,
      MOCK_OBJECTS: objects,
      SECRET_NAME: 'fixture',
      AWS_ACCOUNT_ID: '123456789012',
      AWS_REGION: 'ap-southeast-2',
      ECR_REPOSITORY: 'fixture',
      NAME: 'app',
      LOG_GROUP: 'fixture',
    };
    const run = (name: string) => {
      const child = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', workflowRun(name)], {
        cwd: work,
        env,
        encoding: 'utf8',
      });
      assert.equal(child.status, 0, `${name}: ${child.stderr}`);
    };
    run('Set image tag');
    Object.assign(
      env,
      Object.fromEntries(
        readFileSync(env.GITHUB_ENV, 'utf8')
          .trim()
          .split('\n')
          .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
      ),
    );
    if (attempt === 1) {
      const complete = readFileSync(secret, 'utf8');
      const missingFeedback = JSON.parse(complete);
      delete missingFeedback.MAIL_FEEDBACK_TO;
      writeFileSync(secret, JSON.stringify(missingFeedback));
      const rejected = spawnSync(
        'bash',
        ['-e', '-o', 'pipefail', '-c', workflowRun('Generate and upload .env file')],
        { cwd: work, env, encoding: 'utf8' },
      );
      assert.notEqual(rejected.status, 0);
      assert.ok(rejected.stdout.includes('Required secret setting is missing: MAIL_FEEDBACK_TO'));
      assert.equal(
        existsSync(
          join(objects, 'bucket', (env as Record<string, string>).ENV_FILE_PREFIX, '.env'),
        ),
        false,
      );
      writeFileSync(secret, complete);
    }
    run('Generate and upload .env file');
    run('Update taskdef.json placeholders');
    const definition = JSON.parse(readFileSync(join(work, 'taskdef.json'), 'utf8'));
    const arn = definition[0].environmentFiles[0].value as string;
    assert.ok(arn.startsWith('arn:aws:s3:::'));
    const key = arn.slice('arn:aws:s3:::'.length);
    const contents = readFileSync(join(objects, key), 'utf8');
    assert.ok(contents.includes(`BETTER_AUTH_SECRET=fixture-${attempt}\n`));
    assert.ok(contents.includes(`MAIL_FEEDBACK_TO=fixture-${attempt}\n`));
    releases.push({ key, contents });
  }
  assert.notEqual(releases[0].key, releases[1].key);
  for (const release of releases)
    assert.equal(readFileSync(join(objects, release.key), 'utf8'), release.contents);
  assert.equal(readFileSync(join(objects, legacyKey), 'utf8'), 'legacy-settings\n');
});

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
        RELEASE_ENVIRONMENT_FILE_ARN: 'arn:aws:s3:::bucket/service/releases/revision/123-1/.env',
        RDS_CLUSTER_IDENTIFIER: 'database',
        MOCK_RESULT: outcome,
        MOCK_CALLS: join(dir, 'calls.jsonl'),
        GITHUB_OUTPUT: join(dir, 'github-output'),
      },
    });
    const evidence = JSON.parse(readFileSync(join(dir, 'migration-release.json'), 'utf8'));
    assert.equal(evidence.previousTaskDefinition, 'previous-task');
    assert.equal(
      evidence.nextEnvironmentFile,
      'arn:aws:s3:::bucket/service/releases/revision/123-1/.env',
    );
    assert.ok(evidence.snapshotId);
    assert.equal(evidence.phase, outcome === 'success' ? 'migration-complete' : 'failed');
    assert.equal(child.status, outcome === 'success' ? 0 : 1);
    if (outcome !== 'snapshot-failure') assert.equal(evidence.migrationTask, 'migration-task');
    const calls = readFileSync(join(dir, 'calls.jsonl'), 'utf8');
    assert.ok(!calls.includes('update-service'));
  });
