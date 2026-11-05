/**
 * 시작 화면(로고 겹, app/_layout.tsx)이 다 걷힌 순간을 알리는 신호.
 *
 * 홈 위에 뜨는 것(새 기능 팝업)은 이 뒤에 나타나야 한다 — 걷히는 동안 같이 떠오르면 홈이
 * 보일 때 이미 열려 있어, 나타나는 움직임이 보이지 않았다(사용자 지적 2026-11-05).
 */
let gone = false;
const waiters: (() => void)[] = [];

/** _layout이 로고 겹을 다 지운 뒤 부른다 */
export function markSplashGone(): void {
  if (gone) return;
  gone = true;
  waiters.splice(0).forEach((w) => w());
}

/** 이미 걷혔으면 바로 풀린다 */
export function afterSplash(): Promise<void> {
  return gone ? Promise.resolve() : new Promise((r) => waiters.push(r));
}
