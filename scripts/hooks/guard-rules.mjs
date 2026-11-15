// Pure decision logic for the commit-guard hook. No I/O here, so it can be unit tested.

const EM_DASH = '\u2014';

/** Split a shell command line into simple command segments. */
export function splitSegments(command) {
  return command
    .split(/&&|\|\||;|\||\n|\$\(|`|\(|\)/)
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

/** Tokenise one segment, dropping quotes. Good enough for policy checks, not a full shell parser. */
export function tokenize(segment) {
  const tokens = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(segment)) !== null) tokens.push(m[1] ?? m[2] ?? m[3] ?? '');
  return tokens;
}

const WRAPPERS = new Set(['sudo', 'npx', 'bunx', 'exec', 'env', 'command', 'time', 'nohup']);

/** Strip leading env assignments and wrapper commands such as `npx` or `env`. */
export function programTokens(tokens) {
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i] ?? '';
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t)) { i += 1; continue; }
    if (WRAPPERS.has(t)) { i += 1; while ((tokens[i] ?? '').startsWith('-')) i += 1; continue; }
    if ((t === 'pnpm' || t === 'yarn') && tokens[i + 1] === 'dlx') { i += 2; continue; }
    break;
  }
  return tokens.slice(i);
}

/** For `git [-C dir] [-c k=v] <sub> ...`, return the subcommand. */
export function gitSubcommand(tokens) {
  for (let i = 1; i < tokens.length; i += 1) {
    const t = tokens[i] ?? '';
    if (t === '-C' || t === '-c' || t === '--git-dir' || t === '--work-tree') { i += 1; continue; }
    if (t.startsWith('-')) continue;
    return t;
  }
  return null;
}

/**
 * Classify a shell command.
 * Returns { kind: 'publish' | 'commit' | 'other', reasons: string[] }.
 * 'publish' wins over 'commit' when a command line does both.
 */
export function classifyCommand(command) {
  const reasons = [];
  let commit = false;
  for (const segment of splitSegments(command)) {
    const tokens = programTokens(tokenize(segment));
    const [prog, a1, a2] = tokens.map((t) => t.split('/').pop() ?? t);
    if (!prog) continue;
    if (prog === 'git') {
      const sub = gitSubcommand(tokens);
      if (sub === 'push') reasons.push('git push publishes commits');
      if (sub === 'commit') commit = true;
    } else if (prog === 'gh' && a1 === 'repo' && a2 === 'create') {
      reasons.push('gh repo create creates a public repository');
    } else if (prog === 'gh' && (a1 === 'release' || a1 === 'pr') && a2 === 'create') {
      reasons.push(`gh ${a1} create publishes to GitHub`);
    } else if (prog === 'vercel') {
      reasons.push('vercel commands can deploy');
    } else if (prog === 'netlify' && (a1 === 'deploy' || a1 === 'sites:create' || a1 === 'init')) {
      reasons.push(`netlify ${a1} can deploy`);
    } else if (prog === 'modal' && (a1 === 'deploy' || a1 === 'serve' || a1 === 'run')) {
      reasons.push(`modal ${a1} starts paid cloud compute`);
    } else if (prog === 'npm' && a1 === 'publish') {
      reasons.push('npm publish publishes a package');
    }
  }
  if (reasons.length > 0) return { kind: 'publish', reasons };
  return { kind: commit ? 'commit' : 'other', reasons };
}

/** True when the user has explicitly allowed publishing for this session. */
export function publishAllowed(env) {
  return env.STITCHFORM_GO === '1';
}

/** Files in a `git add` segment, so a combined `git add x && git commit` is checked too. */
export function filesAddedInCommand(command) {
  const files = [];
  for (const segment of splitSegments(command)) {
    const tokens = programTokens(tokenize(segment));
    if ((tokens[0] ?? '').split('/').pop() !== 'git' || gitSubcommand(tokens) !== 'add') continue;
    const idx = tokens.indexOf('add');
    for (const t of tokens.slice(idx + 1)) if (!t.startsWith('-')) files.push(t);
  }
  return files;
}

/** .env files (but not .env.example) must never be committed. */
export function isEnvFile(path) {
  const base = path.split('/').pop() ?? path;
  if (base === '.env.example' || base === '.env.sample') return false;
  return base === '.env' || base.startsWith('.env.');
}

/** The .gitignore must not mention .kiro in any form. */
export function gitignoreMentionsKiro(text) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'))
    .some((l) => /(^|[/!*])\.kiro(\/|$|\*)/.test(l) || l === '.kiro');
}

const SECRET_PATTERNS = [
  { name: 'AWS access key ID', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: 'OpenAI-style secret key', re: /\bsk-[A-Za-z0-9_-]{32,}\b/ },
  { name: 'Slack token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  {
    name: 'hard-coded credential assignment',
    re: /\b(api[_-]?key|secret|token|password)\b\s*[:=]\s*["'][A-Za-z0-9_\-/+]{20,}["']/i,
  },
];

/** Return the names of secret-like patterns found in text. */
export function findSecrets(text) {
  return SECRET_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.name);
}

/** Files whose text must be free of em dashes: docs, HTML and UI strings. */
export function needsEmDashCheck(path) {
  return /\.(md|mdx|html)$/i.test(path) || /^src\/ui\/.*strings.*\.(ts|json)$/.test(path);
}

/** 1-based line numbers containing an em dash. */
export function emDashLines(text) {
  const lines = [];
  text.split('\n').forEach((line, i) => { if (line.includes(EM_DASH)) lines.push(i + 1); });
  return lines;
}

/** Return the body of the README section headed "Pre-existing work", or null. */
export function preExistingSection(readme) {
  const lines = readme.split('\n');
  const start = lines.findIndex((l) => /^#{1,6}\s+Pre-existing work\b/i.test(l));
  if (start === -1) return null;
  const level = (lines[start]?.match(/^#+/)?.[0] ?? '#').length;
  const end = lines.findIndex((l, i) => i > start && new RegExp(`^#{1,${level}}\\s`).test(l));
  return lines.slice(start + 1, end === -1 ? undefined : end).join('\n');
}

/** Dependencies from package.json that README "Pre-existing work" does not mention. */
export function undocumentedDependencies(pkg, readme) {
  const section = preExistingSection(readme);
  const names = Object.keys({ ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) });
  if (section === null) return names;
  return names.filter((n) => !section.includes(n));
}

export const SAMPLE_LABEL = 'SAMPLE / DEMO DATA';

/**
 * Check a file under public/samples/. PDFs must contain the label text in their bytes
 * (the generator writes it into the PDF title metadata and the page). Images must have
 * a file name starting with "sample-". Returns an error string or null.
 */
export function sampleFileProblem(path, bytes) {
  const base = path.split('/').pop() ?? path;
  if (base.startsWith('.') || base === 'README.md' || base.endsWith('.json')) return null;
  if (/\.pdf$/i.test(base)) {
    return Buffer.from(bytes).toString('latin1').includes(SAMPLE_LABEL)
      ? null
      : `${path} does not contain "${SAMPLE_LABEL}"`;
  }
  if (/\.(png|jpe?g|webp)$/i.test(base) && !base.startsWith('sample-')) {
    return `${path} must be named sample-*.${base.split('.').pop()}`;
  }
  return null;
}

/** LICENSE must exist and be the MIT text. */
export function licenseProblem(text) {
  if (text === null) return 'LICENSE is missing';
  if (!/^MIT License/.test(text) || !text.includes('Permission is hereby granted, free of charge')) {
    return 'LICENSE is not the MIT license text';
  }
  return null;
}
