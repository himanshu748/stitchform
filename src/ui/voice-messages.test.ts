import { expect, it } from "vitest";
import { voiceMessageKey } from "./voice-messages";
import { en } from "./strings.en";
import { hi } from "./strings.hi";

it.each([
  ["not-allowed", "voiceDenied"],
  ["service-not-allowed", "voiceDenied"],
  ["audio-capture", "voiceCapture"],
  ["network", "voiceNetwork"],
  ["language-not-supported", "voiceLanguage"],
  ["no-speech", "voiceNoSpeech"],
  ["aborted", "voiceAborted"],
  ["bad-grammar", "voiceError"],
  ["phrases-not-supported", "voiceError"],
  ["unknown", "voiceError"],
  ["constructor", "voiceError"],
] as const)("gives a translated, actionable response for %s", (code, key) => {
  expect(voiceMessageKey(code)).toBe(key);
  expect(en[key]).toMatch(/type|answer/i);
  expect(hi[key]).toContain("उत्तर");
});
