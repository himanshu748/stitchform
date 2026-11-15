#!/usr/bin/env node
// hook-smoke: appends one line to reports/raw/hook-smoke.log each time a hook fires.
// It proves which triggers fire in a given Kiro surface and records the real payload shape.
// Usage from a hook: node scripts/hooks/hook-smoke.mjs <label>

import { appendJsonLine, readPayload } from './io.mjs';

const MAX_PAYLOAD_CHARS = 1500;

async function main() {
  const label = process.argv[2] ?? 'unknown';
  const { payload, raw, error } = await readPayload({ timeoutMs: 2000 });
  appendJsonLine('reports/raw/hook-smoke.log', {
    at: new Date().toISOString(),
    label,
    hook_event_name: payload?.hook_event_name ?? null,
    payload_keys: payload && typeof payload === 'object' ? Object.keys(payload) : [],
    tool_name: payload?.tool_name ?? null,
    tool_input_keys:
      payload?.tool_input && typeof payload.tool_input === 'object' ? Object.keys(payload.tool_input) : [],
    argv: process.argv.slice(3),
    parse_error: error,
    payload_excerpt: raw.slice(0, MAX_PAYLOAD_CHARS),
  });
  process.stdout.write(`hook-smoke: logged ${label}.\n`);
  return 0;
}

main().then((code) => process.exit(code));
