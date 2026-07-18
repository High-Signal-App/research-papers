#!/usr/bin/env bash
# Build the Blume docs site from docs/ + blume.config.ts.
#
# Blume is the PRESENTATION layer only. The committed Markdown under docs/ is
# the source of truth. Generated Blume output is git-ignored (see .gitignore).
#
# Requires Node.js >= 22.12. Uses npx so Blume is not a permanent dependency;
# pin the version with BLUME_VERSION (default: a version >= 7 days old per the
# fleet supply-chain guideline). Bump after vetting a newer release.
#
# Usage:
#   ./scripts/build-docs.sh          # build static site to .blume/dist
#   ./scripts/build-docs.sh dev      # start dev server with hot reload
#   BLUME_VERSION=1.0.4 ./scripts/build-docs.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Default to a version at least 7 days old (published 2026-07-11).
# 1.0.x GA is available; bump after vetting.
BLUME_VERSION="${BLUME_VERSION:-0.8.0}"
MODE="${1:-build}"

if ! command -v npx >/dev/null 2>&1; then
  echo "ERROR: npx not found. Install Node.js >= 22.12." >&2
  exit 1
fi

# Validate docs before building so broken links fail the build.
"$REPO_ROOT/scripts/check-docs.sh"

case "$MODE" in
  dev)
    exec npx --yes "blume@$BLUME_VERSION" dev
    ;;
  build)
    echo "==> Building Blume site (blume@$BLUME_VERSION)..."
    npx --yes "blume@$BLUME_VERSION" build
    echo "==> Done. Output is in the Blume build directory (git-ignored)."
    echo "    Preview with: ./scripts/build-docs.sh preview"
    ;;
  preview)
    exec npx --yes "blume@$BLUME_VERSION" preview
    ;;
  *)
    echo "Usage: $0 [dev|build|preview]" >&2
    exit 2
    ;;
esac
