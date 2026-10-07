import { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';

export function useMotion() {
  const [reduced, setReduced] = useState<boolean | null>(null);
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const preference = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    const app = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => {
      mounted = false;
      preference.remove();
      app.remove();
    };
  }, []);
  return { reduced: reduced !== false, ready: reduced !== null, active };
}
