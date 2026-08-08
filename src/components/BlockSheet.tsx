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
import { tapTick } from '../feedback';
import { t } from '../i18n';
import { C, GUTTER, RADIUS } from '../theme';
import type { Block } from '../types';
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

  useEffect(() => {
    setDraft(block);
    setOpen(null);
    setAlsoTimer(false);
  }, [block]);

  if (!draft) return null;
  const patch = (p: Partial<Block>) => setDraft({ ...draft, ...p });
  const toggle = (f: Exclude<Field, null>) => setOpen(open === f ? null : f);

  return (
    <Sheet visible onClose={onClose}>
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
            divider={false}
          />
        </View>
      </ScrollView>

      {/* 새로 만드는 종목은 타이머로도 남길 수 있다 — 다음 루틴에서 그대로 가져다 쓴다 */}
      {isNew && (
        <Pressable
          style={styles.saveAsTimer}
          onPress={() => {
            tapTick();
            setAlsoTimer((v) => !v);
          }}
        >
          <View style={[styles.checkbox, alsoTimer && styles.checkboxOn]}>
            {alsoTimer && <Text style={styles.check}>✓</Text>}
          </View>
          <Text style={styles.saveAsTimerLabel}>{t('sheet.alsoSaveAsTimer')}</Text>
        </Pressable>
      )}

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {canDelete && (
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
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: C.white, borderColor: C.white },
  check: { fontSize: 14, fontWeight: '800', color: C.onWhite, lineHeight: 17 },
  saveAsTimerLabel: { fontSize: 15, color: C.textSecondary },
  nameRow: { paddingTop: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.divider },
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
