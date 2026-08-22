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

---

# 추가 조사 — 자료와 걸림돌

2026-08-22. 위 조사에서 5일 지났다. **판은 그대로다.** 다만 착수 전에 알아야 할
것이 둘 더 나왔고(아래 「걸림돌」), 만들 때 펼쳐놓고 볼 자료를 여기 모은다.

## 판이 그대로인지 다시 잼

| | 값 | 확인 |
|---|---|---|
| `expo-widgets` | **57.0.11** (2026-08-20) | `latest`에 붙어 있고 알파 접미사 없음 |
| `@expo/ui` | **57.0.12** (2026-08-20) | 같은 라인 |
| `expo-live-activity` | 0.4.2 (2026-06-01) | npm에 `deprecated` 딱지가 실제로 붙어 있다 |
| 이 프로젝트 | `expo@~57.0.10` | 같은 57 라인이라 그대로 들어간다 |

**자동 카운트다운도 지금 버전에서 다시 확인했다** — 기억이 아니라 패키지를 받아
읽었다. `@expo/ui@57.0.12`의 `ios/TextView.swift`·`ios/ProgressView.swift`에
`timerInterval`이 그대로 있고, 타입 선언에도 `timerInterval` · `countsDown` ·
`pauseTime`이 나온다.

## 볼 것

**공식**
- 위젯·라이브 액티비티 문서 — https://docs.expo.dev/versions/v57.0.0/sdk/widgets/
  (버전 박힌 주소로 본다. `/latest/`는 SDK가 올라가면 말이 달라진다)
- Expo 블로그 소개글 — https://expo.dev/blog/home-screen-widgets-and-live-activities-in-expo
  ⚠️ SDK 55 시절 글이라 "alpha"라고 적혀 있다. 개념만 읽고 API는 위 문서를 본다
- `@expo/ui` SwiftUI 컴포넌트 — https://docs.expo.dev/versions/v57.0.0/sdk/ui/

**애플**
- ActivityKit — https://developer.apple.com/documentation/activitykit
- HIG 라이브 액티비티 — https://developer.apple.com/design/human-interface-guidelines/live-activities
- `ActivityAuthorizationInfo.areActivitiesEnabled` —
  https://developer.apple.com/documentation/activitykit/activityauthorizationinfo/areactivitiesenabled

**남의 구현기** (막힐 때 대조용)
- https://fizl.io/blog/posts/live-activities
- https://kutay.boo/blog/expo-live-activity/

## API — 위 조사에서 안 적힌 것

**다이내믹 아일랜드 자리가 아홉 개다.** `banner` 하나만 있는 줄 알고 설계하면
접힌 상태에서 무엇을 보여줄지가 통째로 빠진다.

```
banner            잠금화면 · 알림센터 (주 화면)
bannerSmall       CarPlay · watchOS 대체
compactLeading    아일랜드 접힘 — 왼쪽 (아이콘 자리)
compactTrailing   아일랜드 접힘 — 오른쪽 (남은 시간 자리)
minimal           아일랜드 최소 — 다른 앱과 겹칠 때 동그라미 하나
expandedLeading / expandedCenter / expandedTrailing / expandedBottom
```

이 앱이라면 `compactTrailing`에 `Text(timerInterval)` 하나, `compactLeading`에
페이즈 색 점 하나면 접힌 상태가 끝난다.

**끝내는 방법에 정책이 붙는다.**

```ts
instance.end(dismissalPolicy?, props?, contentDate?)
// 'default' | 'immediate' | after(date) — after는 4시간 창 안에서만
```

운동이 끝나면 완료 화면으로 넘어가므로 `'immediate'`가 맞다.

**환경값** — `colorScheme` · `isLuminanceReduced`(화면 어두울 때) ·
`isActivityFullscreen` · `activityFamily`(iOS 18+) · `levelOfDetail`(iOS 26+).
`isLuminanceReduced`는 잠금화면 상시표시(AOD)에서 참이 된다. 페이즈 색을 그대로
쓰면 번져 보이므로 여기서 한 단계 죽이는 것이 맞다.

**플러그인 옵션**에 `bundleIdentifier`(익스텐션용, 앱과 달라야 한다)가 더 있다.
`NSSupportsLiveActivities`는 플러그인이 알아서 넣는다.

## 애플 쪽 제약

- **iOS 16.1+**. 그 아래에서는 아예 없는 기능이다
- **최대 8시간 활성**, 사용자가 안 지우면 잠금화면에 4시간 더 남는다.
  운동은 길어야 두 시간이라 걸릴 일이 없다
