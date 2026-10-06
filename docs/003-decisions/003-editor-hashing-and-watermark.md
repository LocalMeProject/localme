---
id: repo:localme/decisions/editor-hashing-and-watermark
parent: repo:localme/decisions
title: Editor Hashing And Watermark
level: repo
kind: decision
date: 2026-10-01
deciders: [architecture-team]
---
# ADR 005 — Editor, password hashing and watermark deviations

- **Status:** Accepted
- **Date:** 2026-09-30
- **Related:** [ADR 001](./001-nextjs-only-architecture.md),
  [ADR 003](./003-sqlite-first-switchable-postgres.md),
  [ADR 004](./004-operational-hardening.md)

## Context

Three places where the shipped code intentionally does not match the letter of
the Blueprint. The first two were already true when the 2026-09-30 audit closed
and were never recorded; the third is new. Recording them here is the point —
an undocumented deviation is indistinguishable from a bug.

## 1. The code editor is not Monaco

**Spec:** Technical Documentation §12.3, "Monaco Editor Integration" — the file
manager is specified with Monaco as the editing surface.

**Shipped:** `components/code-editor.tsx`, a `<textarea>` with a line-number
gutter, a cursor position readout, and Ctrl/Cmd+S. No `monaco-editor`
dependency.

**Why.** Monaco is ~2–5 MB of JavaScript plus a web worker and a set of
language grammars, loaded into the one page every project owner opens to manage
files. The platform's editing surface is plain text files that the owner either
uploads wholesale or tweaks — a single file at a time, in a project with a 5 MB
storage cap. Syntax highlighting is the only material benefit, and it is not
worth the payload, the worker lifecycle, and the fact that Monaco's API changes
between major versions.

**Cost, stated plainly.** No autocomplete, no multi-cursor, no symbol search, no
diff view inside the editor. If editing becomes a primary use case rather than an
occasional tweak, this should be revisited — the integration is contained to one
component, and swapping it back does not touch the API.

**If you disagree:** add `monaco-editor` and `@monaco-editor/react`, keep the
`CodeEditor` props, and re-implement the component. The prop surface
(`path`, `value`, `language`, `dirty`, `saving`, `onChange`, `onSave`) is
deliberately the shape Monaco wants.

## 2. Password hashing: scrypt for accounts, bcrypt(12) for visitors

**Spec:** Blueprint §7.3, "Passwords: bcrypt (12 rounds)", for platform
accounts, visitors and API keys alike.

**Shipped:** platform accounts use **scrypt** (`lib/server/crypto.ts`), visitors
use **bcrypt at cost 12** (`lib/server/visitor-auth.ts`, overridable with
`BCRYPT_ROUNDS`), and API keys use a **SHA-256 hash of a high-entropy random
token** (`hashToken`).

**Why the split.** A platform API key is a 256-bit random value, not a
user-chosen password. Hashing it with a deliberately slow function buys
nothing — there is no dictionary to attack — and costs latency on every API
request that carries a key. A plain SHA-256 over 32 random bytes is the correct
construction. bcrypt/scrypt are the right answer for *low-entropy* secrets,
which is exactly the case for the two password classes.

For those two, scrypt is used for platform accounts because it is the current
OWASP first recommendation and is in Node's standard library (no dependency,
audited, memory-hard). bcrypt is kept for visitors because the spec names it and
because bcrypt's cost parameter is the ecosystem's shared expectation.

**Net effect:** the documented algorithm is used where it matters (passwords),
and a cheaper, correct construction is used where the spec's choice would be
active harm (random tokens). Cost 12 for visitors is now compliant, up from 10.

## 3. The watermark label and link are operator config

**Spec:** Blueprint §14 pins the markup verbatim, including the link text
`MVP Platform` pointing at `https://mvp.com`.

**Shipped:** the position, `z-index`, styling, and the "not user-editable"
property are exactly as specified. The **label and target** come from system
config — `watermark.label` and `watermark.url` — and both default to empty,
which renders the §14 markup unchanged.

**Why.** §14 is a copy of markup from the product's earlier name. Injected
server-side into every hosted page, it puts a live link to an unrelated domain
in front of every customer. That is a branding and legal question, not a
technical one, so it belongs to the operator rather than to a hardcoded string.
The default preserves spec compliance for anyone who does not care; setting
`watermark.label` to your product is a two-field change in `/admin`.

**Rejected alternative:** silently rewording the default. That would break the
documented markup and hide the change from anyone comparing output to §14.

## Consequences

- The `/docs` and `README` documents describe §14 behaviour; the config keys are
  documented alongside the rest of the system config table.
- `SECURITY.md` lists the controls the platform actually enforces, which is a
  superset of what §19 names — HSTS, nosniff, a console CSP and the SSRF guard
  are additions, and are labelled as such.


