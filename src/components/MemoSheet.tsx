/**
 * 실행 화면의 메모 고치기 — 링 위의 이름·메모를 누르면 열린다.
 *
 * 운동 중에 떠오르는 것이 메모다("다음엔 22.5kg"). 그걸 적으려고 편집 화면까지
 * 들어갔다 나오면 타이머 화면을 떠나야 하니, 지금 하는 종목 하나만 잘라서 여기서
 * 고친다. 무게·자세 한 줄 외에는 아무것도 건드리지 않는다.
 *
 * 값은 **닫는 순간 저장된다.** 실행 화면은 손이 바쁜 자리라, 적어놓고 화면을 쓸어
 * 내렸는데 사라지는 일이 없어야 한다. 「완료」는 키보드를 내리고 나가는 길일 뿐이다.
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { C, GUTTER } from '../theme';
import { WhiteButton } from './Buttons';
import { ClearButton } from './ClearButton';
import { Sheet } from './Sheet';

type Props = {
  /** 고칠 종목 — null이면 닫힌다 */
  blockId: string | null;
  /** 시트 머리에 세울 종목 이름 */
  name: string;
  memo: string;
  onClose: () => void;
  /** 닫히기 직전에 한 번 — 바뀐 것이 없으면 부르지 않는다 */
  onSave: (blockId: string, memo: string) => void;
};

export function MemoSheet({ blockId, name, memo, onClose, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(memo);
  /** 닫히는 0.3초 동안에도 그릴 것이 있어야 한다 — 부모가 비워도 붙잡아 둔다 */
  const [held, setHeld] = useState({ blockId, name });

  /** 저장은 닫힐 때 한 번. 콜백이 매 글자마다 새로 와도 최신 것만 쓴다 */
  const save = useRef(onSave);
  save.current = onSave;
  const opened = useRef<{ id: string; from: string } | null>(null);

  useEffect(() => {
    if (!blockId) return;
    setDraft(memo);
    setHeld({ blockId, name });
    opened.current = { id: blockId, from: memo };
    // memo·name은 열 때의 값만 쓴다 — 저장하면서 되돌아오는 값에 커서를 뺏기지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockId]);

  /** 시트가 완전히 내려간 뒤 — 이때 적힌 것을 남긴다 */
  const commit = () => {
    const open = opened.current;
    opened.current = null;
    if (!open) return;
    const next = draft.trim();
    if (next === open.from.trim()) return;
    save.current(open.id, next);
  };

  if (!held.blockId) return null;

  return (
    <Sheet visible={blockId != null} onClose={onClose} onClosed={commit}>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {held.name}
        </Text>
        <Text style={styles.label}>{t('sheet.memo')}</Text>
        <View style={styles.inputRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            style={styles.input}
            placeholder={t('sheet.memoPlaceholder')}
            placeholderTextColor={C.textTertiary}
            selectionColor={C.textPrimary}
            maxLength={60}
            returnKeyType="done"
            autoFocus
            onSubmitEditing={onClose}
          />
          {draft.length > 0 && <ClearButton onPress={() => setDraft('')} />}
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <WhiteButton label={t('common.done')} height={64} style={{ flex: 1 }} onPress={onClose} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: GUTTER, paddingTop: 6 },
  name: { fontSize: 15, color: C.textTertiary },
  label: { marginTop: 14, fontSize: 18, lineHeight: 24, fontWeight: '600', color: C.textPrimary },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  input: { flex: 1, fontSize: 17, color: C.textPrimary, padding: 0 },
  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: GUTTER, paddingTop: 18 },
});
