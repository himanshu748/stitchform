import type { Answer, BBox, FieldType, FormField } from "../form-model";
import { mapAnswers, toPromptedAnswers } from "../mapping";
import { messageFor } from "../validation";
import { SAMPLE_IDS, type SampleTemplate } from "../ocr/detect";
import {
  readImageFile,
  openCamera,
  stopCamera,
  capturePhoto,
} from "../capture";
import { recognitionSupport, startVoice } from "../voice";
import {
  assist,
  getKey,
  setKey,
  forgetKey,
  isRemembered,
  DEFAULT_OLLAMA_BASE_URL,
  type ProviderConfig,
} from "../llm";
import {
  createStitchCode,
  openStitchCode,
  toQrDataUrl,
  generatePassphrase,
  parseWordList,
  parseCommonPasswords,
  checkCustomPassphrase,
  passphraseMessage,
} from "../stitch-code";
import jsQR from "jsqr";
import { initialState, nextField, type Step } from "./state";
import { el, button, download } from "./dom";
import { en, type StringKey } from "./strings.en";
import { hi } from "./strings.hi";
import { voiceMessageKey } from "./voice-messages";
import "./theme.css";
import "./seams.css";

let voiceAnswer: { fieldId: string; text: string } | undefined;
const s = initialState(),
  signatures = new Map<string, Uint8Array>();
let templates: SampleTemplate[] = [],
  imageUrl: string | undefined,
  backgroundBytes: Uint8Array | undefined;
let seq = 0,
  revision = 0,
  voice: { stop: () => void; mode: "cloud" | "on-device" } | undefined,
  consent = false;
let voiceController: AbortController | undefined;
let ocrController: AbortController | undefined,
  llmController: AbortController | undefined,
  llm: ProviderConfig = { id: "none" };
let pdfUrl: string | undefined,
  passphrase = "",
  encrypted: Uint8Array<ArrayBuffer> | undefined,
  qrUrl: string | undefined;
let pendingOpen: Uint8Array | undefined,
  notice = "",
  processing = false;
let viewVersion = 0,
  encryptionJob = 0,
  pdfJob = 0;
const signatureJobs = new WeakMap<FormField, number>();
const root = document.querySelector<HTMLDivElement>("#app")!;
const text = (key: StringKey) => (s.lang === "hi" ? hi[key] : en[key]);
const context = () => {
  const now = new Date();
  return {
    today: { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() },
    lang: s.lang,
  };
};
const label = (f: FormField) =>
  s.lang === "hi"
    ? (templates.find((t) => t.id === s.form?.id)?.labelsHi[f.id] ?? f.label)
    : f.label;
