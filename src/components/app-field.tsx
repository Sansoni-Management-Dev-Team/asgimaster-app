import { useState, type Ref } from 'react';
import { TextInput, View, type TextInputProps, type TextStyle, type StyleProp } from 'react-native';
import { AppText } from './app-text';
import { theme } from '@/theme';

type Props = TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
  inputRef?: Ref<TextInput>;
  labelStyle?: StyleProp<TextStyle>;
};
export function AppField({
  label,
  hint,
  error,
  nativeID,
  inputRef,
  labelStyle,
  style,
  onFocus,
  onBlur,
  ...props
}: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: theme.space.sm }}>
      <AppText nativeID={`${nativeID}-label`} style={labelStyle}>
        {label}
      </AppText>
      <TextInput
        {...props}
        ref={inputRef}
        nativeID={nativeID}
        accessibilityLabel={label}
        accessibilityHint={error || hint}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${nativeID}-error` : hint ? `${nativeID}-hint` : undefined}
        allowFontScaling
        placeholderTextColor={theme.colors.subtle}
        selectionColor={theme.colors.teal}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          {
            minHeight: theme.target,
            padding: theme.space.md,
            borderWidth: 2,
            borderRadius: theme.radius.md,
            borderColor: focused ? theme.colors.teal : theme.colors.controlBorder,
            backgroundColor: theme.colors.surface,
            color: theme.colors.text,
            fontFamily: theme.fontWords,
            fontSize: theme.type.body,
            fontWeight: '600',
          },
          style,
        ]}
      />
      {hint && (
        <AppText nativeID={`${nativeID}-hint`} variant="muted">
          {hint}
        </AppText>
      )}
      {error && (
        <AppText
          nativeID={`${nativeID}-error`}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </AppText>
      )}
    </View>
  );
}
