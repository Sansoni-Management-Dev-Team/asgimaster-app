import { useState, type ReactNode, type Ref } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Head from 'expo-router/head';
import Svg, { Path } from 'react-native-svg';
import { AppText } from '@/components/app-text';
import { cinema as c } from './cinematic-theme';

export function MotionIcon({ name }: { name: 'play' | 'pause' | 'replay' }) {
  const replay = name === 'replay';
  return (
    <Svg
      width={replay ? 20 : 16}
      height={replay ? 20 : 16}
      viewBox="0 0 20 20"
      accessible={false}
      aria-hidden
    >
      <Path
        d={
          name === 'pause'
            ? 'M5 4h3v12H5zm7 0h3v12h-3z'
            : name === 'play'
              ? 'm6 3 11 7-11 7z'
              : 'M4.5 6.5a6.5 6.5 0 1 1-1 3.5M4.5 3v3.5H8'
        }
        fill={replay ? 'none' : c.white}
        stroke={replay ? c.white : 'none'}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CinemaText({
  style,
  ...props
}: TextProps & { variant?: 'body' | 'muted' | 'eyebrow' | 'title' }) {
  const fontSize = StyleSheet.flatten(style)?.fontSize ?? (props.variant === 'title' ? 32 : 16);
  return (
    <AppText
      {...props}
      style={[
        {
          color: props.variant === 'muted' ? c.muted : c.white,
          lineHeight: fontSize * 1.5,
          letterSpacing: props.variant === 'title' ? fontSize * 0.1 : 0,
        },
        style,
      ]}
    />
  );
}
export function CinemaButton({
  label,
  onPress,
  solid = false,
  prominent = false,
  disabled = false,
  accessibilityLabel,
  style,
  children,
}: {
  label: string;
  onPress: () => void;
  solid?: boolean;
  prominent?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
  children?: ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      aria-disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        {
          minHeight: solid || prominent ? 56 : 48,
          minWidth: 48,
          paddingVertical: 12,
          paddingHorizontal: 16,
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: c.corner,
          opacity: disabled ? 0.55 : pressed ? 0.8 : 1,
          backgroundColor: solid ? c.white : 'transparent',
          outlineWidth: focused ? 2 : 0,
          outlineColor: c.white,
          outlineOffset: 4,
          borderColor: focused && Platform.OS !== 'web' ? c.white : 'transparent',
          borderWidth: 1,
        },
        style,
      ]}
    >
      {children ?? (
        <CinemaText
          style={{
            color: solid ? c.black : prominent ? c.white : c.muted,
            fontSize: prominent ? 14 : solid ? 12 : 11,
            fontWeight: prominent ? '700' : '600',
            textAlign: 'center',
            textTransform: solid || prominent ? 'uppercase' : 'none',
            letterSpacing: prominent ? 1.4 : solid ? 0.5 : 0,
          }}
        >
          {label}
        </CinemaText>
      )}
    </Pressable>
  );
}
export function CinemaScreen({
  title,
  children,
  backdrop,
  contentStyle,
}: {
  title: string;
  children: ReactNode;
  backdrop?: ReactNode;
  contentStyle?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      role={Platform.OS === 'web' ? 'main' : undefined}
      style={{ flex: 1, backgroundColor: c.black }}
    >
      {Platform.OS === 'web' && (
        <Head>
          <title>{title} — Empire</title>
        </Head>
      )}
      <View style={{ flex: 1, width: '100%', maxWidth: c.pageMax, alignSelf: 'center' }}>
        {backdrop}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              flexGrow: 1,
              paddingTop: Math.max(insets.top, 24),
              paddingBottom: Math.max(insets.bottom, 16),
              paddingHorizontal: Math.max(insets.left, insets.right, 28),
            }}
          >
            <View style={[{ flexGrow: 1, justifyContent: 'flex-end' }, contentStyle]}>
              {children}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}
export function CinemaField({
  label,
  inputRef,
  error,
  visibleLabel = false,
  underline = false,
  style,
  onContentSizeChange,
  ...props
}: TextInputProps & {
  label: string;
  inputRef?: Ref<TextInput>;
  error?: string;
  visibleLabel?: boolean;
  underline?: boolean;
}) {
  const [height, setHeight] = useState(96);
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      {visibleLabel && (
        <CinemaText
          style={{
            fontSize: 12,
            color: underline ? c.white : c.muted,
            textAlign: underline ? 'left' : 'center',
          }}
        >
          {label}
        </CinemaText>
      )}
      <TextInput
        {...props}
        ref={inputRef}
        accessibilityLabel={label}
        accessibilityHint={error || `${props.maxLength ?? 1000} characters maximum.`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${props.nativeID}-error` : undefined}
        allowFontScaling
        placeholderTextColor={c.muted}
        selectionColor={c.border}
        scrollEnabled={false}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        onContentSizeChange={(event) => {
          if (props.multiline) setHeight(Math.max(96, event.nativeEvent.contentSize.height));
          onContentSizeChange?.(event);
        }}
        style={[
          {
            minHeight: 48,
            color: c.white,
            fontFamily: c.fontWords,
            fontSize: 16,
            fontWeight: '600',
            lineHeight: 27.2,
            paddingVertical: 16,
            paddingHorizontal: underline ? 0 : 8,
            textAlign: underline ? 'left' : 'center',
            borderBottomWidth: underline ? 1 : 0,
            borderColor: c.quiet,
            borderRadius: 0,
            outlineWidth: focused ? 2 : 0,
            outlineColor: c.white,
            outlineOffset: 4,
            backgroundColor: 'transparent',
            ...(props.multiline ? { height } : {}),
          },
          style,
        ]}
      />
      {!!error && (
        <CinemaText
          nativeID={`${props.nativeID}-error`}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{ textAlign: 'center', fontSize: 13 }}
        >
          {error}
        </CinemaText>
      )}
    </View>
  );
}
