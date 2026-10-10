#!/usr/bin/env bash
# Builds the Astryx User Guide PDF from the Markdown chapters.
# Needs pandoc (3.x) and typst on the PATH.
# Usage: ./build-guide.sh [output.pdf]   (default: ../src/help/astryx-guide.pdf)
set -euo pipefail
cd "$(dirname "$0")"

# Chapters in reading order
chapters=(
    chapters/introduction.md
    chapters/getting-started.md
    chapters/first-night.md
    chapters/target-selection.md
    chapters/todo-list.md
    chapters/yearly-observability.md
    chapters/daily-visibility.md
    chapters/viewfinder.md
    chapters/target-optimizer.md
    chapters/sequence-planner.md
    chapters/imaging-log.md
    chapters/log-analysis.md
    chapters/utilities.md
    chapters/backup-restore.md
    chapters/admin-tools.md
    chapters/recipes.md
    chapters/troubleshooting.md
    chapters/appendix-target-database.md
    chapters/appendix-best-months.md
    chapters/appendix-yearly.md
    chapters/appendix-optimizer.md
    chapters/appendix-seqplan.md
    chapters/appendix-combined-report.md
    chapters/appendix-accuracy.md
    chapters/appendix-glossary.md
)

version=$(grep -oP "APP_VERSION:\s*'\K[^']+" ../src/js/config.js)
output=${1:-../src/help/astryx-guide.pdf}

mkdir -p build "$(dirname "$output")"
# The chapters often start a list on the line after a paragraph, with no
# blank line between; --file-scope turns links between chapter files into
# links inside the PDF
pandoc -f markdown+lists_without_preceding_blankline --file-scope --lua-filter chapter-links.lua --lua-filter callouts.lua --lua-filter appendices.lua --template guide.typ -V version="$version" \
    -t typst -o build/astryx-guide.typ "${chapters[@]}"
typst compile --root . --font-path fonts --ignore-system-fonts \
    build/astryx-guide.typ "$output"
echo "Built $output (version $version)"
