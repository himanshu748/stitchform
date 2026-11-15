#!/usr/bin/env node
// commit-guard: Kiro PreToolUse hook on the shell tool.
//
// Hook mode (default): reads the PreToolUse payload from stdin.
//   - Publishing commands (git push, gh repo create, vercel, netlify deploy, modal deploy/serve/run,
//     npm publish) are blocked unless the environment has STITCHFORM_GO=1.
//   - `git commit` runs the repository checks below and is blocked if any fail.
//   - Anything else passes.
//   Blocking uses exit code 2: the hook docs say a non-zero exit blocks a PreToolUse tool call,
//   and the IDE 1.0 hooks page names exit code 2 as the blocking code.
//
// CI mode (--ci): runs the repository checks on every tracked file and exits 1 on failure.
// --skip-slow skips typecheck and tests (CI runs those as separate steps).
//
// The whole run has an internal deadline (100 s by default, under the hook's 120 s timeout).
// If the checks have not finished by then, the script fails closed.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { extractCommand, readPayload } from './io.mjs';
import {
  classifyCommand,
  emDashLines,
  filesAddedInCommand,
  findSecrets,
  gitignoreMentionsKiro,
  isEnvFile,
  licenseProblem,
  needsEmDashCheck,
  publishAllowed,
  sampleFileProblem,
  undocumentedDependencies,
} from './guard-rules.mjs';

const args = process.argv.slice(2);
const CI = args.includes('--ci');
const SKIP_SLOW = args.includes('--skip-slow');
const BLOCK = CI ? 1 : 2;
const DEADLINE_MS = Number(process.env.STITCHFORM_GUARD_DEADLINE_MS ?? 100_000);
const FC_RUNS = process.env.STITCHFORM_GUARD_FC_RUNS ?? '20';
// Paths that are never part of the product (local task state for the agent that builds it).
const EXCLUDED_PREFIXES = ['.agents/', 'node_modules/', 'dist/'];
const MAX_SCAN_BYTES = 1_000_000;

const children = new Set();

const deadline = setTimeout(() => {
  for (const child of children) child.kill('SIGKILL');
  process.stderr.write(
    `commit-guard: checks did not finish within ${DEADLINE_MS / 1000} s, blocking (fail closed).\n`,
  );
  process.exit(BLOCK);
}, DEADLINE_MS);

function git(...gitArgs) {
  const r = spawnSync('git', gitArgs, { encoding: 'utf8' });
  return { status: r.status, out: (r.stdout ?? '').trim() };
}

function lines(text) {
  return text.split('\n').map((l) => l.trim()).filter((l) => l !== '');
}

