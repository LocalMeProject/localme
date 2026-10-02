/**
 * Shamsi (Jalali / Solar Hijri) calendar arithmetic.
 *
 * `fa-IR` is the platform's default culture, so every date the console shows
 * has to be a real Jalali date — not a Gregorian one relabelled. This module
 * is the single implementation: display formatting, the datetime picker and
 * the tests all go through it, so they cannot drift apart.
 *
 * The conversion is the Birmajerdi / `jalaali-js` algorithm, which is exact
 * for the whole range this platform cares about (1300–1500 SH, with the
 * arithmetic valid well outside that). It is pure integer math — no
 * `Intl`, no timezone, no locale — which is what makes it testable.
 *
 * Day numbers here are Julian Day Numbers. Everything user-facing is derived
 * from a `Date`; nothing in this module reads the clock.
 */

export interface JalaliDate {
  /** Jalali year, e.g. 1404. */
  jy: number;
  /** 1–12. */
  jm: number;
  /** 1–29/30/31. */
  jd: number;
}

export interface GregorianDate {
  gy: number;
  /** 1–12. */
  gm: number;
  gd: number;
}

/**
 * Jalali years whose Nowruz begins on 21 March. The algorithm's breaks
 * table is this list; it is what makes the calendar rule-based rather than a
 * lookup of "the next leap year every four years" (which is Gregorian, and
 * wrong).
 */
const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192,
  2262, 2324, 2394, 2456, 3178,
];

/**
 * Truncating division, as the published algorithm specifies.
 *
 * `Math.floor` would be wrong here: `g2d` computes `div(gm - 8, 6)`, which is
 * negative for January and February. Flooring `-7 / 6` gives -2 where the
 * algorithm wants -1, and that single day shifts every converted date by a
 * year.
 */
function div(a: number, b: number): number {
  return Math.trunc(a / b);
}

/** Remainder matching `div`'s truncation — sign follows the dividend. */
function mod(a: number, b: number): number {
  return a - Math.trunc(a / b) * b;
}

interface JalaliCalendar {
  /** Whether the Jalali year is a leap year. */
  leap: number;
  /** Gregorian year the Jalali year mostly overlaps. */
  gy: number;
  /** Day of March on which the Jalali year starts. */
  march: number;
}

/** Leap-year and Nowruz position for a Jalali year. */
function jalCal(jy: number): JalaliCalendar {
  const bl = BREAKS.length;
  // Jalali year + 621 = the Gregorian year it starts in.
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0]!;
  let jump = 0;

  for (let i = 1; i < bl; i += 1) {
    const jm = BREAKS[i]!;
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }

  let n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  // The leap year of the *next* cycle shifts where we are in this one.
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return { leap, gy, march };
}

/** Gregorian calendar date → Julian Day Number. */
function g2d(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

/** Julian Day Number → Gregorian calendar date. */
function d2g(jdn: number): GregorianDate {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

/** Jalali calendar date → Julian Day Number. */
function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy);
  return (
    g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1
  );
}

