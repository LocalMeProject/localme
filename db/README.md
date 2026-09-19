# Database migrations

Two dialect trees, one logical schema. Source of truth: `docs/LocalMe — Blueprint.md` §4.1
(PostgreSQL Schema) and §4.2 (project_data document store).

| Dialect  | Directory      | Selected when                              |
| :------- | :------------- | :----------------------------------------- |
| SQLite   | `db/sqlite/`   | `DB_DRIVER=sqlite` (default) or unset      |
| Postgres | `db/postgres/` | `DB_DRIVER=postgres` and `DATABASE_URL`    |

## Files

- `NNN_name.sql` — a migration; applied in lexicographic order by `scripts/migrate.mjs`,
  recorded in a `schema_migrations` ledger table (`dialect`, `name`, `applied_at`).
- Files are never edited after being committed; new behavior = a new numbered file.
- The two trees must remain statement-for-statement equivalent. The parity map:

| Blueprint type        | Postgres         | SQLite                          |
| :-------------------- | :--------------- | :------------------------------ |
| `SERIAL PRIMARY KEY`  | `SERIAL`         | `INTEGER PRIMARY KEY AUTOINCREMENT` |
| `JSONB`               | `JSONB`          | `TEXT` (application-serialized) |
| `TEXT[]`              | `TEXT[]`         | `TEXT` (JSON array)             |
| `BOOLEAN`             | `BOOLEAN`        | `INTEGER` 0/1                   |
| `TIMESTAMP`           | `TIMESTAMP`      | `TEXT` ISO-8601 (sortable)      |
| `document->>'id'`     | expression index | `json_extract(document, '$.id')` |
| `GIN (document)`      | GIN index        | n/a (SQLite JSON funcs scan)    |

## SQLite selection rules

- `DB_PATH` unset → in-memory `:memory:` database.
- `DB_PATH=file:/path/to/localme.db` → file-backed, persistent across restarts.

In-memory keeps local dev and CI dependency-free; set `DB_PATH` when you want a real file.

## Applying

```bash
bun run db:migrate                     # auto-detects the driver (sqlite by default)
DB_DRIVER=postgres bun run db:migrate  # Postgres via DATABASE_URL
```
