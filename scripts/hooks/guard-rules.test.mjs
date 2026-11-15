import { spawnSync } from 'node:child_process';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  classifyCommand,
  emDashLines,
  filesAddedInCommand,
  findSecrets,
  gitignoreMentionsKiro,
  isEnvFile,
  licenseProblem,
  needsEmDashCheck,
  preExistingSection,
  publishAllowed,
  sampleFileProblem,
  undocumentedDependencies,
} from './guard-rules.mjs';
import { extractCommand, extractFilePath, parsePayload, toRepoRelative } from './io.mjs';

// Secret-looking fixtures are assembled at runtime so this file itself never matches the scanner.
const fakeAwsKey = ['AKIA', 'ABCDEFGHIJKLMNOP'].join('');
const fakeGoogleKey = ['AIza', 'Sy'.padEnd(35, 'x')].join('');
const fakePem = ['-----BEGIN', 'RSA PRIVATE KEY-----'].join(' ');
const EM = String.fromCharCode(0x2014);

describe('classifyCommand', () => {
  it.each([
    ['git push', 'publish'],
    ['git push --dry-run origin main', 'publish'],
    ['git -C ../repo push', 'publish'],
    ['npm test && git push', 'publish'],
    ['FOO=1 git push', 'publish'],
    ['gh repo create stitchform --public', 'publish'],
    ['npx vercel --prod', 'publish'],
    ['vercel deploy', 'publish'],
    ['netlify deploy --prod', 'publish'],
    ['modal deploy modal/llm_server.py', 'publish'],
    ['modal serve modal/llm_server.py', 'publish'],
    ['modal run modal/llm_server.py', 'publish'],
    ['git add a.ts && git commit -m "feat: x" && git push', 'publish'],
    ['git commit -m "feat: add guard"', 'commit'],
    ['git add LICENSE && git commit -q -m "chore: license"', 'commit'],
    ['git commit -m "docs: never run git push or vercel"', 'commit'],
    ['git status', 'other'],
    ['grep -r vercel README.md', 'other'],
    ['modal --version', 'other'],
    ['echo git push', 'other'],
    ['npm run build', 'other'],
  ])('%s -> %s', (command, kind) => {
    expect(classifyCommand(command).kind).toBe(kind);
  });

  it('property: appending "&& git push" to any benign command makes it a publish command', () => {
    const benign = fc.constantFrom('ls', 'npm test', 'git status', 'echo hi', 'git commit -m "x"', 'cat README.md');
    fc.assert(
      fc.property(fc.array(benign, { minLength: 0, maxLength: 4 }), (parts) => {
        const command = [...parts, 'git push'].join(' && ');
        return classifyCommand(command).kind === 'publish';
      }),
    );
  });

  it('property: a commit message never changes the verdict for a plain commit', () => {
    const message = fc.string({ maxLength: 60 }).filter((s) => !/["'`$();|&\\\n]/.test(s));
    fc.assert(
      fc.property(message, (m) => classifyCommand(`git commit -m "${m}"`).kind === 'commit'),
    );
  });
});

describe('publishAllowed', () => {
  it('needs exactly STITCHFORM_GO=1', () => {
    expect(publishAllowed({})).toBe(false);
    expect(publishAllowed({ STITCHFORM_GO: 'yes' })).toBe(false);
    expect(publishAllowed({ STITCHFORM_GO: '1' })).toBe(true);
  });
});

describe('file rules', () => {
  it('finds files added in a combined command', () => {
    expect(filesAddedInCommand('git add a.ts b.md && git commit -m x')).toEqual(['a.ts', 'b.md']);
    expect(filesAddedInCommand('git add -f .env')).toEqual(['.env']);
  });

  it('flags .env files but not examples', () => {
    expect(isEnvFile('.env')).toBe(true);
    expect(isEnvFile('config/.env.local')).toBe(true);
    expect(isEnvFile('.env.example')).toBe(false);
    expect(isEnvFile('src/env.ts')).toBe(false);
  });

  it('detects .kiro in .gitignore', () => {
    expect(gitignoreMentionsKiro('node_modules/\n.kiro/\n')).toBe(true);
    expect(gitignoreMentionsKiro('.kiro')).toBe(true);
    expect(gitignoreMentionsKiro('**/.kiro/settings')).toBe(true);
    expect(gitignoreMentionsKiro('# .kiro is committed\nnode_modules/\n')).toBe(false);
    expect(gitignoreMentionsKiro('node_modules/\ndist/\n')).toBe(false);
  });

  it('finds secret-like strings', () => {
    expect(findSecrets(`key = ${fakeAwsKey}`)).toContain('AWS access key ID');
    expect(findSecrets(fakeGoogleKey)).toContain('Google API key');
    expect(findSecrets(fakePem)).toContain('private key block');
    expect(findSecrets('apiKey: "${CONTEXT7_API_KEY}"')).toEqual([]);
    expect(findSecrets('const label = "Date of Birth";')).toEqual([]);
  });

  it('checks em dashes in docs and UI strings only', () => {
    expect(needsEmDashCheck('README.md')).toBe(true);
    expect(needsEmDashCheck('index.html')).toBe(true);
    expect(needsEmDashCheck('src/ui/strings.en.ts')).toBe(true);
    expect(needsEmDashCheck('src/mapping/index.ts')).toBe(false);
    expect(emDashLines(`ok\nbad ${EM} line\nok`)).toEqual([2]);
    expect(emDashLines('a - b, c: d')).toEqual([]);
  });

  it('checks sample files for the SAMPLE label', () => {
    const labelled = new TextEncoder().encode('%PDF-1.7 /Title (SAMPLE / DEMO DATA: Lantern Hill)');
    expect(sampleFileProblem('public/samples/admission.pdf', labelled)).toBeNull();
    expect(sampleFileProblem('public/samples/admission.pdf', new TextEncoder().encode('%PDF-1.7'))).toMatch(/SAMPLE/);
    expect(sampleFileProblem('public/samples/sample-admission.png', new Uint8Array())).toBeNull();
    expect(sampleFileProblem('public/samples/admission.png', new Uint8Array())).toMatch(/sample-/);
  });

  it('requires the MIT license text', () => {
    expect(licenseProblem(null)).toMatch(/missing/);
    expect(licenseProblem('Apache License')).toMatch(/not the MIT/);
    expect(licenseProblem('MIT License\n\nPermission is hereby granted, free of charge, to any person')).toBeNull();
  });
});

describe('README Pre-existing work', () => {
  const readme = '# App\n\n## Pre-existing work\n\n- vite (MIT)\n- `fast-check` (MIT)\n\n## License\n\nMIT\n';

  it('extracts only that section', () => {
    expect(preExistingSection(readme)).toContain('vite');
    expect(preExistingSection(readme)).not.toContain('License');
    expect(preExistingSection('# App\n')).toBeNull();
  });

  it('lists dependencies missing from the section', () => {
    const pkg = { devDependencies: { vite: '1', 'fast-check': '1', vitest: '1' } };
    expect(undocumentedDependencies(pkg, readme)).toEqual(['vitest']);
    expect(undocumentedDependencies(pkg, '# no section')).toEqual(['vite', 'fast-check', 'vitest']);
  });
});

describe('payload helpers', () => {
  it('parses payloads and reports bad JSON', () => {
    expect(parsePayload('').payload).toBeNull();
    expect(parsePayload('{"a":1}').payload).toEqual({ a: 1 });
    expect(parsePayload('{bad').error).not.toBeNull();
  });

  it('extracts the shell command', () => {
    expect(extractCommand({ tool_name: 'shell', tool_input: { command: 'git push' } })).toBe('git push');
    expect(extractCommand({ tool_name: 'shell', tool_input: 'ls' })).toBe('ls');
    expect(extractCommand({ tool_name: 'read', tool_input: { path: 'x' } })).toBeNull();
    expect(extractCommand(null)).toBeNull();
  });

  it('extracts a file path from argv or payload', () => {
    expect(extractFilePath(null, ['src/a.ts'])).toBe('src/a.ts');
    expect(extractFilePath({ file_path: 'src/b.ts' }, ['{{filePath}}'])).toBe('src/b.ts');
    expect(extractFilePath({ tool_input: { path: 'src/c.ts' } }, [])).toBe('src/c.ts');
    expect(extractFilePath({}, [])).toBeNull();
    expect(toRepoRelative('/repo/src/a.ts', '/repo')).toBe('src/a.ts');
  });
});

describe('commit-guard.mjs end to end (publish paths only)', () => {
  const run = (payload, env = {}) =>
    spawnSync('node', ['scripts/hooks/commit-guard.mjs'], {
      input: JSON.stringify(payload),
      encoding: 'utf8',
      env: { ...process.env, STITCHFORM_GO: '', ...env },
    });

  it('blocks git push with exit code 2', () => {
    const r = run({ hook_event_name: 'PreToolUse', tool_name: 'shell', tool_input: { command: 'git push' } });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/blocked a publishing command/);
  });

  it('allows git push only when STITCHFORM_GO=1', () => {
    const r = run({ tool_name: 'shell', tool_input: { command: 'git push' } }, { STITCHFORM_GO: '1' });
    expect(r.status).toBe(0);
  });

  it('lets ordinary commands through', () => {
    expect(run({ tool_name: 'shell', tool_input: { command: 'ls -la' } }).status).toBe(0);
  });

  it('fails closed on an unparseable payload', () => {
    const r = spawnSync('node', ['scripts/hooks/commit-guard.mjs'], { input: '{not json', encoding: 'utf8' });
    expect(r.status).toBe(2);
  });
});
