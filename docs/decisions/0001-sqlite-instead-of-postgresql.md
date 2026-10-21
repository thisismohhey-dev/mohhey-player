# ADR 0001 — SQLite instead of PostgreSQL

**Status:** accepted (the product owner's instruction overrides `docs/agent.md` §2 and §7)

## Context
`docs/agent.md` lists PostgreSQL and Prisma. The product owner explicitly chose **SQLite**. A personal, offline desktop
player benefits from a zero-install, single-file database: no server to install, upgrade or back up separately.

## Decision
- Database: **SQLite** via Bun's built-in `bun:sqlite` (WAL mode, foreign keys on). No native addon to package.
- Schema changes: append-only, versioned SQL migrations in `apps/api/src/shared/db.ts` (`schema_migrations` table).
  Never edit an applied migration.
- Validation: **Zod** at every API boundary (shared schemas in `packages/contracts`).
- Prisma is **not used**: its query-engine binaries complicate Electron packaging and add little over a small, typed
  repository layer. If the data model grows, a query builder can be introduced behind the repositories.

## Consequences
- Backup/restore = copy `library.db` (+ `-wal`/`-shm`) from `<userData>/data/`.
- Search uses normalised text columns + `LIKE`; adequate to tens of thousands of tracks. FTS5 is the upgrade path.
- Remote/shared libraries are out of scope; a future sync phase would need a different design.
