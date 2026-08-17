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
  shot-work.webp  shot-rest.webp  shot-records.webp
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
   같은 폴더의 이미지 6개만 참조한다.

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
운동 #D32F3E   휴식 #12897C   웜업 #C96A1E   종목전환 #2B5BD7
```

모서리 반경 — 카드 24px, 버튼 999px(알약), 타일 14px.

---

## 이미 들어가 있는 것 (지우지 말 것)

- **OG 메타 일습** — 스레드 링크 미리보기가 이 페이지 유입의 첫인상이다.
  `og:image`는 절대 URL이어야 한다(`https://yunuchoiii.github.io/intava-pages/og.png`).
  상대 경로로 바꾸면 카드가 안 뜬다.
- `apple-itunes-app` — iOS 사파리 상단 App Store 배너. 실질 전환 기여가 제일 큰 메타다.
- JSON-LD `SoftwareApplication` — **`aggregateRating`을 넣지 않는다.** 리뷰가 0개라 거짓이 된다.
- canonical, `lang="ko"`, `theme-color`
- 스크롤 등장 — IntersectionObserver, 그룹별 시차. 운동/휴식 폰 두 장은 130ms 간격으로
  들어온다(색이 바뀐다는 걸 등장 순서로도 말한다)

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

플레이라이트가 있으면 크로미움 경로를 지정해 띄운다:
`chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })` (환경에 따라 다름)

이미지를 새로 넣을 때는 **폭 620px WebP(q92)** 로 줄인다. 시뮬레이터 원본 PNG는 장당 2MB가
넘어서 그대로 올리면 인앱 브라우저에서 흰 화면이 몇 초 뜬다. 현재 페이지 전체가 228KB다.

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
