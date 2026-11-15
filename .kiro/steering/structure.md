---
inclusion: always
---

# Project structure

```
.kiro/
  steering/        product.md, tech.md, structure.md, form-privacy-and-i18n.md
  specs/<name>/    requirements.md (EARS), design.md, tasks.md per feature
  hooks/           *.json hook definitions (schema "v1")
  agents/          form-qa.json custom agent
  settings/        mcp.json (Context7)
src/
  capture/         camera and upload, image preprocessing (DOM, canvas)
  ocr/             Tesseract.js worker wrapper, label and box detection
  form-model/      field schema shared by every module (pure)
  mapping/         rule-based mapper, EN/HI label synonyms (pure)
  voice/           typed default, opt-in Web Speech API input
  validation/      date normalisation, required and signature checks (pure)
  pdf/             pdf-lib regeneration, font embedding
  stitch-code/     serialise, compress, encrypt, QR encode and decode (pure core)
  llm/             the single LLM adapter: none, Modal, Ollama, Gemini (pure core)
  ui/              lab-stitching theme, privacy panel, strings per language
  main.ts          entry point
public/
  samples/         generated sample forms (SAMPLE / DEMO DATA)
  tesseract/       self-hosted OCR worker, core and language data
  fonts/           self-hosted OFL fonts
scripts/
  hooks/           hook scripts (*.mjs) and their tests (*.test.mjs)
  make-samples.mjs sample form generator (planned)
modal/             optional Modal app serving an open-weights model (never deployed by the agent)
e2e/               Playwright smoke test
reports/raw/       raw logs written by hooks (hook-smoke.log)
.github/workflows/ CI: typecheck, test, build, guard checks
```

## Spec folders (one per feature, from PLAN.md section 5)

`capture-ocr`, `field-mapping`, `voice-answers`, `llm-adapter`, `validation`, `pdf-regeneration`, `stitch-code`, `lab-ui`, `sample-forms`, `accessibility`, `deliverable-docs`.

## Conventions

- File names are kebab-case. Each module has an `index.ts` that exports its public API; other modules import only from that.
- Tests sit next to the code: `foo.ts`, `foo.test.ts`, `foo.property.test.ts`. Shared fast-check arbitraries go in `<module>/arbitraries.ts`.
- Pure modules must not import from `capture`, `ocr`, `voice`, `pdf` or `ui`, and must not touch `window` or `document`.
- Fixtures for tests live in `<module>/__fixtures__/` and are fictional and labelled as demo data.
- Root-level deliverable docs: README.md, KIRO_USAGE.md, DEVPOST_STORY.md, VIDEO_SHOTLIST.md, BLOG_DRAFT.md, SOCIAL_POST.md, SUBMISSION_CHECKLIST.md, PLAN.md, LICENSE.
- `.kiro/` is always committed. Never add it to `.gitignore`.
