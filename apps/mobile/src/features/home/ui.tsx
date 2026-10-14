import { useEffect, useState, type ReactNode, type Ref } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type PressableProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Head from 'expo-router/head';
import Svg, { Path, Circle } from 'react-native-svg';
import { AppText } from '@/components/app-text';
import { MemberHeader } from '@/components/member-header';
import { MembershipCardIcon } from './membership-card-icon';
import { theme } from '@/theme';
import { type MemberEvent, eventDate, eventTime } from './events';
import { type Lesson } from './model';
import { useSupport, useSupportUI } from '../support/store';
import { unreadCount } from '../support/model';

export type Tab = 'home' | 'library' | 'events' | 'coach' | 'support';
export type Destination = Tab | 'profile' | 'membership' | 'lesson' | 'event' | 'plan';
export type Go = (view: Destination, id?: string) => void;
const icons = {
  home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  library: 'M12 5v15M3 4l9 2 9-2v14l-9 2-9-2Z',
  events: 'M3 5h18v16H3ZM7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2',
  coach: 'M12 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0M3 20v-2a6 6 0 0 1 12 0v2M16 4h5v7l-3-2h-2',
  support: 'M4 13v-2a8 8 0 0 1 16 0v6a4 4 0 0 1-4 4h-3M2 11h4v7H2Zm16 0h4v7h-4Z',
  history: 'M3 11a9 9 0 1 1 2 7M3 3v8h8m1-5v6l4 2',
  check: 'm5 12 4 4L19 6',
  chat: 'M20 11a8 8 0 0 1-8 8H4l1.5-4A8 8 0 1 1 20 11ZM8 10h8M8 14h5',
  spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z',
  play: 'm9 5 11 7-11 7Z',
  lock: 'M5 10h14v11H5ZM8 10V7a4 4 0 0 1 8 0v3',
  close: 'm6 6 12 12M6 18 18 6',
} as const;
export function Icon({
  name,
  size = 20,
  color = theme.colors.accent,
}: {
  name: keyof typeof icons;
  size?: number;
  color?: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={Platform.OS === 'web' ? undefined : false}
      aria-hidden
      focusable={false}
    >
      <Path d={icons[name]} />
    </Svg>
  );
}
export function Copy({
  size = 14,
  muted = false,
  caps = false,
  style,
  ...props
}: TextProps & { size?: number; muted?: boolean; caps?: boolean }) {
  return (
    <AppText
      {...props}
      style={[
        {
          fontSize: size,
          lineHeight: size * 1.5,
          color: muted ? theme.colors.muted : theme.colors.text,
          fontWeight: '600',
          ...(caps
            ? {
                textTransform: 'uppercase',
                fontWeight: '700',
                letterSpacing: size * theme.type.tracking,
              }
            : {}),
        },
        style,
      ]}
    />
  );
}
export function Hit({
  children,
  style,
  grid,
  controlRef,
  accessibilityRole = 'button',
  ...props
}: PressableProps & {
  children: ReactNode;
  grid?: 'metric' | 'status' | 'tab';
  controlRef?: Ref<View>;
}) {
  const [focused, setFocused] = useState(false);
  const { fontScale } = useWindowDimensions();
  const control = (
    <Pressable
      ref={controlRef}
      {...props}
      accessibilityRole={accessibilityRole}
      aria-checked={props.accessibilityState?.checked}
      aria-expanded={props.accessibilityState?.expanded}
      aria-pressed={accessibilityRole === 'button' ? props.accessibilityState?.selected : undefined}
      aria-selected={accessibilityRole === 'tab' ? props.accessibilityState?.selected : undefined}
      aria-disabled={props.disabled || props.accessibilityState?.disabled}
      aria-busy={props.accessibilityState?.busy}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={(s) => [
        {
          minWidth: theme.target,
          minHeight: theme.target,
          justifyContent: 'center',
          opacity: s.pressed ? 0.75 : 1,
          borderRadius: theme.radius.md,
          outlineWidth: focused ? 2 : 0,
          outlineColor: theme.colors.focus,
          // Grid items sit against the scroll edge; keep their focus ring inside it.
          outlineOffset: grid ? -2 : 2,
        },
        typeof style === 'function' ? style(s) : style,
      ]}
    >
      {children}
    </Pressable>
  );
  // Keep CSS grid sizing on a static View: NativeWind drops Pressable callback styles
  // when an arbitrary CSS class and a style callback are passed to the same control.
  return grid ? (
    <View
      className={`member-${grid === 'status' ? 'status-card' : grid}`}
      style={{
        flex: 1,
        minWidth: (grid === 'metric' ? 80 : grid === 'status' ? 128 : 48) * fontScale,
      }}
    >
      {control}
    </View>
  ) : (
    control
  );
}
export const cardStyle: ViewStyle = {
  borderWidth: 1,
  borderColor: theme.colors.border,
  borderRadius: theme.radius.lg,
  backgroundColor: theme.colors.surface,
  paddingVertical: 16,
  paddingHorizontal: 12,
};
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[cardStyle, { gap: 12 }, style]}>{children}</View>;
}
export function Solid({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Hit
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 56,
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: theme.radius.control,
        backgroundColor: disabled ? theme.colors.raised : theme.colors.accent,
      }}
    >
      <Copy
        size={12}
        caps
        style={{ textAlign: 'center', color: disabled ? theme.colors.muted : theme.colors.black }}
      >
        {label}
      </Copy>
    </Hit>
  );
}
export function TextAction({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Hit onPress={onPress} disabled={disabled} accessibilityState={{ disabled }}>
      <Copy size={14} style={{ color: disabled ? theme.colors.muted : theme.colors.accent }}>
        {label}
      </Copy>
    </Hit>
  );
}
export function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: () => void;
}) {
  return (
    <View style={{ marginTop: 32 }}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <Copy caps size={12} accessibilityRole="header" style={{ flexShrink: 1 }}>
          {title}
        </Copy>
        {action && (
          <Hit onPress={action} accessibilityLabel={`View all ${title.toLowerCase()}`}>
            <Copy muted size={12}>
              View all
            </Copy>
          </Hit>
        )}
      </View>
      {children}
    </View>
  );
}
export function Heading({
  title,
  back,
  profile,
}: {
  title: string;
  back?: () => void;
  profile?: { label: string; press: () => void };
}) {
  return (
    <MemberHeader
      title={title}
      actions={
        profile && (
          <Hit
            onPress={profile.press}
            accessibilityLabel={profile.label}
            style={{
              width: 48,
              height: 48,
              alignItems: 'center',
            }}
          >
            <MembershipCardIcon />
          </Hit>
        )
      }
      back={
        back && (
          <Hit
            onPress={back}
            accessibilityLabel="Back to Home"
            style={{ minWidth: 48, alignSelf: 'flex-start', alignItems: 'center' }}
          >
            <Copy size={12}>Back</Copy>
          </Hit>
        )
      }
    />
  );
}
export function MemberFrame({
  children,
  title,
  active,
  go,
  primary,
  footerContent,
  contentRef,
}: {
  children: ReactNode;
  title: string;
  active: Tab;
  go: Go;
  primary?: { label: string; press: () => void };
  footerContent?: ReactNode;
  contentRef?: Ref<ScrollView>;
}) {
  const insets = useSafeAreaInsets();
  const support = useSupport();
  const hydrateSupport = support.hydrate;
  useEffect(() => {
    void hydrateSupport();
  }, [hydrateSupport]);
  const unread = unreadCount(support.data);
  const notification = useSupportUI((s) => s.notification);
  const { height, fontScale } = useWindowDimensions();
  const [footerHeight, setFooterHeight] = useState(0);
  const flowing = height < 500 || fontScale > 1.5 || footerHeight > height * 0.45;
  const footer = (
    <View
      testID="member-footer"
      onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
      style={{ paddingTop: primary ? 16 : 0, paddingBottom: Math.max(8, insets.bottom) }}
    >
      {primary && <Solid label={primary.label} onPress={primary.press} />}
      {footerContent}
      <View
        role={Platform.OS === 'web' ? 'navigation' : undefined}
        accessibilityLabel="Main navigation"
        style={{
          borderTopWidth: 1,
          borderColor: theme.colors.border,
          marginTop: 16,
          paddingTop: 8,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 4,
        }}
      >
        {(['home', 'library', 'events', 'coach', 'support'] as const).map((tab) => (
          <Hit
            key={tab}
            accessibilityLabel={
              tab === 'support' && unread
                ? `Support, ${unread} unread`
                : tab[0].toUpperCase() + tab.slice(1)
            }
            grid="tab"
            onPress={() => go(tab)}
            accessibilityState={{ selected: active === tab }}
            aria-current={active === tab ? 'page' : undefined}
            style={{
              flex: 1,
              minWidth: 48 * fontScale,
              alignItems: 'center',
              gap: 8,
              paddingVertical: 8,
              borderRadius: theme.radius.control,
              backgroundColor: active === tab ? theme.colors.raised : 'transparent',
            }}
          >
            <Icon
              name={tab}
              size={24}
              color={active === tab ? theme.colors.accent : theme.colors.muted}
            />
            {tab === 'support' && unread > 0 && (
              <Copy size={10} style={{ color: theme.colors.accent }}>
                {unread} unread
              </Copy>
            )}
            <Copy
              size={12}
              style={{
                color: active === tab ? theme.colors.accent : theme.colors.muted,
                fontWeight: '700',
                textDecorationLine: active === tab ? 'underline' : 'none',
              }}
            >
              {tab[0].toUpperCase() + tab.slice(1)}
            </Copy>
          </Hit>
        ))}
      </View>
    </View>
  );
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
        style={{
          flex: 1,
          width: '100%',
          maxWidth: theme.pageMax,
          alignSelf: 'center',
          paddingTop: Math.max(16, insets.top),
          paddingLeft: Math.max(16, insets.left),
          paddingRight: Math.max(16, insets.right),
        }}
      >
        {notification && (
          <View
            role="status"
            style={{
              borderWidth: 1,
              borderColor: theme.colors.accent,
              borderRadius: 12,
              padding: 12,
              gap: 4,
            }}
          >
            <Copy size={12}>Master App · Support</Copy>
            <Copy>A reply is ready.</Copy>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <TextAction
                label="Open conversation"
                onPress={() => {
                  useSupportUI.setState({ notification: null });
                  go('support', notification);
                }}
              />
              <TextAction
                label="Dismiss notification"
                onPress={() => useSupportUI.setState({ notification: null })}
              />
            </View>
          </View>
        )}
        <ScrollView
          ref={contentRef}
          testID="member-content"
          key={title}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 24 }}
          style={{ flex: 1, minHeight: 0 }}
        >
          {children}
          {flowing && footer}
        </ScrollView>
        {!flowing && footer}
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
export function Metric({
  label,
  value,
  unit,
  percent,
  color,
  description,
  press,
}: {
  label: string;
  value: number;
  unit: string;
  percent: number;
  color: string;
  description: string;
  press: () => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const diameter = Math.min(140, (Math.min(width, 480) - 48) / 3);
  const numberSize = Math.min(40, Math.max(28, (Math.min(width, 480) - 32) * 0.1));
  return (
    <Hit
      grid="metric"
      accessibilityLabel={`${label}: ${description}. View progress.`}
      onPress={press}
      style={{ flex: 1, minWidth: 80 * fontScale, alignItems: 'center' }}
    >
      <View
        style={{
          width: Math.max(diameter, 80 * fontScale),
          maxWidth: '100%',
          aspectRatio: 1,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          style={{ position: 'absolute' }}
          accessible={Platform.OS === 'web' ? undefined : false}
          aria-hidden
          focusable={false}
        >
          <Circle cx={50} cy={50} r={44} stroke={theme.colors.raised} strokeWidth={6} fill="none" />
          {percent > 0 && (
            <Circle
              cx={50}
              cy={50}
              r={44}
              stroke={color}
              strokeWidth={6}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${Math.min(100, Math.max(0, percent)) * 2.7646} 276.46`}
              rotation={-90}
              origin="50, 50"
            />
          )}
        </Svg>
        <Copy
          size={numberSize}
          style={{
            fontFamily: theme.fontNumbers,
            fontWeight: '700',
            lineHeight: numberSize,
            letterSpacing: numberSize * 0.025,
          }}
        >
          {value}
          <Copy
            size={numberSize * (unit === '/3' ? 0.65 : 0.5)}
            style={{ fontFamily: theme.fontNumbers, fontWeight: '700' }}
          >
            {unit}
          </Copy>
        </Copy>
      </View>
      <Copy caps size={12} style={{ marginTop: 12 }}>
        {label}
      </Copy>
    </Hit>
  );
}
export function LessonRow({
  lesson,
  detail,
  press,
}: {
  lesson: Lesson;
  detail: string;
  press: () => void;
}) {
  const { fontScale } = useWindowDimensions();
  return (
    <Hit
      onPress={press}
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 12,
        padding: 8,
        minHeight: 72,
        backgroundColor: theme.colors.surface,
      }}
    >
      <View
        style={{
          minWidth: 52,
          minHeight: 44,
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: 6,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 4,
        }}
      >
        <Copy size={12} style={{ color: theme.colors.accent }}>
          {lesson.minutes} min
        </Copy>
      </View>
      <View style={{ flex: 1, minWidth: Math.min(220, 100 * fontScale), gap: 4 }}>
        <Copy size={12} style={{ fontWeight: '700' }}>
          {lesson.title}
        </Copy>
        <Copy size={11} muted>
          {detail}
        </Copy>
      </View>
    </Hit>
  );
}
export function EventCard({
  event,
  status,
  press,
}: {
  event: MemberEvent;
  status: string;
  press: () => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  return (
    <Hit
      onPress={press}
      style={[cardStyle, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}
    >
      {width >= 350 && fontScale < 1.5 && (
        <View
          style={{
            alignSelf: 'flex-start',
            width: 48,
            paddingVertical: 8,
            backgroundColor: theme.colors.raised,
            borderRadius: 6,
            alignItems: 'center',
          }}
        >
          <Copy caps size={10} muted>
            {eventDate(event, { weekday: undefined, day: undefined, year: undefined })}
          </Copy>
          <Copy
            size={28}
            style={{ fontFamily: theme.fontNumbers, lineHeight: 34, fontWeight: '700' }}
          >
            {eventDate(event, { weekday: undefined, month: undefined, year: undefined })}
          </Copy>
        </View>
      )}
      <View style={{ flex: 1, gap: 8 }}>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <Copy size={12} muted>
            {event.format === 'online' ? 'Online' : 'In person'}
          </Copy>
          <Copy
            size={10}
            style={{
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: 6,
              paddingVertical: 4,
              paddingHorizontal: 8,
              color: status === 'Registered' ? theme.colors.accent : theme.colors.text,
            }}
          >
            {status}
          </Copy>
        </View>
        <Copy size={16} style={{ fontWeight: '700' }}>
          {event.title}
        </Copy>
        <Copy size={12} muted>
          {eventDate(event)} · {eventTime(event)}
        </Copy>
        <Copy size={12} muted>
          {event.location}
        </Copy>
      </View>
    </Hit>
  );
}