/** Julian Day Number → Jalali calendar date. */
function d2j(jdn: number): JalaliDate {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let k = jdn - jdn1f;

  if (k >= 0) {
    if (k <= 185) {
      return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    }
    k -= 186;
  } else {
    // Before Nowruz: we are still in the previous Jalali year.
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

/** True when `jy` has 366 days. */
export function isJalaliLeapYear(jy: number): boolean {
  return jalCal(jy).leap === 0;
}

/** Number of days in a Jalali month (29 for Esfand in a common year). */
export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeapYear(jy) ? 30 : 29;
}

/** Number of days in a Jalali year. */
export function jalaliYearLength(jy: number): number {
  return isJalaliLeapYear(jy) ? 366 : 365;
}

/** True for a structurally valid Jalali date (does not check round-trip). */
export function isValidJalaliDate(jy: number, jm: number, jd: number): boolean {
  if (!Number.isInteger(jy) || !Number.isInteger(jm) || !Number.isInteger(jd)) return false;
  if (jm < 1 || jm > 12) return false;
  if (jy < 1 || jy > 9999) return false;
  return jd >= 1 && jd <= jalaliMonthLength(jy, jm);
}

/** Gregorian → Jalali. */
export function toJalali(gy: number, gm: number, gd: number): JalaliDate {
  return d2j(g2d(gy, gm, gd));
}

/** Jalali → Gregorian. */
export function toGregorian(jy: number, jm: number, jd: number): GregorianDate {
  return d2g(j2d(jy, jm, jd));
}

/**
 * A `Date` → its Jalali date, read in **local time**.
 *
 * Local, not UTC, on purpose: a timestamp of "today at 09:00" must not render
 * as yesterday's Shamsi date because the server happens to sit west of
 * Tehran. Callers that genuinely store UTC instants should convert first.
 */
export function dateToJalali(date: Date): JalaliDate {
  return toJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** Midnight local time on the first day of a Jalali month. */
export function jalaliMonthStart(jy: number, jm: number): Date {
  const g = toGregorian(jy, jm, 1);
  return new Date(g.gy, g.gm - 1, g.gd, 0, 0, 0, 0);
}

/** The `Date` for a Jalali date, at local midnight. */
export function jalaliToDate(jy: number, jm: number, jd: number): Date {
  const g = toGregorian(jy, jm, jd);
  return new Date(g.gy, g.gm - 1, g.gd, 0, 0, 0, 0);
}

/** Shift a Jalali date by whole months, clamping the day to the target month. */
export function addJalaliMonths(date: JalaliDate, months: number): JalaliDate {
  const total = date.jy * 12 + (date.jm - 1) + months;
  const jy = div(total, 12);
  const jm = (mod(total, 12) + 1);
  return { jy, jm, jd: Math.min(date.jd, jalaliMonthLength(jy, jm)) };
}

/** Shift a Jalali date by whole days, crossing month and year boundaries. */
export function addJalaliDays(date: JalaliDate, days: number): JalaliDate {
  const g = toGregorian(date.jy, date.jm, date.jd);
  const shifted = new Date(g.gy, g.gm - 1, g.gd + days);
  return toJalali(shifted.getFullYear(), shifted.getMonth() + 1, shifted.getDate());
}

/** Difference in days between two Jalali dates (b - a). */
export function jalaliDayDiff(a: JalaliDate, b: JalaliDate): number {
  return j2d(b.jy, b.jm, b.jd) - j2d(a.jy, a.jm, a.jd);
}

/**
 * Jalali month grid for a calendar view: six rows of seven, padded with the
 * neighbouring months' days so the grid is always full (Iranian calendars do
 * the same rather than showing ragged final weeks).
 *
 * Columns run Saturday → Friday. That is not a cosmetic choice: the Iranian
 * week begins on Saturday, and every Shamsi calendar in Iran prints شنبه in
 * the first column. The column a day lands in is therefore exactly
 * `jalaliWeekdayIndex`, which is what keeps the weekday header row and the
 * day numbers in agreement.
 */
export function jalaliMonthGrid(jy: number, jm: number): JalaliDate[] {
  const first = jalaliToDate(jy, jm, 1);
  // JS `getDay()`: 0 = Sunday, so Saturday is 6 and this lands it on 0.
  const leading = (first.getDay() + 1) % 7;
  const start = addJalaliDays({ jy, jm, jd: 1 }, -leading);
  return Array.from({ length: 42 }, (_, i) => addJalaliDays(start, i));
}

/**
 * Weekday index where 0 = Saturday (شنبه) and 6 = Friday (جمعه).
 * Mirrors the column order of `jalaliMonthGrid`.
 */
export function jalaliWeekdayIndex(date: Date): number {
  return (date.getDay() + 1) % 7;
}

/** Jalali month names, index 0 = Farvardin. */
export const JALALI_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
] as const;

/**
 * Weekday names starting on Saturday. These are the labels a
 * `fa-IR` calendar shows in its header row.
 */
export const JALALI_WEEKDAYS = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
] as const;

