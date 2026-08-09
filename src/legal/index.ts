/**
 * 지금 언어의 문서를 고른다.
 *
 * i18n 카탈로그에 넣지 않은 이유: 저기는 화면에 박히는 짧은 말들의 자리다.
 * 긴 산문이 섞이면 어느 줄이 버튼이고 어느 줄이 문단인지 구분이 사라지고,
 * 한 문장을 고치려고 수백 줄짜리 파일을 뒤지게 된다. 문서는 문서끼리 둔다.
 */
import { currentLanguage } from '../i18n';
import { en } from './en';
import { ja } from './ja';
import { ko } from './ko';
import { zh } from './zh';
import type { LegalKind, LegalPack } from './types';

const PACKS: Record<string, LegalPack> = { ko, en, ja, zh };

export function legalDoc(kind: LegalKind) {
  return (PACKS[currentLanguage()] ?? en)[kind];
}

export type { LegalDoc, LegalKind, LegalSection } from './types';
