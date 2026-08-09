/**
 * 앱 안에서 읽는 문서 — 개인정보 처리방침과 지원.
 *
 * **웹이 아니라 앱 안에 둔다.** 이 앱은 네트워크를 하나도 쓰지 않는다. 그런
 * 앱의 방침을 읽으려고 인터넷이 필요하면 앞뒤가 맞지 않고, 비행기 모드에서
 * 빈 화면이 뜬다. 기기 안에 있으면 언제든 읽힌다.
 *
 * 대신 문구를 고칠 때는 앱을 새로 올려야 한다. 방침은 앱이 하는 일이 바뀔 때만
 * 바뀌고, 그때는 어차피 새 판을 올리는 참이라 치를 만한 값이다.
 *
 * **웹 페이지(docs/·intava-pages)와 같은 말을 해야 한다.** App Store Connect가
 * URL을 따로 요구하므로 둘은 함께 산다 — 한쪽을 고치면 다른 쪽도 고친다.
 */

export type LegalSection = {
  heading: string;
  /** 문단들 — 빈 줄로 갈린 덩어리 하나가 한 칸 */
  body?: string[];
  /** 항목 목록. 문단 뒤에 온다 */
  bullets?: string[];
};

export type LegalDoc = {
  title: string;
  /** 방침에만 있다 — 언제 판이 바뀌었는지 */
  updated?: string;
  /** 제목 바로 아래 한 줄. 문서 전체를 한마디로 줄인 것 */
  lead?: string;
  sections: LegalSection[];
  /** 맨 아래 — 문의처 */
  contact: { label: string; email: string };
};

export type LegalKind = 'privacy' | 'support';
export type LegalPack = Record<LegalKind, LegalDoc>;
