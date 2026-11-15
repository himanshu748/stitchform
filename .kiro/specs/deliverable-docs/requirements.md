# Requirements: Deliverable docs (F11)

Feature F11 in PLAN.md section 5. Judging criterion: Presentation.

## Introduction

Judges read the repository, the Devpost story and the video. The deliverable docs must be accurate, honest and easy to follow, and must meet every rule in the [Kiroween 2026 rules](https://kiroween.devpost.com/rules) that applies to them. The agent drafts them; the project owner reviews, records the video, publishes posts and submits. The agent never submits or publishes anything.

## Glossary

- **Owner**: the student entering Stitchform.
- **Deliverable docs**: README.md, KIRO_USAGE.md, DEVPOST_STORY.md, VIDEO_SHOTLIST.md, BLOG_DRAFT.md, SOCIAL_POST.md, SUBMISSION_CHECKLIST.md.

## Requirements

### Requirement 1: README.md

1.1 THE SYSTEM SHALL explain in README what Stitchform is, who it is for, how to run it (`npm ci`, `npm run dev`), how to test it (`npm test`, `npm run test:e2e`, `npm run build`), and how to regenerate the samples.

1.2 THE SYSTEM SHALL show a working app URL placeholder in README until the owner says go and the site is hosted.

1.3 THE SYSTEM SHALL include the privacy statement from PLAN.md section 1, stating that everything runs client-side by default.

1.4 THE SYSTEM SHALL list every template, library, font, word list, data file and asset that was not written for this project under "Pre-existing work", with version and licence.

1.5 THE SYSTEM SHALL include the optional LLM setup: the Ollama `OLLAMA_ORIGINS` line, and the Modal deployment steps, cost note, payment-method note and budget advice from the llm-adapter spec.

1.6 THE SYSTEM SHALL record measured numbers only (OCR time, key-derivation time, accessibility checks), each with the device or browser and date.

### Requirement 2: KIRO_USAGE.md

2.1 THE SYSTEM SHALL keep one section per Kiro write-up question in the rules: Kiro surfaces used and how they differed, custom agents, agent hooks, spec-driven development versus vibe coding, steering strategy, MCP, property-based testing, and Kiro powers.

2.2 WHEN a task changes Kiro configuration or produces a Kiro-related result THE SYSTEM SHALL update KIRO_USAGE.md in the same commit.

2.3 THE SYSTEM SHALL record only events that happened, with commands and outputs where useful, and SHALL say "not yet" or "not known" where there is no result.

### Requirement 3: DEVPOST_STORY.md

3.1 THE SYSTEM SHALL tell the project story under the headings Devpost uses (inspiration, what it does, how it was built, challenges, accomplishments, what was learned, what is next), including what did not work.

3.2 THE SYSTEM SHALL NOT claim users, usage numbers, testimonials or results that did not happen.

### Requirement 4: VIDEO_SHOTLIST.md

4.1 THE SYSTEM SHALL plan a video under 3:00 with a timed shot list that shows the app working on real devices (screen recording and phone camera), the Kiro specs, hooks and agent, and the no-LLM path.

4.2 THE SYSTEM SHALL state that the video uses no copyrighted music and no third-party trademarks without permission, and that only fictional demo data appears on screen.

### Requirement 5: BLOG_DRAFT.md and SOCIAL_POST.md

5.1 THE SYSTEM SHALL write a blog draft about building Stitchform with Kiro that says it was written for the Kiroween 2026 hackathon.

5.2 THE SYSTEM SHALL write a social post that starts with `#KiroweenHackathon26` and leaves the owner's favourite thing about Kiro, and how it changed their approach, as a TODO for the owner.

### Requirement 6: SUBMISSION_CHECKLIST.md

6.1 THE SYSTEM SHALL list the category (Frankenstein), the Best Student Project (Frankenstein) bonus with the details the owner must supply (LinkedIn, student email, year and degree, school), the Social Blitz and Bonus Blog bonuses, and the Best Demo note.

6.2 THE SYSTEM SHALL tick each rule from PLAN.md section 2 against evidence in the repository, and SHALL leave items that only the owner can do (creating the GitHub repo, pushing, hosting, uploading the video, submitting) unticked with the exact command or link.

6.3 THE SYSTEM SHALL state that Best Ghost of Kiroween Past does not apply, because the owner did not register for Kiroween 2025.

### Requirement 7: Style

7.1 THE SYSTEM SHALL write all deliverable docs in English with no em dash (U+2014).

7.2 THE SYSTEM SHALL label all example data as demo data.