/** Persian (Extended Arabic-Indic) digits, index 0 = zero. */
export const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"] as const;

/**
 * Rewrite Persian and Arabic-Indic digits back to ASCII.
 *
 * Needed on *input*: the Shamsi date field is seeded with Persian digits, so
 * without this a person who edits one character hands the parser a string of
 * mixed digit sets. Also accepts Arabic-Indic (٠–٩) because Iranian keyboards
 * and some Android IMEs emit those instead of the Persian forms.
 */
export function toLatinDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/** Arabic-Indic (Persian) decimal separator. */
export const PERSIAN_DECIMAL = "٫";
/** Arabic-Indic (Persian) thousands separator. */
export const PERSIAN_THOUSANDS = "٬";

/**
 * Rewrite every ASCII digit in `value` as a Persian one.
 *
 * Applied to *rendered* strings rather than to the source data, so stored
 * timestamps, byte counts and API values stay ASCII — a `fa-IR` display must
 * never leak Persian digits into a curl example or a JSON payload.
 */
export function toPersianDigits(value: string): string {
  return value.replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]!);
}

/**
 * Render a number with Persian digits and Arabic-Indic separators.
 *
 * Grouping is done by hand rather than through `Intl.NumberFormat("fa-IR")`
 * so the output is identical on every runtime (Node in CI, Safari, an old
 * embedded webview) — ICU varies far more than this arithmetic does.
 */
export function formatPersianNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return PERSIAN_DIGITS[0]!;
  const negative = value < 0;
  const fixed = Math.abs(value).toFixed(decimals);
  const [whole = "0", fraction] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, PERSIAN_THOUSANDS);
  const body = fraction ? `${grouped}${PERSIAN_DECIMAL}${fraction}` : grouped;
  return `${negative ? "-" : ""}${toPersianDigits(body)}`;
}

/**
 * Render a number with ASCII digits and comma grouping (en-US).
 *
 * `Intl.NumberFormat` is not used here either: the en-US path has to match
 * the fa-IR path's rounding and grouping rules exactly, or switching culture
 * would silently change a figure.
 */
export function formatLatinNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return "0";
  const fixed = Math.abs(value).toFixed(decimals);
  const [whole = "0", fraction] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const body = fraction ? `${grouped}.${fraction}` : grouped;
  return `${value < 0 ? "-" : ""}${body}`;
}

/** Zero-padded number as Persian digits (hours, minutes, day-of-month). */
export function persianNumber(value: number, decimals = 0): string {
  return formatPersianNumber(value, decimals);
}

/** Today's Jalali date in local time. */
export function todayJalali(now: Date = new Date()): JalaliDate {
  return dateToJalali(now);
}

/**
 * Parse `YYYY-MM-DD` or `YYYY/MM/DD` into a local `Date`.
 *
 * The Jalali picker writes Shamsi dates in this shape and nothing parses them
 * back with `new Date(string)`, which would silently interpret them as
 * Gregorian. Returns `null` for anything malformed rather than producing an
 * Invalid Date that propagates into a form.
 */
export function parseJalaliInput(value: string): Date | null {
  // Digits are normalised first: the field that produced this string shows
  // Persian digits, so a hand-edited date arrives as a mix of both sets.
  const match = /^\s*(\d{3,4})\s*[-/]\s*(\d{1,2})\s*[-/]\s*(\d{1,2})\s*$/.exec(toLatinDigits(value));
  if (!match) return null;
  const jy = Number(match[1]);
  const jm = Number(match[2]);
  const jd = Number(match[3]);
  if (!isValidJalaliDate(jy, jm, jd)) return null;
  return jalaliToDate(jy, jm, jd);
}