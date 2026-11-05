/**
 * 새 기능 팝업 — 시안 「라이브 액티비티 출시 팝업」 2a의 틀(위 미리보기 판 + 제목 · 설명 · 줄 · 버튼).
 *
 * 1.5.1~1.5.2는 라이브 액티비티를 알렸고, 1.6.0부터는 같은 틀로 **스토리 공유 카드**를 알린다
 * (사용자 결정 2026-11-03). 본 표시 키가 따로라(KEY_SEEN_SHARE_ANNOUNCE) 라이브 액티비티 팝업을
 * 본 사람에게도 한 번 뜬다.
 *
 * 설치(업데이트 포함) 뒤 **한 번만** 홈 위에 띄운다. 「확인」을 누르면 기기에 적어 두고
 * 다시 띄우지 않는다. 운동이 돌고 있지 않을 때만 — 앱을 껐다 켜서 실행 화면이 복원되는
 * 자리에 팝업이 그 위를 덮으면 안 된다.
 *
 * 미리보기는 시안 「1.5.3 · 스토리 공유 카드 팝업」 3a(다섯 장 부채) — 캡처가 아니라 실제 공유 카드를
 * 예시 기록으로 줄여 그린다. 네 언어 모두 그 언어로 나온다. 아래의 IslandPill · LockCard · PreviewGlow는 온보딩이 쓴다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { t } from '../i18n';
import { TABULAR } from '../theme';
import { afterSplash } from '../splash';
import { KEY_SEEN_SHARE_ANNOUNCE } from '../store';
import type { WorkoutRecord } from '../types';
import { Portal } from './Overlay';
import { PressBox } from './PressBox';
import { StoryCard, type StoryTemplate } from './StoryCards';
import { SHARE_H, SHARE_W, ShareImage } from './WorkoutCard';

const KEY = KEY_SEEN_SHARE_ANNOUNCE;
const RED = '#FF4D5E';
const TEAL = '#2BD9C3';

/** 다이내믹 아일랜드가 있는 기종 — 상단 안전 영역이 59pt 안팎이다(노치는 47~50) */
export const ISLAND_MIN_INSET = 54;

export function NewsAnnounce({ blocked }: { blocked: boolean }) {
  const [show, setShow] = useState(false);
  /** 커지기가 끝났다 — 배율을 걷어 낸다(배율이 걸린 채면 안의 글자가 흐려질 수 있다) */
  const [settled, setSettled] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const grow = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    if (blocked) return;
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (alive && v == null) setShow(true);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [blocked]);

  /*
    시작 화면이 다 걷히고 홈이 보인 뒤에 나타난다 — 걷히는 동안 같이 떠오르면 홈이 보일 때 이미
    열려 있었다(사용자 지적). 바탕은 서서히, 카드는 작게서 제자리로 커지며.
  */
  useEffect(() => {
    if (!show) return;
    let alive = true;
    void afterSplash().then(() => {
      if (!alive) return;
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 280, delay: 250, useNativeDriver: true }),
        Animated.spring(grow, { toValue: 1, delay: 250, damping: 16, stiffness: 180, mass: 0.9, useNativeDriver: true }),
      ]).start(({ finished }) => finished && alive && setSettled(true));
    });
    return () => {
      alive = false;
    };
  }, [show, fade, grow]);

  // 띄운 뒤에 운동이 되살아나면(복원이 늦게 끝나면) 거둔다 — 본 것으로 적지는 않는다
  if (!show || blocked) return null;

  const close = () => {
    void AsyncStorage.setItem(KEY, '1').catch(() => undefined);
    Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setShow(false));
  };

  return (
    <Portal>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        <Card onClose={close} scale={settled ? undefined : grow} />
      </Animated.View>
    </Portal>
  );
}

