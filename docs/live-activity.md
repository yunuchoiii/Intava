# 다이내믹 아일랜드 · 잠금화면 타이머 — 조사 결과

2026-08-17. 계획의 9번 항목. **결론부터: 된다. 그것도 이 앱의 구조와 아주 잘 맞는다.**

## 무엇을 쓰나

`expo-live-activity`(Software Mansion)는 **2026-06-01자로 아카이브**됐다. 저장소가 스스로
"deprecated, `expo-widgets`를 쓰라"고 안내한다. 그러니 길은 하나다.

**`expo-widgets@57.0.10`** — 이 프로젝트의 `expo@~57.0.10`과 같은 버전 라인이고, 8/14에
갱신됐다. Expo가 SDK와 맞춰 관리한다는 뜻이다.

### alpha 여부 — 끝났다

Expo 블로그가 "alpha"라고 적어 놓아 한동안 판단이 어려웠는데, **그 글은 SDK 55 시절에
쓰인 것이다.** CHANGELOG의 alpha 버전은 전부 `55.0.0-alpha.*`(2026년 1~2월)이고, 지금
릴리스는 접미사가 없다. README도 문서를 "latest stable release"로 가리킨다.

## 핵심 — 카운트다운이 스스로 흐른다

이게 설계를 가르는 질문이었다. **답은 예다.** `@expo/ui`가 SwiftUI의 자동 갱신 API를
그대로 노출한다(`ios/TextView.swift`, `ios/ProgressView.swift`, iOS 16.0+).

```swift
Text(timerInterval:pauseTime:countsDown:)
ProgressView(timerInterval:countsDown:)
```

JS 쪽 프로퍼티도 그대로다 — `timerInterval: { lower: Date, upper: Date }`,
`pauseTime?: Date`, `countsDown?: boolean`.

**`pauseTime`이 있다는 것이 특히 중요하다.** 일시정지가 이 앱의 핵심 동작인데, 그걸
표현할 방법이 없었다면 멈출 때마다 갱신을 밀어 넣어야 했다.

## 이 앱의 세션 모델과 정확히 맞는다

세션은 이미 **절대 시각 두 개**(`zeroAt`, `pausedAt`)로만 상태를 들고 있다. Live Activity가
원하는 것이 정확히 그 꼴이다.

| Live Activity | 이 앱의 값 |
|---|---|
| `timerInterval.lower` | `zeroAt + seg.start * 1000` |
| `timerInterval.upper` | `zeroAt + (seg.start + seg.dur) * 1000` |
| `pauseTime` | `pausedAt ?? undefined` |
| `countsDown` | `true` |

**그래서 갱신은 구간이 바뀔 때만 하면 된다.** 1초마다 밀어 넣을 필요가 없다 — 초를 깎는
것은 iOS가 앱 없이 알아서 그린다. 구간 전환은 10~60초에 한 번이라 ActivityKit의 갱신
예산에도 여유가 있다.

## API

```ts
const RunActivity = createLiveActivity('RunActivity', (props, env) => {
  'widget';
  return /* @expo/ui/swift-ui 컴포넌트 */;
});

const activity = RunActivity.start({ ... }, 'intava://run');
await activity.update({ ... });
await activity.end('immediate');
```

설정 플러그인은 prebuild 때 위젯 익스텐션과 App Group을 만든다. `/ios`가 gitignore된
이 프로젝트 구조와 그대로 맞는다.

```json
["expo-widgets", {
  "groupIdentifier": "group.com.intava.app",
  "widgets": [{ "name": "RunActivity", "displayName": "운동 타이머" }]
}]
```

> ⚠️ **`enablePushNotifications`는 켜지 않는다.** 켜면 `aps-environment` 엔타이틀먼트가
> 붙는데, 이 앱은 `plugins/withoutPushEntitlement.js`로 그걸 일부러 걷어내고 있다.
> 원격 갱신 없이 로컬 갱신만으로 충분하다(위의 자동 카운트다운 덕분에).

## 남은 위험 하나

앱이 iOS에 완전히 정지되면 **구간이 바뀔 때 갱신을 못 밀어 넣는다.** 그러면 지금 구간의
카운트다운은 0까지 흐르고 거기서 멈춘 채 남는다.

실제로는 잘 안 일어난다 — 이 앱은 무음 루프와 백그라운드 오디오로 살아 있기 때문이다.
다만 그 루프가 끊기면(전화·Siri 인터럽션) 여기도 같이 어긋난다. 알림음 문제와 뿌리가
같아서, `resumeSession()` 복구가 여기에도 이롭다.

## 다음 단계 — 아직 안 했다

**설치와 빌드는 하지 않았다.** 1.1.0 검증 빌드가 도는 중이라 지금 의존성을 건드리면
그 빌드가 어긋난다. 순서는 이렇다.

1. 1.1.0 시뮬레이터 검증이 끝난 뒤
2. 별도 브랜치에서 `npx expo install expo-widgets`
3. 최소 프로토타입 — 남은 시간 하나 + 일시정지 버튼
4. `prebuild` + 개발 빌드(Expo Go에서는 안 된다)
5. **실기기**에서 잠금화면·다이내믹 아일랜드 둘 다 확인

1.1.0 범위에는 넣지 않는다. 이번 몫은 여기까지다.
