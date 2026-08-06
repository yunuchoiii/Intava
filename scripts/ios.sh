#!/bin/bash
# 아이폰에 설치 — 맥이 먹통이 되지 않게 낮은 우선순위로 돈다.
#
#   ./scripts/ios.sh              릴리스 (헬스장용 — Metro 없이 혼자 돈다)
#   ./scripts/ios.sh Debug        개발용 (맥의 Metro가 켜져 있어야 열린다)
#
# taskpolicy -b : macOS의 백그라운드 등급으로 낮춘다. 스케줄러가 효율 코어를
#                 우선 쓰고, 포그라운드 앱(브라우저 등)에 CPU를 양보한다.
# nice -n 10    : 그 위에 우선순위를 한 번 더 낮춘다.
# Xcode 동시 컴파일 수는 별도 설정으로 6/10개로 묶여 있다 —
#   defaults write com.apple.dt.Xcode IDEBuildOperationMaxNumberOfConcurrentCompileTasks 6
#   되돌리려면: defaults delete com.apple.dt.Xcode IDEBuildOperationMaxNumberOfConcurrentCompileTasks

set -e

DEVICE="00008140-000A45E91863C01C" # yunu's iPhone
CONFIG="${1:-Release}"

echo "▸ ${CONFIG} 빌드 — 낮은 우선순위로 실행합니다 (다른 작업에 영향 최소화)"
exec taskpolicy -b nice -n 10 npx expo run:ios --device "$DEVICE" --configuration "$CONFIG"
