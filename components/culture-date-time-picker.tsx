"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";
import {
  JALALI_MONTHS,
  JALALI_WEEKDAYS,
  addJalaliMonths,
  dateToJalali,
  isValidJalaliDate,
  jalaliMonthGrid,
  jalaliToDate,
  toGregorian,
  toLatinDigits,
  toPersianDigits,
  type JalaliDate,
} from "@/lib/jalali";

const GREGORIAN_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Month heading for the `en-US` grid.
 *
 * The cursor is always kept as a Jalali date — that is the only calendar the
 * component computes in — so the Gregorian label is derived by converting the
 * first of the same month back, rather than by trusting that Jalali month 7
 * is October.
 */
function gregorianMonthLabel(cursor: JalaliDate): string {
  const g = toGregorian(cursor.jy, cursor.jm, 1);
  return `${GREGORIAN_MONTHS[g.gm - 1]} ${g.gy}`;
}

/**
 * Culture-aware date (and time) picker.
 *
 * In `fa-IR` this is not a Gregorian calendar with translated labels: it is a
 * real Shamsi month grid — Farvardin through Esfand, leap-year-correct month
 * lengths, the Iranian week starting on Saturday, Persian digits — and what it
 * emits is a real `Date`. In `en-US` the same component renders the Gregorian
 * grid it always did.
 *
 * Typing works in both digit sets. A Shamsi field seeded with `۱۴۰۴/۰۵/۰۹`
 * round-trips through the same parse path, which is what makes the field
 * usable with a Persian keyboard instead of being a display-only widget.
 */
