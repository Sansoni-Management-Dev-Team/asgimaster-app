import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { CinemaScreen, CinemaText } from './cinematic-ui';
import { useMotion } from './use-motion';
import { useIsFocused } from 'expo-router';

export function Interlude({
  direction,
  onComplete,
}: {
  direction: boolean;
  onComplete: () => void;
}) {
  const [opacity] = useState(() => new Animated.Value(0));
  const motion = useMotion();
  const focused = useIsFocused();
  const complete = useRef(onComplete);
  useEffect(() => {
    complete.current = onComplete;
  }, [onComplete]);
  useEffect(() => {
    if (!focused || !motion.ready || !motion.active) return;
    const sequence = Animated.sequence([
      Animated.delay(2000),
      Animated.timing(opacity, {
        toValue: 1,
        duration: motion.reduced ? 0 : 800,
        useNativeDriver: true,
      }),
      Animated.delay(2600),
      Animated.timing(opacity, {
        toValue: 0,
        duration: motion.reduced ? 0 : 700,
        useNativeDriver: true,
      }),
      Animated.delay(1000),
    ]);
    sequence.start(({ finished }) => {
      if (finished) complete.current();
    });
    return () => sequence.stop();
  }, [focused, motion.active, motion.ready, motion.reduced, opacity]);
  return (
    <CinemaScreen
      title={direction ? 'Your direction' : 'Your first decision'}
      contentStyle={{ justifyContent: 'center' }}
    >
      <Animated.View style={{ opacity }}>
        <CinemaText variant="title" style={{ fontSize: 24, lineHeight: 33, textAlign: 'center' }}>
          {direction
            ? 'Every empire starts\nwith a direction.'
            : 'Every empire starts\nwith a decision.\nLet’s make yours.'}
        </CinemaText>
      </Animated.View>
    </CinemaScreen>
  );
}
