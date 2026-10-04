/**
 * Asset minification (Blueprint §5.2, Technical Documentation §5.2: "on save via
 * editor: minify HTML/CSS/JS"). Substitutes for NUglify with a conservative
 * scanner: it never touches quoted segments, so strings, `url(...)` values and
 * template literals survive byte-for-byte.
 *
 * JS keeps its line breaks (automatic semicolon insertion depends on them) and
 * only loses comments and redundant whitespace; CSS additionally drops
 * whitespace around `{ } ; : , >`; HTML collapses whitespace runs and removes
 * comments.
 */

export type AssetKind = "html" | "css" | "js";

/** Asset kinds that can be minified. */
export function assetKindFor(path: string): AssetKind | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "css") return "css";
  if (ext === "js" || ext === "mjs") return "js";
  return null;
}

type CommentPair = [string, string];

const CODE_COMMENTS: CommentPair[] = [
  ["/*", "*/"],
  ["//", "\n"],
];

interface MinifyOptions {
  comments: CommentPair[];
  /** Keep newlines (JS/ASI). When false, whitespace runs collapse to a space. */
  keepNewlines: boolean;
  /** Characters whitespace is removed around (outside quotes). */
  punctuation?: string;
}

function scan(source: string, options: MinifyOptions): string {
  let out = "";
  let i = 0;
  let quote: string | null = null;
  const punctuation = options.punctuation ?? "";

  while (i < source.length) {
    const ch = source[i]!;

    if (quote) {
      out += ch;
      if (ch === "\\") {
        out += source[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }

    const comment = options.comments.find(([start]) => source.startsWith(start, i));
    if (comment) {
      const end = source.indexOf(comment[1], i + comment[0].length);
      i = end === -1 ? source.length : end + comment[1].length;
      // A `//` comment ends at (and consumes) its newline; keep the break for ASI.
      if (options.keepNewlines && comment[1] === "\n") {
        out += "\n";
      }
      continue;
    }

    if (/\s/.test(ch)) {
      let j = i;
      let sawNewline = false;
      while (j < source.length && /\s/.test(source[j]!)) {
        if (source[j] === "\n") sawNewline = true;
        j += 1;
      }
      const previous = out[out.length - 1] ?? "";
      const next = source[j] ?? "";
      const touchesPunctuation =
        punctuation.includes(previous) || punctuation.includes(next);
      if (options.keepNewlines && sawNewline) out += "\n";
      else if (!touchesPunctuation) out += " ";
      i = j;
      continue;
    }

    out += ch;
    i += 1;
  }

  if (!options.keepNewlines) return out.trim();
  return out.replace(/\n{2,}/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
}

export function minifyCss(source: string): string {
  return scan(source, {
    comments: CODE_COMMENTS,
    keepNewlines: false,
    punctuation: "{};:,>",
  })
    // A declaration's trailing semicolon before a block close is redundant.
    .replace(/;}/g, "}");
}

export function minifyJs(source: string): string {
  return scan(source, { comments: CODE_COMMENTS, keepNewlines: true });
}

export function minifyHtml(source: string): string {
  // Preserve <pre>, <code>, <script>, and <style> blocks byte-for-byte
  const preservedBlocks: string[] = [];
  const placeholderPrefix = "___LOCALME_PRESERVED_";

  const protectedHtml = source.replace(
    /<(pre|code|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,
    (match) => {
      const token = `${placeholderPrefix}${preservedBlocks.length}___`;
      preservedBlocks.push(match);
      return token;
    },
  );

  // Remove HTML comments
  const noComments = protectedHtml.replace(/<!--[\s\S]*?-->/g, "");

  // Collapse whitespace between tags and reduce repeated spaces
  let minified = noComments
    .replace(/>\s+</g, "><")
    .replace(/[ \t\r\n]+/g, " ")
    .trim();

  // Restore preserved blocks
  for (let i = 0; i < preservedBlocks.length; i++) {
    minified = minified.replace(`${placeholderPrefix}${i}___`, preservedBlocks[i]!);
  }

  return minified;
}

/** Minify by asset kind; non-minifiable paths come back untouched. */
export function minifyAsset(path: string, source: string): string {
  const kind = assetKindFor(path);
  if (kind === "css") return minifyCss(source);
  if (kind === "js") return minifyJs(source);
  if (kind === "html") return minifyHtml(source);
  return source;
}
