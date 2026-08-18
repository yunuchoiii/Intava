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
- **히어로의 카드 리스트(`.deck`)** — 구간 순서대로 다섯 장을 옆으로 밀어 보는 무한 캐러셀.
  아래 "카드 리스트" 항목을 읽고 고친다

---

## 히어로의 카드 리스트 (`.deck`)

구간 순서대로 다섯 장이다 — 웜업 → 운동 → 휴식 → 종목 전환 → 쿨다운.
구간 이름은 각 폰 아래에 색 점과 함께 붙는다(`figcaption`).

**한 화면에 모바일 세 장, 720px 이상 다섯 장.** 옆으로 밀면 한쪽으로 빠진 카드가
반대쪽에서 돌아오는 무한 캐러셀이다.

```
.deck-wrap          화면 끝까지 흘리는 상자 + 좌우 배경색 덮개(::after)
  .deck             스크롤 상자. 세로 스크롤 금지
    .track          카드 줄. JS 가 앞뒤로 한 벌씩 복제해 세 벌로 만든다
      .card         자리(폭 --cw). 아치·z-index 를 여기에
        .shot       폰 이미지. 3D 기울기·확대·밝기·투명도를 여기에
        figcaption  구간 이름. 눕지 않아야 하므로 .shot 밖에 둔다
```

- **카드는 겹치지 않는다**(`--pitch` ≈ 1). 겹쳐 두면 z-index·그림자·잘림이 서로 물려
  손볼 데가 끝없이 나온다. 깊이는 3D 기울기와 밝기로만 낸다
- **가운데가 크고 앞이고 위로 올라온다.** `animation-timeline:view(inline)` 으로
  스크롤 위치에 물려 두었다. `@supports` 로 감쌌고, 못 읽는 브라우저에서는 다섯 장이
  그냥 나란히 선다(겹치지 않으니 깨질 데가 없다)
- 무한 루프라 '가운데'가 계속 바뀐다. **`nth-child` 로 고정하지 말고** keyframes 안에서
  `z-index` 까지 같이 물린다
- **간격이 일정해 보이려면 바깥 두 장을 안쪽으로 당겨야 한다**(720px 이상, `deckArcWide`의
  `translateX`). 자리 간격은 일정한데 카드는 바깥일수록 작아지고 더 누워서, 안 당기면
  1-2·4-5 사이만 벌어진다(실측 62px 대 24px → 15.6% 당겨서 넷 다 24px).
  모바일은 세 장이라 벌어질 짝이 없다. **같은 값을 모바일에 쓰면 이웃이 가운데에 붙는다**
- keyframes에 `transform:none`·`filter:none` 을 쓰면 보간이 끊긴다.
  `rotateY(0deg)`·`brightness(1)` 처럼 **항등값을 적는다**
- `perspective()` 는 transform 안에 둔다. 상자에 `perspective` 를 걸면 스크롤 상자와
  얽혀 3D 좌표가 흔들린다
- **세로 스크롤 금지** — `overflow-y:hidden`. 그래서 아래 여백(`padding-bottom`)이
  아치로 내려간 카드와 그림자를 다 담아야 한다. 모자라면 그만큼 직선으로 잘린다.
  확인은 `deck.scrollHeight === deck.clientHeight`
- **빠르게 튕겨도 한 장만 넘어간다** — `scroll-snap-stop:always`. 없으면 관성이 여러 장을
  지나며 화면이 어지러워지고, 그 도중 되감기가 끼어들어 더 튄다
- **양쪽 끝은 배경색으로 덮어 사그라뜨린다**(`.deck-wrap::after`). 카드의 `opacity` 도
  끝에서 0이 되지만, 덮개가 있어야 화면 경계에서 잘린 자리가 안 보인다.
  덮는 폭은 `--fade-solid`/`--fade-end` 로 조절 — **넓게 덮으면 끝의 두 장이 통째로
  지워져 다섯 장이 세 장으로 보인다**
- 화면 끝까지 흘리는 음수 마진은 **`.deck` 이 아니라 `.deck-wrap` 에** 준다.
  덱에만 주면 덱이 덮개보다 넓어져서, 삐져나온 부분이 덮이지 않고 그대로 드러난다

### 무한 루프 (index.html 아래쪽 JS)

한 벌(다섯 장)을 앞뒤로 복제해 세 벌로 만들고 가운데 벌에서 시작한다.
스크롤이 0.5벌보다 왼쪽 / 1.5벌보다 오른쪽으로 가면 한 벌만큼 위치를 옮긴다 —
세 벌이 같은 그림이라 티가 나지 않는다.

- 처음엔 `setW*2`(두 벌째 시작)에서 되감으려 했는데, 스크롤이 닿는 최대치가
  `track − 상자폭` 이라 **그 지점까지 갈 수 없어 영영 안 돌았다**. 0.5~1.5벌 사이로 잡는다
- 되감기는 **스크롤이 멎은 뒤**(140ms 디바운스) 한다. 움직이는 중에 위치를 옮기면
  관성·스냅 애니메이션이 끊겨 튄다
- 복제 카드는 `aria-hidden="true"` + `alt=""`, 그리고 **`.in` 을 직접 붙인다**.
  등장 애니메이션은 원본만 관찰하므로, 안 붙이면 복제가 영영 `opacity:0` 으로 남는다
- 한 벌 폭은 되감기 때마다 다시 잰다. `resize` 를 놓쳐도 어긋나지 않게 하는 보험이다
- 모션 줄이기 설정에서는 기울기·아치 애니메이션을 모두 끈다

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

## 전에 실제로 났던 버그 세 개 — 다시 내지 말 것

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

**3. `overflow:hidden` 이 폰 그림자를 잘랐다**

기록 섹션의 `.proof-glow` 는 장식용 글로우가 페이지를 가로로 밀지 않게 `overflow:hidden`
을 걸어 둔 상자다. 그런데 그 상자가 안에 있는 폰의 `box-shadow` 까지 잘라서, 그림자가
직선으로 뚝 끊겨 보였다. **자르는 상자 안에서는 그림자가 퍼질 자리(padding)를 같이 줘야
한다.** 폰 크기가 줄지 않게 같은 만큼 음수 마진으로 물리되, 좌우는 `.wrap` 패딩(24px)
까지만 물린다 — 더 물리면 화면 밖으로 나가 페이지가 가로로 밀린다.
히어로 카드 리스트의 `padding-bottom` 도 같은 이유로 넉넉히 잡아 둔 것이다.

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
7. **카드 리스트** — 모바일 세 장, 720px 이상 다섯 장이 보인다. 밀면 카드마다 딱 멈추고,
   끝까지 밀면 반대쪽에서 같은 순서로 돌아온다. 그리고
   - `deck.scrollHeight === deck.clientHeight` (세로로 잘리는 데가 없다)
   - 페이지는 가로로 안 넘친다(덱만 넘친다)
   - 양쪽 끝에서 카드가 배경색으로 사그라진다(잘린 직선이 안 보인다)

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
