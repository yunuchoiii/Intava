/**
 * 첫 설치 온보딩 — 시안 「인타바 첫 설치 온보딩」 3a–3d.
 *
 * 사용법을 가르치지 않는다. **처음 한 번 하는 초기 설정**이다. 장마다 제목 한 줄 +
 * 설명 한 줄 + 컨트롤. 앱 안 설정은 스위치, iOS 권한은 버튼으로 가른다.
 *
 * 1. 색이 곧 단계 — 큰 링 + 단계 링 다섯(누르면 큰 링 색이 바뀜, 설정 없음)
 * 2. 화면을 꺼도 알려 드려요 — 소리·진동 스위치 + 알림 권한(묻지 않음/허용됨/거부됨)
 * 3. 앱 밖에서도 타이머 — 라이브 액티비티·화면 꺼짐 방지 스위치(아일랜드 없는 기종은 잠금화면만)
 * 4. 건강 앱에 기록 — 켜는 순간에만 권한을 묻고, 허용됐을 때만 켜진 채 남긴다
 *
 * 스위치는 바꾸는 즉시 저장된다. 그래서 「건너뛰기」는 그때까지 바꾼 것은 지키고
 * 나머지는 기본값 그대로 두는 것이 저절로 된다. 건너뛰기도 끝낸 것으로 적는다.
 * 3·4장은 iOS 기능이라 다른 플랫폼에서는 1·2장만 보인다. 건강 앱을 쓸 수 없는 기기는 4장을 뺀다.
 */
import * as Notifications from 'expo-notifications';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  requestWorkoutAuthorization,
  workoutAuthorized,
  workoutAvailable,
} from '../../modules/intava-workout';
import { t } from '../i18n';
import { useStore } from '../store';
import { selectionTick } from '../feedback';
import { PHASE_COLOR, TABULAR } from '../theme';
import type { Phase } from '../types';
import { ISLAND_MIN_INSET, IslandPill, LockCard, PreviewGlow } from './LiveAnnounce';
import { NUM_BOLD } from './WorkoutCard';
import { PhaseFlood } from './PhaseFlood';
import { PressBox } from './PressBox';

const BG = '#17171C';
const SUB = '#9A9EA6';
const DIM = '#6E7279';
const ON = '#30C46C';

type Perm = 'unknown' | 'undetermined' | 'granted' | 'denied';

/**
 * 화면(app/onboarding.tsx, 풀스크린 모달)으로 띄운다 — 겹(Portal)이 아니다.
 *
 * 처음에는 시트처럼 뿌리의 겹으로 띄웠는데, 그 겹은 별도 창이라 건강 앱 권한 창이
 * 그 **아래** 앱 창에 떠서 보이지 않았다. 건너뛰기로 겹이 닫히자 그제서야 드러났다(실기기).
 * 알림 허용 창은 시스템 창이라 상관없었다. 모달 화면은 앱 창 안이라 권한 창이 그 위에 뜬다.
 */
