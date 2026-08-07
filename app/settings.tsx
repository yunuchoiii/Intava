/** 5.8 설정 (전역) */
import { useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Linking,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMiniTimerSpace } from '../src/components/MiniTimer';
import { Screen } from '../src/components/Screen';
import { preview } from '../src/audio';
import { useStore } from '../src/store';
import { t } from '../src/i18n';
import { C, GUTTER, TABULAR } from '../src/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const miniSpace = useMiniTimerSpace();
  const { settings, setSettings } = useStore();

  return (
    <Screen>
      <View style={{ flex: 1, paddingTop: insets.top + 6 }}>
        <View style={styles.topBar}>
          {/* 좌우를 같은 폭으로 두어야 제목이 가운데 온다. 폭을 고정하면
              "Close"처럼 긴 라벨이 줄바꿈된다 */}
          <View style={styles.topSide}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text style={styles.cancel} numberOfLines={1}>
                {t('common.close')}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.topTitle}>{t('settings.title')}</Text>
          <View style={styles.topSide} />
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: GUTTER,
            paddingBottom: insets.bottom + 32 + miniSpace,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.section}>{t('settings.alerts')}</Text>

          <ToggleRow
            title={t('settings.sound')}
            note={t('settings.soundNote')}
            value={settings.sound}
            onChange={(sound) => setSettings({ sound })}
          />
          <ToggleRow
            title={t('settings.vibration')}
            note={t('settings.vibrationNote')}
            value={settings.vibration}
            onChange={(vibration) => setSettings({ vibration })}
          />
          <ToggleRow
            title={t('settings.countdown')}
            note={t('settings.countdownNote')}
            value={settings.countdownBeep}
            onChange={(countdownBeep) => setSettings({ countdownBeep })}
          />

          <Text style={styles.section}>{t('settings.volume')}</Text>
          <View style={styles.volumeHead}>
            <Text style={styles.rowTitle}>{t('settings.volumeLabel')}</Text>
            <Text style={[styles.value, TABULAR]}>{Math.round(settings.volume * 100)}%</Text>
          </View>
          <Slider
            value={settings.volume}
            onChange={(volume) => setSettings({ volume })}
            onRelease={(volume) => {
              if (settings.sound) void preview(volume);
            }}
          />
          <Text style={styles.note}>{t('tips.volume')}</Text>

          <ToggleRow
            title={t('settings.push')}
            note={t('settings.pushNote')}
            value={settings.notifications}
            onChange={(notifications) => setSettings({ notifications })}
          />

          <Text style={styles.section}>{t('settings.app')}</Text>
          {/* 언어는 iOS의 앱별 언어 설정에서 바꾼다 — 앱 안에 또 만들면 두 곳이 어긋난다 */}
          <Pressable style={styles.linkRow} onPress={() => Linking.openSettings()}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={styles.rowTitle}>{t('settings.language')}</Text>
              <Text style={styles.note}>{t('settings.languageNote')}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          <Text style={styles.section}>{t('settings.screen')}</Text>
          <ToggleRow
            title={t('settings.keepAwake')}
            note={t('tips.keepScreenOn')}
            value={settings.keepScreenOn}
            onChange={(keepScreenOn) => setSettings({ keepScreenOn })}
            last
          />
        </ScrollView>
      </View>
    </Screen>
  );
}

function ToggleRow({
  title,
  note,
  value,
  onChange,
  last,
}: {
  title: string;
  note: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, last && { borderBottomWidth: 0 }]}>
      <View style={{ flex: 1, paddingRight: 16 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.note}>{note}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: '#3F8F72', false: 'rgba(255,255,255,0.16)' }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function Slider({
  value,
  onChange,
  onRelease,
}: {
  value: number;
  onChange: (v: number) => void;
  onRelease: (v: number) => void;
}) {
  const [width, setWidth] = useState(1);
  const widthRef = useRef(1);
  const latest = useRef(value);
  latest.current = value;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    widthRef.current = w;
    setWidth(w);
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const v = clamp01(e.nativeEvent.locationX / widthRef.current);
          latest.current = v;
          onChange(v);
        },
        onPanResponderMove: (e) => {
          const v = clamp01(e.nativeEvent.locationX / widthRef.current);
          latest.current = v;
          onChange(v);
        },
        onPanResponderRelease: () => onRelease(latest.current),
      }),
    [onChange, onRelease]
  );

  const x = clamp01(value) * width;

  return (
    /*
      트랙과 원은 그림일 뿐 손가락을 받지 않는다.

      locationX는 **닿은 뷰** 기준 좌표다. 원이 손가락을 받으면 24pt짜리 원이 기준이
      되어 0~24 사이 값이 나오고, 그걸 슬라이더 폭으로 나누니 값이 0 근처로 튄다.
      끌면 원이 따라 움직여 계속 어긋난다 — 원을 잡았을 때만 이상하던 이유다.
      받는 곳을 이 겹 하나로 못 박으면 기준이 늘 슬라이더 전체가 된다.
    */
    <View style={styles.sliderHit} onLayout={onLayout} {...pan.panHandlers}>
      <View style={styles.sliderTrack} pointerEvents="none">
        <View style={[styles.sliderFill, { width: x }]} />
      </View>
      <View
        style={[styles.sliderThumb, { left: Math.max(0, Math.min(width - 24, x - 12)) }]}
        pointerEvents="none"
      />
    </View>
  );
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

const styles = StyleSheet.create({
  topBar: {
    height: 52,
    paddingHorizontal: GUTTER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topSide: { flex: 1 },
  cancel: { fontSize: 17, fontWeight: '600', color: C.textSecondary },
  topTitle: { fontSize: 17, fontWeight: '700', color: C.textPrimary },
  section: {
    marginTop: 26,
    marginBottom: 4,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.78,
    color: C.textTertiary,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
  },
  chevron: { fontSize: 20, color: C.textTertiary },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
  },
  rowTitle: { fontSize: 18, fontWeight: '600', color: C.textPrimary },
  note: { marginTop: 6, fontSize: 14, lineHeight: 20, color: C.textSecondary },
  value: { fontSize: 21, fontWeight: '700', color: C.textPrimary },
  volumeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
  },
  sliderHit: { height: 44, justifyContent: 'center', marginTop: 6 },
  sliderTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  sliderFill: { height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  sliderThumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
});
