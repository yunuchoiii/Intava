/**
 * Pods 리소스 복사 단계가 **매 빌드 돌게** 한다 — 커밋 해시가 옛것으로 뜨던 것.
 *
 * 설정의 버전 줄에 붙는 커밋 해시(app.config.js → extra.commit)는 expo-constants가
 * 빌드마다 `EXConstants.bundle/app.config`로 새로 써 준다. 그런데 그 번들을 앱에
 * 넣는 「[CP] Copy Pods Resources」 단계는 입력을 **디렉터리**로 잡고 있어, 안의
 * 파일만 바뀌면 Xcode가 "변한 게 없다"고 건너뛴다. 그래서 증분 빌드로 깐 앱은
 * JS는 새것인데 해시만 옛것이었다(3692ad9가 그대로 떠서 "설치 안 됐다"고 보임).
 *
 * CocoaPods의 `disable_input_output_paths`를 켜면 그 단계에 입력·출력 목록이
 * 안 붙어 매번 돈다. rsync 몇 초가 든다 — 그 대가로 해시가 늘 맞다.
 */
const { withPodfile } = require('@expo/config-plugins');

const LINE = "install! 'cocoapods', :disable_input_output_paths => true";

module.exports = function withFreshPodResources(config) {
  return withPodfile(config, (c) => {
    if (!c.modResults.contents.includes(LINE)) {
      // platform 선언 앞에 둔다 — install! 은 target 보다 먼저 와야 한다
      c.modResults.contents = c.modResults.contents.replace(
        /^platform :ios/m,
        `${LINE}\nplatform :ios`
      );
    }
    return c;
  });
};
