import { useId } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { theme } from '@/theme';
import { Crown } from '../onboarding/envelope';

// Fine vector grain stays sharp at icon size, without a raster asset or animated shimmer.
const grain = Array.from({ length: 42 }, (_, index) => ({
  y: 3 + index * 0.9,
  opacity: index % 3 === 0 ? 0.1 : 0.045,
}));

export function MembershipCardIcon() {
  const id = `member-card-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const colors = theme.colors;
  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: 46, height: 34, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg
        width={46}
        height={34}
        viewBox="0 0 64 46"
        style={StyleSheet.absoluteFill}
        accessible={Platform.OS === 'web' ? undefined : false}
        aria-hidden
        focusable={false}
      >
        <Defs>
          <LinearGradient id={`${id}-face`} x1="0" y1="0" x2="1" y2="1">
            <Stop stopColor={colors.border} />
            <Stop offset="0.5" stopColor={colors.raised} />
            <Stop offset="1" stopColor={colors.black} />
          </LinearGradient>
          <LinearGradient id={`${id}-light`} x1="0" y1="0" x2="1" y2="0.7">
            <Stop stopColor={colors.white} stopOpacity={0.04} />
            <Stop offset="0.24" stopColor={colors.white} stopOpacity={0.08} />
            <Stop offset="0.43" stopColor={colors.white} stopOpacity={0.28} />
            <Stop offset="0.57" stopColor={colors.white} stopOpacity={0.035} />
            <Stop offset="0.8" stopColor={colors.white} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.white} stopOpacity={0.07} />
          </LinearGradient>
          <LinearGradient id={`${id}-rim`} x1="0" y1="0" x2="0.8" y2="1">
            <Stop stopColor={colors.white} stopOpacity={0.85} />
            <Stop offset="0.45" stopColor={colors.muted} stopOpacity={0.5} />
            <Stop offset="0.72" stopColor={colors.controlBorder} stopOpacity={0.6} />
            <Stop offset="1" stopColor={colors.white} stopOpacity={0.55} />
          </LinearGradient>
          <ClipPath id={`${id}-clip`}>
            <Rect x={1.5} y={2} width={61} height={40} rx={5} />
          </ClipPath>
        </Defs>
        <Rect x={1.5} y={4} width={61} height={40} rx={5} fill={colors.black} />
        <Rect x={1.5} y={2} width={61} height={40} rx={5} fill={`url(#${id}-face)`} />
        <G clipPath={`url(#${id}-clip)`}>
          <Rect width={64} height={44} fill={`url(#${id}-light)`} />
          {grain.map(({ y, opacity }, index) => (
            <Path
              key={index}
              d={`M0 ${y}h64`}
              stroke={colors.white}
              strokeWidth={0.3}
              opacity={opacity}
            />
          ))}
        </G>
        <Rect
          x={1.5}
          y={2}
          width={61}
          height={40}
          rx={5}
          fill="none"
          stroke={`url(#${id}-rim)`}
          strokeWidth={1}
        />
        <Path d="M7 3.5h50" stroke={colors.white} strokeWidth={0.5} opacity={0.22} />
        <Path d="M7 43h50" stroke={colors.controlBorder} strokeWidth={0.6} opacity={0.5} />
      </Svg>
      <View style={{ position: 'absolute', zIndex: 1, transform: [{ translateY: 0.8 }] }}>
        <Crown size={21} color={colors.black} />
      </View>
      <View style={{ position: 'absolute', zIndex: 2 }}>
        <Crown size={21} color={colors.white} />
      </View>
    </View>
  );
}
