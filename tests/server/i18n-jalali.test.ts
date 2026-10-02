/**
 * Shamsi (Jalali) calendar and culture formatting.
 *
 * The calendar is the part of the culture layer that cannot be a string swap,
 * so it is pinned against known dates in both directions plus an exhaustive
 * round-trip over two centuries. A Shamsi conversion that is off by one day is
 * invisible in a screenshot and wrong in every booking, expiry and log line.
 */
import { describe, expect, it } from "vitest";

import {
  JALALI_MONTHS,
  addJalaliDays,
  addJalaliMonths,
  formatPersianNumber,
  isJalaliLeapYear,
  isValidJalaliDate,
  jalaliMonthGrid,
  jalaliMonthLength,
  jalaliToDate,
  jalaliWeekdayIndex,
  parseJalaliInput,
  toGregorian,
  toJalali,
  toLatinDigits,
  toPersianDigits,
} from "@/lib/jalali";
import { LOCALE_META, negotiateLocale, normalizeLocale } from "@/lib/i18n/locales";
import { createFormatter, parseIsoDay } from "@/lib/i18n/format";
import { CATALOG, interpolate, messageSection, translate } from "@/lib/i18n/catalog";

describe("Shamsi (Jalali) conversion", () => {
  it("converts known Gregorian dates to the right Shamsi date", () => {
    // Nowruz 1403 fell on 20 March 2024; 1 October 2026 is Mehr 9, 1405.
    expect(toJalali(2024, 3, 20)).toEqual({ jy: 1403, jm: 1, jd: 1 });
    expect(toJalali(2024, 3, 21)).toEqual({ jy: 1403, jm: 1, jd: 2 });
    expect(toJalali(2026, 10, 1)).toEqual({ jy: 1405, jm: 7, jd: 9 });
    // A date before the epoch of the breaks table still has to be exact.
    expect(toJalali(1979, 2, 11)).toEqual({ jy: 1357, jm: 11, jd: 22 });
  });

  it("round-trips every date across two centuries", () => {
    let failures = 0;
    for (let jy = 1300; jy <= 1500; jy += 1) {
      for (let jm = 1; jm <= 12; jm += 1) {
        for (let jd = 1; jd <= jalaliMonthLength(jy, jm); jd += 1) {
          const g = toGregorian(jy, jm, jd);
          const j = toJalali(g.gy, g.gm, g.gd);
          if (j.jy !== jy || j.jm !== jm || j.jd !== jd) failures += 1;
        }
      }
    }
    expect(failures).toBe(0);
  });

  it("knows the Shamsi leap rule, which is not the Gregorian one", () => {
    // 1403 is a leap year (Esfand has 30 days); 1404 is not (29 days).
    expect(isJalaliLeapYear(1403)).toBe(true);
    expect(jalaliMonthLength(1403, 12)).toBe(30);
    expect(isJalaliLeapYear(1404)).toBe(false);
    expect(jalaliMonthLength(1404, 12)).toBe(29);
    // The first six months are always 31 days, the next five always 30.
    expect(jalaliMonthLength(1404, 1)).toBe(31);
    expect(jalaliMonthLength(1404, 6)).toBe(31);
    expect(jalaliMonthLength(1404, 7)).toBe(30);
  });

  it("rejects dates that do not exist", () => {
    expect(isValidJalaliDate(1404, 12, 30)).toBe(false);
    expect(isValidJalaliDate(1403, 12, 30)).toBe(true);
    expect(isValidJalaliDate(1404, 13, 1)).toBe(false);
    expect(isValidJalaliDate(1404, 1, 0)).toBe(false);
  });

  it("advances by days and months across boundaries", () => {
    expect(addJalaliDays({ jy: 1403, jm: 12, jd: 30 }, 1)).toEqual({ jy: 1404, jm: 1, jd: 1 });
    // 1404 is a common year, so its Esfand ends on day 29 — and that day is the
    // one immediately before Nowruz 1405.
    expect(addJalaliDays({ jy: 1405, jm: 1, jd: 1 }, -1)).toEqual({ jy: 1404, jm: 12, jd: 29 });
    // Adding a month clamps the day rather than skipping into the next one:
    // Esfand 30 lands on Farvardin 30 of a 31-day month.
    expect(addJalaliMonths({ jy: 1403, jm: 12, jd: 30 }, 1)).toEqual({ jy: 1404, jm: 1, jd: 30 });
    expect(addJalaliMonths({ jy: 1404, jm: 1, jd: 31 }, 6)).toEqual({ jy: 1404, jm: 7, jd: 30 });
  });

  it("builds a calendar grid aligned to the Iranian week", () => {
    const grid = jalaliMonthGrid(1405, 7);
    expect(grid).toHaveLength(42);// The Iranian week starts on Saturday, so Mehr 1 1405 (a Wednesday, i.e.
    // the fifth column) is preceded by exactly four days of Shahrivar.
    expect(grid[0]).toEqual({ jy: 1405, jm: 6, jd: 28 });
    expect(grid[4]).toEqual({ jy: 1405, jm: 7, jd: 1 });
    expect(jalaliWeekdayIndex(jalaliToDate(1405, 7, 1))).toBe(4); // چهارشنبه
    expect(jalaliWeekdayIndex(jalaliToDate(1405, 7, 3))).toBe(6); // جمعه
  });

  it("has twelve month names in calendar order", () => {
    expect(JALALI_MONTHS).toHaveLength(12);
    expect(JALALI_MONTHS[0]).toBe("فروردین");
    expect(JALALI_MONTHS[11]).toBe("اسفند");
  });
});

