/**
 * Demo localisation.
 *
 * The landing page's demo is a real single-file application. Two things have
 * to stay true for it:
 *
 *   • A Persian visitor gets a Persian app, right-aligned, in the same
 *     typeface as the page around it. Anything left in English here is not a
 *     cosmetic issue: the demo is what the page asks a non-technical reader to
 *     believe they can build.
 *   • No `{{placeholder}}` ever reaches the document. A leaked placeholder
 *     renders as literal braces in a sandboxed iframe, which looks like a
 *     broken app rather than a bug.
 */
import { describe, expect, it } from "vitest";

import { DEMOS, demoDocument, demoFile, demoText } from "@/lib/demo-apps";

const LOCALES = ["en-US", "fa-IR"] as const;

/**
 * `{{OPENAI_KEY}}` is demo *content*, not a translation placeholder: the
 * guestbook shows what a proxy route looks like once a secret is injected.
 * It is the only double-brace sequence allowed to survive into the document.
 */
const ALLOWED_BRACES = ["{{OPENAI_KEY}}"];

function leftoverBraces(document: string): string[] {
  return document.match(/\{\{\w+\}\}/g) ?? [];
}

describe("demo applications", () => {
  it("renders every demo in both cultures with no leaked placeholders", () => {
    for (const demo of DEMOS) {
      for (const locale of LOCALES) {
        const document = demoDocument(demo, locale);
        expect(leftoverBraces(document), `${demo.id}/${locale}`).toEqual(
          leftoverBraces(document).filter((token) => ALLOWED_BRACES.includes(token)),
        );
        expect(document, `${demo.id}/${locale}`).toContain("<!doctype html>");
      }
    }
  });

  it("marks the Persian document right-to-left and the English one left-to-right", () => {
    for (const demo of DEMOS) {
      expect(demoDocument(demo, "fa-IR")).toContain('<html lang="fa" dir="rtl">');
      expect(demoDocument(demo, "en-US")).toContain('<html lang="en" dir="ltr">');
    }
  });

  it("gives the Persian document a Persian typeface and mirrored layout", () => {
    const fa = demoDocument(DEMOS[0], "fa-IR");
    expect(fa).toContain('font-family: "Iransans"');
    expect(fa).toContain('html[dir="rtl"]');

    const en = demoDocument(DEMOS[0], "en-US");
    expect(en).not.toContain("@font-face");
    expect(en).not.toContain('html[dir="rtl"]');
  });

  it("keeps the secret-substitution example intact in both cultures", () => {
    // `{{OPENAI_KEY}}` is demo *content*, not a translation placeholder: the
    // guestbook shows what a proxy route looks like once a secret is injected.
    for (const locale of LOCALES) {
      expect(demoDocument(DEMOS[1], locale)).toContain("{{OPENAI_KEY}}");
    }
  });

  it("seeds the poll with the same option labels the page renders", () => {
    // A mismatch here is invisible until you look: every bar renders at zero
    // because nothing matches.
    for (const locale of LOCALES) {
      const document = demoDocument(DEMOS[2], locale);
      const seed = JSON.parse(
        document.match(/window\.__LOCALME_SEED__ = (.*?);<\/script>/)?.[1] ?? "{}",
      ) as { votes: { option: string }[] };
      expect(seed.votes.length).toBeGreaterThan(0);
      for (const option of [demoText(locale, "poll.opt1"), demoText(locale, "poll.opt2")]) {
        expect(document).toContain(option);
        expect(seed.votes.map((row) => row.option)).toContain(option);
      }
    }
  });

  it("ships a complete standalone file, not a document with injected scripts", () => {
    for (const locale of LOCALES) {
      const file = demoFile(DEMOS[0], locale);
      expect(file).toContain("<style>");
      // The file ships without the sandbox harness — it only *reads* the seed
      // global in case one is present, which is how it stays runnable locally.
      expect(file).not.toContain("window.__LOCALME_SEED__ =");
      expect(leftoverBraces(file)).toEqual([]);
    }
  });
});