export function OnboardingPages({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const island = insets.top >= ISLAND_MIN_INSET;
  const ios = Platform.OS === 'ios';
  const health = ios && workoutAvailable();
  const pages = ['colors', 'alerts', ...(ios ? ['live'] : []), ...(health ? ['health'] : [])] as const;
  const [page, setPage] = useState(0);
  const scroller = useRef<ScrollView>(null);
  const last = page === pages.length - 1;

  const go = (i: number) => {
    scroller.current?.scrollTo({ x: i * width, animated: true });
    setPage(i);
  };
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: BG }]}>
      <View style={{ height: insets.top }} />
      <View style={styles.skipRow}>
        <PressBox onPress={onDone} haptic="tap" radius={10} scaleTo={0.96} dim={0.1} accessibilityLabel={t('onboarding.skip')}>
          <Text style={styles.skip}>{t('onboarding.skip')}</Text>
        </PressBox>
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={{ flex: 1 }}
      >
        {pages.map((p) => (
          <View key={p} style={{ width, flex: 1 }}>
            {p === 'colors' && <ColorsPage />}
            {p === 'alerts' && <AlertsPage />}
            {p === 'live' && <LivePage width={width} island={island} />}
            {p === 'health' && <HealthPage />}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
        <View style={styles.dots}>
          {pages.map((p, i) => (
            <View key={p} style={[styles.dot, i === page && styles.dotOn]} />
          ))}
        </View>
        <PressBox
          onPress={() => (last ? onDone() : go(page + 1))}
          haptic="tap"
          radius={17}
          scaleTo={0.97}
          dim={0.1}
          outerStyle={{ alignSelf: 'stretch' }}
          accessibilityLabel={t(last ? 'onboarding.start' : 'onboarding.next')}
        >
          <LinearGradient colors={['#FFFFFF', '#E4E7EC']} style={styles.primary}>
            <Text style={styles.primaryText}>{t(last ? 'onboarding.start' : 'onboarding.next')}</Text>
          </LinearGradient>
        </PressBox>
      </View>
    </View>
  );
}

// ---- 1장 ------------------------------------------------------------------

/**
 * 큰 링 + 단계 링 다섯 — 시안 4g.
 *
 * 실행 화면의 링과 유리 원판을 큰 링 하나로 가져오고, 아래 작은 링 다섯 개를 단계
 * 버튼으로 둔다. 누르면 큰 링이 그 단계의 색으로 바뀐다 — 원판은 실행 화면과 같은
 * PhaseFlood라 색이 녹아들듯 건너간다. 설명 대신 직접 눌러 「색이 곧 단계」를 겪게 한다.
 *
 * 처음에는 실행 화면 목업 다섯 장(부채꼴)을, 다음엔 색 띠(4a)를 썼다. 목업은 실제
 * 화면과 달라 보였고, 색 띠는 정적이었다(사용자 결정).
 */
type Step = { phase: Phase; ring: string; track: string; clock: string };
const STEPS: Step[] = [
  { phase: 'WARMUP', ring: '#C96A1E', track: 'rgba(201,106,30,0.3)', clock: '0:34' },
  { phase: 'WORK', ring: '#FF4D5E', track: 'rgba(255,77,94,0.3)', clock: '0:39' },
  { phase: 'SET_REST', ring: '#2BB3A3', track: 'rgba(18,137,124,0.35)', clock: '0:20' },
  { phase: 'BLOCK_REST', ring: '#5B83F0', track: 'rgba(43,91,215,0.35)', clock: '0:09' },
  { phase: 'COOLDOWN', ring: '#6C93B5', track: 'rgba(62,107,143,0.4)', clock: '1:38' },
];

function ColorsPage() {
  const [sel, setSel] = useState(1);
  const step = STEPS[sel];
  /**
   * 링도 원판처럼 녹아들며 바뀐다 — 다섯 단계의 링을 겹쳐 두고 고른 것만 0.6초에 걸쳐 드러낸다.
   * 원판(PhaseFlood)과 같은 길이라, 한쪽만 휙 바뀌어 따로 놀지 않는다(사용자 지적).
   */
  const fades = useRef(STEPS.map((_, i) => new Animated.Value(i === 1 ? 1 : 0))).current;
  useEffect(() => {
    Animated.parallel(
      fades.map((v, i) => Animated.timing(v, { toValue: i === sel ? 1 : 0, duration: 600, useNativeDriver: true }))
    ).start();
  }, [sel, fades]);
  const big = 250;
  const r = 114;
  const c = 2 * Math.PI * r;
  return (
    <View style={styles.colorsPage}>
      <View style={styles.colorsStage}>
        <View style={{ width: big, height: big }}>
          {/* 유리 원판 — 실행 화면 바탕과 같은 PhaseFlood라 단계를 바꾸면 색이 녹아들며 건너간다 */}
          <View style={styles.bigDisc}>
            <PhaseFlood color={PHASE_COLOR[step.phase]} />
          </View>
          {STEPS.map((s, i) => (
            <Animated.View
              key={s.phase}
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { opacity: fades[i], transform: [{ rotate: '-90deg' }] }]}
            >
              <Svg width={big} height={big}>
                <Circle cx={big / 2} cy={big / 2} r={r} fill="none" stroke={s.track} strokeWidth={12} />
                <Circle cx={big / 2} cy={big / 2} r={r} fill="none" stroke={s.ring} strokeWidth={12} strokeLinecap="round"
                  strokeDasharray={`${c} ${c}`} strokeDashoffset={c * 0.3} />
              </Svg>
            </Animated.View>
          ))}
          <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
            <Text style={styles.bigPhase}>{t(`phase.${step.phase}`)}</Text>
            <Text style={[styles.bigClock, TABULAR]}>{step.clock}</Text>
          </View>
        </View>

        <View style={styles.stepRow}>
          {STEPS.map((s, i) => {
            const on = i === sel;
            const sc = 2 * Math.PI * 18;
            return (
              <PressBox
                key={s.phase}
                onPress={() => {
                  if (i !== sel) selectionTick();
                  setSel(i);
                }}
                haptic="none"
                radius={14}
                scaleTo={0.92}
                dim={0}
                style={[styles.step, { opacity: on ? 1 : 0.5 }]}
                accessibilityLabel={t(`phase.${s.phase}`)}
              >
                <View style={{ transform: [{ rotate: '-90deg' }] }}>
                  <Svg width={44} height={44}>
                    <Circle cx={22} cy={22} r={18} fill="none" stroke={s.track} strokeWidth={6} />
                    <Circle cx={22} cy={22} r={18} fill="none" stroke={s.ring} strokeWidth={6} strokeLinecap="round"
                      strokeDasharray={`${sc} ${sc}`} strokeDashoffset={sc * 0.3} />
                  </Svg>
                </View>
                <Text style={[styles.stepName, on && styles.stepNameOn]} numberOfLines={1}>
                  {t(`phase.${s.phase}`)}
                </Text>
              </PressBox>
            );
          })}
        </View>
      </View>
      <View style={{ paddingHorizontal: 4, gap: 8, alignItems: 'center' }}>
        <Text style={[styles.title, { textAlign: 'center' }]}>{t('onboarding.colorsTitle')}</Text>
        <Text style={[styles.desc, { textAlign: 'center' }]}>{t('onboarding.colorsDesc')}</Text>
      </View>
    </View>
  );
}

