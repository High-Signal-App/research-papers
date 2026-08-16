from pathlib import Path

from researchpapers.db import migration_versions


def test_migration_versions_lists_sorted_sql_stems(tmp_path: Path) -> None:
    (tmp_path / "002_later.sql").write_text("-- later")
    (tmp_path / "001_first.sql").write_text("-- first")
    (tmp_path / "notes.txt").write_text("ignore me")

    assert migration_versions(tmp_path) == ["001_first", "002_later"]


def test_migration_versions_empty_directory(tmp_path: Path) -> None:
    assert migration_versions(tmp_path) == []
