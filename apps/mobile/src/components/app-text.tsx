import { useCallback, useRef } from 'react';
import { AccessibilityInfo, findNodeHandle, Platform, Text, type TextProps } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { theme } from '@/theme';

type Props = TextProps & { variant?: 'body' | 'muted' | 'eyebrow' | 'title' };
export function AppText({ variant = 'body', style, ...props }: Props) {
  const title = variant === 'title';
  const eyebrow = variant === 'eyebrow';
  const heading = useRef<Text>(null);
  const content = props.children;
  useFocusEffect(
    useCallback(() => {
      if (!title || content == null) return;
      const frame = requestAnimationFrame(() => {
        if (Platform.OS === 'web')
          (heading.current as unknown as HTMLElement | null)?.focus({ preventScroll: true });
        else {
          const tag = findNodeHandle(heading.current);
          if (tag) AccessibilityInfo.setAccessibilityFocus(tag);
        }
      });
      return () => cancelAnimationFrame(frame);
    }, [title, content]),
  );
  const fontSize = title ? theme.type.title : eyebrow ? theme.type.small : theme.type.body;
  return (
    <Text
      ref={heading}
      tabIndex={title && Platform.OS === 'web' ? -1 : undefined}
      accessibilityRole={title ? 'header' : undefined}
      {...props}
      allowFontScaling
      style={[
        {
          fontFamily: theme.fontWords,
          fontSize,
          fontWeight: title || eyebrow ? '700' : '600',
          lineHeight: fontSize * (title ? 1.15 : 1.5),
          color: variant === 'muted' || eyebrow ? theme.colors.muted : theme.colors.text,
          letterSpacing: title || eyebrow ? fontSize * theme.type.tracking : 0,
          textTransform: title || eyebrow ? 'uppercase' : 'none',
          flexShrink: 1,
          // A heading is a reading destination, not a control. Buttons retain visible focus rings.
          ...(title && Platform.OS === 'web'
            ? { outlineWidth: 0, outlineStyle: 'solid' as const }
            : {}),
        },
        style,
      ]}
    />
  );
}
