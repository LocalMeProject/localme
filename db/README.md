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

- `DB_PATH` unset in test environment (`NODE_ENV=test`) → in-memory `:memory:` database.
- `DB_PATH` unset in production/development → defaults to persistent file `data/localme.db` (automatically creates parent directory).
- `DB_PATH=file:/path/to/localme.db` → file-backed, persistent across restarts.
- `DB_PATH=file:/app/storage_data/localme.db` → container persistent volume path, sharing a single mount with uploaded assets.

In-memory keeps test suites isolated and dependency-free; file paths ensure data survives process restarts.

## Applying

```bash
bun run db:migrate                     # auto-detects the driver (sqlite by default)
DB_DRIVER=postgres bun run db:migrate  # Postgres via DATABASE_URL
```
In container environments, `npm run runflare:start` runs `scripts/migrate.mjs` automatically before binding the port.
