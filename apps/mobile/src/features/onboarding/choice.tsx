import { useEffect, useState, type KeyboardEvent, type Ref } from 'react';
import { Animated, Platform, Pressable, View } from 'react-native';
import { CinemaText } from './cinematic-ui';
import { cinema as c } from './cinematic-theme';

export function Choice({
  label,
  description,
  selected,
  disabled,
  onPress,
  controlRef,
  tabStop,
  onNavigate,
  reduced,
  industry = false,
}: {
  label: string;
  description?: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
  controlRef?: Ref<View>;
  tabStop: boolean;
  onNavigate: (direction: number) => void;
  reduced: boolean;
  industry?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [scale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!selected || reduced) {
      scale.setValue(1);
      return;
    }
    scale.setValue(0.975);
    const animation = Animated.timing(scale, { toValue: 1, duration: 240, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [selected, reduced, scale]);
  const keyboard =
    Platform.OS === 'web'
      ? {
          onKeyDown(event: KeyboardEvent<HTMLElement>) {
            if (disabled) return;
            if (event.key === ' ') {
              event.preventDefault();
              onPress();
            } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
              event.preventDefault();
              onNavigate(event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1);
            }
          },
          tabIndex: tabStop ? (0 as const) : (-1 as const),
        }
      : {};
  return (
    <Animated.View
      style={{
        transform: [{ scale }],
      }}
    >
      <Pressable
        {...keyboard}
        ref={controlRef}
        accessibilityRole="radio"
        accessibilityLabel={label}
        accessibilityHint={
          description
            ? `${description}. Selecting continues to the next question.`
            : 'Selecting continues to the next question.'
        }
        accessibilityState={{ checked: selected, disabled }}
        aria-checked={selected}
        aria-disabled={disabled}
        disabled={disabled}
        onPress={onPress}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          minWidth: 48,
          minHeight: 56,
          paddingVertical: 14.4,
          paddingHorizontal: industry ? 8 : 24,
          borderRadius: c.corner,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: selected ? c.white : 'transparent',
          outlineWidth: focused ? 2 : 0,
          outlineColor: c.white,
          outlineOffset: 4,
          borderWidth: Platform.OS !== 'web' && focused ? 1 : 0,
          borderColor: c.white,
        }}
      >
        <CinemaText
          style={{
            color: selected ? c.black : c.muted,
            fontSize: industry ? 14.4 : 16,
            textAlign: 'center',
            fontWeight: '600',
          }}
        >
          {label}
        </CinemaText>
        {!!description && (
          <CinemaText
            style={{
              color: selected ? c.black : c.muted,
              fontSize: 12,
              lineHeight: 20,
              textAlign: 'center',
              marginTop: c.space.sm,
            }}
          >
            {description}
          </CinemaText>
        )}
      </Pressable>
    </Animated.View>
  );
}
