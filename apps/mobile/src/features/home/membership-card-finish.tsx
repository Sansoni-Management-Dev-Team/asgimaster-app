import { useId } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Pattern, Rect, Stop } from 'react-native-svg';
import { theme } from '@/theme';

/** A static brushed finish: it never animates or sits in front of card content. */
export function MembershipCardFinish() {
  const id = `membership-finish-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const colors = theme.colors;
  return (
    <View
      pointerEvents="none"
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { borderRadius: theme.radius.lg, overflow: 'hidden' }]}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 400 240"
        preserveAspectRatio="none"
        accessible={Platform.OS === 'web' ? undefined : false}
        aria-hidden
        focusable={false}
      >
        <Defs>
          <LinearGradient id={`${id}-face`} x1="0" y1="0" x2="0.85" y2="1">
            <Stop stopColor={colors.border} />
            <Stop offset="0.42" stopColor={colors.raised} />
            <Stop offset="1" stopColor={colors.backgroundStart} />
          </LinearGradient>
          <LinearGradient id={`${id}-reflection`} x1="0" y1="0" x2="1" y2="0.6">
            <Stop stopColor={colors.white} stopOpacity={0.04} />
            <Stop offset="0.28" stopColor={colors.white} stopOpacity={0} />
            <Stop offset="0.54" stopColor={colors.white} stopOpacity={0.035} />
            <Stop offset="0.68" stopColor={colors.white} stopOpacity={0.18} />
            <Stop offset="0.73" stopColor={colors.white} stopOpacity={0.07} />
            <Stop offset="0.88" stopColor={colors.white} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.white} stopOpacity={0.04} />
          </LinearGradient>
          <LinearGradient id={`${id}-edge`} x1="0" y1="0" x2="0.8" y2="1">
            <Stop stopColor={colors.white} stopOpacity={0.65} />
            <Stop offset="0.3" stopColor={colors.muted} stopOpacity={0.25} />
            <Stop offset="0.62" stopColor={colors.controlBorder} stopOpacity={0.15} />
            <Stop offset="1" stopColor={colors.white} stopOpacity={0.35} />
          </LinearGradient>
          <Pattern id={`${id}-grain`} width={100} height={6} patternUnits="userSpaceOnUse">
            <Path d="M0 1h100M0 4h100" stroke={colors.white} strokeWidth={0.35} opacity={0.045} />
            <Path d="M12 2.5h52M71 5.5h27" stroke={colors.white} strokeWidth={0.3} opacity={0.04} />
            <Path d="M0 2h100M0 5h100" stroke={colors.black} strokeWidth={0.5} opacity={0.18} />
          </Pattern>
        </Defs>
        <Rect width={400} height={240} fill={`url(#${id}-face)`} />
        <Rect width={400} height={240} fill={`url(#${id}-reflection)`} />
        <Rect width={400} height={240} fill={`url(#${id}-grain)`} />
        <Rect
          x={0.75}
          y={0.75}
          width={398.5}
          height={238.5}
          rx={8}
          fill="none"
          stroke={`url(#${id}-edge)`}
        />
        <Path d="M9 2h382" stroke={colors.white} strokeWidth={0.5} opacity={0.14} />
        <Path d="M9 238h382" stroke={colors.black} strokeWidth={1.5} opacity={0.7} />
      </Svg>
    </View>
  );
}
