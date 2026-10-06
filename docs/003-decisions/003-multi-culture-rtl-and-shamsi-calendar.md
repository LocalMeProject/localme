---
id: repo:localme/decisions/multi-culture-rtl-and-shamsi-calendar
parent: repo:localme/decisions
title: Multi Culture Rtl And Shamsi Calendar
level: repo
kind: decision
date: 2026-10-01
deciders: [architecture-team]
---
# ADR 008 — Two cultures, not one language: a full i18n/RTL layer with a Shamsi calendar

- Status: accepted
- Date: 2026-10-02
- Refines: the whole console surface. Touches §3 (console), §9 (user guide) and
  the serving pipeline's `Content-Language`/`dir` expectations.

## Context

LocalMe shipped with English copy hard-coded in the components and English
formatting baked into every call site: `toLocaleString("en-US")`, `formatBytes`
from `app/console.ts`, `new Date(...).toLocaleDateString()`. There was no
concept of a culture at all.

That is not only a translation problem. The three things a Persian-speaking
developer needs from their console are things English formatting actively gets
wrong:

1. **Direction.** A right-to-left language inside a left-to-right layout is
   not translatable — the column order, the icon that means "back", the side a
   button's margin sits on are all direction-dependent. `margin-left` is not
   `margin-right` when you flip the document.
2. **The calendar.** A date in `fa-IR` is a Shamsi date. Formatting the
   Gregorian one with translated labels produces "1404-12-30" style artefacts
   and days that do not exist (Esfand 30 is not always real), which is worse
   than showing nothing.
3. **Digits.** `۱۴۰۵` and `1405` are the same number; mixing them in one table
   makes it unreadable, and Persian grouping is not a Latin thousands separator.

The product also has a hard requirement that reshapes the whole design: **every
wording must be tweakable from the admin console at runtime**, without a
redeploy. That rules out the common pattern of a JSON file shipped in the
bundle, because an operator editing it needs a database, a screen, and a
guarantee that a deploy does not silently revert their text.

## Decision

### 1. Two cultures, both first-class

`lib/i18n/locales.ts` is the only table that says what a culture *is*: a BCP-47
tag, a native name, a direction, a calendar, a numeral system, and an `Intl`
tag. `fa-IR` is the default and `en-US` is not a fallback — it has its own
direction, calendar and numerals like any other.

Adding a third culture is a change to that table plus a catalog, not a sweep
through the UI.

### 2. The calendar is computed, not re-skinned

`lib/jalali.ts` is a real Shamsi implementation (the jalaali-js algorithm):
`toJalali`/`toGregorian`, leap-year-correct month lengths, `jalaliMonthGrid`
with columns starting on **شنبه**, and typed Shamsi input that normalises
Persian *and* Arabic-Indic digits before parsing.

`lib/i18n/format.ts` binds all of it to a `t()` so that the *words* stay
editable while the arithmetic does not. A Persian date is `۹ مهر ۱۴۰۵` — a
formatted Shamsi date, not a re-labelled Gregorian one. Years are deliberately
**not** grouped (`۱۴۰۵`, never `۱٬۴۰۵`): a year is an identifier, and no Iranian
calendar, invoice or contract writes it with a thousands separator.

`tests/server/i18n-jalali.test.ts` pins the engine with an exhaustive
round-trip over 1300–1500 SH, and pins the formatters per culture.

### 3. Culture is a client preference; wording is server state

Splitting these two is the decision that makes the rest work.

- **Culture** is per-browser, the way the theme is: `localStorage` plus a
  cookie, mirrored onto `<html lang dir>` *before paint* by an inline script in
  `app/layout.tsx` so a Persian reader never sees an English flash. It is
  never server-rendered from the database.
- **Wording** is server state. The catalog ships in the bundle as the floor;
  the admin console writes **overrides** to the `translations` table
  (migration 009) and `GET /api/i18n/messages` returns them. Resolution is
  override → shipped → the key itself.

Falling back to *the key* rather than to English is deliberate. An untranslated
key is visibly broken in review; a silent English string looks finished and
ships to Persian users. `MessageGroup` is used as a `satisfies` target and
never as a declared type, so a renamed key is a build error rather than a leak.

### 4. Direction is CSS, not a JavaScript mirror

`app/globals.css` carries a `[dir="rtl"]` block plus a small set of helpers —
`.rtl-flip` for directional icons, `.ltr-content` for identifiers, `.ltr-input`
for fields a Persian user types a URL into, `.nums` for tabular figures. `pre`
and `code` are forced left-to-right, because a file's contents, a JSON body and
an API path are not Persian text no matter what the chrome around them says.

Components use logical properties throughout (`ms-*`, `pe-*`, `text-end`,
`paddingInlineStart`). A future third RTL language needs no component changes.

Typeface follows the culture: **Iransans** (body and interface) and **Vazir**
(headings) are self-hosted from `public/fonts/` and swapped in on `body`,
because `next/font` sets its variables on `body` too. Both are declared with
Arabic-only `unicode-range`, so Latin codepoints inside a Persian page still
fall through to Inter and mixed-script words do not split.

### 5. The picker is a real calendar

`components/culture-date-time-picker.tsx` is a Shamsi month grid in `fa-IR` and
a Gregorian one in `en-US` from the same component. The cursor is always held as
a Jalali date — the only calendar it computes in — and the Gregorian heading is
derived by converting the first of the same month back rather than assuming
Jalali month 7 is October. Typed entry works in both digit sets.

It is mounted where a calendar actually earns its place: the per-project
**Usage** range filter. That filter is day-keyed, so the range is held as
`YYYY-MM-DD` strings and compared lexically — a `Date`-based range reintroduces
exactly the timezone bug (`new Date("2026-10-09")` is UTC midnight, which reads
back as the 8th anywhere west of Greenwich) that the day keys exist to avoid.

### 6. The API reference is catalogued, but identifiers are not translated

`app/docs/page.tsx` carries the whole HTTP contract. Paths, methods, header
names, config keys, cron expressions and error codes are identifiers and stay
verbatim; the prose around them is catalogued like everything else.

The message format carries exactly one piece of markup: text between `‹` and `›`
is an identifier, and the page renders it in the monospace, forced-LTR span.
That is what lets an operator reword a sentence without knowing which span was
code.

## Consequences

**Good.** Every panel has a culture dropdown — a person working in the console
never has to go back to `/` to change language. The landing page, the auth
page, the dashboard shell, the admin console, the project workspace, the docs
site and the account page all expose it, because a control that exists on only
some pages is a control people cannot find.

Numbers, byte counts, dates and relative times all go through one formatter, so
"۳ دقیقه پیش" and "5 MB" are catalog *entries* an operator can reword — "changing
the language is not just swapping digits".

**Bad / accepted.** A translated wording can reference a `{placeholder}` that no
longer makes sense in the target grammar. The admin editor cannot validate that,
so it is an operator's judgement, same as any translation memory.

**Bad / accepted.** The inline-code convention (`‹…›`) is markup in a message.
It is one delimiter pair and it is documented at the top of
`lib/i18n/messages/docs.ts`; a richer format (bold, links) was rejected as
YAGNI.

**Neutral.** `formatBytes` in `app/console.ts` is now `@deprecated` and unused:
`fmt.bytes` is the only byte formatter, because a byte unit in Persian is a word
("مگابایت"), not a symbol.