describe("Persian digits", () => {
  it("renders and parses both digit sets", () => {
    expect(toPersianDigits("1404")).toBe("۱۴۰۴");
    expect(toLatinDigits("۱۴۰۴")).toBe("1404");
    // Some Iranian keyboards emit Arabic-Indic rather than Persian forms.
    expect(toLatinDigits("١٤٠٤")).toBe("1404");
  });

  it("groups with Persian separators", () => {
    expect(formatPersianNumber(1234567)).toBe("۱٬۲۳۴٬۵۶۷");
    expect(formatPersianNumber(-250)).toBe("-۲۵۰");
    expect(formatPersianNumber(1234.5, 1)).toBe("۱٬۲۳۴٫۵");
  });

  it("parses a typed Shamsi date in either digit set", () => {
    expect(parseJalaliInput("1404/05/09")?.getTime()).toBe(jalaliToDate(1404, 5, 9).getTime());
    expect(parseJalaliInput("۱۴۰۴-۰۵-۰۹")?.getTime()).toBe(jalaliToDate(1404, 5, 9).getTime());
    // Esfand 30 does not exist in a common year, so it must not parse.
    expect(parseJalaliInput("1404/12/30")).toBeNull();
    expect(parseJalaliInput("nonsense")).toBeNull();
  });
});

describe("culture resolution", () => {
  it("defaults to fa-IR and keeps it a real culture, not a fallback", () => {
    expect(LOCALE_META["fa-IR"].dir).toBe("rtl");
    expect(LOCALE_META["fa-IR"].calendar).toBe("persian");
    expect(LOCALE_META["fa-IR"].numerals).toBe("persian");
    expect(LOCALE_META["en-US"].dir).toBe("ltr");
    expect(LOCALE_META["en-US"].calendar).toBe("gregory");
    expect(normalizeLocale(undefined)).toBe("fa-IR");
    // A stale or hand-edited cookie must fall back rather than throw.
    expect(normalizeLocale("xx-YY")).toBe("fa-IR");
    expect(normalizeLocale("en_US")).toBe("en-US");
    expect(normalizeLocale("en")).toBe("en-US");
  });

  it("negotiates an Accept-Language header by quality value", () => {
    expect(negotiateLocale("fa-IR,fa;q=0.9,en;q=0.8")).toBe("fa-IR");
    expect(negotiateLocale("en-US,en;q=0.9,fa;q=0.8")).toBe("en-US");
    expect(negotiateLocale("de-DE,de;q=0.9")).toBe("fa-IR");
    expect(negotiateLocale(null)).toBe("fa-IR");
  });
});

describe("culture-bound formatting", () => {
  const fa = createFormatter("fa-IR", (key) => translate(key, "fa-IR"));
  const en = createFormatter("en-US", (key) => translate(key, "en-US"));

  it("renders the same instant as a Shamsi date in fa-IR", () => {
    const instant = jalaliToDate(1405, 7, 9).getTime();
    // The year must not be grouped: it is an identifier, not a quantity.
    expect(fa.date(instant)).toBe("۹ مهر ۱۴۰۵");
    expect(fa.monthYear({ jy: 1405, jm: 7, jd: 1 })).toBe("مهر ۱۴۰۵");
    // Tehran reads a 24-hour clock, zero-padded, in Persian digits.
    expect(fa.time(instant)).toBe("۰۰:۰۰");
    expect(fa.time(new Date(2026, 8, 23, 14, 30).getTime())).toBe("۱۴:۳۰");
  });

  it("renders the same instant as a Gregorian date in en-US", () => {
    const instant = new Date(2026, 9, 1).getTime();
    expect(en.date(instant)).toBe("Oct 1, 2026");
    expect(en.time(instant)).toMatch(/\d/);
  });

  it("uses culture numerals and units", () => {
    expect(fa.number(1234)).toBe("۱٬۲۳۴");
    expect(en.number(1234)).toBe("1,234");
    expect(fa.bytes(5 * 1024 * 1024)).toContain("مگابایت");
    expect(en.bytes(5 * 1024 * 1024)).toContain("MB");
  });

  it("never groups a year, because a year is an identifier", () => {
    const fa = createFormatter("fa-IR", (key) => CATALOG[key]["fa-IR"]);
    const en = createFormatter("en-US", (key) => CATALOG[key]["en-US"]);
    // Persian grouping turns 1405 into "۱٬۴۰۵", which no Iranian calendar,
    // invoice or contract ever writes.
    expect(fa.isoMonth("2026-10-09")).toBe("مهر ۱۴۰۵");
    expect(en.isoMonth("2026-10-09")).toBe("Mar 2026");
    expect(fa.date(new Date(2026, 9, 9).getTime())).not.toContain("٬");
  });

  it("returns the shared empty-value placeholder for a missing date", () => {
    expect(fa.date(null)).toBe("—");
    expect(fa.relative(null)).toBe(translate("state.never", "fa-IR"));
  });
});