function Card({ onClose, scale }: { onClose: () => void; scale?: Animated.Value }) {
  const [box, setBox] = useState({ width: 0, height: 0 });

  return (
    <View style={styles.backdrop}>
      <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,4,6,0.66)' }]} />
      <Animated.View style={[styles.modal, scale && { transform: [{ scale }] }]}>
        {/* 바탕 Svg는 숫자로 크기를 준다 — 100%로 두면 판의 오른쪽·아래가 비었다 */}
        <View style={styles.preview} onLayout={(e) => setBox(e.nativeEvent.layout)}>
          <PreviewGlow w={box.width} h={box.height} />
          <CardFan width={box.width} />
        </View>

        <View style={styles.body}>
          <View style={{ gap: 8 }}>
            <Text style={styles.kicker}>{t('announce.kicker')}</Text>
            <Text style={styles.title} lineBreakStrategyIOS="hangul-word">{t('announce.title')}</Text>
            <Text style={styles.desc} lineBreakStrategyIOS="hangul-word">{t('announce.desc')}</Text>
          </View>
          <View style={styles.rule} />
          <View style={{ gap: 14 }}>
            <Row icon={<PhotoGlyph />} title={t('announce.rowPhoto')} />
            <Row icon={<CardsGlyph />} title={t('announce.rowCards')} />
          </View>
          <PressBox onPress={onClose} haptic="tap" radius={16} scaleTo={0.97} dim={0.1} accessibilityLabel={t('announce.ok')}>
            <LinearGradient colors={['#FFFFFF', '#E4E7EC']} style={styles.button}>
              <Text style={styles.buttonText}>{t('announce.ok')}</Text>
            </LinearGradient>
          </PressBox>
        </View>
      </Animated.View>
    </View>
  );
}

/** 미리보기 카드에 넣을 예시 기록 — 56:26, 운동 15:00, 6종목 30세트 */
function sampleRecord(): WorkoutRecord {
  const start = new Date();
  start.setHours(8, 36, 0, 0);
  const names = t('announce.sampleBlocks').split('|');
  return {
    id: 'announce',
    presetId: 'announce',
    presetName: t('announce.cardName'),
    startedAt: start.getTime(),
    endedAt: start.getTime() + 3386_000,
    totalSec: 3386,
    workSec: 900,
    completedSets: 30,
    completed: true,
    shape: '',
    blocks: names.map((name, i) => ({ name, spec: '', durSec: [600, 600, 563, 600, 594, 419][i] ?? 600 })),
    segs: [],
  };
}

/** 사진 카드 두 장의 예시 사진(Unsplash, 360×640) — 어두운 카드들과 색으로 갈리게 */
const PHOTO_A = Image.resolveAssetSource(require('../../assets/announce/photo-a.jpg')).uri;
const PHOTO_C = Image.resolveAssetSource(require('../../assets/announce/photo-c.jpg')).uri;

/** 시안 3a의 판 폭(393pt 폰) — 위치·크기를 이 폭 기준으로 적고 실제 폭에 비례해 늘인다 */
const FAN_W = 317;
const FAN_H = 262;
const FAN_K = 0.32;

/** 뒤에서 앞으로 — 시안 3a 「다섯 장 부채」(left · top · 기울기) */
const FAN: { kind: 'base' | StoryTemplate; left: number; top: number; rot: number; photo?: string }[] = [
  { kind: 'base', left: 8.9, top: 40, rot: -14 },
  { kind: 'typePoster', left: 192.9, top: 40, rot: 14 },
  { kind: 'ringHero', left: 52.9, top: 22, rot: -7 },
  { kind: 'photoStrip', left: 148.9, top: 22, rot: 7, photo: PHOTO_C },
  { kind: 'photoStack', left: 100.9, top: 14, rot: 0, photo: PHOTO_A },
];

/**
 * 카드 다섯 장 부채 — 시안 3a. 모두 불투명, 맨 앞은 사진 카드.
 * 크기·기울기는 고정 transform이다 — 고정이면 글자가 또렷하다(스크롤에 맞춰 바뀌는 배율만 깨졌다).
 */
