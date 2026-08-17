#!/usr/bin/env bash
#
# docs/ 의 웹 자산을 intava-pages 저장소로 옮기고 밀어 올린다.
#
# 원본은 여기(docs/)고 intava-pages는 배포본이다. 손으로 복사하면 언젠가
# 어긋나므로 옮기는 일은 전부 이 스크립트만 한다.
#
#   npm run pages
#   PAGES_DIR=~/어딘가/intava-pages npm run pages
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PAGES_DIR="${PAGES_DIR:-$ROOT/../intava-pages}"

# 배포할 것만 적는다. docs/ 안의 .md 는 내부 문서라 올리지 않는다.
FILES=(
  index.html
  privacy.html
  support.html
  og.png
  icon.png
  lockup.png
  shot-warmup.webp
  shot-work.webp
  shot-rest.webp
  shot-switch.webp
  shot-cooldown.webp
  shot-records.webp
)

if [ ! -d "$PAGES_DIR/.git" ]; then
  echo "intava-pages 저장소가 $PAGES_DIR 에 없다."
  echo
  echo "  git clone https://github.com/yunuchoiii/intava-pages.git \"$PAGES_DIR\""
  echo
  echo "다른 자리에 두었다면 PAGES_DIR 로 알려준다."
  exit 1
fi

for f in "${FILES[@]}"; do
  [ -f "$ROOT/docs/$f" ] || { echo "docs/$f 가 없다."; exit 1; }
done

cp "${FILES[@]/#/$ROOT/docs/}" "$PAGES_DIR/"

cd "$PAGES_DIR"
git add -A

# 바뀐 게 없으면 빈 커밋을 남기지 않는다
if git diff --cached --quiet; then
  echo "바뀐 것이 없다."
  exit 0
fi

git --no-pager diff --cached --stat
git commit -m "${1:-페이지 갱신}"
git push

echo
echo "올렸다. 반영까지 1~2분."
echo "  https://yunuchoiii.github.io/intava-pages/"
