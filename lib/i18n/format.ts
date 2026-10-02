/**
 * Culture-aware formatting.
 *
 * Every number, date and byte count the UI renders goes through here, and
 * every one of them is bound to a `t()` so the *wording* ("۳ دقیقه پیش",
 * "5 MB", "۱٫۲ هزار") is catalog text an operator can edit, not a literal
 * buried in a component.
 *
 * The calendar is the part that cannot be a string swap. In `fa-IR` a date
 * is a genuine Shamsi date produced by `lib/jalali.ts`, and the digits are
 * Persian ones — a formatted value, never a re-skinned Gregorian one.
 */
import {
  JALALI_MONTHS,
  JALALI_WEEKDAYS,
  dateToJalali,
  formatLatinNumber,
  formatPersianNumber,
  jalaliWeekdayIndex,
  toPersianDigits,
  type JalaliDate,
} from "../jalali";

/**
 * A `YYYY-MM-DD` day, as a *local* midnight.
 *
 * The usage rollups and other day-keyed API responses ship plain date strings.
 * `new Date("2026-10-09")` is UTC midnight, which in any negative offset reads
 * back as the 8th; building from the parts keeps the printed day the day the
 * server meant.
 */
export function parseIsoDay(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? null : date;
}
import { LOCALE_META, type Locale } from "./locales";
import type { MessageKey, Translate } from "./catalog";

/** Digits in the culture's own numerals. */
export function formatNumber(value: number, locale: Locale, decimals = 0): string {
  if (!Number.isFinite(value)) return locale === "fa-IR" ? "۰" : "0";
  return locale === "fa-IR" ? formatPersianNumber(value, decimals) : formatLatinNumber(value, decimals);
}

/** Re-render ASCII digits already inside a string (labels, ids, units). */
export function localizeDigits(value: string, locale: Locale): string {
  return locale === "fa-IR" ? toPersianDigits(value) : value;
}

/**
 * A year in the culture's own numerals, never grouped.
 *
 * A year is an identifier, not a quantity: Persian grouping turns 1405 into
 * "۱٬۴۰۵", which no Iranian calendar, invoice or contract ever writes.
 */
function yearDigits(value: number, locale: Locale): string {
  return locale === "fa-IR" ? toPersianDigits(String(value)) : String(value);
}

function zeroPad(value: number, locale: Locale, width = 2): string {
  // Padding happens on the ASCII form and is converted afterwards: zero-padding
  // Persian digits against each other would need a digit-aware comparator.
  const padded = String(Math.abs(value)).padStart(width, "0");
  return locale === "fa-IR" ? toPersianDigits(padded) : padded;
}

export interface Formatter {
  locale: Locale;
  /** Absolute number in the culture's numerals. */
  number(value: number, decimals?: number): string;
  /** "۵ مگابایت" / "5 MB". */
  bytes(value: number, decimals?: number): string;
  /** "۱٫۲ هزار" / "1.2k". */
  count(value: number): string;
  percent(part: number, total: number): string;
  /** "۹ مهر ۱۴۰۵" / "Oct 9, 2026". */
  date(timestamp?: number | null, withWeekday?: boolean): string;
  /** "۹ مهر" / "Oct 9". */
  dateShort(timestamp?: number | null): string;
  /** "۹ مهر ۱۴۰۵، ساعت ۱۴:۳۰" / "Oct 9, 2026, 2:30 PM". */
  dateTime(timestamp?: number | null): string;
  /** "۱۴:۳۰" / "2:30 PM". */
  time(timestamp?: number | null): string;
  /** `fmt.date` for a `YYYY-MM-DD` string, with no timezone drift. */
  isoDate(value: string, withWeekday?: boolean): string;
  /** `fmt.dateShort` for a `YYYY-MM-DD` string. */
  isoDateShort(value: string): string;
  /** Month and year of a `YYYY-MM` or `YYYY-MM-DD` key. */
  isoMonth(value: string): string;
  /** "مهر ۱۴۰۵" / "Oct 2026". */
  monthYear(date: JalaliDate): string;
  /** "همین الان" / "just now". */
  relative(timestamp?: number | null): string;
  /** Human-readable duration, used for timeouts and retention windows. */
  duration(ms: number): string;
  /** The culture's name for its own calendar, for picker hints. */
  calendarName(): string;
}

