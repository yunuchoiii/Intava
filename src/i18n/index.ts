/**
 * 다국어 — 한국어 · 영어 · 일본어 · 중국어(간체).
 *
 * 언어는 기기 설정을 따른다. iOS는 「설정 → 인타바 → 언어」에서 이 앱만 다른
 * 언어로 바꿀 수 있는데, 그 경우 앱이 재시작되면서 expo-localization이 바뀐
 * 언어를 돌려준다. 그래서 실행 중에 언어가 바뀌는 경우는 없고, 화면들은
 * 훅 없이 t()를 그대로 불러 쓴다.
 */
import 'intl-pluralrules'; // 영어 단·복수 판별 — 구형 엔진에 Intl.PluralRules가 없을 수 있다
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './en';
import { ja } from './ja';
import { ko } from './ko';
import { zh } from './zh';

const FALLBACK = 'ko';
const RESOURCES = {
  ko: { translation: ko },
  en: { translation: en },
  ja: { translation: ja },
  zh: { translation: zh },
} as const;

type Supported = keyof typeof RESOURCES;

function deviceLanguage(): Supported {
  try {
    // 네이티브 모듈이라, 이 기능이 들어가기 전에 만든 개발 빌드에서는 없을 수 있다.
    // 언어 하나 때문에 앱 전체가 죽으면 안 되므로 없으면 기본 언어로 간다.
    const { getLocales } = require('expo-localization') as typeof import('expo-localization');
    for (const locale of getLocales()) {
      const code = locale.languageCode?.toLowerCase();
      if (code && code in RESOURCES) return code as Supported;
    }
  } catch {
    // 무시하고 기본 언어
  }
  return FALLBACK;
}

void i18n.use(initReactI18next).init({
  resources: RESOURCES,
  lng: deviceLanguage(),
  fallbackLng: FALLBACK,
  // 문장 안의 이름·숫자를 그대로 넣는다. HTML이 아니므로 이스케이프하지 않는다
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** 화면·엔진 어디서나 쓰는 번역 함수 */
export function t(key: string, vars?: Record<string, unknown>): string {
  return i18n.t(key, vars ?? {}) as string;
}

export const currentLanguage = (): Supported => (i18n.language as Supported) ?? FALLBACK;

export default i18n;