function recalculate() {
  const hadExport = !!encrypted || !!pdfUrl;
  encrypted = undefined;
  qrUrl = undefined;
  document
    .querySelectorAll(".generated-export")
    .forEach((n) => n.replaceChildren());
  if (pdfUrl) {
    URL.revokeObjectURL(pdfUrl);
    pdfUrl = undefined;
  }
  if (s.form)
    s.result = mapAnswers(
      s.form,
      s.answers,
      new Set(signatures.keys()),
      context(),
    );
  revision++;
  s.saved = false;
  if (hadExport && s.step === "save") say(text("exportChanged"));
}
function say(message: string) {
  notice = message;
  const n = document.querySelector("#notice");
  if (n) n.textContent = message;
  const dialog = document.querySelector<HTMLDialogElement>("dialog[open]");
  if (dialog) {
    let live = dialog.querySelector<HTMLElement>(".dialog-status");
    if (!live) {
      live = el("p", "", "dialog-status");
      live.setAttribute("role", "status");
      dialog.append(live);
    }
    live.textContent = message;
  }
}
function current() {
  return s.form?.fields[s.current];
}
function statusLabel(status: string) {
  return text(
    status === "filled" ? "filled" : status === "flagged" ? "flagged" : "empty",
  );
}
function stopVoice() {
  const controller = voiceController,
    session = voice;
  voiceController = undefined;
  voice = undefined;
  document.querySelector("#voice-status")?.remove();
  if (controller) controller.abort();
  else session?.stop();
}
function go(step: Step) {
  stopVoice();
  s.step = step;
  notice = "";
  render();
  document.querySelector<HTMLElement>(".task-panel h1, main h1")?.focus();
}
function fieldInput(title: string, value = "", type = "text") {
  const wrap = el("label", "", "control");
  wrap.append(el("span", title));
  const input = el("input");
  input.type = type;
  input.maxLength = 4000;
  input.setAttribute("aria-label", title);
  input.value = value;
  wrap.append(input);
  return { wrap, input };
}
function selectInput(
  title: string,
  options: { value: string; label: string }[],
  value: string,
) {
  const wrap = el("label", "", "control");
  wrap.append(el("span", title));
  const input = el("select");
  input.setAttribute("aria-label", title);
  for (const o of options) {
    const n = el("option", o.label);
    n.value = o.value;
    input.append(n);
  }
  input.value = value;
  wrap.append(input);
  return { wrap, input };
}
function checkbox(title: string, checked = false) {
  const wrap = el("label", "", "checkbox"),
    input = el("input");
  input.type = "checkbox";
  input.checked = checked;
  wrap.append(input, el("span", title));
  return { wrap, input };
}
function modal(
  title: string,
  build: (dialog: HTMLDialogElement, body: HTMLDivElement) => void,
) {
  const d = el("dialog"),
    h = el("h2", title),
    body = el("div");
  h.id = `dialog-${crypto.randomUUID()}`;
  d.setAttribute("aria-labelledby", h.id);
  d.append(h, body);
  const close = button(text("close"), () => d.close(), "quiet");
  d.append(close);
  d.addEventListener("close", () => d.remove());
  document.body.append(d);
  build(d, body);
  d.showModal();
  return d;
}
async function loadTemplates() {
  if (!templates.length)
    templates = await Promise.all(
      SAMPLE_IDS.map(async (id) => {
        const r = await fetch(`/samples/${id}.template.json`);
        if (!r.ok) throw new Error("Sample could not be loaded.");
        return r.json() as Promise<SampleTemplate>;
      }),
    );
  return templates;
}
async function chooseSample(template: SampleTemplate) {
  stopVoice();
  llmController?.abort();
  s.form = structuredClone(template);
  s.answers = [];
  signatures.clear();
  s.current = 0;
  imageUrl = `/samples/${template.id}.png`;
  backgroundBytes = undefined;
  encrypted = undefined;
  qrUrl = undefined;
  passphrase = "";
  recalculate();
  s.saved = true;
  go("check");
}
function startManual() {
  s.form = {
    id: `manual-${crypto.randomUUID()}`,
    title: "Untitled form",
    source: "manual",
    pages: [{ index: 0, widthPt: 595.28, heightPt: 841.89 }],
    fields: [],
  };
  s.answers = [];
  signatures.clear();
  imageUrl = undefined;
  backgroundBytes = undefined;
  s.current = 0;
  recalculate();
  go("check");
}
function reset() {
  if (s.answers.length && !confirm(text("unsaved"))) return;
  ocrController?.abort();
  llmController?.abort();
  stopVoice();
  if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  delete s.form;
  delete s.result;
  s.answers = [];
  signatures.clear();
  s.step = "choose";
  imageUrl = undefined;
  backgroundBytes = undefined;
  encrypted = undefined;
  qrUrl = undefined;
  passphrase = "";
  s.saved = true;
  render();
}
function header() {
  const h = el("header", "", "header"),
    brand = button(
      text("brand"),
      () => go(s.form ? s.step : "choose"),
      "wordmark",
    );
  brand.prepend(el("span", "╱╲", "brand-mark"));
  const tag = el("span", text("tag"), "micro brand-tag");
  const tools = el("div", "", "header-tools");
  const lang = selectInput(
    text("language"),
    [
      { value: "en", label: "English" },
      { value: "hi", label: "हिन्दी" },
    ],
    s.lang,
  );
  lang.input.onchange = () => {
    stopVoice();
    s.lang = lang.input.value as "en" | "hi";
    render();
  };
  tools.append(
    button(
      text("large"),
      () => {
        s.large = !s.large;
        render();
      },
      "quiet",
    ),
    lang.wrap,
    button(text("privacy"), () => privacy(), "quiet"),
  );
  h.append(brand, tag, tools);
  return h;
}
function privacy() {
  modal(text("privacyTitle"), (_, body) => {
    body.append(el("p", text("privacyBody")));
    body.append(
      el(
        "p",
        voice
          ? text(voice.mode === "cloud" ? "cloudBadge" : "localBadge")
          : text("off"),
      ),
    );
    body.append(
      el(
        "p",
        llm.id === "none"
          ? "LLM: " + text("off")
          : `LLM: ${llm.id} (${llm.id === "modal" ? new URL(llm.endpoint).host : llm.id === "ollama" ? new URL(llm.baseUrl).host : ""})`,
      ),
    );
  });
}
function render() {
  stopVoice();
  viewVersion++;
  document.documentElement.lang = s.lang;
  document.documentElement.classList.toggle("large-text", s.large);
  root.replaceChildren(header());
  const shell = el("div", "", "shell");
  const aside = el("aside", "", "privacy-strip");
  aside.append(
    el("span", "◈"),
    el("span", text("noServer")),
    button(text("privacy"), privacy, "text-button"),
  );
  shell.append(aside);
  if (s.form) {
    const nav = el("nav", "", "steps");
    nav.setAttribute("aria-label", "Form steps");
    (["choose", "check", "answer", "review", "save"] as Step[]).forEach(
      (step, i) => {
        const b = button(
          `${String(i + 1).padStart(2, "0")}  ${text(step)}`,
          () => (step === "choose" ? reset() : go(step)),
          step === s.step ? "active" : "",
        );
        b.disabled =
          s.form!.fields.length === 0 &&
          ["answer", "review", "save"].includes(step);
        if (step === s.step) b.setAttribute("aria-current", "step");
        nav.append(b);
      },
    );
    shell.append(nav);
  }
  const live = el("p", notice, "notice");
  live.id = "notice";
  live.setAttribute("role", "status");
  live.setAttribute("aria-live", "polite");
  shell.append(live);
  if (voice)
    shell.append(
      el(
        "p",
        text(voice.mode === "cloud" ? "cloudBadge" : "localBadge"),
        "badge",
      ),
    );
  if (llm.id !== "none")
    shell.append(
      el(
        "p",
        `LLM: ${llm.id === "modal" ? new URL(llm.endpoint).host : "Ollama"}`,
        "badge",
      ),
    );
  const main = el("main");
  if (s.step === "choose") chooseView(main);
  else workspace(main);
  shell.append(main);
  const footer = el("footer");
  footer.append(el("span", text("footer")), el("span", text("help")));
  shell.append(footer);
  root.append(shell);
}
function heading(parent: HTMLElement, key: StringKey, description: StringKey) {
  const h = el("h1", text(key));
  h.tabIndex = -1;
  parent.append(h, el("p", text(description), "lede"));
}
function chooseView(main: HTMLElement) {
  const hero = el("section", "", "hero"),
    copy = el("div", "", "hero-copy");
  copy.append(el("p", text("eyebrow"), "micro"));
  heading(copy, "hero", "intro");
  const actions = el("div", "", "actions");
  const upload = el("input");
  upload.type = "file";
  upload.accept = "image/png,image/jpeg,image/webp";
  upload.hidden = true;
  upload.onchange = () => {
    const f = upload.files?.[0];
    if (f) void importImage(f);
  };
  actions.append(
    button(text("upload"), () => upload.click(), "primary"),
    button(text("camera"), () => cameraDialog(false), "secondary"),
    upload,
  );
  copy.append(actions, el("p", text("uploadHint"), "small"));
  const links = el("div", "", "actions");
  links.append(
    button(text("open"), openDialog, "text-button"),
    button(text("manual"), startManual, "text-button"),
  );
  copy.append(links);
  hero.append(copy, heroArt());
  main.append(hero);
  const local = el("section", "", "local-note");
  local.append(
    el("span", "◈", "local-icon"),
    el("strong", text("local")),
    el("span", text("localDetail")),
  );
  main.append(local);
  const section = el("section", "", "samples-section");
  section.append(
    el("p", "01 / " + text("samples"), "micro"),
    el("h2", text("sampleIntro")),
  );
  const cards = el("div", "", "sample-grid");
  const names: StringKey[] = ["admission", "scholarship", "hostel"];
  SAMPLE_IDS.forEach((id, i) => {
    const card = el("article", "", "sample-card");
    const thumb = el("div", "", "sample-thumb");
    const img = el("img");
    img.src = `/samples/${id}.png`;
    img.alt = text(names[i]!);
    thumb.append(img, el("span", `0${i + 1}`, "card-number"));
    card.append(
      thumb,
      el("p", text("sample"), "micro"),
      el("h3", text(names[i]!)),
    );
    const template = templates.find((t) => t.id === id);
    card.append(el("p", template?.title ?? id, "small"));
    card.append(
      button(
        text("trySample"),
        () => {
          void loadTemplates()
            .then((ts) => chooseSample(ts.find((t) => t.id === id)!))
            .catch(() => say(text("noFields")));
        },
        "secondary",
      ),
    );
    const links = el("div", "", "sample-links");
    for (const [ext, k] of [
      ["pdf", "blankPdf"],
      ["-crumpled.png", "crumpled"],
    ] as const) {
      const a = el("a", text(k));
      a.href = `/samples/${id}${ext === "pdf" ? ".pdf" : ext}`;
      a.download = "";
      links.append(a);
    }
    card.append(links);
    cards.append(card);
  });
  section.append(cards);
  main.append(section);
}
function heroArt() {
  const art = el("div", "", "hero-art");
  art.setAttribute("aria-hidden", "true");
  const paper = el("div", "", "illustration-paper");
  paper.append(
    el("div", "FIELD NOTES / 026", "micro"),
    el("div", "A form.\nA few answers.\nA fresh start.", "art-title"),
  );
  for (const [i, value] of [
    "Asha Willow",
    "05 / 03 / 2004",
    "One less thing to worry about.",
  ].entries()) {
    const patch = el("div", value, `art-patch art-patch-${i}`);
    patch.append(el("span", "✓", "art-check"));
    paper.append(patch);
  }
  paper.append(el("p", "SAMPLE / DEMO DATA", "micro"));
  art.append(
    el("div", "PHOTO → ANSWERS → PAPER", "micro art-caption"),
    paper,
    el("div", "Stitched together,\non your device.", "art-note"),
  );
  return art;
}
function workspace(main: HTMLElement) {
  const layout = el("div", "", "workspace"),
    left = el("section", "", "document-panel");
  if (s.form!.source === "sample")
    left.append(el("p", text("sample"), "sample-banner"));
  const preview = el("details", "", "document-preview");
  preview.open = s.step === "check" || !matchMedia("(max-width:640px)").matches;
  preview.append(el("summary", text("viewForm")), patchwork());
  left.append(el("h2", s.form!.title, "document-title"), preview);
  const tally = Object.values(s.result!.fields).filter(
      (r) =>
        r.status === "filled" &&
        s.form!.fields.find((f) => f.id === r.fieldId)?.required,
    ).length,
    total = s.form!.fields.filter((f) => f.required).length;
  left.append(el("p", `${tally} / ${total} ${text("progress")}`, "small"));
  const progress = el("progress");
  progress.max = total || 1;
  progress.value = tally;
  progress.setAttribute("aria-label", text("progress"));
  left.append(progress);
  const panel = el("section", "", "task-panel");
  if (s.step === "check") checkView(panel);
  if (s.step === "answer") answerView(panel);
  if (s.step === "review") reviewView(panel);
  if (s.step === "save") saveView(panel);
  layout.append(left, panel);
  main.append(layout);
}
function patchwork() {
  const paper = el("div", "", "document");
  paper.style.aspectRatio = "595 / 842";
  if (imageUrl) {
    const image = el("img");
    image.src = imageUrl;
    image.alt = "";
    paper.append(image);
  } else paper.classList.add("blank-paper");
  for (const [i, f] of s.form!.fields.entries()) {
    const r = s.result!.fields[f.id]!,
      b = button(
        "",
        () => {
          s.current = i;
          render();
        },
        "patch",
      );
    b.dataset.status = r.status;
    b.dataset.fieldId = f.id;
    b.style.left = f.bbox.x * 100 + "%";
    b.style.top = f.bbox.y * 100 + "%";
    b.style.width = f.bbox.w * 100 + "%";
    b.style.height = f.bbox.h * 100 + "%";
    b.title = `${label(f)}: ${statusLabel(r.status)}`;
    b.setAttribute("aria-label", b.title);
    b.append(
      el(
        "span",
        `${r.status === "filled" ? "✓ " : r.status === "flagged" ? "! " : ""}${r.value ?? label(f)}`,
      ),
    );
    if (i === s.current) b.classList.add("selected");
    b.onkeydown = (e) => {
      if (s.step !== "check" || !e.key.startsWith("Arrow")) return;
      e.preventDefault();
      const delta =
          e.key === "ArrowUp" || e.key === "ArrowLeft" ? -0.005 : 0.005,
        axis = e.key === "ArrowLeft" || e.key === "ArrowRight" ? "x" : "y";
      const box = { ...f.bbox };
      if (e.shiftKey) {
        const size = axis === "x" ? "w" : "h";
        box[size] = Math.max(0.015, Math.min(1 - box[axis], box[size] + delta));
      } else
        box[axis] = Math.max(
          0,
          Math.min(1 - box[axis === "x" ? "w" : "h"], box[axis] + delta),
        );
      f.bbox = box;
      recalculate();
      render();
      document.querySelector<HTMLElement>(`[data-field-id="${f.id}"]`)?.focus();
    };
    b.onpointerdown = (e) => {
      if (s.step !== "check") return;
      const start = { x: e.clientX, y: e.clientY },
        box = { ...f.bbox };
      b.setPointerCapture(e.pointerId);
      b.onpointermove = (event) => {
        const bounds = paper.getBoundingClientRect();
        f.bbox = {
          ...box,
          x: Math.max(
            0,
            Math.min(
              1 - box.w,
              box.x + (event.clientX - start.x) / bounds.width,
            ),
          ),
          y: Math.max(
            0,
            Math.min(
              1 - box.h,
              box.y + (event.clientY - start.y) / bounds.height,
            ),
          ),
        };
        b.style.left = f.bbox.x * 100 + "%";
        b.style.top = f.bbox.y * 100 + "%";
      };
      b.onpointerup = () => {
        b.onpointermove = null;
        s.current = i;
        recalculate();
        render();
      };
    };
    paper.append(b);
  }
  return paper;
}
function checkView(panel: HTMLElement) {
  heading(panel, "checkTitle", "checkHint");
  panel.append(el("p", text("ocrNote"), "small"));
  const f = current();
  if (f) {
    const name = fieldInput(text("fieldLabel"), f.label);
    name.input.onchange = () => {
      f.label = name.input.value;
      recalculate();
      render();
    };
    panel.append(name.wrap);
    const type = selectInput(
      text("fieldType"),
      [
        "text",
        "date",
        "number",
        "choice",
        "checkbox",
        "signature",
        "photo",
      ].map((v) => ({ value: v, label: v })),
      f.type,
    );
    type.input.onchange = () => {
      f.type = type.input.value as FieldType;
      if (f.type === "choice") f.choices = ["Option 1", "Option 2"];
      recalculate();
      render();
    };
    panel.append(type.wrap);
    const required = checkbox(text("required"), f.required);
    required.input.onchange = () => {
      f.required = required.input.checked;
      recalculate();
      render();
    };
    panel.append(required.wrap);
    if (f.type === "choice") {
      const choices = fieldInput(text("choices"), f.choices?.join(", ") ?? "");
      choices.input.onchange = () => {
        f.choices = choices.input.value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        recalculate();
        render();
      };
      panel.append(choices.wrap);
    }
    const box = el("div", "", "box-controls");
    for (const key of ["x", "y", "w", "h"] as (keyof BBox)[]) {
      const n = fieldInput(
        text(key),
        String(Math.round(f.bbox[key] * 10000) / 100),
        "number",
      );
      n.input.min = "0";
      n.input.max = "100";
      n.input.step = ".5";
      n.input.onchange = () => {
        const value = Number(n.input.value) / 100;
        if (!Number.isFinite(value)) return;
        const next = { ...f.bbox, [key]: Math.max(0.001, Math.min(1, value)) };
        if (next.x + next.w > 1) next.w = 1 - next.x;
        if (next.y + next.h > 1) next.h = 1 - next.y;
        f.bbox = next;
        recalculate();
        render();
      };
      box.append(n.wrap);
    }
    panel.append(box, el("p", text("boxHelp"), "small"));
    panel.append(
      button(
        text("remove"),
        () => {
          const r = s.result!.fields[f.id];
          if (
            (r?.value || r?.raw || signatures.has(f.id)) &&
            !confirm(text("deleteQuestion"))
          )
            return;
          s.form!.fields.splice(s.current, 1);
          s.answers = s.answers.filter((a) => a.promptedFieldId !== f.id);
          signatures.delete(f.id);
          s.current = Math.max(0, s.current - 1);
          recalculate();
          render();
        },
        "danger",
      ),
    );
  }
  panel.append(
    button(
      text("add"),
      () => {
        const id = `field-${Date.now()}`;
        s.form!.fields.push({
          id,
          label: "New field",
          type: "text",
          required: false,
          page: 0,
          bbox: { x: 0.08, y: 0.25, w: 0.84, h: 0.035 },
        });
        s.current = s.form!.fields.length - 1;
        recalculate();
        render();
      },
      "secondary",
    ),
    button(
      text("continue"),
      () => {
        s.current = 0;
        go("answer");
      },
      "primary",
    ),
  );
}
function record(
  value: string,
  source: Answer["source"] = voiceAnswer?.fieldId === current()?.id &&
  voiceAnswer?.text === value
    ? "voice"
    : "typed",
) {
  const f = current();
  if (!f) return;
  s.answers = s.answers.filter((a) => a.promptedFieldId !== f.id);
  s.answers.push({
    text: value,
    promptedFieldId: f.id,
    lang: s.lang,
    source,
    seq: ++seq,
  });
  recalculate();
}
function answerView(panel: HTMLElement) {
  heading(panel, "answerTitle", "answerHint");
  const f = current();
  if (!f) {
    panel.append(button(text("reviewButton"), () => go("review"), "primary"));
    return;
  }
  const count = el(
    "p",
    `${String(s.current + 1).padStart(2, "0")} / ${s.form!.fields.length}`,
    "micro",
  );
  panel.append(
    count,
    el("h2", label(f)),
    el("p", text(f.required ? "requiredLabel" : "optional"), "small"),
  );
  const r = s.result!.fields[f.id]!;
  const hint = {
    date: "hintDate",
    number: "hintNumber",
    choice: "hintChoice",
    checkbox: "hintCheckbox",
    signature: "hintSignature",
    photo: "hintPhoto",
    text: "hintText",
  } as const;
  panel.append(el("p", text(hint[f.type]), "small"));
  let valueControl: HTMLInputElement | HTMLSelectElement | undefined;
  if (f.type === "signature") signaturePanel(panel, f);
  else if (f.type !== "photo") {
    if (f.type === "choice" || f.type === "checkbox") {
      const options =
        f.type === "choice"
          ? (f.choices ?? []).map((v) => ({ value: v, label: v }))
          : [
              { value: "yes", label: text("yes") },
              { value: "no", label: text("no") },
            ];
      const control = selectInput(
        label(f),
        [{ value: "", label: text("empty") }, ...options],
        r.value ?? r.raw ?? "",
      );
      valueControl = control.input;
      panel.append(control.wrap);
    } else {
      const control = fieldInput(label(f), r.raw ?? r.value ?? "");
      valueControl = control.input;
      control.input.autocomplete = "off";
      panel.append(control.wrap);
    }
    valueControl.id = "answer-value";
    valueControl.setAttribute("aria-describedby", "answer-issues");
    valueControl.setAttribute("aria-invalid", String(r.status === "flagged"));
    valueControl.onchange = () => {
      record(valueControl!.value);
      updateIssues();
    };
  }
  const issues = el("div", "", "field-issues");
  issues.id = "answer-issues";
  issues.setAttribute("aria-live", "polite");
  panel.append(issues);
  function updateIssues() {
    issues.replaceChildren();
    const result = s.result!.fields[f!.id]!;
    for (const issue of result.issues)
      issues.append(el("p", messageFor(issue.code, s.lang, issue.params)));
    if (result.value)
      issues.append(el("p", `${text("normalised")}: ${result.value}`));
  }
  updateIssues();
  const controls = el("div", "", "actions");
  controls.append(
    button(
      text("submit"),
      () => {
        if (valueControl) record(valueControl.value);
        s.current = Math.min(s.current + 1, s.form!.fields.length);
        render();
        document.querySelector<HTMLElement>("#answer-value")?.focus();
      },
      "primary",
    ),
    button(
      text("skip"),
      () => {
        s.current++;
        render();
      },
      "quiet",
    ),
  );
  panel.append(controls);
  if (valueControl?.tagName === "INPUT") {
    valueControl.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        controls.querySelector("button")?.click();
      }
    };
    if (recognitionSupport()) {
      const voiceButton = button(
        text(voice ? "stop" : "speak"),
        () => {
          if (voice) {
            stopVoice();
            render();
          } else enableVoice(valueControl as HTMLInputElement);
        },
        "secondary",
      );
      voiceButton.id = "voice-toggle";
      panel.append(voiceButton);
    } else panel.append(el("p", text("voiceUnsupported"), "small"));
  }
  panel.append(
    button(
      text("back"),
      () => {
        s.current = Math.max(0, s.current - 1);
        render();
      },
      "quiet",
    ),
    button(text("reviewButton"), () => go("review"), "text-button"),
  );
  const free = el("details");
  free.append(el("summary", text("freeTitle")));
  const input = fieldInput(text("freeHint"));
  free.append(
    input.wrap,
    button(
      text("map"),
      () => {
        s.answers.push({
          text: input.input.value,
          source: "typed",
          lang: s.lang,
          seq: ++seq,
        });
        recalculate();
        s.current = Math.max(0, nextField(s.form!, s.result!));
        render();
      },
      "secondary",
    ),
  );
  panel.append(free);
}
function signaturePanel(panel: HTMLElement, f: FormField) {
  const form = s.form;
  const begin = () => {
    const job = (signatureJobs.get(f) ?? 0) + 1;
    signatureJobs.set(f, job);
    return job;
  };
  const active = (job: number) =>
    s.form === form && form?.fields.includes(f) && signatureJobs.get(f) === job;
  const canvas = el("canvas");
  canvas.width = 900;
  canvas.height = 240;
  canvas.className = "signature-pad";
  canvas.setAttribute("aria-label", text("draw"));
  const ctx = canvas.getContext("2d")!;
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#20392e";
  ctx.lineCap = "round";
  let drawing = false,
    moved = false;
  canvas.onpointerdown = (e) => {
    drawing = true;
    moved = false;
    canvas.setPointerCapture(e.pointerId);
    const b = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(
      ((e.clientX - b.x) * canvas.width) / b.width,
      ((e.clientY - b.y) * canvas.height) / b.height,
    );
  };
  canvas.onpointermove = (e) => {
    if (!drawing) return;
    moved = true;
    const b = canvas.getBoundingClientRect();
    ctx.lineTo(
      ((e.clientX - b.x) * canvas.width) / b.width,
      ((e.clientY - b.y) * canvas.height) / b.height,
    );
    ctx.stroke();
  };
  canvas.onpointerup = () => {
    drawing = false;
    if (moved) {
      const job = begin();
      canvas.toBlob((b) => {
        if (b)
          void b.arrayBuffer().then((bytes) => {
            if (!active(job)) return;
            signatures.set(f.id, new Uint8Array(bytes));
            recalculate();
            if (canvas.isConnected) say(text("filled"));
          });
      }, "image/png");
    }
  };
  const file = el("input");
  file.type = "file";
  file.accept = "image/png,image/jpeg,image/webp";
  file.hidden = true;
  file.setAttribute("aria-label", text("signatureUpload"));
  file.onchange = () => {
    const image = file.files?.[0];
    const job = begin();
    if (image)
      void readImageFile(image)
        .then(
          (c) =>
            new Promise<Blob>((resolve, reject) =>
              c.toBlob((b) => (b ? resolve(b) : reject()), "image/png"),
            ),
        )
        .then((b) => b.arrayBuffer())
        .then((b) => {
          if (!active(job)) return;
          signatures.set(f.id, new Uint8Array(b));
          recalculate();
          if (file.isConnected) render();
        })
        .catch(() => {
          if (active(job)) say(text("signatureError"));
        });
  };
  if (signatures.has(f.id)) {
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = new Blob([Uint8Array.from(signatures.get(f.id)!)], {
        type: "image/png",
      }),
      url = URL.createObjectURL(blob);
    img.src = url;
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
    };
  }
  panel.append(
    canvas,
    button(text("signatureUpload"), () => file.click(), "secondary"),
    file,
    button(
      text("clear"),
      () => {
        begin();
        signatures.delete(f.id);
        recalculate();
        render();
      },
      "quiet",
    ),
  );
}
function enableVoice(input: HTMLInputElement) {
  const form = s.form,
    field = current();
  if (!form || !field) return;
  const start = () => {
    stopVoice();
    const controller = new AbortController();
    voiceController = controller;
    const active = () =>
      voiceController === controller &&
      !controller.signal.aborted &&
      input.isConnected &&
      s.form === form &&
      current() === field;
    const finish = () => {
      voice = undefined;
      voiceController = undefined;
      document.querySelector("#voice-status")?.remove();
      const toggle = document.querySelector<HTMLButtonElement>("#voice-toggle");
      if (toggle) toggle.textContent = text("speak");
    };
    void startVoice(
      {
        lang: s.lang,
        confirmed: consent,
        signal: controller.signal,
        offerInstall: async () => active() && confirm(text("install")),
        onText: (value) => {
          if (!active()) return;
          input.value = value;
          voiceAnswer = { fieldId: field.id, text: value };
        },
        onError: (code) => {
          if (!active()) return;
          finish();
          controller.abort();
          say(text(voiceMessageKey(code)));
          input.focus();
        },
        onEnd: () => {
          if (active()) {
            finish();
            say("");
          }
        },
      },
      recognitionSupport(),
    )
      .then((session) => {
        if (!active()) {
          session.stop();
          return;
        }
        voice = session;
        const toggle =
          document.querySelector<HTMLButtonElement>("#voice-toggle");
        if (toggle) toggle.textContent = text("stop");
        const message = text(
          session.mode === "cloud" ? "cloudBadge" : "localBadge",
        );
        const badge = el("p", message, "badge");
        badge.id = "voice-status";
        document.querySelector("main")?.before(badge);
        say(text("listening") + " · " + message);
      })
      .catch(() => {
        if (active()) {
          finish();
          say(text("voiceError"));
        }
      });
  };
  if (consent) {
    start();
    return;
  }
  modal(text("voiceTitle"), (d, body) => {
    body.append(
      el("p", text("voiceNotice")),
      button(
        text("agreeVoice"),
        () => {
          consent = true;
          d.close();
          start();
        },
        "primary",
      ),
    );
  });
}
function reviewView(panel: HTMLElement) {
  heading(panel, "reviewTitle", "reviewHint");
  for (const [i, f] of s.form!.fields.entries()) {
    const r = s.result!.fields[f.id]!,
      row = el("div", "", "review-row"),
      copy = el("div");
    copy.append(
      el("strong", label(f)),
      el(
        "p",
        f.type === "signature"
          ? signatures.has(f.id)
            ? text("filled")
            : text("empty")
          : (r.value ?? r.raw ?? text("empty")),
      ),
      el("span", statusLabel(r.status), "status " + r.status),
    );
    for (const issue of r.issues)
      copy.append(
        el("p", messageFor(issue.code, s.lang, issue.params), "small"),
      );
    row.append(
      copy,
      button(
        text("edit"),
        () => {
          s.current = i;
          go("answer");
        },
        "quiet",
      ),
    );
    panel.append(row);
  }
  panel.append(button(text("proceed"), () => go("save"), "primary"));
  llmPanel(panel);
}
function llmPanel(panel: HTMLElement) {
  const details = el("details");
  details.append(
    el("summary", "LLM · " + (llm.id === "none" ? text("off") : llm.id)),
  );
  const provider = selectInput(
    text("provider"),
    [
      { value: "none", label: text("off") },
      { value: "modal", label: "Modal" },
      { value: "ollama", label: "Ollama (local)" },
    ],
    llm.id,
  );
  const enabled = checkbox(text("enableLlm"), llm.id !== "none");
  provider.input.value = llm.id === "none" ? "modal" : llm.id;
  provider.wrap.hidden = !enabled.input.checked;
  details.append(enabled.wrap, provider.wrap);
  const settings = el("div");
  details.append(settings);
  const draw = () => {
    settings.replaceChildren();
    if (!enabled.input.checked || provider.input.value === "none") {
      llm = { id: "none" };
      return;
    }
    if (provider.input.value === "modal") {
      const endpoint = fieldInput(
          text("endpoint"),
          llm.id === "modal" ? llm.endpoint : "",
          "url",
        ),
        key = fieldInput(text("key"), getKey("modal") ?? "", "password"),
        remember = checkbox(text("remember"), isRemembered("modal"));
      settings.append(
        endpoint.wrap,
        key.wrap,
        remember.wrap,
        el("p", text("keyWarning"), "small"),
        button(
          text("forget"),
          () => {
            forgetKey("modal");
            key.input.value = "";
            remember.input.checked = false;
          },
          "quiet",
        ),
      );
      settings.append(
        button(
          text("ask"),
          () => {
            try {
              const url = new URL(endpoint.input.value);
              if (
                url.protocol !== "https:" &&
                !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
              )
                throw Error();
              llm = { id: "modal", endpoint: url.href };
              const stored = setKey(
                "modal",
                key.input.value,
                remember.input.checked,
              );
              if (remember.input.checked && !stored)
                remember.input.checked = false;
              const token = getKey("modal");
              if (token) llm.proxyToken = token;
              requestLlm();
            } catch {
              say(text("llmFallback"));
            }
          },
          "secondary",
        ),
      );
    } else {
      const base = fieldInput(text("ollamaUrl"), DEFAULT_OLLAMA_BASE_URL),
        model = fieldInput(text("model"), "");
      settings.append(
        base.wrap,
        model.wrap,
        button(
          text("ask"),
          () => {
            try {
              new URL(base.input.value);
              llm = {
                id: "ollama",
                baseUrl: base.input.value,
                model: model.input.value,
              };
              requestLlm();
            } catch {
              say(text("llmFallback"));
            }
          },
          "secondary",
        ),
      );
    }
  };
  enabled.input.onchange = () => {
    provider.wrap.hidden = !enabled.input.checked;
    if (!enabled.input.checked) {
      llmController?.abort();
      llm = { id: "none" };
    }
    draw();
  };
  provider.input.onchange = draw;
  draw();
  panel.append(details);
}
function requestLlm() {
  const host =
    llm.id === "modal"
      ? new URL(llm.endpoint).host
      : llm.id === "ollama"
        ? new URL(llm.baseUrl).host
        : "";
  if (!confirm(text("llmNotice") + "\n" + llm.id + ": " + host)) return;
  llmController?.abort();
  const controller = new AbortController();
  llmController = controller;
  const rev = revision;
  say(text("llmBusy"));
  const cancel = button(text("cancel"), () => controller.abort(), "quiet");
  document.querySelector(".task-panel")?.append(cancel);
  void assist(llm, s.form!, s.answers, s.result!, controller.signal, context())
    .then((outcome) => {
      cancel.remove();
      if (rev !== revision || controller.signal.aborted) return;
      if (outcome.kind === "ok") {
        s.result = outcome.result;
        s.answers = toPromptedAnswers(outcome.result);
        seq = Math.max(...s.answers.map((a) => a.seq), 0);
        s.saved = false;
        render();
        say(text("llmSuccess"));
      } else
        say(
          text(
            outcome.kind === "fallback" && outcome.reason === "warming-up"
              ? "warming"
              : "llmFallback",
          ),
        );
    })
    .catch(() => {
      cancel.remove();
      say(text("llmFallback"));
    });
}
function saveView(panel: HTMLElement) {
  heading(panel, "printTitle", "printHint");
  if (
    Object.values(s.result!.fields).some(
      (r) =>
        r.status === "flagged" &&
        s.form!.fields.find((f) => f.id === r.fieldId)?.required,
    )
  )
    panel.append(el("p", text("pdfIssues"), "callout"));
  const background = selectInput(
      text("background"),
      [
        { value: "over", label: text("over") },
        { value: "clean", label: text("clean") },
      ],
      "over",
    ),
    flagged = checkbox(text("printFlagged"));
  panel.append(background.wrap, flagged.wrap);
  const output = el("div", "", "generated-export");
  panel.append(
    button(
      text("download"),
      () => {
        const job = ++pdfJob,
          rev = revision,
          view = viewVersion;
        const backgroundMode = background.input.value,
          printFlagged = flagged.input.checked;
        const form = structuredClone(s.form!),
          resultSnapshot = structuredClone(s.result!);
        const signatureSnapshot = new Map(
          [...signatures].map(([id, bytes]) => [id, Uint8Array.from(bytes)]),
        );
        const photo = backgroundBytes;
        const active = () =>
          job === pdfJob &&
          rev === revision &&
          view === viewVersion &&
          output.isConnected &&
          backgroundMode === background.input.value &&
          printFlagged === flagged.input.checked;
        void (async () => {
          const { buildPdf } = await import("../pdf/build"),
            { renderTextImage } = await import("../pdf/text-image");
          let bg: import("../pdf/build").Background = { kind: "clean" };
          if (backgroundMode === "over") {
            if (form.source === "sample" && !photo) {
              const response = await fetch(`/samples/${form.id}.pdf`);
              if (!response.ok) throw Error();
              bg = {
                kind: "sample-pdf",
                bytes: new Uint8Array(await response.arrayBuffer()),
              };
            } else if (photo)
              bg = { kind: "photo", bytes: photo, mime: "image/png" };
          }
          if (!active()) return;
          const result = await buildPdf(
            {
              form,
              result: resultSnapshot,
              signatures: signatureSnapshot,
              background: bg,
              isSample: form.source === "sample",
              printFlagged,
            },
            renderTextImage,
          );
          if (!active()) {
            if (view === viewVersion && job === pdfJob)
              say(text("exportChanged"));
            return;
          }
          output.replaceChildren();
          for (const warning of result.warnings)
            output.append(
              el(
                "p",
                `${text("warning")}: ${warning.fieldId} (${warning.code})`,
                "callout",
              ),
            );
          if (
            result.warnings.length &&
            !confirm(
              result.warnings
                .map(
                  (w) =>
                    `${label(form.fields.find((f) => f.id === w.fieldId)!)}: ${text("warning")}`,
                )
                .join("\n"),
            )
          )
            return;
          download(result.bytes, "stitchform-filled.pdf", "application/pdf");
          if (pdfUrl) URL.revokeObjectURL(pdfUrl);
          pdfUrl = URL.createObjectURL(
            new Blob([result.bytes], { type: "application/pdf" }),
          );
          const link = el("a", text("printView"));
          link.href = pdfUrl;
          link.target = "_blank";
          link.rel = "noopener";
          output.append(link);
          s.saved = true;
          say(text("pdfReady"));
        })().catch(() => {
          if (active()) say(text("warning"));
        });
      },
      "primary",
    ),
    output,
  );
  const stitch = el("section", "", "stitch-panel");
  stitch.append(
    el("h2", text("stitchTitle")),
    el("p", text("stitchHint"), "small"),
  );
  const codeOutput = el("div", "", "generated-export");
  let pendingCode = false;
  const invalidateCode = () => {
    encrypted = undefined;
    qrUrl = undefined;
    codeOutput.replaceChildren();
  };
  const pass = fieldInput(text("passphrase"), passphrase);
  pass.input.autocomplete = "new-password";
  pass.input.oninput = () => {
    encryptionJob++;
    invalidateCode();
    if (pendingCode) say(text("exportChanged"));
    pendingCode = false;
    passphrase = pass.input.value;
  };
  stitch.append(
    pass.wrap,
    button(
      text("generate"),
      () => {
        const job = ++encryptionJob,
          view = viewVersion,
          value = pass.input.value;
        invalidateCode();
        pendingCode = false;
        void fetch("/wordlists/eff_large_wordlist.txt")
          .then((r) => r.text())
          .then((raw) => {
            if (
              job !== encryptionJob ||
              view !== viewVersion ||
              !pass.input.isConnected ||
              value !== pass.input.value
            )
              return;
            passphrase = generatePassphrase(parseWordList(raw));
            pass.input.value = passphrase;
          })
          .catch(() => {
            if (job === encryptionJob && view === viewVersion)
              say(text("badCode"));
          });
      },
      "secondary",
    ),
    button(
      text("encrypt"),
      () => {
        const job = ++encryptionJob,
          rev = revision,
          view = viewVersion;
        const phrase = pass.input.value,
          resultSnapshot = structuredClone(s.result!);
        invalidateCode();
        pendingCode = true;
        const active = () =>
          job === encryptionJob &&
          rev === revision &&
          view === viewVersion &&
          pass.input.isConnected &&
          phrase === pass.input.value;
        void (async () => {
          const raw = await fetch("/wordlists/common-passwords.txt").then((r) =>
              r.text(),
            ),
            check = checkCustomPassphrase(phrase, parseCommonPasswords(raw));
          if (!active()) return;
          if (!check.ok) {
            say(passphraseMessage(check.code, s.lang));
            return;
          }
          say(text("deriving"));
          const start = performance.now(),
            result = await createStitchCode(resultSnapshot, phrase);
          if (!active()) {
            if (view === viewVersion && job === encryptionJob)
              say(text("exportChanged"));
            return;
          }
          if (!result.ok) {
            say(text("tooLarge"));
            return;
          }
          const qr = await toQrDataUrl(result.bytes);
          if (!active()) {
            if (view === viewVersion && job === encryptionJob)
              say(text("exportChanged"));
            return;
          }
          encrypted = result.bytes;
          qrUrl = qr.ok ? qr.dataUrl : undefined;
          s.saved = true;
          passphrase = phrase;
          render();
          say(`PBKDF2 + AES-GCM: ${Math.round(performance.now() - start)} ms`);
        })()
          .catch(() => {
            if (active()) say(text("badCode"));
          })
          .finally(() => {
            if (job === encryptionJob) pendingCode = false;
          });
      },
      "primary",
    ),
  );
  if (encrypted) {
    codeOutput.append(
      button(
        text("fileDownload"),
        () =>
          download(encrypted!, "answers.stitch", "application/octet-stream"),
        "secondary",
      ),
    );
    if (qrUrl) {
      const img = el("img");
      img.src = qrUrl;
      img.alt = text("qrAlt");
      img.className = "qr";
      const link = el("a", text("qrDownload"));
      link.href = qrUrl;
      link.download = "stitchform-code.png";
      codeOutput.append(img, link);
    } else codeOutput.append(el("p", text("tooLarge")));
  }
  stitch.append(codeOutput);
  panel.append(stitch, button(text("open"), openDialog, "text-button"));
}
function openDialog() {
  pendingOpen = undefined;
  modal(text("openTitle"), (d, body) => {
    let readVersion = 0,
      unlockVersion = 0;
    d.addEventListener("close", () => {
      readVersion++;
      unlockVersion++;
      pendingOpen = undefined;
    });
    const file = el("input");
    file.type = "file";
    file.accept = ".stitch,image/png,image/jpeg,image/webp";
    file.setAttribute("aria-label", text("codeFile"));
    const pass = fieldInput(text("passphrase"), "", "password");
    body.append(file, pass.wrap);
    file.onchange = () => {
      const read = ++readVersion;
      unlockVersion++;
      const active = () => d.open && read === readVersion;
      pendingOpen = undefined;
      const f = file.files?.[0];
      if (!f) return;
      void (async () => {
        if (f.size > 20 * 1024 * 1024) throw Error();
        if (f.name.endsWith(".stitch")) {
          if (f.size > 70_000) throw Error();
          const bytes = new Uint8Array(await f.arrayBuffer());
          if (active()) pendingOpen = bytes;
        } else {
          const bitmap = await createImageBitmap(f);
          try {
            if (bitmap.width * bitmap.height > 20_000_000) throw Error();
            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
            const bytes = decodeQr(canvas);
            if (active()) pendingOpen = bytes;
          } finally {
            bitmap.close();
          }
        }
      })().catch(() => {
        if (active()) say(text("noQr"));
      });
    };
    body.append(
      button(
        text("scan"),
        () =>
          cameraDialog(true, (bytes) => {
            if (d.open) {
              readVersion++;
              unlockVersion++;
              pendingOpen = bytes;
            }
          }),
        "secondary",
      ),
      button(
        text("unlock"),
        () => {
          if (!pendingOpen) {
            say(text("noQr"));
            return;
          }
          const job = ++unlockVersion,
            read = readVersion,
            bytes = pendingOpen;
          const active = () =>
            d.open && job === unlockVersion && read === readVersion;
          void (async () => {
            const opened = await openStitchCode(bytes, pass.input.value);
            if (!active()) return;
            if (!opened.ok) {
              say(text("badCode"));
              return;
            }
            await loadTemplates();
            if (!active()) return;
            const template = templates.find((t) => t.id === opened.formId);
            if (template && (!s.form || s.form.id !== opened.formId))
              await chooseSample(template);
            else if (!s.form) {
              say(text("customRestore"));
              return;
            } else if (
              s.form.id !== opened.formId &&
              !confirm(text("otherForm"))
            )
              return;
            s.answers = opened.answers;
            signatures.clear();
            seq = Math.max(...s.answers.map((a) => a.seq), 0);
            recalculate();
            s.saved = true;
            d.close();
            go("review");
          })().catch(() => {
            if (active()) say(text("badCode"));
          });
        },
        "primary",
      ),
    );
  });
}
function decodeQr(canvas: HTMLCanvasElement) {
  const data = canvas
      .getContext("2d", { willReadFrequently: true })!
      .getImageData(0, 0, canvas.width, canvas.height),
    code = jsQR(data.data, data.width, data.height);
  if (!code) throw Error();
  return Uint8Array.from(code.binaryData);
}
function cameraDialog(scan: boolean, onScan?: (bytes: Uint8Array) => void) {
  const d = modal(text(scan ? "scan" : "cameraTitle"), (dialog, body) => {
    const video = el("video");
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    body.append(video);
    let stream: MediaStream | undefined;
    dialog.addEventListener("close", () => {
      if (stream) stopCamera(stream);
    });
    void openCamera()
      .then(async (media) => {
        stream = media;
        if (!dialog.open) {
          stopCamera(media);
          return;
        }
        video.srcObject = media;
        await video.play();
      })
      .catch((error) => {
        say((error as Error).message);
        dialog.close();
      });
    body.append(
      button(
        text(scan ? "scanFrame" : "capture"),
        () => {
          if (!video.videoWidth) return;
          const canvas = capturePhoto(video);
          if (scan) {
            try {
              const bytes = decodeQr(canvas);
              onScan?.(bytes);
              dialog.close();
              say(text("filled"));
            } catch {
              say(text("noQr"));
            }
          } else {
            dialog.close();
            void processCanvas(canvas);
          }
        },
        "primary",
      ),
    );
  });
  return d;
}
async function importImage(file: File) {
  try {
    const canvas = await readImageFile(file);
    await processCanvas(canvas);
  } catch (error) {
    say((error as Error).message);
  }
}
async function processCanvas(canvas: HTMLCanvasElement) {
  if (processing) return;
  processing = true;
  const controller = new AbortController();
  ocrController = controller;
  const capturedImage = canvas.toDataURL("image/png");
  let capturedBytes: Uint8Array | undefined;
  const d = modal(text("readTitle"), (dialog, body) => {
    body.append(el("p", text("reading")));
    const progress = el("progress");
    progress.max = 1;
    body.append(
      progress,
      button(
        text("cancel"),
        () => {
          controller.abort();
          dialog.close();
        },
        "quiet",
      ),
    );
    dialog.addEventListener("close", () => controller.abort());
  });
  try {
    capturedBytes = new Uint8Array(
      await new Promise<ArrayBuffer>((resolve, reject) =>
        canvas.toBlob(
          (b) =>
            b
              ? void b.arrayBuffer().then(resolve, reject)
              : reject(new Error("Image encoding failed")),
          "image/png",
        ),
      ),
    );
    if (controller.signal.aborted) return;
    await loadTemplates();
    const { detectFields } = await import("../ocr");
    const result = await detectFields(
      canvas,
      templates,
      (n) => {
        const p = d.querySelector("progress");
        if (p) p.value = n;
      },
      controller.signal,
    );
    if (controller.signal.aborted) return;
    s.form = result.form;
    s.answers = [];
    signatures.clear();
    s.current = 0;
    imageUrl = capturedImage;
    backgroundBytes = capturedBytes;
    recalculate();
    go("check");
    if (!s.form.fields.length) say(text("noFields"));
    else say(`${result.matched} · ${Math.round(result.ms)} ms`);
  } catch {
    if (!controller.signal.aborted) {
      startManual();
      imageUrl = capturedImage;
      backgroundBytes = capturedBytes;
      render();
      say(text("noFields"));
    }
  } finally {
    processing = false;
    d.close();
  }
}
window.addEventListener("beforeunload", (e) => {
  stopVoice();
  if (s.answers.length && !s.saved) {
    e.preventDefault();
    e.returnValue = "";
  }
});
render();
void loadTemplates()
  .then(() => {
    if (s.step === "choose" && !root.querySelector("dialog[open]")) render();
  })
  .catch(() => say(text("noFields")));
