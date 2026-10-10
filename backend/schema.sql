-- GST Market — schema inicial para PostgreSQL/Neon
-- Execute somente em um banco Neon novo, antes de iniciar a API.
-- Este registro marca a migração 0001 como aplicada para o Flask-Migrate.

BEGIN;

CREATE TABLE IF NOT EXISTS stores (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    store_id VARCHAR(36) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    username VARCHAR(80) NOT NULL,
    name VARCHAR(160) NOT NULL,
    email VARCHAR(254),
    password_hash VARCHAR(256) NOT NULL,
    role VARCHAR(20) NOT NULL,
    active BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_users_store_username UNIQUE (store_id, username)
);

CREATE INDEX IF NOT EXISTS ix_users_store_id ON users (store_id);

CREATE TABLE IF NOT EXISTS store_state (
    store_id VARCHAR(36) PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    version INTEGER NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS alembic_version (
    version_num VARCHAR(32) NOT NULL PRIMARY KEY
);

INSERT INTO alembic_version (version_num)
VALUES ('0001_initial')
ON CONFLICT (version_num) DO NOTHING;

COMMIT;