- **사용자가 설정에서 끌 수 있다.** 켜져 있는지 물어보는 API가
  `ActivityAuthorizationInfo.areActivitiesEnabled`다 — 꺼져 있으면 `start()`가
  실패한다. 실패를 삼키지 말고 조용히 넘어가되 로그는 남길 것
- 갱신 예산은 **원격(APNs) 갱신에만** 걸린다. 우리는 앱에서 로컬로만 밀어 넣고,
  그마저 구간 전환 때(10~60초에 한 번)뿐이라 해당 없다

## ⚠️ 걸림돌 — 착수 전에 알아야 할 둘

### 1. ProgressView에는 `pauseTime`이 없다

`@expo/ui@57.0.12`의 `ProgressView.swift`를 읽어 확인했다. `timerInterval`과
`countsDown`은 있는데 **`pauseTime`은 `Text`에만 있다.** 그대로 두면 일시정지
중에도 막대가 계속 차오른다.

피하는 길은 있다. `ProgressView`에 `value`(0~1)를 주는 갈래가 따로 있으므로,
멈춘 동안만 정지한 비율로 갈아 끼운다.

```tsx
paused
  ? <ProgressView value={ratio} />                       // 멈춤 — 그 자리에 굳는다
  : <ProgressView timerInterval={{ lower, upper }} />    // 흐름 — iOS가 그린다
```

`pauseTime`이 있는 `Text` 쪽과 갈래가 갈리므로, 프로토타입에서 **일시정지를
가장 먼저** 확인할 것.

### 2. 스피너가 내용 위를 덮는 버그 — 우리 사용 사례에 정확히 걸린다

expo/expo **#44543** — iOS가 레이아웃을 다시 계산할 때 위젯 익스텐션이 JS 번들을
다시 읽는데, 이게 간헐적으로 실패해서 **로딩 스피너가 내용 위에 겹친다.** 시작
2~20초 뒤부터 나타난다고 보고돼 있다. 열려 있고(담당 jakex7) 우회로도 없다.

라이브 액티비티는 **30분 내내 떠 있는 것**이라 재계산을 수없이 겪는다. 짧게
뜨는 배달 알림보다 이 버그에 훨씬 크게 노출된다. **프로토타입에서 제일 먼저 잴
것이 이것이다** — 실기기에서 20~30분 띄워두고 스피너가 뜨는지 본다. 뜨면 그
시점에 결정을 다시 한다.

`expo-widgets`는 아직 젊다. CHANGELOG를 보면 주 단위로 패치가 나오고 **08-20에도
"빈 위젯" 렌더링 버그를 고쳤다**(#47888). 나쁜 신호는 아니지만 — 활발히 고쳐지고
있다는 뜻이다 — 1.2에 넣을 기능이라면 그만큼 여유를 두고 재야 한다.

### 막혔을 때의 뒷길

위 버그에 걸려 못 쓰게 되면, 위젯 UI를 **Swift로 직접** 쓰는 길이 있다. 둘 다
`/ios`가 gitignore된 이 구조와 맞는 설정 플러그인이다.

- `react-native-widget-extension` (bndkt) — 위젯 폴더를 Swift로 두고 플러그인이
  타깃을 만든다. `frequentUpdates` 옵션이 있다
- `@bacons/apple-targets` — 더 일반적인 타깃 등록기. 익스텐션 파일을 Xcode에서
  바로 고칠 수 있다

JS 번들을 익스텐션에서 돌리지 않으므로 #44543 같은 부류가 원천적으로 없다.
대신 SwiftUI를 직접 쓰게 되고, 앱과 위젯 사이 값 전달을 App Group에 직접 써야 한다.

## 착수 순서 (갱신)

1. 별도 브랜치. `npx expo install expo-widgets`
2. `app.json`에 플러그인 — `groupIdentifier: "group.com.intava.app"`,
   `bundleIdentifier: "com.intava.app.widgets"`, `enablePushNotifications`는 **끈다**
   (`plugins/withoutPushEntitlement.js`와 정면으로 부딪힌다)
3. `npx expo prebuild -p ios --clean` → `./scripts/ios.sh Debug`
4. **최소 프로토타입 — 순서가 중요하다.** 예쁘게 만들기 전에 위험부터 잰다
   1. `banner`에 `Text(timerInterval)` 하나. 흐르는가
   2. 일시정지 — `pauseTime`이 듣는가, `ProgressView`는 굳는가 (걸림돌 1)
   3. **20~30분 띄워두고 스피너가 뜨는가** (걸림돌 2)
   4. 그다음에야 아일랜드 아홉 자리와 색을 짠다
5. 실기기에서 잠금화면·다이내믹 아일랜드 둘 다. 시뮬레이터로는 아일랜드가 안 잡힌다

1.1.0에는 안 넣는다. 이 문서를 들고 별도 브랜치에서 시작한다.
