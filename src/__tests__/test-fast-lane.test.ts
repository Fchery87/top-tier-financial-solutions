import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import {
  FAST_LANE_EXCLUDED_SUITES,
  buildFastLaneCommands,
  runFastLane,
} from '../../scripts/test-fast-lane.mjs';

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
