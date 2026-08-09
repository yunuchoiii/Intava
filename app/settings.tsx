/** 5.8 설정 (전역) */
import { useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
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
import { PressBox } from '../src/components/PressBox';
import { BackIcon } from '../src/components/Icons';
import { Screen } from '../src/components/Screen';
import Constants from 'expo-constants';
import { preview } from '../src/audio';
import { exportBackup, pickBackup } from '../src/backup';
import { useStore } from '../src/store';
import { t } from '../src/i18n';
import { C, GUTTER, TABULAR } from '../src/theme';

/** 설치된 앱의 버전 — 문제를 알릴 때 사용자가 그대로 읽어줄 수 있어야 한다 */
const appVersion = (() => {
  const v = Constants.expoConfig?.version;
  const b = Constants.expoConfig?.ios?.buildNumber;
  if (!v) return '—';
  return b ? `${v} (${b})` : v;
})();

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const miniSpace = useMiniTimerSpace();
  const { presets, settings, setSettings, mergePresets } = useStore();

  const doExport = async () => {
    const ok = await exportBackup(presets, settings);
    if (!ok) Alert.alert(t('backup.failTitle'), t('backup.failBody'));
  };

  const doImport = async () => {
    const picked = await pickBackup();
    if (picked === null) return; // 취소
    if (picked === 'invalid') {
      Alert.alert(t('backup.badTitle'), t('backup.badBody'));
      return;
    }
    const count = picked.presets.length;
    Alert.alert(t('backup.askTitle'), t('backup.askBody', { count }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('backup.import'),
        onPress: () => {
          mergePresets(picked.presets);
          setSettings(picked.settings);
          Alert.alert(t('backup.doneTitle'), t('backup.doneBody', { count }));
        },
      },
    ]);
  };

  return (
    <Screen>
      <View style={{ flex: 1, paddingTop: insets.top + 6 }}>
        <View style={styles.topBar}>
          {/* 좌우를 같은 폭으로 두어야 제목이 가운데 온다 */}
          <View style={styles.topSide}>
            <PressBox
              onPress={() => router.back()}
              hitSlop={12}
              scaleTo={0.88}
              dim={0}
              accessibilityLabel={t('common.close')}
            >
              <BackIcon size={26} color={C.textSecondary} />
            </PressBox>
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
          {/* 소리·진동과 같은 갈래다 — 볼륨 아래 홀로 있던 것을 알림으로 들인다 */}
          <ToggleRow
            title={t('settings.push')}
            note={t('settings.pushNote')}
            value={settings.notifications}
            onChange={(notifications) => setSettings({ notifications })}
            last
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

          <Text style={styles.section}>{t('settings.app')}</Text>
          {/* 언어는 iOS의 앱별 언어 설정에서 바꾼다 — 앱 안에 또 만들면 두 곳이 어긋난다 */}
          <Pressable style={styles.linkRow} onPress={() => Linking.openSettings()}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={styles.rowTitle}>{t('settings.language')}</Text>
              <Text style={styles.note}>{t('settings.languageNote')}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <View style={[styles.linkRow, { borderBottomWidth: 0, justifyContent: 'space-between' }]}>
            <Text style={styles.rowTitle}>{t('settings.version')}</Text>
            <Text style={[styles.value, TABULAR]}>{appVersion}</Text>
          </View>

          <Text style={styles.section}>{t('settings.screen')}</Text>
          <ToggleRow
            title={t('settings.keepAwake')}
            note={t('tips.keepScreenOn')}
            value={settings.keepScreenOn}
            onChange={(keepScreenOn) => setSettings({ keepScreenOn })}
            last
          />

          {/*
            루틴은 이 기기 안에만 있다 — 앱을 지우거나 기기를 바꾸면 사라진다.
            밖으로 꺼내 둘 수 있는 유일한 길이라 설정 맨 아래에 둔다.
          */}
          <Text style={styles.section}>{t('backup.data')}</Text>
          <ActionRow
            title={t('backup.export')}
            note={t('backup.exportNote')}
            onPress={doExport}
          />
          <ActionRow title={t('backup.import')} note={t('backup.importNote')} onPress={doImport} last />
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

function ActionRow({
  title,
  note,
  onPress,
  last,
}: {
  title: string;
  note: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.linkRow,
        last && { borderBottomWidth: 0 },
        pressed && { opacity: 0.55 },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={{ flex: 1, paddingRight: 16 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.note}>{note}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
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
  topTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, color: C.textPrimary },
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
