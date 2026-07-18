#!/usr/bin/env bash
# Validate the docs/ knowledge base: broken links, orphaned files, structure.
#
# Pure shell — no Node or Python deps. Runs in CI via .github/workflows/docs.yml
# and locally via `./scripts/check-docs.sh`.
#
# Checks:
#   1. Every relative .md / .png / .svg link inside docs/ resolves on disk.
#   2. Every markdown file under docs/ is reachable from docs/index.md (orphan check).
#   3. Required root canonical docs exist (README, DEPLOY, PROJECT_STATUS, STATUS, AGENTS).
#   4. blume.config.ts exists.
#   5. No empty docs/ subdirectories.
#
# Exit code is non-zero if any check fails.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DOCS="docs"
FAIL=0
fail() { echo "FAIL: $*" >&2; FAIL=1; }

if [ ! -d "$DOCS" ]; then
  echo "ERROR: $DOCS/ not found" >&2
  exit 1
fi

echo "==> [1/6] Checking relative markdown/media links inside $DOCS/"
# Extract [text](target) where target does not start with http://, https://, or #
# and does not contain a space (mailto). Resolve relative to the linking file.
while IFS= read -r line; do
  file="${line%%:*}"
  rest="${line#*:}"
  # rest is the link target(s); process each
  : # placeholder; we use a different approach below
done < <(grep -rEn --include='*.md' '\]\([^)]+\)' "$DOCS" || true)

# Simpler: walk each markdown file, pull targets, resolve.
while IFS= read -r mdfile; do
  dir="$(dirname "$mdfile")"
  # Use grep -oE to extract link targets, then filter.
  grep -oE '\]\([^)]+\)' "$mdfile" | sed 's/^](//; s/)$//' | while IFS= read -r target; do
    # Skip external, anchor-only, mailto, and bare-URL fragments.
    case "$target" in
      http://*|https://*|\#*|mailto:*) continue ;;
    esac
    # Strip an anchor fragment.
    path="${target%%#*}"
    [ -z "$path" ] && continue
    # Resolve relative to the file's directory.
    resolved="$dir/$path"
    # Normalize ./ and ../ via realpath -m (logical, no symlink follow needed).
    if ! real="$(python3 -c "import os,sys; print(os.path.normpath(sys.argv[1]))" "$resolved" 2>/dev/null)"; then
      real="$resolved"
    fi
    if [ ! -e "$real" ]; then
      echo "FAIL: broken link in $mdfile: [$target] -> $real" >&2
      FAIL=1
    fi
  done
done < <(find "$DOCS" -type f -name '*.md')
# Propagate FAIL from the subshell (pipefail + the while runs in current shell for the find loop,
# but the inner grep|while is a pipeline). Re-scan with a single pass to be safe.
broken=$(find "$DOCS" -type f -name '*.md' -print0 | while IFS= read -r -d '' mdfile; do
  dir="$(dirname "$mdfile")"
  grep -oE '\]\([^)]+\)' "$mdfile" | sed 's/^](//; s/)$//' | while IFS= read -r target; do
    case "$target" in
      http://*|https://*|\#*|mailto:*) continue ;;
    esac
    path="${target%%#*}"
    [ -z "$path" ] && continue
    real="$(python3 -c "import os,sys; print(os.path.normpath(os.path.join(sys.argv[1], sys.argv[2])))" "$dir" "$path" 2>/dev/null || echo "$dir/$path")"
    [ -e "$real" ] || echo "$mdfile:[$target]->$real"
  done
done)
if [ -n "$broken" ]; then
  echo "$broken" >&2
  FAIL=1
fi

echo "==> [2/6] Checking for orphaned markdown files under $DOCS/"
# A file is reachable if docs/index.md links to it directly or transitively.
# Build the reachable set via a BFS over relative .md links.
reachable=$(python3 - "$DOCS/index.md" <<'PY'
import os, re, sys
start = sys.argv[1]
root = os.path.dirname(os.path.abspath(start))
seen = set()
stack = [start]
link_re = re.compile(r'\]\(([^)]+)\)')
while stack:
    f = stack.pop()
    f = os.path.normpath(f)
    if f in seen or not os.path.isfile(f):
        continue
    seen.add(f)
    d = os.path.dirname(f)
    try:
        txt = open(f, encoding='utf-8').read()
    except Exception:
        continue
    for m in link_re.findall(txt):
        tgt = m.split('#', 1)[0]
        if not tgt or tgt.startswith(('http://', 'https://', 'mailto:')):
            continue
        # Only follow .md targets (media orphans are checked separately if needed).
        if not tgt.endswith('.md'):
            continue
        resolved = os.path.normpath(os.path.join(d, tgt))
        if resolved not in seen:
            stack.append(resolved)
for s in sorted(seen):
    print(os.path.relpath(s, root))
PY
)
reachable_rel=$(echo "$reachable" | sed "s|^|$DOCS/|")
orphans=$(find "$DOCS" -type f -name '*.md' | sort | while IFS= read -r f; do
  echo "$reachable_rel" | grep -qxF "$f" || echo "$f"
done)
if [ -n "$orphans" ]; then
  echo "FAIL: orphaned markdown (not reachable from $DOCS/index.md):" >&2
  echo "$orphans" >&2
  FAIL=1
fi

echo "==> [3/6] Checking required root canonical docs"
for f in README.md DEPLOY.md PROJECT_STATUS.md STATUS.md AGENTS.md; do
  [ -f "$f" ] || fail "missing root canonical doc: $f"
done

echo "==> [4/6] Checking blume.config.ts"
[ -f "blume.config.ts" ] || fail "missing blume.config.ts"

echo "==> [5/6] Checking for empty docs/ subdirectories"
while IFS= read -r d; do
  # A directory is empty if it contains no files (recursively).
  count=$(find "$d" -type f | wc -l | tr -d ' ')
  [ "$count" -eq 0 ] && fail "empty docs subdirectory: $d"
done < <(find "$DOCS" -mindepth 1 -type d)

echo "==> [6/6] Checking links from root canonical docs (README/DEPLOY/PROJECT_STATUS/STATUS/AGENTS)"
broken_root=$(for f in README.md DEPLOY.md PROJECT_STATUS.md STATUS.md AGENTS.md; do
  [ -f "$f" ] || continue
  grep -oE '\]\([^)]+\)' "$f" | sed 's/^](//; s/)$//' | while IFS= read -r target; do
    case "$target" in
      http://*|https://*|\#*|mailto:*) continue ;;
    esac
    path="${target%%#*}"
    [ -z "$path" ] && continue
    # Root files link repo-relative (e.g. docs/index.md, DEPLOY.md).
    [ -e "$path" ] || echo "$f:[$target]->$path"
  done
done)
if [ -n "$broken_root" ]; then
  echo "$broken_root" >&2
  FAIL=1
fi

if [ "$FAIL" -ne 0 ]; then
  echo >&2
  echo "docs validation FAILED" >&2
  exit 1
fi
echo >&2
echo "docs validation OK"