// ---- 2장 ------------------------------------------------------------------

function useNotifPerm(): [Perm, () => void] {
  const [perm, setPerm] = useState<Perm>('unknown');
  const read = useCallback(async () => {
    try {
      const p = await Notifications.getPermissionsAsync();
      setPerm(p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied');
    } catch {
      setPerm('undetermined');
    }
  }, []);
  useEffect(() => {
    void read();
    // 설정 앱에 다녀오면 다시 읽는다 — 거기서 켰을 수 있다
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void read());
    return () => sub.remove();
  }, [read]);
  const ask = useCallback(() => {
    if (perm === 'denied') {
      // 한 번 거절하면 iOS는 다시 묻지 않는다 — 창을 부르지 않고 설정으로 보낸다
      void Linking.openSettings();
      return;
    }
    void Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } })
      .then(() => read())
      .catch(() => undefined);
  }, [perm, read]);
  return [perm, ask];
}

function AlertsPage() {
  const { settings, setSettings } = useStore();
  const [perm, ask] = useNotifPerm();
  return (
    <View style={styles.page}>
      {/* 부제 없음 — 아래 스위치 설명이 같은 말을 이미 한다 */}
      <Heading title={t('onboarding.alertsTitle')} />
      <View style={styles.card}>
        <ToggleRow
          title={t('settings.sound')}
          note={t('onboarding.soundNote')}
          value={settings.sound}
          onChange={(v) => setSettings({ sound: v })}
        />
        <View style={styles.rule} />
        <ToggleRow
          title={t('settings.vibration')}
          note={t('onboarding.vibrationNote')}
          value={settings.vibration}
          onChange={(v) => setSettings({ vibration: v })}
        />
      </View>
      <View style={{ gap: 10 }}>
        <Text style={styles.groupLabel}>{t('onboarding.iosPerm')}</Text>
        <View style={[styles.card, { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 18, gap: 14 }]}>
          <View style={{ gap: 3 }}>
            <Text style={styles.rowTitle}>{t('onboarding.notif')}</Text>
            <Text style={styles.rowNote}>{t('onboarding.notifNote')}</Text>
          </View>
          {perm === 'granted' ? (
            <View style={[styles.permButton, styles.permDone]}>
              <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                <Path d="M3 8.4l3.2 3.1L13 4.6" stroke={ON} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={[styles.permText, { color: SUB }]}>{t('onboarding.notifAllowed')}</Text>
            </View>
          ) : (
            <PressBox
              onPress={ask}
              disabled={perm === 'unknown'}
              haptic="tap"
              radius={13}
              scaleTo={0.97}
              dim={0.12}
              dimColor="#FFF"
              style={styles.permButton}
              accessibilityLabel={t(perm === 'denied' ? 'onboarding.notifOpenSettings' : 'onboarding.notifAllow')}
            >
              <Text style={styles.permText}>
                {t(perm === 'denied' ? 'onboarding.notifOpenSettings' : 'onboarding.notifAllow')}
              </Text>
              {perm === 'denied' && (
                <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
                  <Path d="M4 2.5L7.5 6L4 9.5" stroke="#F7F7F8" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              )}
            </PressBox>
          )}
          {perm === 'denied' && <Text style={styles.rowNote}>{t('onboarding.notifDeniedNote')}</Text>}
        </View>
      </View>
    </View>
  );
}

// ---- 3장 ------------------------------------------------------------------

