import { useState } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import { AppText } from './app-text';
import { theme } from '@/theme';

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: 'primary' | 'secondary';
};
// Native equivalent of ds-button / ds-button--solid; no fixed text height.
export function AppButton({
  label,
  variant = 'primary',
  disabled,
  style,
  onFocus,
  onBlur,
  onPressIn,
  onPressOut,
  ...props
}: Props) {
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);
  const primary = variant === 'primary';
  // Static styles keep NativeWind's native Pressable interop from dropping the button surface.
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? label}
      accessibilityState={{ ...props.accessibilityState, disabled: Boolean(disabled) }}
      aria-disabled={Boolean(disabled)}
      aria-busy={props.accessibilityState?.busy}
      disabled={disabled}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      onPressIn={(event) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      style={[
        {
          minHeight: theme.target,
          minWidth: theme.target,
          paddingVertical: theme.space.md,
          paddingHorizontal: theme.space.lg,
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: theme.radius.control,
          borderWidth: 1,
          borderColor: focused
            ? theme.colors.white
            : disabled
              ? theme.colors.subtle
              : theme.colors.accent,
          backgroundColor:
            disabled || !primary
              ? 'transparent'
              : pressed
                ? theme.colors.accentPressed
                : theme.colors.accent,
          outlineWidth: focused ? 2 : 0,
          outlineOffset: 3,
          outlineColor: theme.colors.white,
        },
        typeof style === 'function' ? style({ pressed }) : style,
      ]}
    >
      <AppText
        style={{
          color: disabled
            ? theme.colors.subtle
            : primary
              ? theme.colors.black
              : theme.colors.accent,
          textAlign: 'center',
          fontWeight: '700',
          fontSize: 12,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
