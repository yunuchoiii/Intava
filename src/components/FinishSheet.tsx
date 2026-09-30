/**
 * 마지막 구간이 끝난 자리에서 묻는다 — 「운동을 완료할까요?」
 *
 * 예전에는 끝나는 즉시 완료 화면으로 넘어갔다. 그런데 계획이 끝났다고 운동이
 * 끝난 것은 아니다 — 한 종목 더, 한 세트 더 하고 싶은 날이 있고, 그때 기록을
 * 이미 남겨버린 뒤라 이어 붙일 자리가 없었다.
 *
 * **기본은 완료다.** 시트를 쓸어내려도 완료로 간다. 더 하는 쪽이 한 번 더
 * 고르는 일이어야 하지, 끝내는 쪽이 그래서는 안 된다 — 운동을 마친 사람의
 * 손은 이미 지쳐 있다.
 *
 * 다만 **바깥을 눌러도 닫히지 않는다.** 지친 손이 시트 바깥을 스치는 것만으로
 * 기록이 그 자리에서 끝나 버렸다 — 「더 하기」를 고를 새도 없이. 끝내는 것은
 * 버튼이나 손잡이처럼 뜻이 실린 몸짓으로만 받는다.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { C, GUTTER } from '../theme';
import { SurfaceButton, WhiteButton } from './Buttons';
import { Sheet } from './Sheet';

type Props = {
  visible: boolean;
  /** 완료 — 쓸어내려 닫는 것도 여기로 온다 */
  onFinish: () => void;
  /** 더 하기 — 시트가 다 내려간 뒤에 종목 고르기를 연다 */
  onMore: () => void;
  onClosed?: () => void;
};

export function FinishSheet({ visible, onFinish, onMore, onClosed }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Sheet visible={visible} onClose={onFinish} onClosed={onClosed} dismissOnBackdrop={false}>
      <View style={styles.body}>
        <Text style={styles.title}>{t('run.finishTitle')}</Text>
        <Text style={styles.note}>{t('run.finishBody')}</Text>
      </View>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <SurfaceButton
          label={t('run.finishMore')}
          height={64}
          style={{ flex: 1 }}
          onPress={onMore}
        />
        <WhiteButton
          label={t('run.finishDone')}
          height={64}
          style={{ flex: 1 }}
          onPress={onFinish}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: GUTTER, paddingTop: 10 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, color: C.textPrimary },
  note: { marginTop: 8, fontSize: 15, lineHeight: 21, color: C.textSecondary },
  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: GUTTER, paddingTop: 22 },
});
