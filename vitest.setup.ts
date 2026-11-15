import fc from 'fast-check';

// Property tests use fast-check's default run count (100) unless FC_NUM_RUNS is set.
// The commit-guard hook sets a low value so a commit check stays fast; CI and `npm test` use the default.
const fromEnv = Number.parseInt(process.env.FC_NUM_RUNS ?? '', 10);
if (Number.isInteger(fromEnv) && fromEnv > 0) {
  fc.configureGlobal({ numRuns: fromEnv });
}
