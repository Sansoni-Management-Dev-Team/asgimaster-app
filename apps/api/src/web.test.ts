import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from './app.js';

test('Expo static mount serves clean direct routes, refresh, assets and HEAD', async (t) => {
  const temporary = await mkdtemp(join(process.env.BB_THREAD_STORAGE ?? tmpdir(), 'web-static-'));
  const root = join(temporary, 'export');
  await mkdir(join(root, '_expo/static/js/web'), { recursive: true });
  await mkdir(join(root, 'nested'), { recursive: true });
  await mkdir(join(root, '.private'), { recursive: true });
  await Promise.all([
    writeFile(join(root, 'index.html'), '<html>Loading member session</html>'),
    writeFile(join(root, 'sign-in.html'), '<html>Sign in</html>'),
    writeFile(join(root, 'nested/index.html'), '<html>Nested route</html>'),
    writeFile(
      join(root, '_expo/static/js/web/entry-aabbccddeeff0011.js'),
      'window.exportLoaded=true;',
    ),
    writeFile(join(root, 'favicon.ico'), 'favicon'),
    writeFile(join(root, '.env'), 'private'),
    writeFile(join(root, '.private/secret.txt'), 'private'),
    writeFile(join(temporary, 'secret.txt'), 'outside'),
  ]);
  await symlink(join(temporary, 'secret.txt'), join(root, 'leak.txt'));
  await symlink(join(root, 'favicon.ico'), join(root, 'public-alias.ico'));
  await symlink(join(root, '.env'), join(root, 'hidden-alias.txt'));
  await symlink(join(root, 'nested'), join(root, 'directory-alias'));
  await symlink(join(root, '.private'), join(root, 'hidden-directory'));
  const app = createApp({ webRoot: root });
  try {
    await t.test('canonical mount redirect preserves query', async () => {
      const response = await app.request('/app?review=true');
      assert.equal(response.status, 308);
      assert.equal(response.headers.get('location'), '/app/?review=true');
    });
    await t.test(
      'exported HTML works on direct load and refresh with private cache policy',
      async () => {
        for (const path of [
          '/app/',
          '/app/sign-in',
          '/app/sign-in/',
          '/app/sign-in.html',
          '/app/nested/',
        ]) {
          for (let refresh = 0; refresh < 2; refresh++) {
            const response = await app.request(path);
            assert.equal(response.status, 200, path);
            assert.match(response.headers.get('content-type')!, /text\/html/);
            assert.equal(response.headers.get('cache-control'), 'no-store');
          }
        }
      },
    );
    await t.test(
      'fingerprinted assets retain content type, immutable policy and HEAD behavior',
      async () => {
        const path = '/app/_expo/static/js/web/entry-aabbccddeeff0011.js';
        const get = await app.request(path),
          head = await app.request(path, { method: 'HEAD' });
        assert.equal(get.status, 200);
        assert.match(get.headers.get('content-type')!, /javascript/);
        assert.match(get.headers.get('cache-control')!, /immutable/);
        assert.equal(await get.text(), 'window.exportLoaded=true;');
        assert.equal(head.status, 200);
        assert.equal(await head.text(), '');
        assert.equal(head.headers.get('content-length'), get.headers.get('content-length'));
        const favicon = await app.request('/app/favicon.ico');
        assert.equal(favicon.status, 200);
        assert.equal(favicon.headers.get('cache-control'), 'public, max-age=3600');
      },
    );
    await t.test(
      'missing assets, unknown routes and mutations never receive app HTML',
      async () => {
        for (const path of [
          '/app/unknown',
          '/app/_expo/missing.js',
          '/app/assets/missing.png',
          '/app/_expo/missing.css',
        ]) {
          const response = await app.request(path);
          assert.equal(response.status, 404);
          assert.match(response.headers.get('content-type')!, /json/);
        }
        const post = await app.request('/app/sign-in', { method: 'POST' });
        assert.equal(post.status, 405);
        assert.equal(post.headers.get('allow'), 'GET, HEAD');
      },
    );
    await t.test('dotfiles, traversal and symlink escape cannot expose server files', async () => {
      for (const path of [
        '/app/.env',
        '/app/%2eenv',
        '/app/leak.txt',
        '/app/public-alias.ico',
        '/app/hidden-alias.txt',
        '/app/directory-alias/index.html',
        '/app/hidden-directory/secret.txt',
        '/app/%2e%2e%2fsecret.txt',
        '/app/a%5c..%5csecret.txt',
        '/app/%00',
      ]) {
        const response = await app.request(path);
        assert.equal(response.status, 404, path);
        assert.ok(!(await response.text()).includes('outside'));
      }
      assert.equal((await app.request('/app/%zz')).status, 400);
    });
    await t.test('health and member authorization remain outside static routing', async () => {
      assert.deepEqual(await (await app.request('/')).json(), { status: 'ok' });
      assert.deepEqual(await (await app.request('/health')).json(), { status: 'ok' });
      const member = await app.request('/v1/me');
      assert.equal(member.status, 401);
      assert.equal(
        ((await member.json()) as { error: { code: string } }).error.code,
        'UNAUTHENTICATED',
      );
      assert.equal(
        (await app.request('/_expo/static/js/web/entry-aabbccddeeff0011.js')).status,
        404,
      );
      assert.equal((await app.request('/app/v1/me')).status, 404);
    });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
test('an absent web build does not initialize the database or break probes', async () => {
  const app = createApp({ webRoot: '/missing-member-web-export' });
  assert.equal((await app.request('/health')).status, 200);
  assert.equal((await app.request('/app/')).status, 503);
});