const EN_MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function createFormatter(locale: Locale, t: Translate): Formatter {
  const fa = LOCALE_META[locale].calendar === "persian";
  const digits = (value: number, decimals = 0) => formatNumber(value, locale, decimals);

  function bytes(value: number, decimals = 1): string {
    if (!Number.isFinite(value) || value <= 0) return digits(0);
    const units: MessageKey[] = [
      "unit.byte",
      "unit.kilobyte",
      "unit.megabyte",
      "unit.gigabyte",
      "unit.terabyte",
    ];
    const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const scaled = value / 1024 ** index;
    const shown = index === 0 ? digits(scaled) : digits(scaled, decimals);
    return `${shown} ${t(units[index]!)}`;
  }

  function count(value: number): string {
    if (!Number.isFinite(value)) return digits(0);
    if (Math.abs(value) >= 1_000_000) {
      return `${digits(value / 1_000_000, 1)} ${t("unit.million")}`;
    }
    // Persian reads "۱۲ هزار" where English says "12k", so the short form
    // kicks in later: 10,000 is already idiomatic as a plain number.
    if (Math.abs(value) >= 10_000 && !fa) {
      return `${digits(value / 1000, 1)}k`;
    }
    return digits(value);
  }

  function percent(part: number, total: number): string {
    // Persian writes the percent sign as U+066A, which is the mark that sits
    // correctly next to Persian numerals; forcing ASCII "%" there looks wrong.
    const sign = fa ? "٪" : "%";
    if (!total) return `${digits(0)}${sign}`;
    return `${digits(Math.min(100, Math.round((part / total) * 100)))}${sign}`;
  }

  /** Shamsi or Gregorian, long form, optionally prefixed with the weekday. */
  function date(timestamp: number | null | undefined, withWeekday = false): string {
    if (!timestamp) return "—";
    const d = new Date(timestamp);
    if (fa) {
      const j = dateToJalali(d);
      const day = `${digits(j.jd)} ${JALALI_MONTHS[j.jm - 1]} ${yearDigits(j.jy, locale)}`;
      return withWeekday ? `${JALALI_WEEKDAYS[jalaliWeekdayIndex(d)]} ${day}` : day;
    }
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      ...(withWeekday ? { weekday: "long" as const } : {}),
    });
  }

  function dateShort(timestamp: number | null | undefined): string {
    if (!timestamp) return "—";
    const d = new Date(timestamp);
    if (fa) {
      const j = dateToJalali(d);
      return `${digits(j.jd)} ${JALALI_MONTHS[j.jm - 1]}`;
    }
    return `${d.getDate()} ${EN_MONTHS_SHORT[d.getMonth()]}`;
  }

  function time(timestamp: number | null | undefined): string {
    if (!timestamp) return "—";
    const d = new Date(timestamp);
    // Tehran reads 24-hour time; that is also what `fa-IR` produces in ICU,
    // but it is computed here so the output does not depend on ICU version.
    if (fa) return `${zeroPad(d.getHours(), locale)}:${zeroPad(d.getMinutes(), locale)}`;
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  function dateTime(timestamp: number | null | undefined): string {
    if (!timestamp) return "—";
    const d = new Date(timestamp);
    if (fa) return `${date(timestamp)}، ساعت ${time(timestamp)}`;
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function isoDate(value: string, withWeekday = false): string {
    return date(parseIsoDay(value)?.getTime() ?? null, withWeekday);
  }

  function isoDateShort(value: string): string {
    return dateShort(parseIsoDay(value)?.getTime() ?? null);
  }

  function isoMonth(value: string): string {
    const day = parseIsoDay(value);
    return day ? monthYear(dateToJalali(day)) : "—";
  }

  function monthYear(date: JalaliDate): string {
    if (fa) return `${JALALI_MONTHS[date.jm - 1]} ${yearDigits(date.jy, locale)}`;
    // Nowruz falls on 20/21 March, so March is always the first Jalali month.
    return `${EN_MONTHS_SHORT[2]} ${yearDigits(date.jy + 621, locale)}`;
  }

  function relative(timestamp: number | null | undefined): string {
    if (!timestamp) return t("state.never");
    const delta = Date.now() - timestamp;
    const past = delta >= 0;
    const seconds = Math.abs(Math.round(delta / 1000));
    const count = (unit: number) => digits(Math.round(unit));

    // Persian counts the largest whole unit it can, same as English, but the
    // "never/just now" boundary sits at a minute in both.
    let key: MessageKey;
    let amount: number | string;
    if (seconds < 45) return t("time.justNow");
    if (seconds < 90) {
      key = past ? "time.minutesAgo" : "time.inMinutes";
      amount = 1;
    } else if (seconds < 3600) {
      key = past ? "time.minutesAgo" : "time.inMinutes";
      amount = count(seconds / 60);
    } else if (seconds < 3600 * 24) {
      key = past ? "time.hoursAgo" : "time.inHours";
      amount = count(seconds / 3600);
    } else if (seconds < 3600 * 24 * 30) {
      key = past ? "time.daysAgo" : "time.inDays";
      amount = count(seconds / (3600 * 24));
    } else if (seconds < 3600 * 24 * 365) {
      key = past ? "time.monthsAgo" : "time.inMonths";
      amount = count(seconds / (3600 * 24 * 30));
    } else {
      key = past ? "time.yearsAgo" : "time.inYears";
      amount = count(seconds / (3600 * 24 * 365));
    }
    return t(key, { count: amount });
  }

  function duration(ms: number): string {
    const minutes = Math.round(ms / 60_000);
    if (minutes < 1) return t("unit.secondsShort", { count: digits(Math.max(1, Math.round(ms / 1000))) });
    if (minutes < 60) return t("unit.minutesShort", { count: digits(minutes) });
    const hours = Math.round(minutes / 60);
    if (hours < 24) return t("unit.hoursShort", { count: digits(hours) });
    return t("unit.daysShort", { count: digits(Math.round(hours / 24)) });
  }

  function calendarName(): string {
    return fa ? t("picker.calendar.persian") : t("picker.calendar.gregory");
  }

  return {
    locale,
    number: digits,
    bytes,
    count,
    percent,
    date,
    dateShort,
    dateTime,
    time,
    isoDate,
    isoDateShort,
    isoMonth,
    monthYear,
    relative,
    duration,
    calendarName,
  };
}

/** The empty-value placeholder shared by every date formatter. */
export const EMPTY_DATE = "—";