function LivePage({ width, island }: { width: number; island: boolean }) {
  const { settings, setSettings } = useStore();
  const [box, setBox] = useState({ width: 0, height: 0 });
  // 판 = 화면 − 좌우 24, 그 안 = 판 − 좌우 12
  const cardW = width - 48 - 24;
  return (
    <View style={[styles.page, { paddingTop: 8, gap: 28 }]}>
      <View style={styles.preview} onLayout={(e) => setBox(e.nativeEvent.layout)}>
        <PreviewGlow w={box.width} h={box.height} />
        {island ? <IslandPill /> : <LockClock />}
        <LockCard width={cardW} />
      </View>
      <Heading
        title={t(island ? 'onboarding.liveTitle' : 'onboarding.liveTitleLock')}
        desc={t(island ? 'onboarding.liveDesc' : 'onboarding.liveDescLock')}
      />
      <View style={styles.card}>
        <ToggleRow
          title={t(island ? 'settings.liveActivity' : 'onboarding.liveLock')}
          note={t('onboarding.liveNote')}
          value={settings.liveActivity}
          onChange={(v) => setSettings({ liveActivity: v })}
        />
        <View style={styles.rule} />
        <ToggleRow
          title={t('onboarding.keepAwake')}
          note={t('onboarding.keepAwakeNote')}
          value={settings.keepScreenOn}
          onChange={(v) => setSettings({ keepScreenOn: v })}
        />
      </View>
    </View>
  );
}

/** 아일랜드 없는 기종 — 아일랜드 자리에 잠금화면 시계를 둬서 높이를 맞춘다(시안 3c) */
function LockClock() {
  const now = new Date();
  const time = `${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')}`;
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.55)' }}>
        {t('records.dateLabel', {
          m: now.getMonth() + 1,
          d: now.getDate(),
          w: t('records.weekdays').split(' ')[now.getDay()],
        })}
      </Text>
      <Text style={[{ fontFamily: NUM_BOLD, fontSize: 50, color: '#F7F7F8', lineHeight: 52 }, TABULAR]}>{time}</Text>
    </View>
  );
}

// ---- 4장 ------------------------------------------------------------------

function HealthPage() {
  const { settings, setSettings } = useStore();
  const [denied, setDenied] = useState(false);
  const toggle = (on: boolean) => {
    if (!on) {
      setSettings({ healthSync: false });
      return;
    }
    // 켜는 순간에만 묻고, 실제로 허용됐을 때만 켜진 채로 둔다 — 설정 화면과 같은 규칙
    void requestWorkoutAuthorization().then(() => {
      if (workoutAuthorized()) {
        setDenied(false);
        setSettings({ healthSync: true });
      } else {
        setDenied(true);
      }
    });
  };
  return (
    <View style={[styles.page, { paddingTop: 8, gap: 28 }]}>
      <View style={styles.healthArt}>
        <Rings />
        <View style={styles.workoutRow}>
          <LinearGradient colors={['#E2475A', '#A81F30']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={styles.workoutIcon} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={styles.workoutName}>{t('onboarding.sampleWorkout')}</Text>
            <Text style={styles.workoutMeta} numberOfLines={1}>
              {t('onboarding.sampleMeta')}
            </Text>
          </View>
          <Text style={[styles.workoutTime, TABULAR]}>24:30</Text>
        </View>
      </View>
      <Heading title={t('onboarding.healthTitle')} desc={t('onboarding.healthDesc')} />
      <View style={styles.card}>
        <ToggleRow
          title={t('settings.healthSync')}
          note={t('onboarding.healthNote')}
          value={settings.healthSync}
          onChange={toggle}
        />
        {denied && (
          <>
            <View style={styles.rule} />
            <View style={styles.deniedRow}>
              <Svg width={15} height={15} viewBox="0 0 16 16" fill="none" style={{ marginTop: 2 }}>
                <Circle cx={8} cy={8} r={7} stroke={SUB} strokeWidth={1.5} />
                <Path d="M8 7v4.6" stroke={SUB} strokeWidth={1.6} strokeLinecap="round" />
                <Circle cx={8} cy={4.8} r={1} fill={SUB} />
              </Svg>
              <Text style={[styles.rowNote, { flex: 1, lineHeight: 19.5 }]}>
                {t('onboarding.healthDenied')}
                <Text style={{ color: '#E7E8EA', fontWeight: '600' }}>{t('onboarding.healthPath')}</Text>
                {t('onboarding.healthDeniedTail')}
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

/** 활동 링 느낌 — 인타바 단계 색으로 그려 특정 브랜드처럼 보이지 않게(시안 메모) */
function Rings() {
  const ring = (r: number, color: string, track: string, frac: number) => {
    const c = 2 * Math.PI * r;
    return (
      <React.Fragment key={r}>
        <Circle cx={75} cy={75} r={r} fill="none" stroke={track} strokeWidth={15} />
        <Circle cx={75} cy={75} r={r} fill="none" stroke={color} strokeWidth={15} strokeLinecap="round"
          strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - frac)} />
      </React.Fragment>
    );
  };
  return (
    <View style={{ transform: [{ rotate: '-90deg' }] }}>
      <Svg width={150} height={150}>
        {ring(64, '#FF4D5E', 'rgba(255,77,94,0.18)', 0.76)}
        {ring(46, '#2BD9C3', 'rgba(43,217,195,0.18)', 0.62)}
        {ring(28, '#6E9BFF', 'rgba(110,155,255,0.2)', 0.75)}
      </Svg>
    </View>
  );
}

// ---- 공통 -----------------------------------------------------------------

function Heading({ title, desc }: { title: string; desc?: string }) {
  return (
    <View style={{ paddingHorizontal: 4, gap: 8 }}>
      <Text style={styles.title}>{title}</Text>
      {!!desc && <Text style={styles.desc}>{desc}</Text>}
    </View>
  );
}

function ToggleRow({ title, note, value, onChange }: { title: string; note: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowNote}>{note}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: ON, false: 'rgba(120,120,128,0.32)' }} ios_backgroundColor="rgba(120,120,128,0.32)" />
    </View>
  );
}

