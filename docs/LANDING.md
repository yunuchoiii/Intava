# 랜딩 페이지 — 작업 지침

인타바 랜딩 페이지를 고칠 때 이 문서를 먼저 읽는다.
클로드 코드에 넘길 때는 이 파일 경로만 알려주면 된다.

---

## 어디에 있고 어떻게 배포되나

| | |
|---|---|
| **원본** | 이 저장소의 `docs/` — **여기만 고친다** |
| **배포본** | 별도 저장소 `yunuchoiii/intava-pages` (기본 위치 `../intava-pages`) |
| **주소** | https://yunuchoiii.github.io/intava-pages/ |
| **배포** | `npm run pages` (→ `scripts/publish-pages.sh`) |

`intava-pages`를 직접 고치지 않는다. 거기서 고치면 다음 `npm run pages` 때 덮어써진다.

배포되는 파일은 `scripts/publish-pages.sh`의 `FILES` 배열에 박혀 있다.
새 자산을 추가하면 **그 배열에도 넣어야** 올라간다. `docs/*.md`는 내부 문서라 배포되지 않는다.

```
docs/
  index.html          랜딩 (단일 파일, CSS·JS 전부 인라인)
  privacy.html        개인정보 처리방침   ← App Store에 등록된 URL. 경로 바꾸지 말 것
  support.html        지원·FAQ           ← 같음
  og.png              1200×630 링크 미리보기 카드
  icon.png  lockup.png
  shot-warmup.webp  shot-work.webp  shot-rest.webp    ← 히어로 카드 리스트(구간 순서대로)
  shot-switch.webp  shot-cooldown.webp
  shot-records.webp                                   ← 기록 섹션
```

`privacy.html`·`support.html`의 URL은 App Store Connect와 앱 안(`src/legal/`)에 이미 등록돼 있다.
**파일명이나 경로를 바꾸면 앱 심사와 앱 안 링크가 깨진다.**

---

## 이 페이지의 목적

스레드(Threads)를 보고 온 사람을 App Store로 보내는 것. 그것 하나다.

- **유입은 대부분 모바일**, 그것도 스레드 인앱 브라우저다. 모바일이 기본, 데스크톱이 부가
- CTA는 App Store 하나뿐. 안드로이드 버전은 아직 없다
- App Store 링크: `https://apps.apple.com/kr/app/id6799622371`

---

## 절대 규칙

1. **JS가 꺼져도 모든 내용이 보여야 한다.**
   등장 애니메이션의 숨김 CSS는 `html.anim` 아래에만 둔다. 그 클래스는 `<head>`의 인라인
   스크립트가 `IntersectionObserver`와 `prefers-reduced-motion`을 확인한 뒤에만 붙인다.
   `.rv{opacity:0}`를 `.anim` 밖에 쓰는 순간 JS 실패 = 백지가 된다.

2. **없는 숫자를 쓰지 않는다.** 별점·리뷰 수·다운로드 수·"N명이 사용 중" 전부 금지.
   이 앱은 리뷰가 0개다. 가짜 후기, 로고 월, "이런 곳에 소개됨"도 마찬가지.

3. **앱에 없는 기능을 쓰지 않는다.** AI, 코칭, 개인 트레이너, 클라우드 동기화,
   애플워치 연동, 통계 그래프 — 전부 없다.

4. **외부 요청 0건.** CDN·웹폰트·라이브러리·분석 스크립트 금지. 서체는 시스템 폰트.
   같은 폴더의 이미지 8개만 참조한다.

5. **`localStorage`·`sessionStorage` 쓰지 않는다.**

6. **다크 전용.** `prefers-color-scheme` 분기를 만들지 않는다.

7. **`word-break:keep-all; overflow-wrap:break-word`** 를 `body`에 유지한다.
   빼면 한글이 어절 중간에서 끊긴다.

---

## 디자인 토큰

앱의 `src/theme.ts`와 같은 값이다. 새 색을 만들지 말고 여기서 고른다.

```
배경 #17171C   표면 #2A2A34   밴드 #1D1D24
글자 #F7F7F8 / 보조 #9A9EA6 / 흐림 #6E7279
구분선 rgba(255,255,255,0.09)
포인트 #1FB3A1, 링크·강조 #5FD8C6

구간 색(앱에서 화면 전체가 이 색으로 물든다)
웜업 #C96A1E   운동 #D32F3E   휴식 #12897C   종목전환 #2B5BD7   쿨다운 #3E6B8F
```