function CardFan({ width }: { width: number }) {
  const record = React.useMemo(sampleRecord, []);
  if (!width) return <View style={{ height: FAN_H }} />;
  const z = width / FAN_W;
  const k = FAN_K * z;
  const w = SHARE_W * k;
  const h = SHARE_H * k;
  return (
    <View style={{ width, height: FAN_H * z }}>
      {FAN.map((c, i) => {
        const front = i === FAN.length - 1;
        return (
          <View
            key={c.kind}
            style={[
              front ? styles.fanFront : styles.fanBack,
              {
                position: 'absolute',
                left: c.left * z,
                top: c.top * z,
                width: w,
                height: h,
                borderRadius: 7,
                transform: [{ rotate: `${c.rot}deg` }],
                transformOrigin: '50% 100%',
              },
            ]}
          >
            <View style={[styles.fanClip, front && { borderColor: 'rgba(255,255,255,0.14)' }]}>
              <View style={{ width: SHARE_W, height: SHARE_H, transform: [{ scale: k }], transformOrigin: 'top left' }}>
                {c.kind === 'base' ? (
                  <ShareImage record={record} />
                ) : (
                  <StoryCard template={c.kind} record={record} photo={c.photo} />
                )}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** 사진 — 시안 3a의 줄 아이콘 */
function PhotoGlyph() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#F7F7F8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={3} y={3} width={18} height={18} rx={4} />
      <Circle cx={9} cy={9} r={1.8} />
      <Path d="M21 15.5l-5-5L5 21" />
    </Svg>
  );
}

/** 겹친 카드 — 시안 3a의 줄 아이콘 */
function CardsGlyph() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#F7F7F8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={7} y={3} width={12} height={16} rx={2.5} />
      <Path d="M4 7v11.5A2.5 2.5 0 0 0 6.5 21H14" />
    </Svg>
  );
}

/** 아이콘 + 이름 한 줄 — 설명은 위의 한 문단이 맡는다(사용자 결정) */
function Row({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.iconBox}>{icon}</View>
      <Text style={[styles.rowTitle, { flex: 1 }]}>{title}</Text>
    </View>
  );
}

/** 미리보기 판 — 위는 운동(빨강), 아래는 휴식(청록)이 번진다. 그림 순서와 아래 줄 순서가 같다 */
export function PreviewGlow({ w, h }: { w: number; h: number }) {
  if (!w || !h) return null;
  return (
    <Svg style={StyleSheet.absoluteFill} width={w} height={h}>
      <Defs>
        <RadialGradient id="annR" cx="0.5" cy="0" rx="0.9" ry="0.5">
          <Stop offset="0" stopColor={RED} stopOpacity={0.2} />
          <Stop offset="0.7" stopColor={RED} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="annT" cx="0.5" cy="1" rx="1" ry="0.5">
          <Stop offset="0" stopColor={TEAL} stopOpacity={0.16} />
          <Stop offset="0.7" stopColor={TEAL} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width={w} height={h} fill="url(#annR)" />
      <Rect x="0" y="0" width={w} height={h} fill="url(#annT)" />
    </Svg>
  );
}

/**
 * 링 — 라이브 액티비티와 같이 좌우를 뒤집어, 남은 호가 12시에서 끝나고 머리가
 * 시계방향으로 전진하게 그린다(TimerActivity.tsx와 같은 모양).
 */
function MiniRing({ size, stroke, color, track, remain }: { size: number; stroke: number; color: string; track: string; remain: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, transform: [{ scaleX: -1 }, { rotate: '-90deg' }] }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - remain)}
        />
      </Svg>
    </View>
  );
}

/** 접힌 아일랜드 — 왼쪽 링, 오른쪽 남은 시간(운동 구간) */
export function IslandPill() {
  return (
    <View style={styles.pill}>
      <MiniRing size={22} stroke={3.4} color={RED} track="rgba(211,47,62,0.3)" remain={0.7} />
      <Text style={[styles.pillTime, TABULAR]}>0:39</Text>
    </View>
  );
}

/**
 * 잠금화면 카드 — 실제 배너를 1110pt 폭 기준으로 그린 시안 값을 폭에 맞춰 줄인 것.
 * 휴식 구간이라 「다음에 무엇을 하는지」가 바로 읽힌다.
 */
