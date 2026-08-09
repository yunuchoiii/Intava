/**
 * 문서 한 장 — 개인정보 처리방침과 지원이 같은 틀을 쓴다.
 *
 * 어느 문서인지는 주소로 온다(`/legal?doc=privacy`). 두 화면을 따로 만들면
 * 같은 레이아웃이 두 벌이 되고, 한쪽만 고쳐지는 날이 온다.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon } from '../src/components/Icons';
import { useMiniTimerSpace } from '../src/components/MiniTimer';
import { PressBox } from '../src/components/PressBox';
import { Screen } from '../src/components/Screen';
import { legalDoc, type LegalKind } from '../src/legal';
import { t } from '../src/i18n';
import { C, GUTTER } from '../src/theme';

export default function Legal() {
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const miniSpace = useMiniTimerSpace();

  const kind: LegalKind = doc === 'support' ? 'support' : 'privacy';
  const page = useMemo(() => legalDoc(kind), [kind]);

  return (
    <Screen>
      <View style={{ flex: 1, paddingTop: insets.top + 6 }}>
        <View style={styles.header}>
          <PressBox
            onPress={() => router.back()}
            hitSlop={10}
            scaleTo={0.9}
            dim={0}
            accessibilityLabel={t('common.close')}
          >
            <BackIcon size={26} color={C.textSecondary} />
          </PressBox>
          <Text style={styles.topTitle} numberOfLines={1}>
            {page.title}
          </Text>
          {/* 제목을 가운데 세우려면 오른쪽이 왼쪽 버튼과 같은 폭이어야 한다 */}
          <View style={{ width: 26 }} />
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: GUTTER,
            paddingBottom: insets.bottom + 40 + miniSpace,
          }}
          showsVerticalScrollIndicator={false}
        >
          {!!page.lead && <Text style={styles.lead}>{page.lead}</Text>}
          {!!page.updated && <Text style={styles.updated}>{page.updated}</Text>}

          {page.sections.map((s) => (
            <View key={s.heading} style={styles.section}>
              <Text style={styles.heading}>{s.heading}</Text>
              {s.body?.map((p, i) => (
                <Text key={i} style={styles.body}>
                  {p}
                </Text>
              ))}
              {!!s.bullets?.length && (
                <View style={styles.bullets}>
                  {s.bullets.map((b, i) => (
                    <View key={i} style={styles.bulletRow}>
                      {/*
                        점은 글자가 아니라 표식이라 View로 찍는다. 글자로 두면
                        글리프가 baseline 근처에 앉아 첫 줄보다 아래로 처진다.
                      */}
                      <View style={styles.bulletDot} />
                      <Text style={[styles.body, styles.bulletText]}>{b}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}

          <View style={styles.contact}>
            <Text style={styles.body}>{page.contact.label}</Text>
            <Pressable
              onPress={() => void Linking.openURL(`mailto:${page.contact.email}`)}
              hitSlop={8}
            >
              <Text style={styles.email}>{page.contact.email}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.34,
    color: C.textPrimary,
  },
  lead: { marginTop: 22, fontSize: 17, lineHeight: 26, fontWeight: '600', color: C.textPrimary },
  updated: { marginTop: 8, fontSize: 13, color: C.textTertiary },
  section: { marginTop: 30 },
  heading: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2, color: C.textPrimary },
  body: { marginTop: 8, fontSize: 15, lineHeight: 24, color: C.textSecondary },
  bullets: { marginTop: 4 },
  bulletRow: { flexDirection: 'row', marginTop: 6 },
  /** 첫 줄 한가운데에 놓는다 — 줄높이 24의 절반에서 점 반지름을 뺀다 */
  bulletDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginTop: 10.5,
    marginRight: 11,
    backgroundColor: C.textTertiary,
  },
  bulletText: { flex: 1, marginTop: 0 },
  contact: {
    marginTop: 38,
    paddingTop: 22,
    borderTopWidth: 1,
    borderTopColor: C.divider,
  },
  email: { marginTop: 10, fontSize: 15, fontWeight: '600', color: C.volumeText },
});
