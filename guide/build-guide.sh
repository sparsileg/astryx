#!/usr/bin/env bash
# Builds the Astryx User Guide PDF from the Markdown chapters.
# Needs pandoc (3.x) and typst on the PATH.
# Usage: ./build-guide.sh [output.pdf]   (default: ../src/help/astryx-guide.pdf)
set -euo pipefail
cd "$(dirname "$0")"

# Chapters in reading order
chapters=(
    chapters/introduction.md
    chapters/target-database.md
    chapters/best-months.md
    chapters/yearly-observability.md
    chapters/sequence-planner.md
    chapters/combined-session-report.md
)

version=$(grep -oP "APP_VERSION:\s*'\K[^']+" ../src/js/config.js)
output=${1:-../src/help/astryx-guide.pdf}

mkdir -p build "$(dirname "$output")"
# The chapters often start a list on the line after a paragraph, with no
# blank line between; --file-scope turns links between chapter files into
# links inside the PDF
pandoc -f markdown+lists_without_preceding_blankline --file-scope --lua-filter chapter-links.lua --template guide.typ -V version="$version" \
    -t typst -o build/astryx-guide.typ "${chapters[@]}"
typst compile --root . --font-path fonts --ignore-system-fonts \
    build/astryx-guide.typ "$output"
echo "Built $output (version $version)"