export function LockCard({ width }: { width: number }) {
  const k = width / 1110;
  const ring = 156 * k;
  return (
    <View
      style={{
        width,
        borderRadius: 78 * k,
        overflow: 'hidden',
        paddingTop: 54 * k,
        paddingBottom: 52 * k,
        paddingHorizontal: 60 * k,
        gap: 46 * k,
        backgroundColor: '#000000',
      }}
    >
      <Svg style={StyleSheet.absoluteFill} width={width} height={1000}>
        <Defs>
          <RadialGradient id="annLock" cx={138 * k} cy={144 * k} r={690 * k} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={TEAL} stopOpacity={0.32} />
            <Stop offset={String(210 / 690)} stopColor={TEAL} stopOpacity={0.13} />
            <Stop offset={String(450 / 690)} stopColor={TEAL} stopOpacity={0.04} />
            <Stop offset="1" stopColor={TEAL} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={1000} fill="url(#annLock)" />
      </Svg>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 42 * k }}>
        <MiniRing size={ring} stroke={18 * k} color={TEAL} track="rgba(18,137,124,0.34)" remain={0.62} />
        <View style={{ flex: 1, minWidth: 0, gap: 9 * k }}>
          <Text style={{ fontSize: 36 * k, fontWeight: '800', letterSpacing: 36 * k * 0.16, color: TEAL }} numberOfLines={1}>
            {t('phase.SET_REST')}
          </Text>
          <Text style={{ fontSize: 50 * k, fontWeight: '700', color: '#FFFFFF' }} numberOfLines={1}>
            {t('live.next', { what: t('announce.sampleName') })}
          </Text>
          <Text style={{ fontSize: 37 * k, fontWeight: '600', color: 'rgba(255,255,255,0.6)' }} numberOfLines={1}>
            {t('sub.setsRounds', { set: 1, sets: 4, round: 1, rounds: 1 })}
          </Text>
        </View>
        <Text style={[{ fontSize: 104 * k, fontWeight: '800', letterSpacing: -104 * k * 0.04, color: TEAL }, TABULAR]}>
          1:09
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 30 * k }}>
        <View style={{ flex: 1, height: 15 * k, borderRadius: 8 * k, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' }}>
          <View style={{ width: '14%', height: '100%', borderRadius: 8 * k, backgroundColor: TEAL }} />
        </View>
        <Text style={[{ fontSize: 36 * k, fontWeight: '600', color: 'rgba(255,255,255,0.6)' }, TABULAR]}>
          {t('run.stageOf', { i: 2, n: 9 })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  modal: {
    width: '100%',
    borderRadius: 30,
    borderCurve: 'continuous',
    backgroundColor: '#18181C',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    paddingTop: 10,
    paddingHorizontal: 10,
    paddingBottom: 18,
    gap: 20,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 30 },
  },
  preview: {
    borderRadius: 22,
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  pill: {
    width: 188,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 7,
    paddingRight: 14,
    shadowColor: RED,
    shadowOpacity: 0.3,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 6 },
  },
  pillTime: { fontSize: 15, fontWeight: '800', color: RED, letterSpacing: -0.4 },
  body: { paddingHorizontal: 12, gap: 18 },
  kicker: { fontSize: 11.5, fontWeight: '800', letterSpacing: 1.6, color: '#6E7279' },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '800', letterSpacing: -0.66, color: '#F7F7F8' },
  desc: { marginTop: 2, fontSize: 14.5, lineHeight: 21, color: '#9A9EA6' },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fanBack: { shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 13, shadowOffset: { width: 0, height: 10 } },
  fanFront: { shadowColor: '#000', shadowOpacity: 0.7, shadowRadius: 17, shadowOffset: { width: 0, height: 14 } },
  fanClip: {
    flex: 1,
    borderRadius: 7,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#F7F7F8' },
  button: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700', color: '#0A0A0C' },
});
