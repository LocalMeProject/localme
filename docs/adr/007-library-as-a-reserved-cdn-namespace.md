# ADR 007 — The library is a reserved CDN namespace, and a visitor session is an API principal

- Status: accepted
- Date: 2026-10-01
- Supersedes: nothing. Refines §5.3 (library), §6.2 (visitor auth) and §7.8 (hotlink protection).

## Context

Three defects shared one theme: **a value was correct in isolation and wrong in
combination**, and each was invisible to the tests that existed because each
test stopped one step short of the failure.

1. **Static assets 403'd in the browser.** `serving.ts` compared a `Referer`
   against `new URL(request.url).hostname`. Behind a reverse proxy or preview
   tunnel, `request.url` is rebuilt from the app's *internal* origin, so the two
   names never matched and the anti-hotlink rule refused the project's own
   stylesheet and scripts. Every test used a bare `Request` with no `Referer`,
   which the rule allows by design, so the suite was green while the product was
   broken.

2. **In-project sign-up "did not work".** Signing up set a cookie and the gated
   page rendered, but the page's own `/api/db/*` call answered 401. Two
   independent causes: the visitor cookie was `Path=/{user}/{project}/`, so the
   browser never sent it to `/api/db/*` on the platform origin; and
   `resolvePrincipal` only ever returned a console session or an API key, so a
   visitor was not a principal at all. Sign-in appeared to succeed and changed
   nothing.

3. **The library was not a CDN.** An upload had to name a "home project", the
   same asset could exist in several projects, and the console rendered a `×N`
   badge to paper over the copies. The user-facing model was "copy this from X
   to Y", which is the opposite of referencing a URL.

A fourth, smaller one: the seeded demo page asserted "Sign in to see it"
unconditionally, so a *working* session rendered exactly like a failed one. The
copy, not the code, was the last thing standing between the user and the truth.

## Decision

**The library is one reserved project per account, served as a CDN.**

Each account gets a project named `library`, created on first use by
`ensureLibraryProject`. Its files are served from `/{username}/library/{path}`
and referenced directly by every project the account owns.

- `library` is **reserved in two places**: `createProject` refuses the name, and
  a project upload or rename into a top-level `library/` folder is rejected with
  a pointer to the Library page. Reserving it is what makes the URL mean exactly
  one thing; otherwise a project called `library` shadows the namespace.
- Inside a hosted project, `library/<name>` resolves against the account library
  rather than the project's own files, so a *relative* reference keeps working
  on a verified custom domain.
- Making it a real project row, not a parallel storage table, means the library
  inherits ownership checks, the storage cap, ETags, the asset cache, compression
  and minification instead of reimplementing them.
- The storage split is now **by project name**, not by a `library/` path prefix,
  so the cap accounting follows the model.
- Migration 008 re-homes existing rows, stripping the prefix. Two rules, both
  of which exist because running it against deliberately messy data produced a
  wrong result that reading it did not:
  - All copies of a path are ranked *before* anything moves (newest `updated_at`,
    ties by lowest id), so the unique `(project_id, path)` index cannot be
    violated mid-migration and leave the data half-migrated.
  - The prefix is stripped **only when present**. A row already sitting in the
    library project was stored under its real path, and an unconditional
    `substr(path, 9)` truncated `a.css` to the empty string — a file with no
    name, invisible in the console and unservable.

  `tests/server/library-migration.test.ts` pins both against a messy fixture.

**A visitor session is a first-class API principal.**

`resolvePrincipal` returns a `visitor` principal alongside `session` and
`api_key`. Because the cookie is *named* `auth_{projectId}`, resolving it needs
the target project, so the project-scoped routes pass a `projectId` hint. A
visitor is pinned to its own project: naming a different `projectId` is `403`.

**The visitor cookie is scoped by name, not by path** — `Path=/`. The name
already carries the project, so the narrow path bought no isolation and only
hid the cookie from the API.

**Hotlink validation uses the forwarded request host.** `X-Forwarded-Host` /
`Host`, not `request.url`, because that is the host the browser's `Referer` will
carry.

**The demo page reports state instead of asserting it.** It renders the count
when the session works and only then shows the sign-in prompt.

## Consequences

- A project reference and a library reference are the same kind of thing: a URL.
- Deleting a library asset deletes one row, not N copies.
- `/api/lib/*` (project-shaped) and `/api/library` (account-shaped) now resolve to
  the same namespace, so they cannot drift.
- `putFile`'s last argument no longer rewrites the path; it only selects which
  budget the write is charged against. That coupling was what made the old prefix
  load-bearing.
- The tests that would have caught all of this now exist and cross the boundary:
  a `Referer`-bearing asset request, a visitor session making a real API call,
  and concurrent first use of the library project.

## Alternatives rejected

- **A dedicated `library_files` table.** Cleaner conceptually, but it would have
  needed its own ownership checks, cap logic, ETag/cache integration and serving
  path — reimplementing everything `files` already does, for a namespace that is
  just "files with a different owner scope".
- **Keeping the copies and fixing only the UI.** Hides the model rather than
  fixing it; the `×N` reconciliation would remain the source of truth.
- **Widening the hotlink allow-list to include the internal host.** Would have
  re-opened the CDN abuse the rule exists to prevent; comparing the *forwarded*
  host is both correct and narrower.
- **Treating the visitor as `permissions: ["*"]`.** A visitor is scoped to one
  project and to the permissions of its role, so a wildcard would be a privilege
  escalation.
