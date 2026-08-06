/**
 * 값 한 줄 — 탭하면 그 자리에서 휠 피커가 인라인으로 펼쳐진다 (한 번에 하나만).
 * 핸드오프 5.2 · 5.4 · 5.5
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, TABULAR } from '../theme';
import { InfoTip } from './InfoTip';
import { CountWheel, TimeWheel } from './WheelPicker';

type Common = {
  title: string;
  tip?: string;
  tipOpen?: boolean;
  onTip?: () => void;
  display: string;
  open: boolean;
  onToggle: () => void;
  titleSize?: number;
  valueSize?: number;
  divider?: boolean;
  chevron?: boolean;
};

type Props = Common &
  (
    | { wheel: 'time'; value: number; onChange: (n: number) => void; allowZero?: boolean }
    | {
        wheel: 'count';
        value: number;
        onChange: (n: number) => void;
        min?: number;
        max?: number;
        unit?: string;
      }
  );

export function ValueRow(props: Props) {
  const {
    title,
    tip,
    tipOpen = false,
    onTip,
    display,
    open,
    onToggle,
    titleSize = 18,
    valueSize = 22,
    divider = true,
    chevron = false,
  } = props;

  return (
    /* 툴팁은 이 행의 자식이라, 행 자체를 올려두지 않으면 다음 행들이 그 위에 그려진다 */
    <View style={[divider && styles.divided, tipOpen && styles.raised]}>
      <Pressable
        onPress={onToggle}
        style={styles.row}
        accessibilityRole="button"
        accessibilityLabel={`${title} ${display}`}
      >
        <View style={styles.titleWrap}>
          <Text
            style={{
              fontSize: titleSize,
              lineHeight: Math.round(titleSize * 1.35),
              fontWeight: '600',
              color: C.textPrimary,
            }}
          >
            {title}
          </Text>
          {tip && onTip && <InfoTip text={tip} open={tipOpen} onToggle={onTip} />}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text
            style={[
              TABULAR,
              {
                fontSize: valueSize,
                lineHeight: Math.round(valueSize * 1.35),
                fontWeight: '700',
                color: open ? C.textPrimary : C.textSecondary,
              },
            ]}
          >
            {display}
          </Text>
          {chevron && <Text style={styles.chevron}>›</Text>}
        </View>
      </Pressable>

      {open &&
        (props.wheel === 'time' ? (
          <TimeWheel value={props.value} onChange={props.onChange} allowZero={props.allowZero} />
        ) : (
          <CountWheel
            value={props.value}
            onChange={props.onChange}
            min={props.min}
            max={props.max}
            unit={props.unit}
          />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  divided: { borderBottomWidth: 1, borderBottomColor: C.divider },
  raised: { zIndex: 30, elevation: 30 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  titleWrap: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  chevron: { fontSize: 20, color: C.textTertiary, marginLeft: 8 },
});