구간 색은 `src/theme.ts`의 `WARMUP` `WORK` `SET_REST` `BLOCK_REST` `COOLDOWN`이다.
앱에는 `PREPARE`(#B8791F) `ROUND_REST`(#6A3FD1)도 있지만 페이지에서는 쓰지 않는다.

모서리 반경 — 카드 24px, 버튼 999px(알약), 타일 14px.

---

## 이미 들어가 있는 것 (지우지 말 것)

- **OG 메타 일습** — 스레드 링크 미리보기가 이 페이지 유입의 첫인상이다.
  `og:image`는 절대 URL이어야 한다(`https://yunuchoiii.github.io/intava-pages/og.png`).
  상대 경로로 바꾸면 카드가 안 뜬다.
- `apple-itunes-app` — iOS 사파리 상단 App Store 배너. 실질 전환 기여가 제일 큰 메타다.
- JSON-LD `SoftwareApplication` — **`aggregateRating`을 넣지 않는다.** 리뷰가 0개라 거짓이 된다.
- canonical, `lang="ko"`, `theme-color`
- 스크롤 등장 — IntersectionObserver, 그룹별 시차. 카드 다섯 장은 110ms 간격으로 들어온다
- **히어로의 카드 리스트(`.deck`)** — 구간 순서대로 다섯 장을 옆으로 밀어 보는 캐러셀.
  아래 "카드 리스트" 항목을 읽고 고친다

---

## 히어로의 카드 리스트 (`.deck`)

구간 순서대로 다섯 장이다 — 웜업 → 운동 → 휴식 → 종목 전환 → 쿨다운.
아래에 같은 순서로 색 점을 찍은 범례(`.legend`)가 붙는다.

- **옆으로 밀어 본다.** `overflow-x:auto` + `scroll-snap-type:x mandatory`,
  카드마다 `scroll-snap-align:center`. 가로 스크롤은 이 상자 안에서만 일어난다
- **첫·마지막 카드도 가운데에 세우려고** 좌우 패딩을 `calc(50% - var(--cw)/2)`로 준다.
  그래서 **`.deck`에 음수 마진(화면 끝까지 흘리기)을 주면 안 된다.** 퍼센트 패딩의 기준은
  부모 폭이라, 마진으로 상자를 넓히면 첫 카드가 그만큼 왼쪽으로 어긋난다
- **가운데 카드만 크고 밝다.** `animation-timeline:view(inline)`으로 스크롤 위치에 물려 둔
  것이라 JS가 없어도 움직인다. `@supports`로 감싸 두었고, 못 읽는 브라우저에서는
  크기가 같은 평범한 캐러셀로 보인다(내용은 다 보인다)
- keyframes에 `transform:none`·`filter:none`을 쓰면 보간이 끊긴다. `rotate(0deg)`,
  `brightness(1)`처럼 **항등값을 적는다**
- 옆 카드를 죽일 때 **`opacity`를 쓰지 않는다.** 등장 애니메이션이 카드의 `opacity`를
  쓰기 때문에, 같이 쓰면 등장이 끝난 뒤 어둡기가 풀린다. 밝기(`filter`)로 죽인다
- 크기는 전부 `--cw`(카드 폭)에서 계산한다. 모바일 `clamp(160px,54vw,224px)`,
  720px 이상 `clamp(232px,28vw,292px)`
- 좌우 끝은 `mask-image`로 9%씩 흐린다. 안 하면 옆 카드가 상자 끝에서 칼로 자른 듯 끊긴다
- 모션 줄이기 설정에서는 `animation:none` + `scroll-behavior:auto`

### 카드에 넣는 이미지

**기기 프레임이 이미 그려진 목업 PNG를 그대로 쓴다.** 프레임을 벗겨 CSS 베젤(`.phone`)을
씌우지 않는다. 목업의 배경은 투명이라 그림자는 실루엣을 따라야 한다 —
사각형인 `box-shadow`는 폰 밖으로 삐져나온다. 그래서 그림자는 `img`의 `drop-shadow`로,
구간 색 번짐은 `.card::before`의 방사 그라디언트로 낸다.

`sips`는 **webp를 조용히 못 만든다**(성공한 것처럼 경로만 찍고 파일을 안 쓴다).
이 맥에는 `cwebp`도 `sharp`도 없으니, 변환할 때는 따로 받아서 쓴다.

```bash
npm i cwebp-bin              # 프로젝트 밖(임시 폴더)에 받는다
node_modules/cwebp-bin/vendor/cwebp -q 92 -alpha_q 100 -resize 620 0 목업.png -o docs/shot-x.webp
```

알파를 살려야 한다(`-alpha_q 100`). 지우면 폰 모서리 밖이 검게 찍힌다.

---

## 전에 실제로 났던 버그 두 개 — 다시 내지 말 것

**1. `padding` 단축 속성이 `.wrap`의 좌우 여백을 지웠다**

```css
.wrap     { padding: 0 24px }
.features { padding: 96px 0 0 }   /* ← 뒤에 와서 좌우까지 0으로 덮음 */
```

`<section class="features wrap">`처럼 두 클래스를 같이 쓰는 구조라, 나중 규칙에서
`padding` 단축을 쓰면 `.wrap`의 좌우 패딩이 통째로 날아간다. **세로 여백은 항상
`padding-top`/`padding-bottom`으로 쓴다.** 미디어쿼리 안에서만 맞아 있어서 큰 화면에선
멀쩡해 보였고, 그래서 한동안 못 잡았다.

**2. 번들된 HTML은 배포하면 안 된다**

디자인 도구가 뽑아주는 자체 압축 해제 HTML(6MB대, JS가 런타임에 본문을 그림)을 그대로
올리면, **진짜 `<head>`에 og 태그가 없어서 스레드 미리보기 카드가 안 뜬다.**
반드시 평문 정적 파일로 풀어서 `docs/`에 넣는다.

---

## 고친 뒤 반드시 확인할 것

로컬에서 띄우고,

```bash
python3 -m http.server 8899 --directory docs
```

아래를 전부 통과해야 한다. 눈으로 보지 말고 재서 확인한다.

1. **좌우 여백** — 320·360·390·430·600·720·900·1280px에서 본문 요소의 좌우 여백이
   16px 미만인 것이 없어야 한다
2. **가로 스크롤** — `document.documentElement.scrollWidth === clientWidth`
   (장식용 glow의 음수 `inset`이 자주 범인이다. 부모에 `overflow:hidden`)
3. **외부 요청 0건, 콘솔 에러 0건**
4. **CTA가 첫 화면 안** — 390×844에서 `a.cta`의 `bottom <= 844`
5. **JS 끔 / 모션 줄이기 상태에서 모든 내용이 보임** (opacity 1)
6. **스크롤 끝까지 내렸을 때 `.rv` 전부에 `.in`이 붙음**
7. **카드 리스트** — 처음에 첫 카드(웜업)가 가운데 서 있고, 밀면 카드마다 딱 멈추며
   가운데 것만 커진다. `.deck`은 가로로 넘치고(`scrollWidth > clientWidth`)
   페이지는 안 넘쳐야 한다

브라우저를 도구로 몰 때 주의: 탭이 백그라운드면 `document.hidden`이 참이 되어
IntersectionObserver가 늦게 울고 스크롤 연동 애니메이션도 갱신되지 않는다.
등장이 안 됐다고 오해하기 쉬우니, 눈으로 볼 때는 `.in`을 직접 붙이고 캡처한다.

플레이라이트가 있으면 크로미움 경로를 지정해 띄운다:
`chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })` (환경에 따라 다름)

이미지를 새로 넣을 때는 **폭 620px WebP(q92)** 로 줄인다. 시뮬레이터 원본 PNG는 장당 2MB가
넘어서 그대로 올리면 인앱 브라우저에서 흰 화면이 몇 초 뜬다.
현재 첫 화면이 받는 것이 303KB(그중 카드 다섯 장이 214KB)다.

---

## 배포

```bash
npm run pages                      # 복사 → 변경 요약 → 커밋 → 푸시
npm run pages -- "커밋 메시지"
PAGES_DIR=~/다른/경로 npm run pages
```

반영까지 1~2분. 그 뒤 라이브에서 위 6개를 다시 한 번 확인한다.
스레드는 링크 미리보기를 캐싱하므로, 이미 올린 링크는 `?v=2` 같은 걸 붙여야 새 카드가 뜬다.

관련: `store-listing/TODO.md`(다음 할 일), `store-listing/PROMO.md`(왜 이 문구인지)
