import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppField } from '@/components/app-field';
import { AppText } from '@/components/app-text';
import { theme } from '@/theme';
import { useMotion } from '@/features/onboarding/use-motion';
import { getDashboard, memberships, type Membership } from './model';
import { useMember } from './store';
import { EventSummary } from '../events/components';
import { Card, Copy, Hit, Icon, Solid, TextAction, type Go } from './ui';
import { type Sheet } from './dashboard';
const titles: Record<Sheet, string> = {
  progress: 'Your progress',
  focus: 'Your weekly focus',
  reflection: 'A moment to reflect',
  'support-menu': 'Here for you',
  demo: 'Demo settings',
};
export function MemberSheets({
  sheet,
  close,
  open,
  go,
}: {
  sheet: Sheet | null;
  close: () => void;
  open: (sheet: Sheet) => void;
  go: Go;
}) {
  const state = useMember();
  const motion = useMotion();
  const insets = useSafeAreaInsets();
  const { member, goal } = state.data;
  const d = getDashboard(member, goal);
  return (
    <Modal
      visible={Boolean(sheet)}
      transparent
      animationType={motion.reduced ? 'none' : 'fade'}
      onRequestClose={close}
      accessibilityLabel={sheet ? titles[sheet] : ''}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.black + 'B3' }}
      >
        <LinearGradient
          colors={[theme.colors.backgroundStart, theme.colors.backgroundEnd]}
          style={{
            width: '100%',
            maxWidth: 480,
            maxHeight: '92%',
            alignSelf: 'center',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <View
            accessibilityViewIsModal
            accessibilityLabel={sheet ? titles[sheet] : ''}
            style={{ flexShrink: 1 }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderColor: theme.colors.border,
              }}
            >
              <AppText
                variant="title"
                style={{ fontSize: 14, lineHeight: 21, letterSpacing: 1.4, flex: 1 }}
              >
                {sheet ? titles[sheet] : ''}
              </AppText>
              <Hit
                accessibilityLabel="Close details"
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
              {sheet === 'progress' && (
                <>
                  <Copy size={12} muted>
                    {goal.name} · {goal.weeks} weeks
                  </Copy>
                  <Card style={{ padding: 24 }}>
                    <Copy
                      size={48}
                      style={{ fontFamily: theme.fontNumbers, lineHeight: 48, fontWeight: '700' }}
                    >
                      {d.coursePercent}%
                    </Copy>
                    <Copy muted>
                      {d.complete.length} of {d.entitled.length} included lessons complete
                    </Copy>
                    <View
                      accessibilityRole="progressbar"
                      accessibilityLabel="Included lessons completed"
                      aria-valuemin={0}
                      aria-valuemax={d.entitled.length}
                      aria-valuenow={d.complete.length}
                      accessibilityValue={{
                        min: 0,
                        max: d.entitled.length,
                        now: d.complete.length,
                      }}
                      style={{ height: 8, backgroundColor: theme.colors.raised }}
                    >
                      <View
                        style={{
                          height: 8,
                          width: `${d.coursePercent}%`,
                          backgroundColor: theme.colors.teal,
                        }}
                      />
                    </View>
                  </Card>
                  <Copy>
                    {d.weeklyMinutes} learning minutes this week. Your weekly aim is 60 minutes.
                  </Copy>
                  <EventSummary go={go} />
                  <Copy caps size={12} accessibilityRole="header">
                    This week’s actions · {d.actionsDone}/3
                  </Copy>
                  {[
                    {
                      done: member.weeklyCompleted.length > 0,
                      title: 'Complete a lesson',
                      detail: member.weeklyCompleted.length
                        ? 'Done this week'
                        : 'Your next lesson is ready',
                      action: () => go('library'),
                    },
                    {
                      done: member.focusDone,
                      title: 'Set your weekly focus',
                      detail: member.focusNote || 'Choose one action toward your goal',
                      action: () => open('focus'),
                    },
                    {
                      done: member.reflectionDone,
                      title: 'Reflect on your week',
                      detail: member.reflectionDone
                        ? member.reflectionNote
                        : 'Notice what moved forward',
                      action: () => open('reflection'),
                    },
                  ].map((item) => (
                    <Hit
                      key={item.title}
                      onPress={item.action}
                      style={{
                        flexDirection: 'row',
                        gap: 12,
                        paddingVertical: 16,
                        borderBottomWidth: 1,
                        borderColor: theme.colors.border,
                      }}
                    >
                      <Copy style={{ color: theme.colors.teal }}>{item.done ? '✓' : '○'}</Copy>
                      <View style={{ flex: 1 }}>
                        <Copy>{item.title}</Copy>
                        <Copy size={12} muted>
                          {item.detail}
                        </Copy>
                      </View>
                    </Hit>
                  ))}
                  <Solid
                    label={
                      !member.focusDone
                        ? 'Set weekly focus'
                        : !member.reflectionDone
                          ? 'Reflect on my week'
                          : 'Back to Home'
                    }
                    onPress={() =>
                      !member.focusDone
                        ? open('focus')
                        : !member.reflectionDone
                          ? open('reflection')
                          : close()
                    }
                  />
                  <TextAction label="View my plan" onPress={() => go('plan')} />
                </>
              )}
              {(sheet === 'focus' || sheet === 'reflection') && (
                <WeeklyNote key={sheet} kind={sheet} done={() => open('progress')} />
              )}
              {sheet === 'support-menu' && (
                <>
                  <Copy>A little help to keep you moving.</Copy>
                  {d.membership.ai && (
                    <Hit onPress={() => go('coach')}>
                      <Card>
                        <Copy style={{ fontWeight: '700' }}>Ask AaronAI</Copy>
                        <Copy muted>Work through your goal and next step.</Copy>
                      </Card>
                    </Hit>
                  )}
                  <Hit onPress={() => go('support')}>
                    <Card>
                      <Copy style={{ fontWeight: '700' }}>
                        {d.membership.coach ? 'Your consultant & support' : 'Member support'}
                      </Copy>
                      <Copy muted>Your plan, membership, or learning.</Copy>
                    </Card>
                  </Hit>
                  <Solid label="Back to today" onPress={close} />
                </>
              )}
              {sheet === 'demo' && <DemoSettings close={close} />}
              {!!state.error && sheet !== 'focus' && sheet !== 'reflection' && (
                <Copy role="alert" accessibilityLiveRegion="polite">
                  {state.error}
                </Copy>
              )}
              {!!state.notice && (
                <Copy role="status" accessibilityLiveRegion="polite">
                  {state.notice}
                </Copy>
              )}
            </ScrollView>
          </View>
        </LinearGradient>
      </KeyboardAvoidingView>
    </Modal>
  );
}
function WeeklyNote({ kind, done }: { kind: 'focus' | 'reflection'; done: () => void }) {
  const state = useMember();
  const [draft, setDraft] = useState(
    kind === 'focus' ? state.data.member.focusNote : state.data.member.reflectionNote,
  );
  const [height, setHeight] = useState(120);
  const input = useRef<TextInput>(null);
  return (
    <>
      <Copy>
        {kind === 'focus'
          ? `What’s one action you can take toward “${state.data.goal.name}” this week?`
          : 'What moved you forward this week, and what will you try next?'}
      </Copy>
      <AppField
        nativeID="weekly-note"
        inputRef={input}
        label={kind === 'focus' ? 'My next action (required)' : 'My reflection (required)'}
        error={state.error || undefined}
        value={draft}
        onChangeText={(text) => {
          state.clearError();
          setDraft(text);
        }}
        multiline
        maxLength={400}
        editable={!state.saving}
        textAlignVertical="top"
        scrollEnabled={false}
        onContentSizeChange={(e) => setHeight(Math.max(120, e.nativeEvent.contentSize.height))}
        style={{ height }}
      />
      <Solid
        label={state.saving ? 'Saving…' : kind === 'focus' ? 'Save focus' : 'Save reflection'}
        disabled={state.saving}
        onPress={() => {
          void state.saveNote(kind, draft).then((ok) => {
            if (ok) done();
            else input.current?.focus();
          });
        }}
      />
    </>
  );
}
function DemoSettings({ close }: { close: () => void }) {
  const state = useMember();
  const [membership, setMembership] = useState<Membership>(state.data.member.membership);
  const [progress, setProgress] = useState('current');
  return (
    <>
      <Copy muted>
        Preview how membership and learning activity change your Home. Choosing a preset replaces
        the saved demo learning activity.
      </Copy>
      <Copy>Membership preview</Copy>
      {(Object.keys(memberships) as Membership[]).map((key) => (
        <Hit
          key={key}
          accessibilityState={{ selected: membership === key }}
          onPress={() => setMembership(key)}
        >
          <Copy style={{ color: membership === key ? theme.colors.teal : theme.colors.text }}>
            {membership === key ? '● ' : '○ '}
            {key === 'payment'
              ? 'Growth · payment due'
              : key === 'paused'
                ? 'Membership paused'
                : `${memberships[key].name} · active`}
          </Copy>
        </Hit>
      ))}
      <Copy>Learning activity</Copy>
      {[
        ['current', 'Keep current activity'],
        ['new', 'New member · no activity'],
        ['returning', 'Returning member · some progress'],
        ['complete', 'All included learning completed'],
      ].map(([value, label]) => (
        <Hit
          key={value}
          onPress={() => setProgress(value)}
          accessibilityState={{ selected: progress === value }}
        >
          <Copy style={{ color: progress === value ? theme.colors.teal : theme.colors.text }}>
            {progress === value ? '● ' : '○ '}
            {label}
          </Copy>
        </Hit>
      ))}
      <Solid
        label="Apply demo settings"
        disabled={state.saving}
        onPress={() => {
          void state.preset(membership, progress).then((ok) => {
            if (ok) close();
          });
        }}
      />
    </>
  );
}
