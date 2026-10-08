import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, type ViewStyle } from 'react-native';
import type { useMotion } from './use-motion';

const delayFor = (index: number) => (index === 0 ? 0 : 420 + (index - 1) * 140);
const durationFor = (index: number) => (index === 0 ? 560 : 480);
// Sample the curve so the native driver and web use the same eased interpolation.
const fractions = Array.from({ length: 17 }, (_, index) => index / 16);
const eased = fractions.map(Easing.out(Easing.cubic));

export function useQuestionEntrance({
  screen,
  enabled,
  count,
  motion,
}: {
  screen: string;
  enabled: boolean;
  count: number;
  motion: ReturnType<typeof useMotion>;
}) {
  const [clock] = useState(() => new Animated.Value(0));
  const elapsed = useRef(0);
  const revealed = useRef(1);
  const [visibleCount, setVisibleCount] = useState(1);
  const total = delayFor(count - 1) + durationFor(count - 1);

  useEffect(() => {
    const listener = clock.addListener(({ value }) => {
      elapsed.current = value;
      let next = 1;
      while (next < count && value >= delayFor(next) + durationFor(next)) next++;
      if (revealed.current !== next) {
        revealed.current = next;
        setVisibleCount(next);
      }
    });
    return () => clock.removeListener(listener);
  }, [clock, count]);

  useLayoutEffect(() => {
    clock.setValue(0);
    elapsed.current = 0;
  }, [clock, screen, enabled]);

  useEffect(() => {
    if (!enabled || !motion.ready) return;
    if (motion.reduced) {
      clock.setValue(total);
      return;
    }
    if (!motion.active) return;
    const animation = Animated.timing(clock, {
      toValue: total,
      duration: Math.max(0, total - elapsed.current),
      easing: Easing.linear,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [clock, screen, enabled, total, motion.ready, motion.reduced, motion.active]);

  return {
    clock,
    visibleCount: motion.ready && motion.reduced ? count : visibleCount,
    reduced: motion.ready && motion.reduced,
    revealAll() {
      clock.stopAnimation();
      clock.setValue(total);
    },
  };
}

export function QuestionReveal({
  entrance,
  index,
  style,
  children,
}: {
  entrance: ReturnType<typeof useQuestionEntrance>;
  index: number;
  style?: ViewStyle;
  children: ReactNode;
}) {
  const visible = index < entrance.visibleCount;
  const progress = entrance.clock.interpolate({
    inputRange: fractions.map((fraction) => delayFor(index) + fraction * durationFor(index)),
    outputRange: eased,
    extrapolate: 'clamp',
  });
  return (
    <Animated.View
      testID={`question-reveal-${index}`}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      aria-hidden={!visible}
      {...(Platform.OS === 'web' ? { inert: !visible } : {})}
      style={[
        style,
        {
          opacity: entrance.reduced ? 1 : progress,
          transform: [
            {
              translateY: entrance.reduced
                ? 0
                : progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