export function CultureDateTimePicker({
  value,
  onChange,
  withTime = false,
  min,
  max,
  placeholder,
  id,
  className,
  disabled,
  invalid = false,
}: {
  /** Epoch milliseconds, or `null` for "nothing chosen". */
  value: number | null;
  onChange: (value: number | null) => void;
  /** Show hour/minute controls and emit a time as well as a date. */
  withTime?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
  /** Render the trigger in the error colour. */
  invalid?: boolean;
}) {
  const { fmt, isRtl, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  // Cursor month, so paging does not move when the value changes underneath.
  const selected = value ? new Date(value) : null;
  const [cursor, setCursor] = useState<JalaliDate>(() =>
    dateToJalali(selected ?? new Date()),
  );

  /**
   * Re-seed the view each time the popover opens.
   *
   * Done in the open handler rather than an effect on `value`: the trigger
   * button already shows the value, so the only state worth resetting is the
   * month being browsed and the text being edited, and both belong to the
   * interaction that just started.
   */
  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) return;
    const current = value ? new Date(value) : null;
    setCursor(dateToJalali(current ?? new Date()));
    setDraft(current ? typedDateFor(current) : "");
  }

  /** The value written into the manual-entry field, in ASCII digits. */
  function typedDateFor(date: Date): string {
    if (isRtl) {
      const j = dateToJalali(date);
      return `${j.jy}/${j.jm}/${j.jd}`;
    }
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
  }

  const label = value
    ? withTime
      ? fmt.dateTime(value)
      : fmt.date(value)
    : placeholder ?? t("picker.selectDate");

  function commit(next: Date | null) {
    if (!next) {
      onChange(null);
      return;
    }
    if (min && next.getTime() < min) return;
    if (max && next.getTime() > max) return;
    onChange(next.getTime());
    setOpen(false);
  }

  function pickDay(day: JalaliDate) {
    const base = jalaliToDate(day.jy, day.jm, day.jd);
    if (value) {
      base.setHours(new Date(value).getHours(), new Date(value).getMinutes(), 0, 0);
    } else {
      base.setHours(12, 0, 0, 0);
    }
    if (!withTime) commit(base);
    else {
      onChange(base.getTime());
      setCursor(day);
    }
  }

  const grid = useMemo(() => jalaliMonthGrid(cursor.jy, cursor.jm), [cursor]);
  const todayKey = dateToJalali(new Date());
  const selectedKey = selected ? dateToJalali(selected) : null;

  // Grid columns follow the culture's week: the Iranian one starts on Saturday,
  // the en-US one on Sunday. Both must match `jalaliMonthGrid`'s column order
  // or the day numbers sit under the wrong heading.
  const weekdayLabels = isRtl
    ? JALALI_WEEKDAYS.slice()
    : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  function applyTyped(raw: string) {
    setDraft(raw);
    const cleaned = toLatinDigits(raw).trim();
    if (!cleaned) {
      onChange(null);
      return;
    }
    const match = /^(\d{3,4})\D(\d{1,2})\D(\d{1,2})/.exec(cleaned);
    if (!match) return;
    const a = Number(match[1]);
    const b = Number(match[2]);
    const c = Number(match[3]);
    if (isRtl) {
      if (!isValidJalaliDate(a, b, c)) return;
      setCursor({ jy: a, jm: b, jd: c });
      const parsed = jalaliToDate(a, b, c);
      parsed.setHours(12, 0, 0, 0);
      onChange(parsed.getTime());
    } else {
      const candidate = new Date(a, b - 1, c, 12, 0, 0, 0);
      if (Number.isNaN(candidate.getTime())) return;
      setCursor(dateToJalali(candidate));
      onChange(candidate.getTime());
    }
  }

  const timeParts = selected
    ? { hour: selected.getHours(), minute: selected.getMinutes() }
    : { hour: 12, minute: 0 };

  function setTime(part: "hour" | "minute", nextValue: number) {
    const base = selected ? new Date(selected) : new Date();
    base.setHours(part === "hour" ? nextValue : timeParts.hour, part === "minute" ? nextValue : timeParts.minute, 0, 0);
    onChange(base.getTime());
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-start gap-2 px-3 text-13px font-normal",
            !value && "text-muted-foreground",
            invalid && "border-destructive focus-visible:outline-destructive",
            className,
          )}
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
          <span className="truncate nums">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[19rem] p-3" align="start">
        <div className="flex items-center justify-between gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("picker.previousMonth")}
            onClick={() => setCursor((prev) => addJalaliMonths(prev, -1))}
          >
            <ChevronLeft className={cn("h-4 w-4", isRtl && "rtl-flip")} />
          </Button>
          <div className="text-13px font-medium nums">
            {isRtl
              ? `${JALALI_MONTHS[cursor.jm - 1]} ${toPersianDigits(String(cursor.jy))}`
              : gregorianMonthLabel(cursor)}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("picker.nextMonth")}
            onClick={() => setCursor((prev) => addJalaliMonths(prev, 1))}
          >
            <ChevronRight className={cn("h-4 w-4", isRtl && "rtl-flip")} />
          </Button>
        </div>

        <div className="mt-2 grid grid-cols-7 gap-0.5 text-center text-10.5px text-muted-foreground">
          {weekdayLabels.map((name, index) => (
            <div key={`${name}-${index}`} className="py-1">
              {name}
            </div>
          ))}
        </div>

        <div className="mt-0.5 grid grid-cols-7 gap-0.5">
          {grid.map((day, index) => {
            const outside = day.jm !== cursor.jm;
            const isToday = day.jy === todayKey.jy && day.jm === todayKey.jm && day.jd === todayKey.jd;
            const isSelected = Boolean(
              selectedKey && day.jy === selectedKey.jy && day.jm === selectedKey.jm && day.jd === selectedKey.jd,
            );
            return (
              <button
                key={`${day.jy}-${day.jm}-${day.jd}-${index}`}
                type="button"
                onClick={() => pickDay(day)}
                aria-current={isToday ? "date" : undefined}
                aria-pressed={isSelected}
                className={cn(
                  "nums h-8 rounded-md text-12.5px transition-colors hover:bg-accent",
                  outside && "text-muted-foreground/45",
                  isToday && !isSelected && "ring-1 ring-inset ring-blueprint/60",
                  isSelected && "bg-signal text-signal-foreground hover:bg-signal",
                )}
              >
                {isRtl ? toPersianDigits(String(day.jd)) : day.jd}
              </button>
            );
          })}
        </div>

        {withTime && (
          <div className="mt-3 flex items-center gap-2 border-t pt-3">
            <span className="text-12px text-muted-foreground">{t("picker.time")}</span>
            <select
              aria-label={t("picker.hour")}
              value={timeParts.hour}
              onChange={(event) => setTime("hour", Number(event.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 text-12.5px nums"
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>
                  {isRtl ? toPersianDigits(String(hour).padStart(2, "0")) : String(hour).padStart(2, "0")}
                </option>
              ))}
            </select>
            <span className="nums">:</span>
            <select
              aria-label={t("picker.minute")}
              value={timeParts.minute}
              onChange={(event) => setTime("minute", Number(event.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 text-12.5px nums"
            >
              {Array.from({ length: 60 }, (_, minute) => (
                <option key={minute} value={minute}>
                  {isRtl ? toPersianDigits(String(minute).padStart(2, "0")) : String(minute).padStart(2, "0")}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 border-t pt-3">
          <input
            value={draft}
            onChange={(event) => applyTyped(event.target.value)}
            placeholder={isRtl ? "۱۴۰۴/۰۵/۰۹" : "YYYY/MM/DD"}
            inputMode="numeric"
            aria-label={t("picker.title")}
            className="ltr-input h-8 flex-1 rounded-md border border-input bg-background px-2 text-12.5px nums"
          />
          <Button variant="ghost" size="sm" className="h-8 text-12px" onClick={() => commit(null)}>
            {t("picker.clear")}
          </Button>
        </div>
        <p className="mt-1.5 text-11px text-muted-foreground">
          {t("picker.hint", { calendar: fmt.calendarName() })}
        </p>
      </PopoverContent>
    </Popover>
  );
}

export default CultureDateTimePicker;