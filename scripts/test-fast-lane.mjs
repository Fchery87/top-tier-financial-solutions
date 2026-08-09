import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const FAST_LANE_EXCLUDED_SUITES = [
  'src/__tests__/api/admin/dispute-submission-tracking.test.ts',
  'src/components/workspace/__tests__/AdminAnalyticsPanel.test.tsx',
];

function buildShardArguments(shard) {
  return [
    'run',
    '--pool=threads',
    '--maxWorkers=4',
    ...FAST_LANE_EXCLUDED_SUITES.map((suite) => `--exclude=${suite}`),
    `--shard=${shard}/2`,
  ];
}

export function buildFastLaneCommands() {
  return [1, 2].map((shard) => ({
    command: 'vitest',
    args: buildShardArguments(shard),
  }));
}

function runVitest(command, args) {
  const result = spawnSync('npx', [command, ...args], { stdio: 'inherit' });
  return result.status ?? 1;
}

export function runFastLane({ runCommand = runVitest, write = console.log } = {}) {
  const commands = buildFastLaneCommands();

  for (const [index, { command, args }] of commands.entries()) {
    write(`Fast lane: running non-serial shard ${index + 1}/${commands.length}`);
    const exitCode = runCommand(command, args);
    if (exitCode !== 0) {
      write(`Fast lane failed in shard ${index + 1}/${commands.length} (exit ${exitCode}).`);
      return exitCode;
    }
  }

  write('Fast lane passed. Run npm test before merging or releasing.');
  return 0;
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  process.exitCode = runFastLane();
}
