"""Legacy Postgres operator helpers — not the ClickHouse product path.

mlx_tag_v2 and a few leftover CLIs (`init-db`, `status`, ingest writers) still
need psycopg against POSTGRES_URL. Keep this module; do not add new product
features here.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

from researchpapers.config import MIGRATIONS_DIR, Settings


@contextmanager
def connect(settings: Settings) -> Iterator[psycopg.Connection]:
    with psycopg.connect(settings.postgres_url, row_factory=dict_row) as conn:
        yield conn


def migration_files(migrations_dir: Path | None = None) -> list[Path]:
    """Sorted SQL files applied by the legacy Postgres operator path."""
    return sorted((migrations_dir or MIGRATIONS_DIR).glob("*.sql"))


def migration_versions(migrations_dir: Path | None = None) -> list[str]:
    """Sorted migration stems from the legacy Postgres SQL directory."""
    return [path.stem for path in migration_files(migrations_dir)]


def init_db(settings: Settings) -> list[str]:
    """Apply pending Postgres migrations. Returns the versions that were applied."""
    applied: list[str] = []
    with connect(settings) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version TEXT PRIMARY KEY,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
                """
            )
            cur.execute("SELECT version FROM schema_migrations")
            done = {r["version"] for r in cur.fetchall()}
        for path in migration_files():
            version = path.stem
            if version in done:
                continue
            sql = path.read_text()
            with conn.cursor() as cur:
                cur.execute(sql)
                cur.execute(
                    "INSERT INTO schema_migrations (version) VALUES (%s) ON CONFLICT DO NOTHING",
                    (version,),
                )
            applied.append(version)
        conn.commit()
    return applied
