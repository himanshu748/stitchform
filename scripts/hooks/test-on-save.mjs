#!/usr/bin/env node
// test-on-save: Kiro PostFileSave hook for src/**/*.ts.
// Runs only the Vitest tests related to the saved file (`vitest related <file> --run`).
// The file path comes from the first CLI argument ({{filePath}}) or the stdin payload.
// Exit 0 adds the summary to the agent's context; exit 1 sends the failure to the agent.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { extractFilePath, readPayload, toRepoRelative } from './io.mjs';

export function shouldTest(relPath) {
  return /^src\/.*\.ts$/.test(relPath) && !relPath.endsWith('.d.ts');
}

async function main() {
  const { payload } = await readPayload();
  const filePath = extractFilePath(payload, process.argv.slice(2));
  if (!filePath) {
    process.stdout.write('test-on-save: no file path in the hook input, nothing to test.\n');
    return 0;
  }
  const rel = toRepoRelative(filePath);
  if (!shouldTest(rel) || !existsSync(rel)) {
    process.stdout.write(`test-on-save: ${rel} is not a source file under src/, skipped.\n`);
    return 0;
  }

  const vitest = join('node_modules', '.bin', 'vitest');
  const r = spawnSync(vitest, ['related', rel, '--run', '--passWithNoTests', '--reporter=dot'], {
    encoding: 'utf8',
    timeout: 110_000,
  });
  const output = `${r.stdout ?? ''}${r.stderr ?? ''}`.split('\n').slice(-30).join('\n');
  if (r.status === 0) {
    process.stdout.write(`test-on-save: tests related to ${rel} passed.\n${output}\n`);
    return 0;
  }
  process.stderr.write(`test-on-save: tests related to ${rel} FAILED. Fix them before moving on.\n${output}\n`);
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => process.exit(code));
}
