import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  View,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  useWindowDimensions,
  AccessibilityInfo,
  findNodeHandle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/app-text';
import { AppField } from '@/components/app-field';
import { MemberHeader } from '@/components/member-header';
import { theme } from '@/theme';
import { useMotion } from '../onboarding/use-motion';
import { Copy, Hit, Icon, Solid, TextAction } from '../home/ui';
import type { LocalState } from './local-store';
const InsideSheet = createContext(false);
export function useHydrate<T>(state: LocalState<T>) {
  const hydrate = state.hydrate;
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
}
export function SavedState<T>({ state }: { state: LocalState<T> }) {
  return (
    <>
      {!!state.warning && (
        <View style={{ gap: 4, paddingVertical: 12 }}>
          <Copy role="alert" size={12}>
            {state.warning}
          </Copy>
          <TextAction
            label={state.status === 'failed' ? 'Retry loading' : 'Retry saving'}
            onPress={() => void (state.status === 'failed' ? state.hydrate() : state.retrySave())}
          />
        </View>
      )}
      {!!state.notice && (
        <Copy size={12} role="status" accessibilityLiveRegion="polite">
          {state.notice}
        </Copy>
      )}
    </>
  );
}
export function PageHeader({
  title,
  eyebrow,
  subtitle,
  options,
  optionsLabel,
  history,
  back,
  backLabel = 'Back',
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  options?: () => void;
  optionsLabel?: string;
  history?: () => void;
  back?: () => void;
  backLabel?: string;
}) {
  return (
    <MemberHeader
      title={title}
      back={back && <TextAction label={backLabel} onPress={back} />}
      context={
        (eyebrow || subtitle) && (
          <View style={{ gap: theme.space.xs }}>
            {eyebrow && (
              <Copy caps size={12} muted>
                {eyebrow}
              </Copy>
            )}
            {subtitle && (
              <Copy size={12} muted>
                {subtitle}
              </Copy>
            )}
          </View>
        )
      }
      actions={
        (history || options) && (
          <>
            {history && (
              <Hit
                accessibilityLabel="Conversation history"
                onPress={history}
                style={{
                  minWidth: theme.target,
                  minHeight: theme.target,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  borderRadius: theme.target / 2,
                }}
              >
                <Icon name="history" size={20} color={theme.colors.text} />
                <Copy size={10}>History</Copy>
              </Hit>
            )}
            {options && (
              <Hit
                accessibilityLabel={optionsLabel ?? `${title} options`}
                onPress={options}
                style={{
                  minWidth: theme.target,
                  minHeight: theme.target,
                  borderRadius: theme.target / 2,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  alignItems: 'center',
                }}
              >
                <Copy size={24}>···</Copy>
              </Hit>
            )}
          </>
        )
      }
    />
  );
}
export function Sheet({
  title,
  children,
  close,
}: {
  title: string | null;
  children: ReactNode;
  close: () => void;
}) {
  const motion = useMotion(),
    insets = useSafeAreaInsets();
  const visible = !!title;
  useLayoutEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    // Capture before RN Web's modal focus trap runs its passive effects.
    const trigger = document.activeElement as HTMLElement | null;
    return () => {
      requestAnimationFrame(() => {
        if (trigger?.isConnected && !trigger.closest('[aria-hidden="true"]'))
          trigger.focus({ preventScroll: true });
      });
    };
  }, [visible]);
  return (
    <Modal
      visible={visible}
      transparent
      animationType={motion.reduced ? 'none' : 'fade'}
      onRequestClose={close}
      accessibilityLabel={title ?? ''}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.black + 'B3' }}
      >
        <LinearGradient
          colors={[theme.colors.backgroundStart, theme.colors.backgroundEnd]}
          style={{
            maxWidth: theme.pageMax,
            width: '100%',
            maxHeight: '92%',
            alignSelf: 'center',
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <View accessibilityViewIsModal style={{ flexShrink: 1 }}>
            <View
              style={{
                flexDirection: 'row',
                gap: 12,
                alignItems: 'center',
                padding: 16,
                borderBottomWidth: 1,
                borderColor: theme.colors.border,
              }}
            >
              <AppText
                variant="title"
                style={{ fontSize: 16, lineHeight: 24, letterSpacing: 1.6, flex: 1 }}
              >
                {title}
              </AppText>
              <Hit
                accessibilityLabel="Close panel"
                onPress={close}
                style={{ width: 48, alignItems: 'center' }}
              >
                <Icon name="close" color={theme.colors.text} />
              </Hit>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                padding: 24,
                paddingBottom: Math.max(24, insets.bottom),
                gap: 16,
              }}
            >
              <InsideSheet.Provider value={true}>{children}</InsideSheet.Provider>
            </ScrollView>
          </View>
        </LinearGradient>
      </KeyboardAvoidingView>
    </Modal>
  );
}
export type Option = { value: string; label: string };
export function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const insideSheet = useContext(InsideSheet),
    trigger = useRef<View>(null);
  const choices = options.map((o) => (
    <Hit
      key={o.value}
      accessibilityState={{ selected: o.value === value }}
      onPress={() => {
        onChange(o.value);
        setOpen(false);
        if (insideSheet)
          requestAnimationFrame(() => {
            if (Platform.OS === 'web')
              (trigger.current as unknown as HTMLElement | null)?.focus({ preventScroll: true });
            else {
              const handle = findNodeHandle(trigger.current);
              if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
            }
          });
      }}
      style={{ borderBottomWidth: 1, borderColor: theme.colors.border, paddingVertical: 12 }}
    >
      <Copy style={{ color: o.value === value ? theme.colors.accent : theme.colors.text }}>
        {o.value === value ? '✓ ' : ''}
        {o.label}
      </Copy>
    </Hit>
  ));
  return (
    <View style={{ gap: 8, flex: 1 }}>
      <Copy size={11} muted>
        {label}
      </Copy>
      <Hit
        controlRef={trigger}
        accessibilityLabel={`${label}: ${options.find((o) => o.value === value)?.label ?? value}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={{
          padding: 12,
          borderWidth: 1,
          borderColor: theme.colors.controlBorder,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <Copy size={12} style={{ flex: 1 }}>
          {options.find((o) => o.value === value)?.label ?? value}
        </Copy>
        <Copy size={16}>⌄</Copy>
      </Hit>
      {insideSheet ? (
        open && <View style={{ gap: 4, paddingLeft: 12 }}>{choices}</View>
      ) : (
        <Sheet title={open ? label : null} close={() => setOpen(false)}>
          {choices}
        </Sheet>
      )}
    </View>
  );
}
export function Segments({
  options,
  value,
  onChange,
  pills = false,
}: {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  pills?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: pills ? 8 : 4,
        ...(pills ? {} : { borderBottomWidth: 1, borderColor: theme.colors.border }),
      }}
    >
      {options.map((o) => (
        <Hit
          key={o.value}
          accessibilityState={{ selected: value === o.value }}
          onPress={() => onChange(o.value)}
          style={{
            flexGrow: pills ? 0 : 1,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderWidth: pills ? 1 : 0,
            borderBottomWidth: pills ? 1 : 3,
            borderColor:
              value === o.value
                ? theme.colors.accent
                : pills
                  ? theme.colors.controlBorder
                  : 'transparent',
            borderRadius: pills ? theme.radius.control : 0,
            backgroundColor: pills && value === o.value ? theme.colors.accent : 'transparent',
            alignItems: 'center',
          }}
        >
          <Copy
            size={14}
            style={{
              color:
                value === o.value
                  ? pills
                    ? theme.colors.black
                    : theme.colors.accent
                  : theme.colors.muted,
            }}
          >
            {o.label}
          </Copy>
        </Hit>
      ))}
    </View>
  );
}
export function Check({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <Hit
      accessibilityRole="checkbox"
      role="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onChange}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderWidth: 1,
          borderColor: theme.colors.controlBorder,
          borderRadius: 6,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: checked ? theme.colors.accent : 'transparent',
        }}
      >
        <Copy size={24} style={{ color: theme.colors.black }}>
          {checked ? '✓' : ''}
        </Copy>
      </View>
      <Copy style={{ flex: 1 }}>{label}</Copy>
    </Hit>
  );
}
export function Emblem({ kind = 'spark' }: { kind?: 'spark' | 'chat' | 'events' }) {
  return (
    <View
      style={{
        width: 56,
        height: 56,
        borderWidth: 1,
        borderColor: theme.colors.accent,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
      }}
    >
      <Icon name={kind} size={28} />
    </View>
  );
}
export function Hero({
  eyebrow,
  title,
  children,
  size = 36,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  size?: number;
}) {
  const { width, fontScale } = useWindowDimensions();
  return (
    <View style={{ paddingTop: 24, paddingBottom: 32 }}>
      <Emblem kind={eyebrow === 'Member care' ? 'chat' : 'spark'} />
      <Copy caps size={10} style={{ color: theme.colors.accent, marginBottom: 12 }}>
        {eyebrow}
      </Copy>
      <Copy
        caps
        size={width < 350 || fontScale > 1.5 ? 28 : size}
        accessibilityRole="header"
        style={{
          lineHeight: (width < 350 || fontScale > 1.5 ? 28 : size) * 1.12,
          letterSpacing: 3.6,
          fontWeight: '700',
          marginBottom: 16,
        }}
      >
        {title}
      </Copy>
      <Copy size={14} style={{ lineHeight: 23.1 }}>
        {children}
      </Copy>
    </View>
  );
}
export function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: { label: string; press: () => void };
}) {
  return (
    <View style={{ paddingVertical: 32, gap: 16 }}>
      <Copy caps size={20} accessibilityRole="header">
        {title}
      </Copy>
      <Copy muted>{detail}</Copy>
      {action && <Solid label={action.label} onPress={action.press} />}
    </View>
  );
}
export function Multiline({
  label,
  value,
  onChange,
  error,
  maxLength = 2000,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  maxLength?: number;
}) {
  const [height, setHeight] = useState(128);
  const input = useRef<TextInput>(null);
  useEffect(() => {
    if (error) input.current?.focus();
  }, [error]);
  return (
    <AppField
      inputRef={input}
      nativeID={label.replace(/[^a-z]/gi, '').toLowerCase()}
      label={label}
      value={value}
      onChangeText={onChange}
      error={error}
      maxLength={maxLength}
      multiline
      scrollEnabled={false}
      textAlignVertical="top"
      onContentSizeChange={(e) => setHeight(Math.max(128, e.nativeEvent.contentSize.height))}
      style={{ height }}
    />
  );
}
export function Composer({
  label,
  draft,
  setDraft,
  send,
  disabled = false,
  error,
  note,
  placeholder = 'What’s on your mind?',
}: {
  label: string;
  draft: string;
  setDraft: (v: string) => void;
  send: () => void;
  disabled?: boolean;
  error?: string;
  note: string;
  placeholder?: string;
}) {
  const input = useRef<TextInput>(null);
  const [height, setHeight] = useState(56);
  useEffect(() => {
    if (error) input.current?.focus();
  }, [error]);
  return (
    <View style={{ gap: 8, paddingTop: 12 }}>
      <Copy size={11}>{label}</Copy>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <TextInput
          ref={input}
          accessibilityLabel={label}
          aria-invalid={!!error}
          aria-describedby={error ? 'message-error' : undefined}
          value={draft}
          onChangeText={setDraft}
          editable={!disabled}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.muted}
          multiline
          maxLength={2000}
          allowFontScaling
          selectionColor={theme.colors.selection}
          onContentSizeChange={(e) =>
            setHeight(Math.max(56, Math.min(128, e.nativeEvent.contentSize.height)))
          }
          style={{
            flex: 1,
            minWidth: 160,
            height,
            minHeight: 56,
            padding: 12,
            borderWidth: 1,
            borderColor: theme.colors.controlBorder,
            borderRadius: theme.radius.control,
            color: theme.colors.text,
            fontFamily: theme.fontWords,
            fontSize: 16,
            fontWeight: '600',
          }}
        />
        <Hit
          accessibilityLabel={label === 'Message AaronAI' ? 'Send message' : 'Send reply'}
          disabled={disabled}
          accessibilityState={{ disabled }}
          onPress={send}
          style={{
            minWidth: 56,
            paddingHorizontal: 12,
            minHeight: 56,
            borderRadius: theme.radius.control,
            backgroundColor: disabled ? theme.colors.raised : theme.colors.accent,
            alignItems: 'center',
          }}
        >
          <Copy size={12} style={{ color: disabled ? theme.colors.muted : theme.colors.onAccent }}>
            Send
          </Copy>
        </Hit>
      </View>
      {!!error && (
        <Copy nativeID="message-error" size={12} role="alert">
          {error}
        </Copy>
      )}
      <Copy size={10} muted style={{ textAlign: 'center' }}>
        {note}
      </Copy>
    </View>
  );
}
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(date),
  );
export const timeLabel = (date: string) =>
  new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit' }).format(new Date(date));
