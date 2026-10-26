// Goal: atomic saves trigger one source change, never staging-file rebuilds.
// Method: use Vite's real watcher to observe staging creation, completed rename,
// ordinary outside edits and route creation/removal, with an existing ignore rule.
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rename, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { createServer } from 'vite';
import { sourceWatch } from '../src/features/project/sourceWatch';

test('watch only completed source and preserve project ignores', { timeout: 15000 }, async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'studio-source-watch-')));
  const directory = path.join(root, 'src/pages');
  await mkdir(directory, { recursive: true });
  const source = path.join(directory, 'index.astro');
  const outside = path.join(directory, 'outside.astro');
  await writeFile(source, '<h1>Before</h1>');
  await writeFile(outside, '<h1>Before outside edit</h1>');
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
    // Vite can finish the initial scan before createServer resolves. Observe the
    // watched files instead of waiting for an event that may already have fired.
    await waitForWatched(server.watcher, directory);
    await writeFile(source + '.studio-tmp', '<h1>After</h1>');
    await writeFile(source + '.project-ignore', 'Ignored');
    await setTimeout(250);
    assert.deepEqual(events, [], 'Staging files do not trigger route work');
    await rename(source + '.studio-tmp', source);
    await waitForEvent(events, 'change:index.astro');
    assert.deepEqual(events, ['change:index.astro']);
    events.length = 0;
    // Watchers coalesce rapid changes to the same path. Use another existing
    // source to test ordinary writes without assuming one event per write.
    await writeFile(outside, '<h1>Outside edit</h1>');
    await waitForEvent(events, 'change:outside.astro');
    const added = path.join(directory, 'new.astro');
    await writeFile(added, '<h1>New route</h1>');
    await waitForEvent(events, 'add:new.astro');
    await rm(added);
    await waitForEvent(events, 'unlink:new.astro');
    assert.deepEqual(events, ['change:outside.astro', 'add:new.astro', 'unlink:new.astro']);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

async function waitForWatched(
  watcher: { readonly getWatched: () => Readonly<Record<string, readonly string[]>> },
  directory: string,
): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt++) {
    const files = watcher.getWatched()[directory];
    if (files?.includes('index.astro')) {
      if (files.includes('outside.astro')) {
        return;
      }
    }
    await setTimeout(10);
  }
  assert.fail('Source files were not registered with the watcher');
}

async function waitForEvent(events: readonly string[], expected: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (events.includes(expected)) {
      return;
    }
    await setTimeout(10);
  }
  assert.fail(`Missing watcher event: ${expected}`);
}
