# 출시 절차 — iOS (App Store)

EAS 클라우드 빌드를 쓴다. **맥에서 굽지 않는 이유는 CPU다** — 네이티브 빌드가
M5를 통째로 물고 가면 빌드가 도는 동안 맥으로 다른 일을 할 수 없다. EAS는
Expo 서버에서 굽고 App Store Connect까지 올려준다.

`/ios`·`/android`는 gitignore돼 있다(관리형·CNG). EAS 서버가 `expo prebuild`를
새로 돌리므로 아이콘·스플래시·다국어가 `app.json` 기준으로 매번 깨끗하게
생성된다 — 로컬의 옛 네이티브 자산이 섞여 들어갈 일이 없다.

## 값이 어디에 있나

| 값 | 자리 |
|---|---|
| 버전 (`1.0.0`) | `app.json` → `expo.version` |
| 빌드 번호 (`2`) | `app.json` → `expo.ios.buildNumber` |
| 번들 ID | `app.json` → `expo.ios.bundleIdentifier` = `com.intava.app` |
| ASC 앱 ID | `eas.json` → `submit.production.ios.ascAppId` = `6799622371` |
| 애플 팀 ID | `eas.json` → `submit.production.ios.appleTeamId` = `9A66V5LDFK` |

**`appVersionSource`는 `local`이다.** 버전·빌드 번호의 주인은 `app.json`이고
EAS 서버가 아니다. `autoIncrement`도 꺼 뒀다 — 빌드 번호는 손으로 올린다.
iOS가 부팅 화면을 앱 버전 단위로 캐시하기 때문에 이 숫자는 스플래시를 갈 때도
함께 올려야 하는 값이라, 자동으로 움직이면 그 규칙이 어긋난다.

## 처음 한 번만

```bash
npx eas-cli login
```

```bash
npx eas-cli init
```

`init`은 Expo 서버에 프로젝트를 만들고 `app.json`에 `extra.eas.projectId`를
적어 넣는다. 이 변경은 커밋해야 한다.

## 올릴 때마다

**1. 빌드 번호를 올린다** (첫 업로드면 건너뛴다 — 지금은 `2`이고 아직 올린 것이
없다). 같은 버전에 같은 빌드 번호를 두 번 올릴 수는 없다.

**2. 굽는다.**

```bash
npx eas-cli build --platform ios --profile production
```

처음 돌리면 서명 자격을 묻는다. **EAS가 알아서 만들게 두면 된다**(애플 로그인
필요). 배포 인증서와 프로비저닝 프로파일을 만들어 Expo에 보관하고, 다음부터는
묻지 않는다.

푸시 알림 자격은 **켜지 않는다.** 이 앱은 로컬 알림만 쓴다 —
`plugins/withoutPushEntitlement.js`가 `aps-environment`를 걷어낸다.

**3. 올린다.**

```bash
npx eas-cli submit --platform ios --latest
```

`--latest`는 방금 구운 것을 집는다. 애플 앱 암호(app-specific password)나
App Store Connect API 키를 묻는다.

**4. App Store Connect에서 마무리.** 업로드된 빌드는 처리에 10~30분 걸린다.
처리가 끝나면 「배포」 → iOS 앱 버전에서 그 빌드를 고르고 「심사에 추가」.

## 아직 남은 것

- **스크린샷** — 6.5" 디스플레이용. 시뮬레이터 원본 5장은 찍어 뒀고
  (홈·운동중·휴식중·운동기록·루틴편집), 마케팅 문구를 얹는 작업이 남았다.
- **연령 등급 · 카테고리** — App Store Connect 「앱 정보」에서. 1차 카테고리는
  건강 및 피트니스.
- **앱이 수집하는 개인정보** — 이 앱은 아무것도 모으지 않는다(서버 없음,
  로그인 없음, 분석 SDK 없음). 「데이터를 수집하지 않음」으로 답한다.

## 이번 출시 범위

**한국어 스토어만.** `store-listing/ko.md`의 문구를 쓴다. 영어·일본어·중국어
등록정보(`en.md`·`ja.md`·`zh-Hans.md`)는 써 뒀지만 이번에는 올리지 않는다.

앱 자체는 여전히 4개 언어를 지원한다(`app.json`의 `CFBundleLocalizations`).
스토어 등록정보의 언어와 앱 안의 언어는 별개다 — 영어권 사용자가 받아도 앱은
영어로 뜬다.
