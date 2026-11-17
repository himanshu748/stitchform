# Stitchform submission checklist

Local preparation only. Nothing has been pushed, hosted, posted, recorded, uploaded or submitted. Rules reference: [Kiroween 2026 official rules](https://kiroween.devpost.com/rules), read in the earlier in-app-browser session on 2026-11-15; the saved text was re-read for this checklist on 2026-11-17. Recheck the current page before submitting in case it has changed.

Deadline: **4 Dec 2026, 2:00 PM Pacific Time**, equivalent to **5 Dec 2026, 3:30 AM Asia/Kolkata**. Keep the test app free and accessible through **29 Jan 2027, 1:00 PM PT**, the recorded end of judging.

## Category and evidence

- [x] Project direction: **Frankenstein**. OCR → editable field model → English/Hindi answers → checks → PDF → encrypted QR.
- [x] Eleven specs with EARS requirements, designs and tasks in /.kiro/specs.
- [x] Product, tech, structure and form-privacy steering files.
- [x] Three requested hooks plus smoke hook and guard tests are committed. Distinguish observed triggers from configuration/replay in KIRO_USAGE.md.
- [x] form-qa custom agent definition and Context7 MCP configuration.
- [x] Real Kiro hook/MCP smoke evidence and property tests P1-P5.
- [ ] Final form-qa execution in Kiro and unobserved test-on-save/doc-sync trigger evidence. Kiro previously reported a monthly usage limit; do not claim Codex execution as Kiro execution.
- [ ] Kiro IDE foundation steering generation and Correctness feature, if used; record only actual execution.
- [x] MIT LICENSE at the repository root; /.kiro tracked and not ignored.
- [x] Pre-existing work and privacy/LLM limits documented in README.
- [x] Local sample → typed answers → PDF → QR → reload/refill journey exercised.
- [ ] Real camera and microphone checks in English/Hindi; physical-photo OCR, screen reader and low-end-phone check. Do not claim these in the video until verified.
- [ ] Optional Modal live health, auth/CORS and hosted-browser request, only after explicit deployment approval. Not required for the no-LLM judge journey.

## Public deliverables requiring owner approval

- [ ] Owner confirms age/residency and other eligibility requirements in current official rules; team has at most three eligible participants.
- [ ] Create a public GitHub repository. Confirm the MIT licence appears in GitHub's About section.
- [ ] Push the intended branch and verify public source/asset access. Local commits are not publication.
- [ ] Deploy the static app to Vercel's permitted free plan after approval. Test from a clean browser with no account and LLM off, and replace README's URL placeholder.
- [ ] Rerun public-host access, link and same-origin OCR checks. Keep access free/unrestricted until judging ends.
- [ ] Record real functioning footage under 3:00 using VIDEO_SHOTLIST.md, verify its duration and rights, upload it publicly to YouTube, and add the URL.
- [ ] Review DEVPOST_STORY.md and KIRO_USAGE.md, synchronise claims with the actual published build, and complete all form fields in English or provide translations.
- [ ] Explicitly approve and perform the final Devpost submission before the deadline. Preparation is not submission.

## Bonuses

- [ ] **Best Student Project (Frankenstein)**: owner confirms every team member currently attends a recognised academic institution. Supply for each: LinkedIn URL **TODO**, student email **TODO**, year/degree **TODO**, school **TODO**. Be ready to provide current-enrolment proof if requested.
- [ ] **Social Blitz**: edit SOCIAL_POST.md with the owner's own favourite Kiro feature and how it changed their approach. Keep #KiroweenHackathon26 at the very beginning. Post during the submission period only after approval, then supply its URL.
- [ ] **Bonus Blog**: review BLOG_DRAFT.md; retain the explicit Kiroween 2026 sentence. Publish on a third-party platform during the submission period only after approval, then supply its URL.
- [x] **Best Demo**: automatic consideration as described in the recorded rules; no separate bonus submission claimed.
- [x] **Best Ghost of Kiroween Past**: not applicable; owner said they did not register for Kiroween 2025.
- [x] **Best Startup**: not pursued; no founder/startup eligibility asserted.
- [x] **Best Kiro Crew App**: not pursued; no Kiro Crew app was built.

Optional credit request: owner may request the rules' 4,000 Kiro credits by **1 Dec 2026, 12:00 PM PT** and redeem by **4 Dec 2026**. This task did not request credits or alter billing.

## Commands for a later, explicitly approved release

Do not run these merely because they are listed. CLI help was checked for gh repo create and modal deploy. Provider setup links below are the source of truth; first review auth state and costs. Existing origin points to the unrelated local kiro repository, so inspect remotes and use a new name for the public target.

```sh
# Only if GitHub authentication is needed:
gh auth login
# After explicit repository/publication approval; replace YOUR_ACCOUNT:
gh repo create YOUR_ACCOUNT/stitchform --public --source=. --remote=github
# Inspect the target before pushing:
git remote -v
git push -u github stitchform-plan
```

Vercel commands after approval, from the [Vercel CLI docs](https://vercel.com/docs/cli): `npx vercel login`, `npx vercel` for a preview and `npx vercel --prod` for production. Preview deployment is still external publication and needs approval. This task ran none of them.

For optional Modal, the owner first confirms remaining credits and an enforced spend limit, then uses the README's exact-origin configuration and `modal deploy modal/stitchform_llm.py`. If authentication is needed, `modal token new` is the setup command from [Modal getting started](https://modal.com/docs/guide). No token, billing change or deployment was performed here.
