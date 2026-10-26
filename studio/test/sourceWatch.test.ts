// Goal: atomic saves trigger one source change, never staging-file rebuilds.
// Method: use Vite's real watcher to observe staging creation, completed rename,
// ordinary outside edits and route creation/removal, with an existing ignore rule.
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { setTimeout } from 'node:timers/promises';
import { createServer } from 'vite';
import { sourceWatch } from '../src/features/project/sourceWatch';

test('watch only completed source and preserve project ignores', { timeout: 15000 }, async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'studio-source-watch-'));
  const directory = path.join(root, 'src/pages');
  await mkdir(directory, { recursive: true });
  const source = path.join(directory, 'index.astro');
  await writeFile(source, '<h1>Before</h1>');
  const server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    appType: 'custom',
    server: {
      middlewareMode: true,
      hmr: { port: 0 },
      watch: { ignored: [/\.project-ignore$/] },
    },
    plugins: [sourceWatch()],
  });
  const events: string[] = [];
  server.watcher.on('all', (event, file) => {
    assert.ok(events.length < 100, 'Watcher event capture stays bounded');
    events.push(`${event}:${path.basename(file)}`);
  });
  try {
    await once(server.watcher, 'ready');
    await writeFile(source + '.studio-tmp', '<h1>After</h1>');
    await writeFile(source + '.project-ignore', 'Ignored');
    await setTimeout(250);
    assert.deepEqual(events, [], 'Staging files do not trigger route work');
    await rename(source + '.studio-tmp', source);
    await waitForEvent(events, 'change:index.astro');
    assert.deepEqual(events, ['change:index.astro']);
    events.length = 0;
    await writeFile(source, '<h1>Outside edit</h1>');
    await waitForEvent(events, 'change:index.astro');
    const added = path.join(directory, 'new.astro');
    await writeFile(added, '<h1>New route</h1>');
    await waitForEvent(events, 'add:new.astro');
    await rm(added);
    await waitForEvent(events, 'unlink:new.astro');
    assert.deepEqual(events, ['change:index.astro', 'add:new.astro', 'unlink:new.astro']);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

async function waitForEvent(events: readonly string[], expected: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (events.includes(expected)) {
      return;
    }
    await setTimeout(10);
  }
  assert.fail(`Missing watcher event: ${expected}`);
}
