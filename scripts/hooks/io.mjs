// Shared helpers for Kiro hook scripts.
// Kiro runs command hooks in the project root and sends the event as JSON on stdin
// (https://kiro.dev/docs/hooks/). These helpers read that payload defensively.

import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

/**
 * Read all of stdin and parse it as JSON.
 * Returns { payload, raw, error }. payload is null when stdin is empty or a TTY.
 */
export async function readPayload({ timeoutMs = 5000 } = {}) {
  if (process.stdin.isTTY) return { payload: null, raw: '', error: null };

  const raw = await new Promise((resolveRead) => {
    const chunks = [];
    const timer = setTimeout(() => finish(), timeoutMs);
    function finish() {
      clearTimeout(timer);
      process.stdin.removeAllListeners();
      process.stdin.pause();
      resolveRead(Buffer.concat(chunks).toString('utf8'));
    }
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', finish);
    process.stdin.on('error', finish);
  });

  return parsePayload(raw);
}

/** Parse a raw payload string. Exported for tests. */
export function parsePayload(raw) {
  const trimmed = raw.trim();
  if (trimmed === '') return { payload: null, raw, error: null };
  try {
    return { payload: JSON.parse(trimmed), raw, error: null };
  } catch (err) {
    return { payload: null, raw, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Find the shell command in a PreToolUse payload.
 * The documented shape is { tool_name, tool_input: {...} }; the shell tool's input
 * field is read as `command`, with a few fallbacks in case the field name differs.
 */
export function extractCommand(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const input = payload.tool_input;
  if (typeof input === 'string') return input;
  if (input && typeof input === 'object') {
    for (const key of ['command', 'cmd', 'script']) {
      if (typeof input[key] === 'string') return input[key];
    }
  }
  return null;
}

/**
 * Find a file path for a file event. Checks the CLI argument first (the hook may pass
 * {{filePath}}), then common payload keys, then any string under a key containing "path".
 */
export function extractFilePath(payload, argv = []) {
  const arg = argv.find((a) => typeof a === 'string' && a !== '' && !a.startsWith('--'));
  if (arg && !arg.includes('{{')) return arg;
  if (!payload || typeof payload !== 'object') return null;

  const direct = ['file_path', 'filePath', 'path', 'file'];
  for (const key of direct) {
    if (typeof payload[key] === 'string') return payload[key];
  }
  const found = findPathLike(payload, 0);
  return found;
}

function findPathLike(value, depth) {
  if (depth > 4 || !value || typeof value !== 'object') return null;
  for (const [key, v] of Object.entries(value)) {
    if (typeof v === 'string' && /path/i.test(key) && v !== '') return v;
    if (Array.isArray(v) && /path/i.test(key) && typeof v[0] === 'string') return v[0];
  }
  for (const v of Object.values(value)) {
    const nested = findPathLike(v, depth + 1);
    if (nested) return nested;
  }
  return null;
}

/** Turn a possibly absolute path into a repo-relative POSIX path. */
export function toRepoRelative(filePath, root = process.cwd()) {
  const abs = isAbsolute(filePath) ? filePath : resolve(root, filePath);
  return relative(root, abs).split('\\').join('/');
}

/** Append one JSON line to a log file under the repo, creating folders as needed. */
export function appendJsonLine(file, record) {
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify(record)}\n`, 'utf8');
}
