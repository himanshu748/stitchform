import type { StringKey } from "./strings.en";

// Error values confirmed against MDN SpeechRecognitionErrorEvent.error.
const messages: Readonly<Record<string, StringKey>> = {
  "not-allowed": "voiceDenied",
  "service-not-allowed": "voiceDenied",
  "audio-capture": "voiceCapture",
  network: "voiceNetwork",
  "language-not-supported": "voiceLanguage",
  "no-speech": "voiceNoSpeech",
  aborted: "voiceAborted",
  "bad-grammar": "voiceError",
  "phrases-not-supported": "voiceError",
};
export function voiceMessageKey(code: string): StringKey {
  return Object.hasOwn(messages, code) ? messages[code]! : "voiceError";
}
