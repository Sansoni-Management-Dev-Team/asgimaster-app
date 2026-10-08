import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { Animated, Easing, View, type LayoutChangeEvent } from 'react-native';

// The layout slot can move immediately when controls change. Keep the artwork at
// its current visible position, then ease away the difference from the new slot.
export function useEnvelopePosition(
  slot: RefObject<View | null>,
  phase: string,
  reducedMotion: boolean,
  viewportHeight: number,
) {
  const previous = useRef<{ phase: string; center: number } | null>(null);
  const offsetValue = useRef(0);
  const [center] = useState(() => new Animated.Value(0));
  const [offset] = useState(() => new Animated.Value(0));
  const [positioned, setPositioned] = useState(false);

  useEffect(() => {
    const listener = offset.addListener(({ value }) => {
      offsetValue.current = value;
    });
    return () => {
      offset.stopAnimation();
      offset.removeListener(listener);
    };
  }, [offset]);

  const place = useCallback(
    (y: number, height: number) => {
      const next = y + height / 2;
      const last = previous.current;
      if (reducedMotion) {
        offset.stopAnimation();
        offset.setValue(0);
      } else if (last && last.phase !== phase) {
        offset.stopAnimation();
        offset.setValue(last.center + offsetValue.current - next);
        Animated.timing(offset, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }).start();
      }
      center.setValue(next);
      previous.current = { phase, center: next };
      if (!last) setPositioned(true);
    },
    [center, offset, phase, reducedMotion],
  );

  useLayoutEffect(() => {
    // Web onLayout reports size changes, so also measure position-only changes.
    let cancelled = false;
    slot.current?.measure((_x, y, _width, height) => {
      if (!cancelled) place(y, height);
    });
    return () => {
      cancelled = true;
    };
  }, [place, slot, viewportHeight]);

  function onLayout(event: LayoutChangeEvent) {
    const { y, height } = event.nativeEvent.layout;
    place(y, height);
  }

  return { onLayout, top: Animated.add(center, offset), positioned };
}
