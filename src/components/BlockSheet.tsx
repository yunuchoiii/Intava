/** 5.4 종목 편집 시트 — 하단 시트, 뒤 화면은 45% 어둡게 */
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { durationShort } from '../engine/labels';
import { t } from '../i18n';
import { C, GUTTER, RADIUS } from '../theme';
import type { Block } from '../types';
import { Checkbox } from './Checkbox';
import { ClearButton } from './ClearButton';
import { PressBox } from './PressBox';
import { Sheet } from './Sheet';
import { ValueRow } from './ValueRow';
import { WhiteButton } from './Buttons';

type Props = {
  block: Block | null;
  canDelete: boolean;
  /** 새로 만드는 중인지 — 그때만 "타이머로도 저장"을 묻는다 */
  isNew?: boolean;
  onClose: () => void;
  onSave: (b: Block, alsoSaveAsTimer: boolean) => void;
  onDelete: (id: string) => void;
};

type Field = 'work' | 'rest' | 'sets' | null;

export function BlockSheet({ block, canDelete, isNew, onClose, onSave, onDelete }: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Block | null>(block);
  const [open, setOpen] = useState<Field>(null);
  const [alsoTimer, setAlsoTimer] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  /**
   * 닫히는 동안 보여줄 값 — 부모가 block을 비워도 여기서는 붙잡고 있는다.
   *
   * 예전에는 block이 null이 되는 순간 이 컴포넌트가 통째로 `null`을 반환했다.
   * 그러면 시트가 **내려가는 몸짓 없이 트리에서 뜯겨 나간다** — 네이티브
   * Modal이 표시 중인 채로 사라지는 것이라, iOS가 그 창을 미처 걷지 못하면
   * 보이지 않는 겹이 화면에 남아 아무것도 눌리지 않는다. 시트를 닫았는데
   * 화면이 먹통이 되던 것이 이것이다.
   *
   * 이제 visible만 false로 내려보내고, Sheet가 제 몸짓을 마친 뒤 스스로
   * Modal을 걷는다. 내려가는 0.3초 동안에도 안에 그릴 것이 있어야 하므로
   * 마지막 값과 그때의 곁값(새것인지·지울 수 있는지)을 같이 붙잡아 둔다.
   */
  const [held, setHeld] = useState<{ isNew?: boolean; canDelete: boolean }>({
    isNew,
    canDelete,
  });

  useEffect(() => {
    // 열릴 때만 갈아끼운다. 닫히는 중에 비우면 빈 시트가 내려간다
    if (!block) return;
    setDraft(block);
    setHeld({ isNew, canDelete });
    setOpen(null);
    setAlsoTimer(false);
  }, [block, isNew, canDelete]);

  if (!draft) return null;
  const patch = (p: Partial<Block>) => setDraft({ ...draft, ...p });
  const toggle = (f: Exclude<Field, null>) => setOpen(open === f ? null : f);

  return (
    <Sheet visible={block != null} onClose={onClose}>
      {/* 키보드가 올라오면 시트가 짧아진다 — 그때 줄어드는 쪽은 이 목록이다 */}
      <ScrollView
        style={{ maxHeight: 560, flexShrink: 1 }}
        contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 8 }}
        keyboardShouldPersistTaps="handled"
      >
        <View>
          <View style={styles.nameRow}>
            <Text style={styles.nameLabel}>{t('sheet.blockName')}</Text>
            <View style={styles.nameInputRow}>
              <TextInput
                value={draft.name}
                onChangeText={(name) => patch({ name })}
                style={[styles.nameInput, { flex: 1 }]}
                placeholder={t('sheet.blockNamePlaceholder')}
                placeholderTextColor={C.textTertiary}
                selectionColor={C.textPrimary}
                maxLength={20}
                returnKeyType="done"
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
              />
              {nameFocused && draft.name.length > 0 && (
                <ClearButton onPress={() => patch({ name: '' })} />
              )}
            </View>
          </View>

          <ValueRow
            title={t('sheet.work')}
            display={durationShort(draft.workSec)}
            open={open === 'work'}
            onToggle={() => toggle('work')}
            wheel="time"
            value={draft.workSec}
            onChange={(workSec) => patch({ workSec })}
            allowZero={false}
          />

          <ValueRow
            title={t('sheet.setRest')}
            display={durationShort(draft.restSec) || t('common.none')}
            open={open === 'rest'}
            onToggle={() => toggle('rest')}
            wheel="time"
            value={draft.restSec}
            onChange={(restSec) => patch({ restSec })}
          />

          <ValueRow
            title={t('sheet.sets')}
            display={t('count.sets', { count: draft.sets })}
            open={open === 'sets'}
            onToggle={() => toggle('sets')}
            wheel="count"
            value={draft.sets}
            onChange={(sets) => patch({ sets })}
            min={1}
            max={50}
            unit={t('sheet.sets')}
          />

          {/*
            무게·자세 같은 한 줄 메모 — 실행 화면에서 이름 밑에 선다.
            라벨은 위의 운동·세트 줄과 같은 옷(18/600/흰색), 입력은 그 아래 줄이다.
          */}
          <View style={styles.memoRow}>
            <Text style={styles.memoLabel}>{t('sheet.memo')}</Text>
            <TextInput
              value={draft.memo ?? ''}
              onChangeText={(memo) => patch({ memo })}
              style={styles.memoInput}
              placeholder={t('sheet.memoPlaceholder')}
              placeholderTextColor={C.textTertiary}
              selectionColor={C.textPrimary}
              maxLength={60}
              returnKeyType="done"
            />
          </View>
        </View>
      </ScrollView>

      {/* 새로 만드는 종목은 타이머로도 남길 수 있다 — 다음 루틴에서 그대로 가져다 쓴다 */}
      {held.isNew && (
        <Pressable style={styles.saveAsTimer} onPress={() => setAlsoTimer((v) => !v)}>
          <Checkbox on={alsoTimer} />
          <Text style={styles.saveAsTimerLabel}>{t('sheet.alsoSaveAsTimer')}</Text>
        </Pressable>
      )}

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {held.canDelete && (
          <PressBox
            onPress={() => onDelete(draft.id)}
            radius={RADIUS.button}
            scaleTo={0.95}
            dim={0.2}
            style={styles.delete}
            accessibilityLabel={t('sheet.a11yDelete')}
          >
            <Text style={styles.deleteLabel}>{t('common.delete')}</Text>
          </PressBox>
        )}
        <WhiteButton
          label={t('common.done')}
          height={64}
          style={{ flex: 1 }}
          onPress={() =>
            onSave({ ...draft, name: draft.name.trim() || t('defaults.block') }, alsoTimer)
          }
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  saveAsTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: GUTTER,
    paddingTop: 6,
    paddingBottom: 2,
  },
  saveAsTimerLabel: { fontSize: 15, color: C.textSecondary },
  nameRow: { paddingTop: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.divider },
  memoRow: { paddingTop: 14, paddingBottom: 6 },
  memoLabel: { fontSize: 18, lineHeight: 24, fontWeight: '600', color: C.textPrimary },
  memoInput: {
    marginTop: 8,
    fontSize: 17,
    color: C.textPrimary,
    padding: 0,
  },
  nameLabel: { fontSize: 15, color: C.textTertiary },
  nameInputRow: { flexDirection: 'row', alignItems: 'center' },
  nameInput: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: '700',
    color: C.textPrimary,
    padding: 0,
    letterSpacing: -0.5,
  },
  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: GUTTER, paddingTop: 14 },
  delete: {
    width: 96,
    height: 64,
    borderRadius: RADIUS.button,
    backgroundColor: C.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteLabel: { color: C.danger, fontSize: 17, fontWeight: '700' },
});
