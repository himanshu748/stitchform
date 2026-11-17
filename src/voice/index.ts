// Web Speech feature detection; no audio or transcripts are stored or logged.
export interface RecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  processLocally?: boolean;
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
export interface RecognitionConstructor {
  new (): RecognitionInstance;
  available?: (options: {
    langs: string[];
    processLocally: boolean;
  }) => Promise<string>;
  install?: (options: { langs: string[] }) => Promise<boolean>;
}
export function recognitionSupport(): RecognitionConstructor | undefined {
  const w = globalThis as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}
export async function startVoice(
  options: {
    lang: "en" | "hi";
    confirmed: boolean;
    signal?: AbortSignal;
    offerInstall: () => Promise<boolean>;
    onText: (s: string) => void;
    onError: (code: string) => void;
    onEnd: () => void;
  },
  ctor = recognitionSupport(),
): Promise<{ stop: () => void; mode: "cloud" | "on-device" }> {
  if (!options.confirmed) throw new Error("Voice requires consent.");
  if (!ctor) throw new Error("Voice is unavailable.");
  const lang = options.lang === "hi" ? "hi-IN" : "en-IN";
  let local = false;
  try {
    const availability = await ctor.available?.({
      langs: [lang],
      processLocally: true,
    });
    local = availability === "available";
    if (
      availability === "downloadable" &&
      ctor.install &&
      (await options.offerInstall())
    )
      local = await ctor.install({ langs: [lang] });
  } catch {
    /* cloud is only allowed after the notice */
  }
  if (options.signal?.aborted)
    throw new DOMException("Cancelled", "AbortError");
  const r = new ctor();
  r.lang = lang;
  r.interimResults = true;
  r.continuous = false;
  if (local) r.processLocally = true;
  r.onresult = (e) =>
    options.onText(
      Array.from(e.results)
        .map((row) => row[0]?.transcript ?? "")
        .join(" "),
    );
  r.onerror = (e) => options.onError(e.error);
  const cancel = () => r.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  r.onend = () => {
    options.signal?.removeEventListener("abort", cancel);
    options.onEnd();
  };
  r.start();
  return { stop: () => r.abort(), mode: local ? "on-device" : "cloud" };
}
