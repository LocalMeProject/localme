# Contributing

## Getting set up

```bash
bun install
bun run db:migrate        # SQLite by default; no database service needed
bun run seed              # optional: demo accounts and projects
bun run dev
```

Copy `env.example` to `.env.local` and set `SESSION_SECRET` (generate one with
`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`).
`bun run dev` binds `0.0.0.0:$PORT`.

The default database is in-memory, so it starts empty and disappears on restart. Set
`DB_PATH` to an absolute `file:/…` path for a database that survives, then
`bun run db:migrate && bun run seed` gives you a console with data in it.

## The four gates

CI runs these on every push and every pull request. All four must pass.

```bash
bun run typecheck     # tsc --noEmit, strict
bun run lint          # eslint 9 flat config
bun run test          # vitest on SQLite
bun run build         # next build
```

There is a fifth leg, `bun run test:postgres`, which needs a real server:

```bash
DB_DRIVER=postgres DATABASE_URL=postgresql://user:pass@localhost:5432/localme bun run db:migrate
DB_DRIVER=postgres DATABASE_URL=postgresql://user:pass@localhost:5432/localme bun run test:postgres
```

**The two dialects cannot drift.** Any change to the document store, the DSL
compiler or a migration must keep `tests/db/document-store.contract.ts` passing
on both engines. That shared contract is the guard; if you find yourself
writing a dialect-specific assertion, the abstraction is probably wrong.

A change that only passes one dialect is a bug, not a platform limitation.

## Conventions

- **Docs are the contract.** The product specification lives in `docs/`. If you
  change behaviour, either match the spec or record the deviation in
  `docs/adr/` with the reasoning. A silent divergence is the one thing that
  makes this codebase hard to maintain.
- **One implementation per operation.** The spec sometimes names two paths for
  the same thing (`/api/endpoints` and `/api/api-endpoints`); the second is a
  re-export of the first, never a copy.
- **Parameterize SQL.** Identifiers (table names) go through `quote.ident`;
  values always go through `placeholder`. There is no exception to this.
- **Both dialects.** `placeholder()` is positional on SQLite and numbered on
  Postgres. A value that appears twice in the SQL must be supplied twice on
  SQLite and once on Postgres — `documents.ts` shows the pattern.
- **New configuration is a system config row**, not an environment variable,
  unless it is a secret. Add it to `SYSTEM_CONFIG_DEFAULTS` and *read it* — a
  key nothing reads is worse than no key, because it looks like it works.
- **Never log a credential.** Use the scoped logger (`createLogger`); it
  redacts by field name and shape.
- **Both sides of a value, not just the type.** `scripts/migrate.mjs` used to
  strip the `file:/` prefix itself and drifted from `resolveDriver`; the two then
  opened different databases with no error anywhere. Environment parsing that
  both the app and a script depend on belongs in one shared module.
- **No user-visible string in a component.** Every one is a key in
  `lib/i18n/messages/*`, with a value for every culture. A hard-coded English
  sentence in JSX is a bug, not a TODO: it is invisible to an operator and it
  ships to every Persian reader. Declare a group with
  `export const x = { ... } satisfies MessageGroup` — as a *satisfies* target,
  never as a declared type, so `MessageKey` stays a literal union and a renamed
  key is a build error.
- **No culture logic in a component either.** Numbers, byte counts, dates and
  relative times go through `useI18n().fmt`, not `toLocaleString`, not
  `Intl.DateTimeFormat`, not a hand-rolled `formatBytes`. `fmt` is bound to a
  `t()`, so a unit in Persian ("مگابایت") is an editable catalog entry.
- **Logical properties, not physical ones.** `ms-*` / `pe-*` / `text-end` /
  `paddingInlineStart`, never `ml-*` / `pr-*` / `text-right` / `paddingLeft`.
  Directional icons take `rtl-flip`; identifiers, paths, monospace and code
  spans take `ltr-content`; fields a user types a URL into take `ltr-input`.
  Identifiers and file contents stay left-to-right in a Persian paragraph —
  a JSON body and an API path are not Persian text.
- **Day-keyed data is compared as `YYYY-MM-DD` strings.** `new Date(s)` on a
  bare date string is UTC midnight, which reads back as the previous day
  anywhere west of Greenwich. Use `lib/i18n`'s `parseIsoDay` when you need a
  `Date`, and `fmt.isoDate` / `fmt.isoMonth` when you only need to print one.
- **The calendar is computed, never re-skinned.** Do not format a Gregorian date
  with translated labels; `fmt` does the Shamsi conversion in `lib/jalali.ts`
  and that is the only place that calendar is implemented.

## Before you open a pull request

- `bun run typecheck && bun run lint && bun run test && bun run build` is green.
- New behaviour has a test that fails without it.
- Public docs (`README.md`, `app/docs/page.tsx`, `env.example`) match what the
  code actually does — defaults included.
- Commits and pull requests are handled by the maintainers' Changes panel; you
  only need a working tree and a description of what changed and why.
