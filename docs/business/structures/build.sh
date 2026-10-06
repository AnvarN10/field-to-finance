#!/usr/bin/env bash
# Rebuilds diagrams and the PDF for structures-aifc-f2f-ru.
# Needs docker (structurizr/structurizr, plantuml/plantuml) and typst.
set -euo pipefail
cd "$(dirname "$0")"

rm -rf .puml && mkdir -p .puml diagrams
docker run --rm -v "$PWD":/usr/local/structurizr structurizr/structurizr \
  export -w /usr/local/structurizr/workspace.dsl -f plantuml \
  -o /usr/local/structurizr/.puml >/dev/null
rm -f .puml/*-key.puml

# Readable PNGs with a Cyrillic font (DejaVu Sans is in the plantuml image).
for f in .puml/*.puml; do
  perl -0pi -e 's/\[Software System\]/[Система]/g; s/\[Person\]/[Участник]/g; s/\[Container: /[Контейнер: /g; s/\[Infrastructure Node: /[Инфраструктура: /g; s/\[Deployment Node: /[Узел: /g; s/^title .*\n//m; s/^!pragma teoz true\n//m; s/^box .*\n//mg; s/^end box\n//mg; s/\@startuml(.*)\n/\@startuml$1\nskinparam dpi 170\nskinparam defaultFontName "DejaVu Sans"\nskinparam wrapWidth 260\nskinparam maxMessageSize 230\n/' "$f"
done
docker run --rm -e PLANTUML_LIMIT_SIZE=16384 -v "$PWD":/w -w /w plantuml/plantuml -tpng -o /w/diagrams .puml/*.puml
for f in diagrams/structurizr-*.png; do mv "$f" "diagrams/${f#diagrams/structurizr-}"; done
rm -rf .puml

[ -f structures-aifc-f2f-ru.typ ] && typst compile structures-aifc-f2f-ru.typ structures-aifc-f2f-ru.pdf
[ -f structures-cc-ru.typ ] && typst compile structures-cc-ru.typ structures-cc-ru.pdf