describe("catalog", () => {
  it("ships a value for both cultures in every key", () => {
    for (const [key, entry] of Object.entries(CATALOG)) {
      expect(entry["en-US"], `${key} en-US`).toBeTruthy();
      expect(entry["fa-IR"], `${key} fa-IR`).toBeTruthy();
    }
  });

  it("only interpolates placeholders the message declares", () => {
    for (const [key, entry] of Object.entries(CATALOG)) {
      const declared = new Set((entry["fa-IR"].match(/\{(\w+)\}/g) ?? []).map((m) => m.slice(1, -1)));
      const englishDeclared = new Set(
        (entry["en-US"].match(/\{(\w+)\}/g) ?? []).map((m) => m.slice(1, -1)),
      );
      // The two cultures must accept the same parameters, or a message would
      // render "{count}" literally in whichever language forgot it.
      expect([...englishDeclared].sort(), `${key} placeholders`).toEqual([...declared].sort());
    }
  });

  it("falls back to the shipped text, then to the key itself", () => {
    expect(translate("action.save", "fa-IR")).toBe("ذخیره");
    expect(translate("action.save", "fa-IR", { "fa-IR": { "action.save": "نگه‌داری" } })).toBe("نگه‌داری");
    // A blank override must not shadow the shipped wording with nothing.
    expect(translate("action.save", "fa-IR", { "fa-IR": { "action.save": "   " } })).toBe("ذخیره");
    expect(translate("action.save" as never, "fa-IR")).toBe("ذخیره");
  });

  it("groups keys by section for the admin editor's filter", () => {
    expect(messageSection("landing.hero.title1")).toBe("landing");
    expect(messageSection("common")).toBe("other");
    expect(interpolate("{a} and {b}", { a: "x", b: "y" })).toBe("x and y");
    // An unknown token is left visible rather than silently dropped.
    expect(interpolate("{a} {z}", { a: "x" })).toBe("x {z}");
  });

  it("balances the inline-code markers in every docs message", () => {
    // The docs renderer splits on ‹…›. An unbalanced pair would swallow the
    // rest of the paragraph into a monospace span, and nothing else in the
    // catalog would catch it.
    for (const [key, entry] of Object.entries(CATALOG)) {
      if (!key.startsWith("docs.")) continue;
      for (const locale of ["en-US", "fa-IR"] as const) {
        const text = entry[locale];
        expect((text.match(/‹/g) ?? []).length, `${key} ${locale} opens`).toBe(
          (text.match(/›/g) ?? []).length,
        );
        expect(text.includes("‹›"), `${key} ${locale} empty code span`).toBe(false);
      }
    }
  });
});

describe("day-keyed data", () => {
  it("does not drift a YYYY-MM-DD value across the date line", () => {
    // new Date("2026-10-09") is UTC midnight, which reads back as the 8th in
    // any negative offset. parseIsoDay builds from the parts instead.
    const naive = new Date("2026-10-09");
    expect(Number.isNaN(naive.getTime())).toBe(false);
    expect(parseIsoDay("2026-10-09")!.getDate()).toBe(9);
    expect(parseIsoDay("2026-10-09")!.getFullYear()).toBe(2026);
    expect(parseIsoDay("2026-10-09")!.getMonth()).toBe(9);
  });

  it("rejects a value that is not a day key", () => {
    expect(parseIsoDay("")).toBeNull();
    expect(parseIsoDay("not-a-date")).toBeNull();
  });

  it("prints a day key in the culture's own calendar", () => {
    const fa = createFormatter("fa-IR", (key) => CATALOG[key]["fa-IR"]);
    const en = createFormatter("en-US", (key) => CATALOG[key]["en-US"]);
    expect(fa.isoDate("2026-10-09")).toBe("۱۷ مهر ۱۴۰۵");
    expect(en.isoDate("2026-10-09")).toBe("Oct 9, 2026");
    // An unparseable value falls back to the shared empty placeholder rather
    // than printing "Invalid Date".
    expect(fa.isoDate("nope")).toBe("—");
    expect(en.isoDate("nope")).toBe("—");
  });
});