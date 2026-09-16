/** Uploads a file to a Convex upload URL and returns the resulting storage id. */
export async function uploadToStorageUrl(uploadUrl: string, file: Blob | File): Promise<string> {
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }
  const body = (await response.json()) as { storageId?: string };
  if (!body.storageId) {
    throw new Error("Upload did not return a storage id");
  }
  return body.storageId;
}

/** Triggers a download for a base64 payload produced by an export action. */
export function downloadBase64(filename: string, base64: string, mime = "application/octet-stream"): void {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  downloadBlob(filename, new Blob([bytes], { type: mime }));
}

export function downloadText(filename: string, text: string, mime = "application/json"): void {
  downloadBlob(filename, new Blob([text], { type: mime }));
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
}

export function languageFor(path: string): string {
  const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  const map: Record<string, string> = {
    html: "html",
    htm: "html",
    css: "css",
    js: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    json: "json",
    ts: "typescript",
    tsx: "typescript",
    jsx: "javascript",
    md: "markdown",
    txt: "text",
    svg: "svg",
    xml: "xml",
    yml: "yaml",
    yaml: "yaml",
    csv: "csv",
    webmanifest: "json",
  };
  return map[extension] ?? "text";
}
