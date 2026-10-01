/**
 * Cron expressions for scheduled tasks (Technical Documentation §8).
 *
 * "Each job reads its schedule from `cron_configs` (`parameters` JSONB contains
 * `schedule` or uses the default)." The five built-in tasks ship with a default
 * cadence; this module lets an owner give any task a real 5-field expression
 * (for example `0,15,30,45 * * * *` for every quarter hour, or `0 3 * * 1` for
 * Monday 03:00 UTC) and computes its next run.
 *
 * Deliberately small and strict: five space-separated fields (minute, hour,
 * day-of-month, month, day-of-week), each `*`, a number, a `*`-step, a range,
 * or a comma list of those. Anything else is rejected at validation time rather
 * than silently never firing. Day-of-week accepts 0-6 and the three-letter names;
 * when both day-of-month and day-of-week are restricted, either matching is
 * enough — the classic cron rule.
 *
 * Times are evaluated in UTC, matching the ISO-8601 timestamps the platform
 * stores, so a schedule means the same thing in every deployment.
 */

export interface CronField {
  /** Sorted, de-duplicated allowed values. */
  values: number[];
  /** True when the field was `*` (used for the DOM/DOW "either" rule). */
  isWildcard: boolean;
}

export interface CronSchedule {
  minute: CronField;
  hour: CronField;
  dayOfMonth: CronField;
  month: CronField;
  dayOfWeek: CronField;
  /** The normalized expression, for display. */
  expression: string;
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const DAY_NAMES: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

interface FieldSpec {
  min: number;
  max: number;
  /** Day-of-week wraps 7 → 0 the way cron does. */
  wrap?: (value: number) => number;
  names?: Record<string, number>;
}

const SPECS: FieldSpec[] = [
  { min: 0, max: 59 },
  { min: 0, max: 23 },
  { min: 1, max: 31 },
  { min: 1, max: 12, names: MONTH_NAMES },
  { min: 0, max: 7, wrap: (value) => (value === 7 ? 0 : value), names: DAY_NAMES },
];

function parseField(raw: string, index: number): CronField | null {
  const spec = SPECS[index]!;
  const text = raw.trim();
  if (!text) return null;
  const values = new Set<number>();

  const resolve = (token: string): number | null => {
    const lowered = token.toLowerCase();
    if (spec.names && lowered in spec.names) return spec.names[lowered]!;
    if (!/^\d+$/.test(token)) return null;
    const value = Number(token);
    if (value < spec.min || value > spec.max) return null;
    return spec.wrap ? spec.wrap(value) : value;
  };

  for (const part of text.split(",")) {
    if (!part) return null;
    const [rangePart, stepPart, ...extra] = part.split("/");
    if (extra.length > 0) return null;
    let step = 1;
    if (stepPart !== undefined) {
      if (!/^\d+$/.test(stepPart) || Number(stepPart) < 1) return null;
      step = Number(stepPart);
    }
    let start: number;
    let end: number;
    if (rangePart === "*" || rangePart === undefined) {
      start = spec.min;
      end = spec.max;
    } else if (rangePart.includes("-")) {
      const [from, to] = rangePart.split("-");
      const fromValue = resolve(from ?? "");
      const toValue = resolve(to ?? "");
      if (fromValue === null || toValue === null) return null;
      if (fromValue > toValue) return null;
      start = fromValue;
      end = toValue;
    } else {
      const single = resolve(rangePart);
      if (single === null) return null;
      start = single;
      end = stepPart === undefined ? single : spec.max;
    }
    for (let value = start; value <= end; value += step) {
      if (spec.wrap) values.add(spec.wrap(value));
      else values.add(value);
    }
  }

  if (values.size === 0) return null;
  return {
    values: [...values].sort((a, b) => a - b),
    isWildcard: text === "*" || text === "*" + "/1",
  };
}

/**
 * Parse a 5-field expression, returning null when it is not a valid cron
 * schedule (the caller turns that into a 400 rather than storing junk).
 */
export function parseCronExpression(expression: string): CronSchedule | null {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const parsed = fields.map((field, index) => parseField(field, index));
  if (parsed.some((field) => field === null)) return null;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parsed as CronField[];
  return {
    minute: minute!,
    hour: hour!,
    month: month!,
    dayOfMonth: dayOfMonth!,
    dayOfWeek: dayOfWeek!,
    expression: fields.join(" "),
  };
}

/** True when a schedule can ever fire (guards `0 0 31 2 *`, style mistakes). */
export function scheduleIsReachable(schedule: CronSchedule): boolean {
  if (schedule.hour.values.length === 0 || schedule.minute.values.length === 0) return false;
  // A sweep over one year of days catches the classic impossible combinations
  // without simulating minute-by-minute for a whole year.
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  for (let day = 0; day < 366; day++) {
    const date = new Date(start.getTime() + day * 86_400_000);
    if (schedule.month.values.includes(date.getUTCMonth() + 1) && dayMatches(schedule, date)) return true;
  }
  return false;
}

function dayMatches(schedule: CronSchedule, date: Date): boolean {
  const dom = schedule.dayOfMonth.values.includes(date.getUTCDate());
  const dow = schedule.dayOfWeek.values.includes(date.getUTCDay());
  if (schedule.dayOfMonth.isWildcard && schedule.dayOfWeek.isWildcard) return true;
  if (schedule.dayOfMonth.isWildcard) return dow;
  if (schedule.dayOfWeek.isWildcard) return dom;
  return dom || dow;
}

/** The next time this schedule fires strictly after `from`, or null within a year. */
export function nextCronRun(schedule: CronSchedule, from: Date = new Date()): Date | null {
  // Start at the next whole minute: cron has minute resolution.
  const cursor = new Date(from.getTime());
  cursor.setUTCSeconds(0, 0);
  cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  const limit = cursor.getTime() + 366 * 86_400_000;
  while (cursor.getTime() <= limit) {
    if (
      schedule.month.values.includes(cursor.getUTCMonth() + 1) &&
      schedule.hour.values.includes(cursor.getUTCHours()) &&
      schedule.minute.values.includes(cursor.getUTCMinutes()) &&
      dayMatches(schedule, cursor)
    ) {
      return cursor;
    }
    // Skip a whole day when the date cannot match; otherwise step a minute.
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  }
  return null;
}

/** A human-readable summary, used by the API and the console. */
export function describeSchedule(schedule: CronSchedule): string {
  return `cron(${schedule.expression}) in UTC`;
}

/**
 * Read a schedule out of a task's `parameters` blob, honouring both the
 * documented `schedule` string and an `every_minutes` interval.
 */
export function scheduleFromParameters(
  parameters: unknown,
): { schedule: CronSchedule | null; everyMinutes: number | null } {
  if (!parameters || typeof parameters !== "object") return { schedule: null, everyMinutes: null };
  const record = parameters as Record<string, unknown>;
  const every = record.every_minutes;
  const everyMinutes = typeof every === "number" && Number.isFinite(every) && every > 0 ? every : null;
  const expression = record.schedule;
  if (typeof expression !== "string" || !expression.trim()) {
    return { schedule: null, everyMinutes };
  }
  return { schedule: parseCronExpression(expression), everyMinutes };
}
