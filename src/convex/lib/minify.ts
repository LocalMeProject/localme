import { extensionOf } from "./paths";

function stripJsComments(source: string): string {
  let output = "";
  let index = 0;
  let quote: string | null = null;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (quote) {
      output += char;
      if (char === "\\") {
        output += next ?? "";
        index += 2;
        continue;
      }
      if (char === quote) quote = null;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      output += char;
      index += 1;
      continue;
    }

    if (char === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) index += 1;
      index += 2;
      continue;
    }

    output += char;
    index += 1;
  }
  return output;
}

function collapseBlankLines(source: string): string {
  return source
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .filter((line, position, lines) => !(line === "" && lines[position - 1] === ""))
    .join("\n")
    .trim();
}

/**
 * JavaScript is only ever stripped of comments and trailing whitespace: no
 * whitespace collapsing, because automatic semicolon insertion makes aggressive
 * shrinking unsafe without a real parser.
 */
export function minifyJavaScript(source: string): string {
  return collapseBlankLines(stripJsComments(source));
}

export function minifyCss(source: string): string {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  return withoutComments
    .replace(/\s*([{};:,>~+])\s*/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/;}/g, "}")
    .trim();
}

export function minifyHtml(source: string): string {
  return source
    .replace(/<!--(?!\[if)[\s\S]*?-->/g, "")
    .replace(/\n\s*/g, "\n")
    .replace(/>\s+</g, "><")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Minifies a file according to its extension; unknown types pass through. */
export function minifyByExtension(path: string, source: string): string {
  switch (extensionOf(path)) {
    case "html":
    case "htm":
      return minifyHtml(source);
    case "css":
      return minifyCss(source);
    case "js":
    case "mjs":
      return minifyJavaScript(source);
    default:
      return source;
  }
}