const styles = StyleSheet.create({
  skipRow: { height: 44, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 12 },
  skip: { paddingVertical: 10, paddingHorizontal: 12, fontSize: 15, fontWeight: '600', color: DIM },
  page: { flex: 1, paddingTop: 28, paddingHorizontal: 24, gap: 32 },
  title: { fontSize: 26, lineHeight: 34, fontWeight: '800', letterSpacing: -0.78, color: '#F7F7F8' },
  desc: { fontSize: 15, lineHeight: 22, color: SUB },
  colorsPage: { flex: 1, paddingHorizontal: 24, gap: 22 },
  colorsStage: { height: 430, alignItems: 'center', justifyContent: 'center', gap: 34 },
  bigDisc: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    bottom: 20,
    borderRadius: 105,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 18 },
  },
  center: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  bigPhase: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  /** 실행 화면 링 안 숫자와 같은 글꼴 — 시스템 800, 고정폭 숫자(Ring.tsx의 clock) */
  bigClock: { fontSize: 66, fontWeight: '800', letterSpacing: -3, color: '#FFFFFF' },
  stepRow: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between' },
  step: { width: 64, alignItems: 'center', gap: 8, paddingVertical: 4 },
  stepName: { fontSize: 12.5, fontWeight: '600', color: '#C9CCD1' },
  stepNameOn: { fontWeight: '700', color: '#F7F7F8' },
  card: { borderRadius: 20, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.05)' },
  rule: { height: 1, marginLeft: 18, backgroundColor: 'rgba(255,255,255,0.07)' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16, paddingHorizontal: 18 },
  rowTitle: { fontSize: 16, lineHeight: 21, fontWeight: '600', color: '#F7F7F8' },
  rowNote: { fontSize: 13, lineHeight: 19, color: SUB },
  groupLabel: { paddingHorizontal: 6, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, color: DIM },
  permButton: {
    height: 46,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  permDone: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: 8 },
  permText: { fontSize: 15.5, fontWeight: '600', color: '#F7F7F8' },
  preview: {
    borderRadius: 24,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: '#000000',
    paddingTop: 18,
    paddingHorizontal: 12,
    paddingBottom: 14,
    alignItems: 'center',
    gap: 18,
  },
  healthArt: {
    borderRadius: 24,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingTop: 24,
    paddingHorizontal: 18,
    paddingBottom: 18,
    alignItems: 'center',
    gap: 20,
  },
  workoutRow: {
    alignSelf: 'stretch',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  workoutIcon: { width: 34, height: 34, borderRadius: 10 },
  workoutName: { fontSize: 14.5, fontWeight: '600', color: '#F7F7F8' },
  workoutMeta: { fontSize: 12.5, color: SUB },
  workoutTime: { fontFamily: NUM_BOLD, fontSize: 20, color: '#F7F7F8', paddingTop: 2 },
  deniedRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', paddingTop: 13, paddingBottom: 15, paddingHorizontal: 18 },
  footer: { paddingTop: 16, paddingHorizontal: 24, alignItems: 'center', gap: 20 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)' },
  dotOn: { width: 18, backgroundColor: '#F7F7F8' },
  primary: { height: 56, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 17, fontWeight: '700', color: '#0A0A0C' },
});
