import { useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { LinearGradient as PaperGradient } from 'expo-linear-gradient';
import { CinemaText } from './cinematic-ui';
import { cinema as c } from './cinematic-theme';
import { useEnvelopePosition } from './use-envelope-position';

export const ARRIVAL = 5900;
export const OPENED = 8800;
const smooth = (value: number) => {
  const x = Math.min(1, Math.max(0, value));
  return x * x * (3 - 2 * x);
};
const times = Array.from({ length: 89 }, (_, i) => i * 100);
function sample(clock: Animated.Value, fn: (time: number) => number) {
  return clock.interpolate({ inputRange: times, outputRange: times.map(fn), extrapolate: 'clamp' });
}
function degrees(clock: Animated.Value, fn: (time: number) => number) {
  return clock.interpolate({
    inputRange: times,
    outputRange: times.map((t) => `${fn(t)}deg`),
    extrapolate: 'clamp',
  });
}
export function Crown({ size = 24, color = c.paper }: { size?: number; color?: string }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 32 28"
      accessible={Platform.OS === 'web' ? undefined : false}
      aria-hidden
    >
      <Path
        d="m4 8 6 6 6-10 6 10 6-6-3 15H7L4 8Z M8 26h16"
        fill="none"
        stroke={color}
        strokeWidth={1.3}
      />
    </Svg>
  );
}
function LetterCrown({ scale }: { scale: number }) {
  return (
    <Svg
      testID="letter-crown"
      className={Platform.OS === 'web' ? 'inline-block align-baseline' : undefined}
      width={21 * scale}
      height={19.6 * scale}
      viewBox="0 0 38 34"
      fill="none"
      stroke={c.ink}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: [{ translateY: 2.24 * scale }, { rotate: '-8deg' }] }}
      accessible={false}
      aria-hidden
      focusable={false}
    >
      <Path d="M5 11Q9 14 12 17Q15 10 18 5Q22 11 24 17Q29 12 34 9Q32 19 31 24Q19 26 8 25Q6 18 5 11Z" />
      <Path d="M9 29Q20 30 30 28.5M3 6 1.5 4.5M18 1v1.5M35 5l1.5-1.5" />
    </Svg>
  );
}
function EnvelopeFlap({ showSeal = true }: { showSeal?: boolean }) {
  return (
    <>
      <Path d="M0 0H324L162 120Z" fill="url(#flap)" />
      <Path d="M0 .5H324" stroke={c.quiet} />
      {showSeal && (
        <>
          <Circle cx="162" cy="48" r="25" fill="url(#seal)" stroke={c.border} />
          <Circle cx="162" cy="48" r="22" fill="none" stroke={c.surface} strokeWidth="2" />
          <Path
            d="m152 44 5 5 5-9 5 9 5-5-2.5 14h-15z M155 61h14"
            fill="none"
            stroke={c.paper}
            strokeWidth="1.3"
          />
        </>
      )}
    </>
  );
}
function EnvelopeArt({
  flap = false,
  reverse = false,
  sealed = false,
  lining = false,
}: {
  flap?: boolean;
  reverse?: boolean;
  sealed?: boolean;
  lining?: boolean;
}) {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={flap ? '0 0 324 120' : '0 0 324 200'}
      preserveAspectRatio="none"
      accessible={false}
      aria-hidden
    >
      <Defs>
        <LinearGradient id="body" x1="0" y1="0" x2="1" y2="1">
          <Stop stopColor={c.surface} />
          <Stop offset="1" stopColor={c.black} />
        </LinearGradient>
        <LinearGradient id="left" x2="1" y2="1">
          <Stop stopColor={c.fold} />
          <Stop offset="1" stopColor={c.ink} />
        </LinearGradient>
        <LinearGradient id="right" x1="1" x2="0" y2="1">
          <Stop stopColor={c.surface} />
          <Stop offset="1" stopColor={c.dark} />
        </LinearGradient>
        <LinearGradient id="bottom" x2=".4" y2="1">
          <Stop stopColor={c.fold} />
          <Stop offset="1" stopColor={c.ink} />
        </LinearGradient>
        <LinearGradient id="flap" x2=".3" y2="1">
          <Stop stopColor={c.fold} />
          <Stop offset="1" stopColor={c.dark} />
        </LinearGradient>
        <RadialGradient id="seal" cx=".3" cy=".2" r=".8">
          <Stop stopColor={c.border} />
          <Stop offset=".48" stopColor={c.surface} />
          <Stop offset="1" stopColor={c.black} />
        </RadialGradient>
      </Defs>
      {flap ? (
        <EnvelopeFlap showSeal={!lining} />
      ) : (
        <>
          <Rect x=".5" y=".5" width="323" height="199" rx="3" fill="url(#body)" stroke={c.border} />
          {!reverse && (
            <>
              <Path d="M0 0 188 108 0 200Z" fill="url(#left)" />
              <Path d="M324 0 136 108 324 200Z" fill="url(#right)" />
              <Path d="M0 200v-8L162 84 324 192v8Z" fill="url(#bottom)" />
            </>
          )}
          {reverse && (
            <>
              <Circle cx="162" cy="95" r="22" stroke={c.border} fill="none" />
              <Path d="m152 90 5 5 5-9 5 9 5-5-2.5 14h-15z" fill="none" stroke={c.muted} />
              <SvgText
                x="162"
                y="30"
                fill={c.muted}
                fontSize="8"
                textAnchor="middle"
                letterSpacing="1"
              >
                PERSONAL &amp; CONFIDENTIAL
              </SvgText>
            </>
          )}
          <Path d="M230 162H298" stroke={c.border} />
          <SvgText x="230" y="178" fill={c.paper} fontSize="9" fontWeight="600" letterSpacing=".5">
            No. 031 / 300
          </SvgText>
          <Rect x=".5" y=".5" width="323" height="199" rx="3" stroke={c.border} fill="none" />
          {sealed && <EnvelopeFlap />}
        </>
      )}
    </Svg>
  );
}
export function Envelope({
  clock,
  name,
  opening,
  revealed,
  fontLoaded,
  phase,
  reducedMotion,
}: {
  clock: Animated.Value;
  name: string;
  opening: boolean;
  revealed: boolean;
  fontLoaded: boolean;
  phase: string;
  reducedMotion: boolean;
}) {
  const { width: windowWidth, height: windowHeight, fontScale } = useWindowDimensions();
  const slot = useRef<View>(null);
  const position = useEnvelopePosition(slot, phase, reducedMotion, windowHeight);
  const width = Math.min(c.pageMax - 56, windowWidth - 56) * 0.98;
  const body = width / 1.62;
  const [paper, setPaper] = useState(360);
  const closed = Math.max(288, body * 1.65);
  const expansion = sample(
    clock,
    (t) => closed + (paper + body + 48 - closed) * smooth((t - ARRIVAL) / 650),
  );
  const lift = sample(clock, (t) => -smooth((t - 7300) / 1500) * (paper + body * 0.06));
  const shift = sample(clock, (t) => smooth((t - 7300) / 1500) * paper * 0.5);
  const yaw = (t: number) => -24 + 744 * smooth(t / ARRIVAL);
  // Both faces rotate around their center; the web prototype's left-pivot offset is unnecessary.
  const transform = (reverse = false) => [
    { perspective: 900 },
    { translateY: shift },
    { scale: sample(clock, (t) => 900 / (900 + 540 * Math.pow(1 - smooth(t / ARRIVAL), 0.6))) },
    { rotateX: degrees(clock, (t) => 12 * (1 - smooth(t / ARRIVAL))) },
    { rotateY: degrees(clock, yaw) },
    { rotateZ: degrees(clock, (t) => -55 * (1 - smooth((t - 4300) / 1600))) },
    // Flip the back in local space, after the shared spin, so both faces stay coplanar.
    { rotateY: reverse ? '180deg' : '0deg' },
  ];
  const handwriting = {
    fontFamily: fontLoaded ? 'Caveat' : c.fontWords,
    color: c.ink,
    fontWeight: '500' as const,
    textTransform: 'none' as const,
    letterSpacing: 0,
    textAlign: 'left' as const,
  };
  return (
    <>
      <Animated.View
        ref={slot}
        onLayout={position.onLayout}
        testID="envelope-stage"
        pointerEvents="none"
        style={{ height: expansion, width: '100%' }}
      />
      <Animated.View
        testID="envelope-reverse"
        pointerEvents="none"
        accessible={false}
        aria-hidden
        style={{
          position: 'absolute',
          top: position.top,
          opacity: position.positioned ? 1 : 0,
          marginTop: -body / 2,
          alignSelf: 'center',
          width,
          height: body,
          backfaceVisibility: 'hidden',
          transformOrigin: 'center center',
          transform: transform(true),
        }}
      >
        <EnvelopeArt reverse />
      </Animated.View>
      <Animated.View
        testID="envelope-front"
        style={{
          position: 'absolute',
          top: position.top,
          opacity: position.positioned ? 1 : 0,
          marginTop: -body / 2,
          alignSelf: 'center',
          width,
          height: body,
          backfaceVisibility: 'hidden',
          transformOrigin: 'center center',
          transform: transform(),
        }}
      >
        {/* A single SVG keeps the sealed flap inside the face's backface culling. */}
        {!opening ? (
          <EnvelopeArt sealed />
        ) : (
          <>
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: c.ink, borderRadius: c.corner }]}
            />
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                width,
                height: body * 0.6,
                transformOrigin: 'center top',
                transform: [
                  { perspective: 900 },
                  { rotateX: degrees(clock, (t) => -178 * smooth((t - ARRIVAL) / 1400)) },
                ],
              }}
            >
              <EnvelopeArt flap lining />
            </Animated.View>
            <View
              style={{
                position: 'absolute',
                top: -paper,
                bottom: 0,
                left: 0,
                right: 0,
                overflow: 'hidden',
              }}
              pointerEvents={revealed ? 'auto' : 'none'}
              accessibilityElementsHidden={!revealed}
              importantForAccessibility={revealed ? 'auto' : 'no-hide-descendants'}
              aria-hidden={!revealed}
            >
              <Animated.View
                style={{
                  position: 'absolute',
                  top: paper + body * 0.06,
                  left: '5%',
                  width: '90%',
                  opacity: clock.interpolate({
                    inputRange: [0, 7300, 7301],
                    outputRange: [0, 0, 1],
                    extrapolate: 'clamp',
                  }),
                  transform: [{ translateY: lift }],
                }}
              >
                <PaperGradient
                  colors={[c.white, c.paper]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  onLayout={(e) => setPaper(e.nativeEvent.layout.height)}
                  style={{
                    paddingHorizontal: 17.6,
                    paddingTop: 22.4,
                    paddingBottom: 24,
                    borderWidth: 1,
                    borderColor: c.muted,
                    gap: 16,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      borderBottomWidth: 1,
                      borderColor: c.muted,
                      paddingBottom: 13,
                    }}
                  >
                    <CinemaText
                      style={{ color: c.fold, fontSize: 9, letterSpacing: 1, lineHeight: 13.5 }}
                    >
                      {'PRIVATE\nINVITATION'}
                    </CinemaText>
                    <CinemaText style={{ color: c.fold, fontSize: 12 }}>
                      No.{' '}
                      <CinemaText style={{ color: c.fold, fontSize: 25, fontWeight: '500' }}>
                        031
                      </CinemaText>{' '}
                      / 300
                    </CinemaText>
                  </View>
                  <CinemaText
                    variant={revealed ? 'title' : 'body'}
                    style={[handwriting, { fontSize: 25, lineHeight: 31 }]}
                  >
                    Hi {name || 'there'},
                  </CinemaText>
                  <CinemaText style={[handwriting, { fontSize: 28, lineHeight: 33.6 }]}>
                    You don’t have to be great to start a business, but you have to start to build
                    an empire{' '}
                    <LetterCrown scale={fontScale} />
                  </CinemaText>
                  <View style={{ width: 32, height: 1, backgroundColor: c.border }} />
                  <CinemaText style={[handwriting, { fontSize: 25, lineHeight: 30 }]}>
                    Aaron Sansoni
                  </CinemaText>
                </PaperGradient>
              </Animated.View>
            </View>
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <EnvelopeArt />
            </View>
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                width,
                height: body * 0.6,
                opacity: clock.interpolate({
                  inputRange: [0, ARRIVAL, 6600],
                  outputRange: [1, 1, 0],
                  extrapolate: 'clamp',
                }),
                transformOrigin: 'center top',
                transform: [
                  { perspective: 900 },
                  { rotateX: degrees(clock, (t) => -178 * smooth((t - ARRIVAL) / 1400)) },
                ],
              }}
            >
              <EnvelopeArt flap />
            </Animated.View>
          </>
        )}
      </Animated.View>
    </>
  );
}
