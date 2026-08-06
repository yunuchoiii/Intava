/** 5.4 종목 편집 시트 — 하단 시트, 뒤 화면은 45% 어둡게 */
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { ABS, C, E3, GUTTER, RADIUS } from '../theme';
import type { Block } from '../types';
import { PressBox } from './PressBox';
import { ValueRow } from './ValueRow';
import { WhiteButton } from './Buttons';

type Props = {
  block: Block | null;
  canDelete: boolean;
  onClose: () => void;
  onSave: (b: Block) => void;
  onDelete: (id: string) => void;
};

type Field = 'work' | 'rest' | 'sets' | null;

export function BlockSheet({ block, canDelete, onClose, onSave, onDelete }: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Block | null>(block);
  const [open, setOpen] = useState<Field>(null);

  useEffect(() => {
    setDraft(block);
    setOpen(null);
  }, [block]);

  if (!draft) return null;
  const patch = (p: Partial<Block>) => setDraft({ ...draft, ...p });
  const toggle = (f: Exclude<Field, null>) => setOpen(open === f ? null : f);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
      >
        <View style={[styles.sheet, E3]}>
          <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={[C.sheetTop, C.sheetBottom]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
          <View style={styles.sheetBorder} pointerEvents="none" />

          <View style={styles.grabWrap}>
            <View style={styles.grab} />
          </View>

          <ScrollView
            style={{ maxHeight: 560 }}
            contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            <View>
              <View style={styles.nameRow}>
                <Text style={styles.nameLabel}>{t('sheet.blockName')}</Text>
                <TextInput
                  value={draft.name}
                  onChangeText={(name) => patch({ name })}
                  style={styles.nameInput}
                  placeholder={t('sheet.blockNamePlaceholder')}
                  placeholderTextColor={C.textTertiary}
                  selectionColor={C.textPrimary}
                  maxLength={20}
                  returnKeyType="done"
                />
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
              onPress={() => onSave({ ...draft, name: draft.name.trim() || t('defaults.block') })}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...ABS, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    overflow: 'hidden',
  },
  sheetBorder: {
    ...ABS,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
  },
  grabWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  grab: { width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.24)' },
  nameRow: { paddingTop: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.divider },
  nameLabel: { fontSize: 15, color: C.textTertiary },
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
