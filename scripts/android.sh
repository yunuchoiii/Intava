#!/bin/bash
# 갤럭시에 설치 — 맥이 먹통이 되지 않게 낮은 우선순위로 돈다.
#
#   ./scripts/android.sh              릴리스 (헬스장용 — Metro 없이 혼자 돈다)
#   ./scripts/android.sh debug        개발용 (맥의 Metro가 켜져 있어야 열린다)
#
# iOS(ios.sh)와 같은 두 겹에 그레이들 몫을 하나 더 얹는다.
#
# taskpolicy -b : macOS의 백그라운드 등급. 스케줄러가 효율 코어를 우선 쓰고,
#                 포그라운드 앱(브라우저 등)에 CPU를 양보한다.
# nice -n 10    : 그 위에 우선순위를 한 번 더 낮춘다.
#
# workers.max=6 : 그레이들이 동시에 돌리는 일감을 6개로 묶는다(10코어 중).
#                 Xcode를 6/10으로 묶어둔 것과 같은 값이다.
# arm64-v8a만   : 이게 제일 크다. 기본값은 네 가지 ABI(arm64·armv7·x86·x86_64)를
#                 **전부** 빌드하는데, 실기기에는 arm64 하나만 있으면 된다.
#                 네이티브 컴파일이 통째로 1/4이 된다. 에뮬레이터(x86_64)에
#                 설치하려면 이 줄을 지우거나 ABI를 더해야 한다.
#
# 그레이들 설정은 프로젝트가 아니라 **환경변수로** 준다. android/ 폴더는
# prebuild가 매번 다시 만드는 자리라, 거기 적어두면 다음 빌드에 사라진다.

set -e

VARIANT="${1:-release}"

# 기기를 하나만 꽂아 두었으면 알아서 찾는다. 여러 대면 시리얼을 인자로 준다.
#   ./scripts/android.sh release R3CN30XXXXX
DEVICE="${2:-$(adb devices | awk 'NR>1 && $2=="device" {print $1; exit}')}"
if [ -z "$DEVICE" ]; then
  echo "✗ 연결된 기기가 없습니다. USB 디버깅을 켜고 '파일 전송'으로 연결하세요." >&2
  echo "  (adb devices 로 확인 — unauthorized면 폰의 허용 팝업을 눌러야 합니다)" >&2
  exit 1
fi

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ORG_GRADLE_PROJECT_reactNativeArchitectures=arm64-v8a
export GRADLE_OPTS="-Dorg.gradle.workers.max=6"

echo "▸ ${VARIANT} 빌드 → ${DEVICE} — 낮은 우선순위로 실행합니다 (다른 작업에 영향 최소화)"
exec taskpolicy -b nice -n 10 npx expo run:android --device "$DEVICE" --variant "$VARIANT"
