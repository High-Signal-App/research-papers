#!/usr/bin/env python3
"""Fail when the researchpapers package contains an import cycle."""

from __future__ import annotations

import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "src" / "researchpapers"
PREFIX = "researchpapers."


def module_name(path: Path) -> str:
    relative = path.relative_to(PACKAGE).with_suffix("")
    if relative.name == "__init__":
        relative = relative.parent
    suffix = ".".join(relative.parts)
    return "researchpapers" if not suffix else f"{PREFIX}{suffix}"


modules = {module_name(path): path for path in PACKAGE.rglob("*.py")}
graph: dict[str, set[str]] = {name: set() for name in modules}

for name, path in modules.items():
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    package_parts = name.split(".")[:-1]
    for node in ast.walk(tree):
        candidates: list[str] = []
        if isinstance(node, ast.Import):
            candidates.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            if node.level:
                base = package_parts[: len(package_parts) - node.level + 1]
                if node.module:
                    base.extend(node.module.split("."))
                candidates.append(".".join(base))
            elif node.module:
                candidates.append(node.module)
        for candidate in candidates:
            parts = candidate.split(".")
            while parts:
                target = ".".join(parts)
                if target in modules and target != name:
                    graph[name].add(target)
                    break
                parts.pop()

visiting: list[str] = []
visited: set[str] = set()


def visit(name: str) -> list[str] | None:
    if name in visiting:
        start = visiting.index(name)
        return [*visiting[start:], name]
    if name in visited:
        return None
    visiting.append(name)
    for target in sorted(graph[name]):
        cycle = visit(target)
        if cycle:
            return cycle
    visiting.pop()
    visited.add(name)
    return None


for module in sorted(graph):
    found = visit(module)
    if found:
        raise SystemExit(f"Python import cycle: {' -> '.join(found)}")

print(f"Python import cycles: 0 across {len(modules)} modules.")
