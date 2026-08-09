// @vitest-environment node

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = join(process.cwd(), 'src');
const callerRoots = ['app', 'components', 'hooks'].map((directory) =>
  join(sourceRoot, directory),
);

describe('workspace API client contract', () => {
  it('does not let first-party callers use the deprecated admin API namespace', () => {
    expect(collectLegacyCallerPaths()).toEqual([]);
  });
});

function collectLegacyCallerPaths(): string[] {
  return callerRoots.flatMap((root) => collectTypeScriptFiles(root))
    .filter((filePath) => !filePath.includes(`${join('src', 'app', 'api')}/`))
    .filter((filePath) => readFileSync(filePath, 'utf8').includes('/api/admin/'))
    .map((filePath) => relative(sourceRoot, filePath))
    .sort();
}

function collectTypeScriptFiles(root: string): string[] {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
        !entry.parentPath.includes('__tests__'),
    )
    .map((entry) => join(entry.parentPath, entry.name));
}
