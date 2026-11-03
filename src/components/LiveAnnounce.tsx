/**
 * 새 기능 팝업 — 시안 「라이브 액티비티 출시 팝업」 2a의 틀(위 미리보기 판 + 제목 · 설명 · 줄 · 버튼).
 *
 * 1.5.1~1.5.2는 라이브 액티비티를 알렸고, 1.5.3부터는 같은 틀로 **스토리 공유 카드**를 알린다
 * (사용자 결정 2026-11-03). 본 표시 키가 따로라(KEY_SEEN_SHARE_ANNOUNCE) 라이브 액티비티 팝업을
 * 본 사람에게도 한 번 뜬다.
 *
 * 설치(업데이트 포함) 뒤 **한 번만** 홈 위에 띄운다. 「확인」을 누르면 기기에 적어 두고
 * 다시 띄우지 않는다. 운동이 돌고 있지 않을 때만 — 앱을 껐다 켜서 실행 화면이 복원되는
 * 자리에 팝업이 그 위를 덮으면 안 된다.
 *
 * 미리보기는 캡처가 아니라 실제 공유 카드(StoryCard)를 예시 기록으로 줄여 그린다 — 네 언어
 * 모두 그 언어로 나온다. 아래의 IslandPill · LockCard · PreviewGlow는 온보딩이 쓴다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { t } from '../i18n';
import { TABULAR } from '../theme';
import { KEY_SEEN_SHARE_ANNOUNCE } from '../store';
import type { WorkoutRecord } from '../types';
import { ShareIcon } from './Icons';
import { Portal } from './Overlay';
import { PressBox } from './PressBox';
import { StoryCard, type StoryTemplate } from './StoryCards';
import { SHARE_H, SHARE_W } from './WorkoutCard';

const KEY = KEY_SEEN_SHARE_ANNOUNCE;
const RED = '#FF4D5E';
const TEAL = '#2BD9C3';

/** 다이내믹 아일랜드가 있는 기종 — 상단 안전 영역이 59pt 안팎이다(노치는 47~50) */
export const ISLAND_MIN_INSET = 54;

export function NewsAnnounce({ blocked }: { blocked: boolean }) {
  const [show, setShow] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    if (show) Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [show, fade]);

  // 띄운 뒤에 운동이 되살아나면(복원이 늦게 끝나면) 거둔다 — 본 것으로 적지는 않는다
  if (!show || blocked) return null;

  const close = () => {
    void AsyncStorage.setItem(KEY, '1').catch(() => undefined);
    Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setShow(false));
  };

  return (
    <Portal>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        <Card onClose={close} />
      </Animated.View>
    </Portal>
  );
}

function Card({ onClose }: { onClose: () => void }) {
  const [box, setBox] = useState({ width: 0, height: 0 });

  return (
    <View style={styles.backdrop}>
      <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,4,6,0.66)' }]} />
      <View style={styles.modal}>
        {/* 바탕 Svg는 숫자로 크기를 준다 — 100%로 두면 판의 오른쪽·아래가 비었다 */}
        <View style={styles.preview} onLayout={(e) => setBox(e.nativeEvent.layout)}>
          <PreviewGlow w={box.width} h={box.height} />
          <CardFan />
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
            <Row icon={<ShareIcon size={20} color="#F7F7F8" />} title={t('announce.rowCards')} />
          </View>
          <PressBox onPress={onClose} haptic="tap" radius={16} scaleTo={0.97} dim={0.1} accessibilityLabel={t('announce.ok')}>
            <LinearGradient colors={['#FFFFFF', '#E4E7EC']} style={styles.button}>
              <Text style={styles.buttonText}>{t('announce.ok')}</Text>
            </LinearGradient>
          </PressBox>
        </View>
      </View>
    </View>
  );
}

/** 미리보기 카드에 넣을 예시 기록 — 56:26, 운동 15:00, 6종목 30세트 */
function sampleRecord(): WorkoutRecord {
  const start = new Date();
  start.setHours(8, 36, 0, 0);
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
    blocks: Array.from({ length: 6 }, () => ({ name: '', spec: '', durSec: 300 })),
    segs: [],
  };
}


/**
 * 카드 세 장 부채 — 가운데 링, 왼쪽 포스터, 오른쪽 사진 카드(사진 자리는 비어 있다).
 * 크기는 고정 배율(transform)로 줄인다 — 고정이면 글자가 또렷하다(애니메이션 배율만 깨졌다).
 */
function CardFan() {
  const record = React.useMemo(sampleRecord, []);
  // 가운데 카드는 화면 높이의 30%까지(18 Pro에서 0.42배 = 269pt). SE 같은 작은 화면에서 팝업이 넘치지 않게
  const { height } = useWindowDimensions();
  const FAN_MID = Math.min(0.42, (height * 0.3) / SHARE_H);
  const FAN_SIDE = FAN_MID * 0.8;
  const midW = SHARE_W * FAN_MID;
  const midH = SHARE_H * FAN_MID;
  const sideW = SHARE_W * FAN_SIDE;
  const sideH = SHARE_H * FAN_SIDE;
  const card = (template: StoryTemplate, k: number) => (
    <View style={{ width: SHARE_W * k, height: SHARE_H * k, borderRadius: 12, overflow: 'hidden' }}>
      <View style={{ width: SHARE_W, height: SHARE_H, transform: [{ scale: k }], transformOrigin: 'top left' }}>
        <StoryCard template={template} record={record} />
      </View>
    </View>
  );
  return (
    <View style={{ height: midH, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
      <View style={[styles.fanSide, { left: '50%', marginLeft: -midW / 2 - sideW * 0.62, top: (midH - sideH) / 2 }]}>
        {card('typePoster', FAN_SIDE)}
      </View>
      <View style={[styles.fanSide, { left: '50%', marginLeft: midW / 2 - sideW * 0.38, top: (midH - sideH) / 2 }]}>
        {card('photoStrip', FAN_SIDE)}
      </View>
      <View style={styles.fanMid}>{card('ringHero', FAN_MID)}</View>
    </View>
  );
}

/** 사진 + 더하기 — 카드 고르기의 「사진 넣기」와 같은 모양 */
function PhotoGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#F7F7F8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 3.5H7A3.5 3.5 0 0 0 3.5 7v10A3.5 3.5 0 0 0 7 20.5h10a3.5 3.5 0 0 0 3.5-3.5v-5.5" />
      <Circle cx={8.6} cy={8.6} r={1.8} />
      <Path d="M5.5 20.3l8.1-8.1a1.6 1.6 0 0 1 2.3 0l4.4 4.4" />
      <Path d="M15.5 5.5h6M18.5 2.5v6" />
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
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 18,
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
  fanSide: { position: 'absolute', opacity: 0.55 },
  fanMid: {
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#F7F7F8' },
  button: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700', color: '#0A0A0C' },
});
