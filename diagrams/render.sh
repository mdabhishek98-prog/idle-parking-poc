#!/usr/bin/env bash
# Render the Archify diagram specs in this folder and copy the checked HTML into public/flow/.
# Usage: ARCHIFY=/path/to/archify/archify/bin/archify.mjs diagrams/render.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${ARCHIFY:?set ARCHIFY to archify/bin/archify.mjs (git clone https://github.com/tt-a1i/archify)}"
mkdir -p public/flow
for spec in diagrams/*.json; do
  name=$(basename "$spec" .json)       # e.g. plotpark-flow.workflow
  type=${name##*.}
  slug=${name%.*}
  rm -rf "diagrams/build/$slug"
  node "$ARCHIFY" finalize "$type" "$spec" "diagrams/build/$slug/$slug.html" --quality showcase --json > "diagrams/build/$slug.result.json" || {
    echo "✗ $slug failed — see diagrams/build/$slug.result.json"; exit 1; }
  cp "diagrams/build/$slug/$slug.html" "public/flow/$slug.html"
  echo "✓ $slug ($type)"
done
