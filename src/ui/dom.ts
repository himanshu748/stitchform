export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text = "",
  className = "",
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function button(
  text: string,
  action: () => void,
  className = "",
): HTMLButtonElement {
  const b = el("button", text, className);
  b.type = "button";
  b.onclick = action;
  return b;
}
export function download(
  bytes: Uint8Array<ArrayBuffer>,
  name: string,
  type: string,
): void {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = el("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
