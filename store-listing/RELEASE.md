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

**`appVersionSource`는 `remote`다** (`a31b416`에서 바뀌었다). `version`의 주인은
`app.json`이지만 **빌드 번호의 주인은 EAS 서버**이고, `production` 프로파일은
`autoIncrement: true`라 구울 때마다 알아서 1씩 오른다. 손으로 올리는 한 잊으면
업로드가 거부되고 두 플랫폼이 어긋나기 때문이다 — 실제로 iOS는 2인데 안드로이드는
1이었던 적이 있다.

`app.json`의 `buildNumber` / `versionCode`는 이제 **최종 번호가 아니라 원격 카운터의
출발점**이다. 최종 번호는 빌드 로그와 `eas build:version:get`에서 본다.

> ⚠️ **원격 카운터가 저절로 초기화되지는 않았다.** 2026-08-30에 확인했더니
> `build:version:get`이 *"No remote versions are configured"* 였다. 이 상태로 구우면
> EAS가 초기값을 대화형으로 묻고, 답하지 않으면 빌드가 죽는다. 그러니 **처음 한
> 번은 손으로 못박는다** — 이미 App Store에 build 2를 올렸으므로 2로 세워야
> 다음 빌드가 3이 된다.
>
> ```bash
> npx eas-cli build:version:set --platform ios   # 물으면 2
> ```
>
> 이 명령은 값을 인자로 못 받는다(대화형 프롬프트뿐). 자동화 안에서는 못 돌린다.

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

**1. 버전을 올린다.** `app.json`의 `expo.version`. 빌드 번호는 **손대지 않는다** —
EAS가 원격에서 올린다(위 표 참고). 굽고 나면 로그에 찍힌 번호를 눈으로 확인한다.

올린 뒤 그 자리에 태그를 단다. 태그가 없으면 어떤 코드가 어느 빌드에 들어갔는지
되짚을 방법이 없다.

```bash
git tag v1.2.0 && git push origin v1.2.0
```

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
