import { toWorkingCanvas } from "./upload";
export async function openCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia)
    throw new Error(
      "Camera needs a secure page and a supported browser. Upload an image instead.",
    );
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
  } catch (error) {
    if (
      error instanceof DOMException &&
      ["NotFoundError", "NotReadableError", "OverconstrainedError"].includes(
        error.name,
      )
    ) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      } catch {
        /* upload fallback below */
      }
    }
    throw new Error("Camera access is unavailable. Upload an image instead.");
  }
}
export function stopCamera(stream: MediaStream): void {
  stream.getTracks().forEach((t) => t.stop());
}
export function capturePhoto(video: HTMLVideoElement): HTMLCanvasElement {
  return toWorkingCanvas(video, video.videoWidth, video.videoHeight);
}
