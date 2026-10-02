import type { MessageGroup } from "../types";

/**
 * Time wording.
 *
 * Relative times are composed rather than handed to
 * `Intl.RelativeTimeFormat`: Persian past tense wants "۳ دقیقه پیش" while
 * English wants "3 minutes ago", and the difference is a suffix in one and a
 * prefix in the other. Keeping the whole phrase in the catalog means an
 * operator can make it "چند دقیقه پیش" from the admin console without a
 * deploy — which is the whole point of the setting.
 *
 * `{count}` is already rendered in the culture's own numerals, so a message
 * never has to think about digits.
 */
export const time = {
  "time.justNow": { "en-US": "just now", "fa-IR": "همین الان" },
  "time.secondsAgo": { "en-US": "{count}s ago", "fa-IR": "{count} ثانیه پیش" },
  "time.minutesAgo": { "en-US": "{count}m ago", "fa-IR": "{count} دقیقه پیش" },
  "time.hoursAgo": { "en-US": "{count}h ago", "fa-IR": "{count} ساعت پیش" },
  "time.daysAgo": { "en-US": "{count}d ago", "fa-IR": "{count} روز پیش" },
  "time.monthsAgo": { "en-US": "{count}mo ago", "fa-IR": "{count} ماه پیش" },
  "time.yearsAgo": { "en-US": "{count}y ago", "fa-IR": "{count} سال پیش" },

  "time.inSeconds": { "en-US": "in {count}s", "fa-IR": "{count} ثانیه دیگر" },
  "time.inMinutes": { "en-US": "in {count}m", "fa-IR": "{count} دقیقه دیگر" },
  "time.inHours": { "en-US": "in {count}h", "fa-IR": "{count} ساعت دیگر" },
  "time.inDays": { "en-US": "in {count}d", "fa-IR": "{count} روز دیگر" },
  "time.inMonths": { "en-US": "in {count}mo", "fa-IR": "{count} ماه دیگر" },
  "time.inYears": { "en-US": "in {count}y", "fa-IR": "{count} سال دیگر" },

  "time.today": { "en-US": "Today", "fa-IR": "امروز" },
  "time.yesterday": { "en-US": "Yesterday", "fa-IR": "دیروز" },
  "time.tomorrow": { "en-US": "Tomorrow", "fa-IR": "فردا" },

  /** Month and year order, e.g. "مهر ۱۴۰۵" / "Oct 2026". */
  "time.monthYearFormat": {
    "en-US": "{month} {year}",
    "fa-IR": "{month} {year}",
  },

  // ------------------------------------------------------- date pickers
  "picker.title": { "en-US": "Choose a date", "fa-IR": "یک تاریخ انتخاب کنید" },
  "picker.titleDateTime": { "en-US": "Choose a date and time", "fa-IR": "تاریخ و ساعت را انتخاب کنید" },
  "picker.previousMonth": { "en-US": "Previous month", "fa-IR": "ماه قبل" },
  "picker.nextMonth": { "en-US": "Next month", "fa-IR": "ماه بعد" },
  "picker.selectDate": { "en-US": "Select date", "fa-IR": "انتخاب تاریخ" },
  "picker.clear": { "en-US": "Clear", "fa-IR": "پاک کردن" },
  "picker.time": { "en-US": "Time", "fa-IR": "ساعت" },
  "picker.hour": { "en-US": "Hour", "fa-IR": "ساعت" },
  "picker.minute": { "en-US": "Minute", "fa-IR": "دقیقه" },
  "picker.invalid": {
    "en-US": "That is not a valid date.",
    "fa-IR": "این تاریخ معتبر نیست.",
  },
  "picker.hint": {
    "en-US": "Dates are entered and shown in {calendar}.",
    "fa-IR": "تاریخ‌ها بر پایهٔ تقویم {calendar} وارد و نمایش داده میشوند.",
  },
  "picker.calendar.persian": { "en-US": "Persian (Shamsi)", "fa-IR": "شمسی" },
  "picker.calendar.gregory": { "en-US": "Gregorian", "fa-IR": "میلادی" },
} satisfies MessageGroup;