function readText(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function isExcluded(path) {
  return EXCLUDED_PREFIXES.some((p) => path.startsWith(p));
}

function candidateFiles(command) {
  if (CI) return lines(git('ls-files').out).filter((f) => !isExcluded(f));
  const staged = lines(git('diff', '--cached', '--name-only', '--diff-filter=ACMR').out);
  // A single shell call may run `git add ... && git commit`, so this hook sees the tree before
  // the add. Check everything that could end up in the commit: staged, modified and untracked.
  const pending = lines(git('ls-files', '--modified', '--others', '--exclude-standard').out);
  const added = command ? filesAddedInCommand(command) : [];
  return [...new Set([...staged, ...pending, ...added])].filter((f) => !isExcluded(f) && existsSync(f));
}

function runCommand(label, cmd, cmdArgs, env = {}) {
  return new Promise((resolveRun) => {
    const child = spawn(cmd, cmdArgs, { env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    children.add(child);
    let output = '';
    child.stdout.on('data', (c) => { output += c; });
    child.stderr.on('data', (c) => { output += c; });
    child.on('close', (code) => {
      children.delete(child);
      resolveRun(code === 0 ? null : `${label} failed:\n${output.split('\n').slice(-40).join('\n')}`);
    });
    child.on('error', (err) => {
      children.delete(child);
      resolveRun(`${label} could not start: ${err.message}`);
    });
  });
}

function fastChecks(files, command) {
  const problems = [];

  for (const target of ['.kiro', '.kiro/hooks/commit-guard.json']) {
    if (git('check-ignore', '--no-index', '-q', target).status === 0) {
      problems.push(`${target} is ignored by git. /.kiro must be committed.`);
    }
  }
  const gitignore = readText('.gitignore');
  if (gitignore !== null && gitignoreMentionsKiro(gitignore)) {
    problems.push('.gitignore mentions .kiro. Remove that line.');
  }

  const license = licenseProblem(readText('LICENSE'));
  if (license) problems.push(license);

  const staged = CI ? files : lines(git('diff', '--cached', '--name-only').out);
  const envFiles = [...staged, ...(command ? filesAddedInCommand(command) : [])].filter(isEnvFile);
  for (const f of new Set(envFiles)) problems.push(`${f} is an environment file and must not be committed.`);

  for (const f of files) {
    let size = 0;
    try { size = statSync(f).size; } catch { continue; }
    if (size > MAX_SCAN_BYTES || f === 'package-lock.json') continue;
    const text = readText(f);
    if (text === null || text.includes('\u0000')) continue;
    for (const name of findSecrets(text)) problems.push(`${f}: looks like it contains a ${name}.`);
    if (needsEmDashCheck(f)) {
      const hits = emDashLines(text);
      if (hits.length > 0) problems.push(`${f}: em dash (U+2014) on line(s) ${hits.join(', ')}.`);
    }
  }

  if (existsSync('public/samples')) {
    for (const name of readdirSync('public/samples')) {
      const path = join('public/samples', name);
      if (!statSync(path).isFile()) continue;
      const problem = sampleFileProblem(path, readFileSync(path));
      if (problem) problems.push(problem);
    }
  }

  const pkgText = readText('package.json');
  const readme = readText('README.md') ?? '';
  if (pkgText !== null) {
    const missing = undocumentedDependencies(JSON.parse(pkgText), readme);
    if (missing.length > 0) {
      problems.push(`README "Pre-existing work" does not list: ${missing.join(', ')}.`);
    }
  }

  return problems;
}

async function slowChecks() {
  const bin = (name) => join('node_modules', '.bin', name);
  const results = await Promise.all([
    runCommand('typecheck (tsc --noEmit)', bin('tsc'), ['--noEmit']),
    runCommand(`tests (vitest run, FC_NUM_RUNS=${FC_RUNS})`, bin('vitest'), ['run'], { FC_NUM_RUNS: FC_RUNS }),
  ]);
  return results.filter((r) => r !== null);
}

async function runChecks(command) {
  const files = candidateFiles(command);
  const problems = fastChecks(files, command);
  if (problems.length === 0 && !SKIP_SLOW) problems.push(...(await slowChecks()));

  if (problems.length > 0) {
    process.stderr.write(`commit-guard blocked this commit:\n- ${problems.join('\n- ')}\n`);
    return BLOCK;
  }
  process.stdout.write(`commit-guard: all checks passed (${files.length} files scanned).\n`);
  return 0;
}

async function main() {
  if (CI) return runChecks(null);

  const { payload, error } = await readPayload();
  if (error) {
    process.stderr.write(`commit-guard: could not parse the hook payload (${error}). Blocking to be safe.\n`);
    return BLOCK;
  }
  const command = extractCommand(payload);
  if (command === null) return 0;

  const verdict = classifyCommand(command);
  if (verdict.kind === 'publish') {
    if (publishAllowed(process.env)) {
      process.stdout.write('commit-guard: publishing allowed because STITCHFORM_GO=1.\n');
      return 0;
    }
    process.stderr.write(
      `commit-guard blocked a publishing command: ${verdict.reasons.join('; ')}.\n` +
        'Stitchform never publishes or deploys without the user saying go. ' +
        'Ask the user; only they can set STITCHFORM_GO=1 before starting Kiro.\n',
    );
    return BLOCK;
  }
  if (verdict.kind === 'commit') return runChecks(command);
  return 0;
}

main().then(
  (code) => { clearTimeout(deadline); process.exit(code); },
  (err) => {
    clearTimeout(deadline);
    process.stderr.write(`commit-guard crashed: ${err instanceof Error ? err.stack : String(err)}\n`);
    process.exit(BLOCK);
  },
);
