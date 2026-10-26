import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { walk, safePath } from '../project/projectServer';
import type { createRooms } from '../collaboration/rooms';
import { batchedRead } from '../../shared/batchedRead';
import { sourcePath, string } from '../../shared/validation';
import { stopServiceAndWait } from '../../../vendor/stacki/electron/content/contentConfig';

export const CMS_SOURCE =
  /\.(astro|json|md|mdx|mdoc|markdown|css|[cm]?[jt]sx?|yaml|yml|toml|csv|ndjson)$/i;
export async function cmsSources(root: string, rooms?: ReturnType<typeof createRooms>) {
  const paths = [...(await walk(root, 'src')), ...(await walk(root, 'public'))];
  if (paths.length > 2000) {
    throw new Error('CMS scan exceeds 2,000 files');
  }
  let size = 0;
  const entries = await batchedRead(
    paths.filter((file) => CMS_SOURCE.test(file)),
    async (file) => {
      sourcePath(file);
      const source = rooms
        ? await rooms.read(file)
        : string(await readFile(await safePath(root, file), 'utf8'));
      size += Buffer.byteLength(source);
      if (size > 32_000_000) {
        throw new Error('CMS scan exceeds 32 MB');
      }
      return [file, source] as const;
    },
  );
  return { sources: new Map(entries), paths };
}
export async function withCmsSnapshot<T>(
  root: string,
  snapshot: Awaited<ReturnType<typeof cmsSources>>,
  run: (stage: string) => Promise<T>,
) {
  const stage = await mkdtemp(path.join(tmpdir(), 'studio-cms-'));
  try {
    await stageSources(root, stage, snapshot);
    return await run(stage);
  } finally {
    await stopServiceAndWait(stage);
    await rm(stage, { recursive: true, force: true });
  }
}
async function stageSources(
  root: string,
  stage: string,
  snapshot: Awaited<ReturnType<typeof cmsSources>>,
) {
  await symlink(path.join(root, 'node_modules'), path.join(stage, 'node_modules'), 'dir');
  for (const file of ['package.json', 'tsconfig.json', 'jsconfig.json']) {
    try {
      const source = string(await readFile(path.join(root, file), 'utf8'));
      await writeFile(path.join(stage, file), source);
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
        throw error;
      }
    }
  }
  // Asset placeholders allow import resolution without copying binary uploads.
  await batchedRead(snapshot.paths, async (file) => {
    const destination = await safePath(stage, file);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, snapshot.sources.get(file) ?? '');
  });
}
