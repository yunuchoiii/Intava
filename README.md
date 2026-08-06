# 인타바 (Intava)

운동용 인터벌 타이머. 운동·휴식 시간과 반복 횟수를 미리 설정해두면 화면을 보지 않아도
소리·진동·잠금화면 알림으로 다음 동작을 알려준다.

핵심 성공 조건은 **"휴대폰을 주머니에 넣거나 화면을 끈 상태에서도 정확히 울린다"**.

- React Native + Expo SDK 57 (expo-router)
- 다크 전용 · 한국어
- 백엔드 없음 — AsyncStorage 로컬 저장만

## 실행

배경 오디오 모드와 커스텀 알림 채널이 필요하므로 **Expo Go로는 동작하지 않는다.** 개발 빌드로 실행한다.

```bash
npm install
npx expo run:ios     # 또는 npx expo run:android
```

CocoaPods가 `Encoding::CompatibilityError`로 실패하면 로케일을 UTF-8로 지정한다.

```bash
cd ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install
```

알림음(`assets/sounds/*.wav`)은 생성물이다. 톤을 바꾸려면 `scripts/gen-sounds.js`를 고치고 다시 만든다.

```bash
npm run sounds
```

## 구조

```
app/                 expo-router 화면
  index.tsx          홈 — 루틴/타이머 2탭, 한 번의 탭으로 실행
  edit.tsx           루틴 편집 · 타이머 편집(축소 상태)
  run.tsx            실행 화면 — 이 앱의 심장
  done.tsx           완료
  settings.tsx       전역 설정
src/
  types.ts           Block · Preset · Settings · Segment
  store.tsx          AsyncStorage 저장소 (스키마 버전 포함)
  theme.ts           디자인 토큰 (색·반경·엘리베이션)
  copy.ts            ⓘ 툴팁 문구
  audio.ts           계층 1 — 오디오 세션 · 알림음
  notify.ts          계층 2 — 로컬 알림 예약 · Android 채널
  feedback.ts        계층 3 — 진동 + 소리 묶음
  engine/
    segments.ts      구간 전개 규칙 · 총 소요 시간
    labels.ts        문구 (용어 적응 포함)
    useRunner.ts     절대 시각 기반 타이머
  components/        Ring · PhaseFlood · WheelPicker · BlockSheet · BlockList …
```

## 타이밍

`setInterval`로 1초씩 빼지 않는다. 시작 시점에 루틴 전체를 구간 배열로 펼치고,
매 250ms마다 `elapsed = now - startedAt - 누적 일시정지`를 다시 구해 그 offset이 속한 구간을 찾는다.
백그라운드에 다녀와 여러 구간을 건너뛴 경우까지 자동으로 복구된다.
`requestAnimationFrame`은 쓰지 않는다 — 화면이 꺼지면 콜백이 멈춘다.

핸드오프의 검증 예시와 값이 일치한다.

| 루틴 | 총 시간 | 순수 운동 |
|---|---|---|
| 전신 서킷 (3종목 2라운드) | 23분 0초 | 12분 20초 |
| 타바타 (20/10×8) | 4분 0초 | 2분 40초 |

## 백그라운드 전략

1. **오디오 세션** — `UIBackgroundModes: ["audio"]` + 무음 루프로 JS 타이머를 살려둔다.
2. **로컬 알림** — 구간 전환 시각을 절대 시각으로 미리 예약(가까운 60개까지, iOS 64개 제한).
   시작·재개·구간 이동·백그라운드 전환마다 전부 취소 후 재생성한다.
3. **진동** — 포그라운드는 `expo-haptics`, 백그라운드는 Android 알림 채널의 패턴에 위임.

**다른 앱의 음악을 절대 멈추거나 줄이지 않는다** — `interruptionMode`는 항상 `mixWithOthers`.
알림음은 음악의 중저역을 피해 2~3kHz대의 짧고 날카로운 톤으로 만들었다.

## 아직 하지 않은 것

- Live Activity(다이내믹 아일랜드), Android 포그라운드 서비스
- 운동 기록·통계, 계정·동기화, 워치 연동
- 블록 복제
