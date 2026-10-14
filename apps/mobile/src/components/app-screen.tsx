import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Head from 'expo-router/head';
import { AppText } from './app-text';
import { theme } from '@/theme';

export function AppScreen({
  children,
  actions,
  title,
  showBranding = true,
  contentAlignment = 'top',
}: {
  children: ReactNode;
  actions: ReactNode;
  title: string;
  showBranding?: boolean;
  contentAlignment?: 'top' | 'bottom';
}) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      role={Platform.OS === 'web' ? 'main' : undefined}
      colors={[theme.colors.backgroundStart, theme.colors.backgroundEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      {Platform.OS === 'web' && (
        <Head>
          <title>{title} — Master App</title>
        </Head>
      )}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: Math.max(insets.top, theme.space.lg),
            paddingBottom: Math.max(insets.bottom, theme.space.lg),
            paddingLeft: Math.max(insets.left, theme.space.md),
            paddingRight: Math.max(insets.right, theme.space.md),
          }}
        >
          <View
            style={{ flexGrow: 1, width: '100%', maxWidth: theme.pageMax, alignSelf: 'center' }}
          >
            {showBranding && (
              <View
                className="flex-row flex-wrap items-center justify-between gap-4"
                style={{ paddingBottom: theme.space.xxl }}
              >
                <AppText variant="eyebrow" style={{ color: theme.colors.text }}>
                  Master App
                </AppText>
                <AppText variant="eyebrow">Demo</AppText>
              </View>
            )}
            <View
              style={{
                flexGrow: 1,
                gap: theme.space.lg,
                justifyContent: contentAlignment === 'bottom' ? 'flex-end' : 'flex-start',
              }}
            >
              {children}
            </View>
            <View style={{ gap: theme.space.md, paddingTop: theme.space.xxl }}>{actions}</View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
