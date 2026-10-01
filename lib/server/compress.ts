/**
 * Response compression (Blueprint §5.2, Technical Documentation §5.2).
 *
 * The Blueprint stores Brotli-compressed files and serves them with
 * `Content-Encoding: br`; we keep the stored bytes verbatim (so backups,
 * downloads and the editor stay byte-exact) and compress text responses on the
 * wire instead — same client-visible behaviour, no migration of stored blobs.
 */
import { brotliCompress, brotliCompressSync, gzip, gzipSync } from "node:zlib";
import { promisify } from "node:util";

const compressBrotli = promisify(brotliCompress);
const compressGzip = promisify(gzip);

const COMPRESSIBLE = /^(text\/|application\/(json|javascript|xml|manifest\+json))/i;
/** Below this size the framing overhead outweighs the win. */
const MIN_BYTES = 512;

export interface EncodedBody {
  body: Uint8Array;
  encoding: "br" | "gzip" | null;
}

/** Which encoding, if any, this request/response pair should use. */
function negotiate(request: Request, body: Buffer, contentType: string): "br" | "gzip" | null {
  if (!COMPRESSIBLE.test(contentType) || body.byteLength < MIN_BYTES) return null;
  const accept = request.headers.get("accept-encoding") ?? "";
  if (/\bbr\b/.test(accept)) return "br";
  if (/\bgzip\b/.test(accept)) return "gzip";
  return null;
}

/**
 * Negotiate `Accept-Encoding` and compress, on the libuv thread pool.
 *
 * The async form is what the serving path uses: `brotliCompressSync` on a
 * multi-hundred-kilobyte asset blocks the single Node event loop for the whole
 * compression, stalling every other in-flight request behind it.
 */
export async function encodeBodyAsync(
  request: Request,
  body: Buffer,
  contentType: string,
): Promise<EncodedBody> {
  const encoding = negotiate(request, body, contentType);
  if (!encoding) return { body: new Uint8Array(body), encoding: null };
  const compressed = encoding === "br" ? await compressBrotli(body) : await compressGzip(body);
  return { body: new Uint8Array(compressed), encoding };
}

/** Synchronous form, kept for tests and non-request callers. */
export function encodeBody(request: Request, body: Buffer, contentType: string): EncodedBody {
  const encoding = negotiate(request, body, contentType);
  if (!encoding) return { body: new Uint8Array(body), encoding: null };
  const compressed = encoding === "br" ? brotliCompressSync(body) : gzipSync(body);
  return { body: new Uint8Array(compressed), encoding };
}

/** Headers for an encoded response (`Vary` so caches split by encoding). */
export function encodingHeaders(encoding: "br" | "gzip" | null): Record<string, string> {
  if (!encoding) return { vary: "accept-encoding" };
  return { "content-encoding": encoding, vary: "accept-encoding" };
}

/**
 * Build a compressed response for a text payload. `headers` are a base set the
 * caller already computed (content-type, cache-control, …).
 */
export function encodedResponse(
  request: Request,
  body: Buffer,
  headers: Record<string, string>,
): Response {
  const contentType = headers["content-type"] ?? "application/octet-stream";
  const { body: encoded, encoding } = encodeBody(request, body, contentType);
  return buildResponse(encoded, encoding, headers);
}

/** Async twin of `encodedResponse` — the one the serving path uses. */
export async function encodedResponseAsync(
  request: Request,
  body: Buffer,
  headers: Record<string, string>,
): Promise<Response> {
  const contentType = headers["content-type"] ?? "application/octet-stream";
  const { body: encoded, encoding } = await encodeBodyAsync(request, body, contentType);
  return buildResponse(encoded, encoding, headers);
}

function buildResponse(
  encoded: Uint8Array,
  encoding: "br" | "gzip" | null,
  headers: Record<string, string>,
): Response {
  // Copy into a plain ArrayBuffer-backed view: that is what Response accepts.
  const payload = new Uint8Array(encoded.byteLength);
  payload.set(encoded);
  return new Response(payload, {
    status: 200,
    headers: { ...headers, ...encodingHeaders(encoding) },
  });
}
