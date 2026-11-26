import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  FAST_LANE_EXCLUDED_SUITES,
  buildFastLaneCommands,
  resolveVitestLauncher,
  runFastLane,
} from '../../scripts/test-fast-lane.mjs';

describe('cross-platform scripts', () => {
  it('launches vitest through the current node binary, not a shell shim like npx', () => {
    const launcher = resolveVitestLauncher();

    expect(launcher.executable).toBe(process.execPath);
    expect(basename(launcher.cliPath)).toBe('vitest.mjs');
    expect(existsSync(launcher.cliPath)).toBe(true);
  });

  it('keeps npm lifecycle scripts free of POSIX-only commands', async () => {
    const { scripts } = JSON.parse(await readFile('package.json', 'utf8'));

    expect(scripts.pretypecheck).not.toMatch(/\brm\s+-rf\b/);
    expect(scripts.pretypecheck).toContain('.next/dev');
  });
});

describe('test fast lane', () => {
  it('runs both non-serial shards and excludes only the documented serial suites', () => {
    expect(FAST_LANE_EXCLUDED_SUITES).toEqual([
      'src/__tests__/api/admin/dispute-submission-tracking.test.ts',
      'src/components/workspace/__tests__/AdminAnalyticsPanel.test.tsx',
    ]);

    expect(buildFastLaneCommands()).toEqual([
      {
        command: 'vitest',
        args: [
          'run',
          '--pool=threads',
          '--maxWorkers=4',
          '--exclude=src/__tests__/api/admin/dispute-submission-tracking.test.ts',
          '--exclude=src/components/workspace/__tests__/AdminAnalyticsPanel.test.tsx',
          '--shard=1/2',
        ],
      },
      {
        command: 'vitest',
        args: [
          'run',
          '--pool=threads',
          '--maxWorkers=4',
          '--exclude=src/__tests__/api/admin/dispute-submission-tracking.test.ts',
          '--exclude=src/components/workspace/__tests__/AdminAnalyticsPanel.test.tsx',
          '--shard=2/2',
        ],
      },
    ]);
  });

  it('stops at the first failed command instead of retrying or hiding it', () => {
    const runCommand = vi.fn(() => 1);
    const write = vi.fn();

    expect(runFastLane({ runCommand, write })).toBe(1);
    expect(runCommand).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(expect.stringContaining('Fast lane failed'));
  });

  it('exposes the runner through npm and disables retries globally', async () => {
    const [packageJson, vitestConfig] = await Promise.all([
      readFile('package.json', 'utf8'),
      readFile('vitest.config.ts', 'utf8'),
    ]);

    expect(JSON.parse(packageJson).scripts['test:fast']).toBe('node scripts/test-fast-lane.mjs');
    expect(vitestConfig).toContain('retry: 0');
  });
});
