import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { CallbackSummary, OffboardingEntry } from '../offboarding/components';
import { theme } from '@/theme';
import { useMember } from '../home/store';
import { membershipFor } from '../home/model';
import { Card, Copy, Hit, MemberFrame, Solid, TextAction, type Go } from '../home/ui';
import {
  PageHeader,
  Hero,
  Segments,
  Sheet,
  Select,
  Empty,
  Composer,
  Multiline,
  Check,
  useHydrate,
  SavedState,
  dateLabel,
  timeLabel,
} from '../member/ui';
import { useSupport, useSupportUI, useNotificationPreferences } from './store';
import {
  topics,
  statusLabels,
  findConversation,
  listConversations,
  startConversation,
  sendMessage,
  agentReply,
  markRead,
  resolveConversation,
  reopenConversation,
  type Topic,
} from './model';
export function SupportScreen({ id, go }: { id?: string; go: Go }) {
  const state = useSupport(),
    ui = useSupportUI(),
    preferences = useNotificationPreferences();
  useHydrate(state);
  useHydrate(preferences);
  const member = useMember((s) => s.data.member),
    consultant = membershipFor(member).coach;
  const item = findConversation(state.data, id),
    isNew = id === 'new',
    history = id === 'history',
    inbox = !id || history || id === 'settings';
  const scroll = useRef<ScrollView>(null);
  const key = isNew ? 'new' : (item?.id ?? 'missing'),
    draft = ui.drafts[key] ?? '';
  const [error, setError] = useState(''),
    [panel, setPanel] = useState<string | null>(id === 'settings' ? 'Notifications' : null),
    [context, setContext] = useState(false),
    [demo, setDemo] = useState(false),
    [pushOverride, setPushDraft] = useState<boolean | null>(null),
    [replyOverride, setReplyDraft] = useState<boolean | null>(null);
  const pushDraft = pushOverride ?? preferences.data.push,
    replyDraft = replyOverride ?? preferences.data.replies;
  useEffect(() => {
    const saved = useSupport.getState();
    if (id && saved.status === 'ready' && findConversation(saved.data, id)?.unread)
      saved.change((d) => markRead(d, id));
  }, [id, state.status]);
  function fail() {
    if (useSupportUI.getState().failNext) {
      useSupportUI.setState({ failNext: false });
      setError('This demo send failed. Your draft is still here. Try again.');
      return true;
    }
    return false;
  }
  function submit() {
    if (fail()) return;
    const result = state.change(
      (s) =>
        isNew
          ? startConversation(
              s,
              {
                topic: ui.newTopic === 'consultant' && !consultant ? 'general' : ui.newTopic,
                text: draft,
              },
              { consultant },
            )
          : sendMessage(s, item?.id ?? '', draft),
      'Message kept locally. Nothing was sent to a person.',
    );
    if (!result) {
      setError('Wait for saved conversations to load.');
      return;
    }
    if (!result.conversation) {
      setError(result.error.replaceAll('browser', 'device'));
      return;
    }
    setError('');
    ui.setDraft(key, '');
    if (isNew) go('support', result.conversation.id);
  }
  function changeStatus() {
    if (!item) return;
    const result = state.change(
      (s) =>
        item.status === 'resolved'
          ? reopenConversation(s, item.id)
          : resolveConversation(s, item.id),
      item.status === 'resolved' ? 'Conversation reopened.' : 'Conversation resolved.',
    );
    if (!result)
      setError('This conversation cannot be changed. Start a new request if it is full.');
    setPanel(null);
  }
  function demoReply(resolve = false, push = false) {
    if (!item) return;
    const result = state.change(
      (s) => agentReply(s, item.id, { resolve }),
      'A sample agent reply is ready.',
    );
    if (result?.error) {
      setError(result.error);
      return;
    }
    setPanel(null);
    if (push) {
      if (preferences.data.push && preferences.data.replies)
        useSupportUI.setState({ notification: item.id });
      go('home');
    }
  }
  const footer =
    state.status !== 'ready' ? null : isNew ? (
      <>
        <Solid label="Start conversation" onPress={submit} />
        <Copy size={10} muted style={{ textAlign: 'center', marginTop: 8 }}>
          Demo only. Saved on this device, not sent to a person.
        </Copy>
      </>
    ) : item ? (
      <>
        <View style={{ gap: 4 }}>
          {item.unread && (
            <TextAction
              label="View new reply"
              onPress={() => {
                state.change((s) => markRead(s, item.id), 'New reply marked read.');
                scroll.current?.scrollToEnd({ animated: false });
              }}
            />
          )}
          {item.status === 'resolved' ? (
            <>
              <Solid label="Reopen conversation" onPress={changeStatus} />
              <TextAction label="New conversation" onPress={() => go('support', 'new')} />
            </>
          ) : (
            <>
              <Composer
                label="Reply to your team (required)"
                draft={draft}
                setDraft={(text) => {
                  ui.setDraft(key, text);
                  setError('');
                }}
                send={submit}
                error={error}
                note="Demo only. Kept on this device, not sent to a person."
              />
              <TextAction label="Mark as resolved" onPress={() => setPanel('All sorted?')} />
            </>
          )}
        </View>
      </>
    ) : (
      <>
        <Solid
          label={inbox ? 'Start a conversation' : 'Back to Support'}
          onPress={() => go('support', inbox ? 'new' : undefined)}
        />
        <Copy size={10} muted style={{ textAlign: 'center', marginTop: 8 }}>
          Demo only. Saved on this device, not sent to a person.
        </Copy>
      </>
    );
  return (
    <MemberFrame
      title={isNew ? 'New request' : 'Support'}
      active="support"
      go={go}
      footerContent={footer}
      contentRef={scroll}
    >
      <PageHeader
        title={isNew ? 'New request' : 'Support'}
        subtitle="Human support · Demo preview"
        options={() => setPanel('Support options')}
        back={!inbox ? () => go('support') : undefined}
      />
      {state.status !== 'ready' ? (
        <Empty
          title={
            state.status === 'failed' ? 'Couldn’t load conversations' : 'Loading conversations'
          }
          detail="Your saved requests will appear here."
        />
      ) : inbox ? (
        <>
          {state.data.conversations.length ? (
            <View style={{ paddingVertical: 24, gap: 12 }}>
              <Copy caps size={10} style={{ color: theme.colors.accent }}>
                Member care
              </Copy>
              <Copy caps size={32} accessibilityRole="header">
                Your inbox
              </Copy>
              <Copy>Pick up a conversation or revisit a resolved request.</Copy>
            </View>
          ) : (
            <Hero eyebrow="Member care" title={'Here for\nyou.'} size={40}>
              {'App, access or your next step.\nKeep the conversation with your team in one place.'}
            </Hero>
          )}
          <Segments
            options={[
              { value: 'current', label: `Current  ${listConversations(state.data).length}` },
              { value: 'history', label: `History  ${listConversations(state.data, true).length}` },
            ]}
            value={history ? 'history' : 'current'}
            onChange={(v) => go('support', v === 'history' ? 'history' : undefined)}
          />
          <View style={{ gap: 12, marginTop: 24 }}>
            {listConversations(state.data, history).map((c) => (
              <Hit key={c.id} onPress={() => go('support', c.id)}>
                <Card style={{ borderColor: theme.colors.controlBorder }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: 8,
                      justifyContent: 'space-between',
                    }}
                  >
                    <Copy
                      caps
                      size={10}
                      style={{
                        color: c.status === 'waiting' ? theme.colors.text : theme.colors.accent,
                      }}
                    >
                      {c.status === 'resolved' ? '✓ ' : ''}
                      {statusLabels[c.status]}
                    </Copy>
                    {c.unread && (
                      <Copy size={10} style={{ color: theme.colors.accent }}>
                        Unread
                      </Copy>
                    )}
                  </View>
                  <Copy size={16} style={{ fontWeight: '700' }}>
                    {c.offboarding ? 'Programme callback' : topics[c.topic]}
                  </Copy>
                  <Copy size={12} muted>
                    {c.messages.at(-1)?.role === 'agent'
                      ? 'Alex · Demo agent: '
                      : c.messages.at(-1)?.role === 'user'
                        ? 'You: '
                        : ''}
                    {c.messages.at(-1)?.text.slice(0, 96)}
                  </Copy>
                  <Copy size={12} muted>
                    {dateLabel(c.updatedAt)} · {c.messages.length} messages
                  </Copy>
                </Card>
              </Hit>
            ))}
            {!listConversations(state.data, history).length && (
              <View
                style={{
                  borderLeftWidth: 2,
                  borderColor: theme.colors.controlBorder,
                  paddingHorizontal: 16,
                  paddingVertical: 24,
                  gap: 16,
                }}
              >
                <Copy caps size={14} accessibilityRole="header">
                  {history ? 'No past requests' : 'All clear'}
                </Copy>
                <Copy size={14} muted>
                  {history
                    ? 'Resolved conversations will stay here. You can reopen one if you need more help.'
                    : 'You have no open conversations. Start one whenever you need a hand.'}
                </Copy>
              </View>
            )}
          </View>
          <Copy size={12} muted style={{ marginTop: 24, lineHeight: 19.8 }}>
            This is a human-support preview, separate from AaronAI. Agent replies are simulated; no
            real team is connected.
          </Copy>
        </>
      ) : isNew ? (
        <>
          <View style={{ paddingVertical: 24, gap: 16 }}>
            <Copy caps size={10} style={{ color: theme.colors.accent }}>
              Let’s work it out
            </Copy>
            <Copy caps size={40} accessibilityRole="header" style={{ lineHeight: 43.2 }}>
              {'Let’s\ntalk.'}
            </Copy>
            <Copy>A little context helps your team pick up where you are.</Copy>
          </View>
          <View style={{ gap: 24 }}>
            <Select
              label="Topic"
              value={ui.newTopic === 'consultant' && !consultant ? 'general' : ui.newTopic}
              onChange={(newTopic) => useSupportUI.setState({ newTopic })}
              options={(Object.entries(topics) as [Topic, string][])
                .filter(([k]) => k !== 'consultant' || consultant)
                .map(([value, label]) => ({ value, label }))}
            />
            {ui.newTopic === 'account' && <OffboardingEntry />}
            <Multiline
              label="Your message (required)"
              value={draft}
              onChange={(text) => {
                ui.setDraft(key, text);
                setError('');
              }}
              error={error}
            />
            <Copy size={12} muted>
              Don’t include passwords, card details or sensitive information. This demo saves
              messages locally and doesn’t send them to an agent.
            </Copy>
          </View>
        </>
      ) : item ? (
        <>
          <View style={{ paddingVertical: 24, gap: 16 }}>
            <Copy caps size={10} muted>
              Request {item.id.slice(-6).toUpperCase()}
            </Copy>
            <Copy size={24} style={{ fontWeight: '700' }} accessibilityRole="header">
              {topics[item.topic]}
            </Copy>
            <Copy
              caps
              size={10}
              style={{ color: item.status === 'waiting' ? theme.colors.text : theme.colors.accent }}
            >
              {statusLabels[item.status]}
            </Copy>
          </View>
          <View
            style={{
              paddingVertical: 16,
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: theme.colors.border,
              gap: 8,
            }}
          >
            <Copy>
              {item.messages.some((m) => m.role === 'agent')
                ? 'Alex · Demo agent'
                : item.topic === 'consultant'
                  ? 'Consultant team'
                  : 'Member Care'}
            </Copy>
            <Copy size={10} muted>
              {item.status === 'resolved'
                ? 'Closed for now. Reopen if you need us.'
                : item.messages.some((m) => m.role === 'agent')
                  ? 'Human-support preview · Not AaronAI'
                  : 'Waiting for a person · Demo only'}
            </Copy>
          </View>
          {item.offboarding && <CallbackSummary conversation={item} />}
          {item.topic === 'account' && <OffboardingEntry />}
          <Copy size={10} muted style={{ textAlign: 'center', marginVertical: 24 }}>
            Started {dateLabel(item.createdAt)}
          </Copy>
          {!!item.context && (
            <>
              <TextAction
                label={context ? 'Hide shared AaronAI conversation' : 'Shared AaronAI conversation'}
                onPress={() => setContext(!context)}
              />
              {context && (
                <Card>
                  <Copy size={12}>{item.context}</Copy>
                </Card>
              )}
            </>
          )}
          <View role="log" accessibilityLabel="Support conversation" style={{ gap: 16 }}>
            {item.messages.map((m) =>
              m.role === 'system' ? (
                <Copy size={12} muted key={m.id}>
                  ✓ {m.text}
                </Copy>
              ) : (
                <Card
                  key={m.id}
                  style={{
                    marginLeft: m.role === 'user' ? 24 : 0,
                    marginRight: m.role === 'agent' ? 12 : 0,
                    backgroundColor:
                      m.role === 'user' ? theme.colors.backgroundEnd : theme.colors.surface,
                    borderTopWidth: m.role === 'agent' ? 2 : 1,
                    borderTopColor: m.role === 'agent' ? theme.colors.accent : theme.colors.border,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <Copy
                      size={12}
                      style={{
                        color: m.role === 'agent' ? theme.colors.accent : theme.colors.text,
                      }}
                    >
                      {m.role === 'user' ? 'You' : 'Alex · Demo agent'}
                    </Copy>
                    <Copy size={10} muted>
                      {timeLabel(m.createdAt)}
                    </Copy>
                  </View>
                  <Copy size={14} style={{ lineHeight: 23.8 }}>
                    {m.text}
                  </Copy>
                  {m.role === 'user' && (
                    <Copy size={10} muted>
                      Local preview · Not sent
                    </Copy>
                  )}
                </Card>
              ),
            )}
          </View>
          <View
            style={{
              padding: 16,
              borderLeftWidth: 2,
              borderColor: theme.colors.controlBorder,
              marginTop: 24,
              gap: 8,
            }}
          >
            <Copy size={12}>
              {item.status === 'resolved'
                ? '✓ Conversation resolved'
                : 'Your conversation is open.'}
            </Copy>
            <Copy size={12} muted>
              {item.status === 'resolved'
                ? 'Your messages stay in History. Reopen if this issue needs another look.'
                : 'In the live app, a person will reply here. This preview has no live agent or promised response time.'}
            </Copy>
          </View>
        </>
      ) : (
        <Empty
          title="Not found."
          detail="This link doesn’t match a conversation saved on this device. Return to Support to find your requests."
        />
      )}
      <SavedState state={state} />
      <Sheet title={panel} close={() => setPanel(null)}>
        {panel === 'All sorted?' ? (
          <>
            <Copy>
              Mark this conversation resolved? It will move to History. You can reopen it if you
              still need help.
            </Copy>
            <Solid label="Yes, resolve" onPress={changeStatus} />
            <TextAction label="Keep it open" onPress={() => setPanel(null)} />
          </>
        ) : panel === 'Notifications' ? (
          <>
            <Copy>
              These saved preferences control the in-app reply notification demo. No system
              permission or live push subscription is changed.
            </Copy>
            <Check
              label="Push notifications"
              disabled={preferences.status !== 'ready'}
              checked={pushDraft}
              onChange={() => setPushDraft(!pushDraft)}
            />
            <Check
              label="Support replies"
              disabled={preferences.status !== 'ready'}
              checked={replyDraft}
              onChange={() => setReplyDraft(!replyDraft)}
            />
            <Solid
              label="Save notification preferences"
              disabled={preferences.status !== 'ready'}
              onPress={() => {
                preferences.change((d) => {
                  d.push = pushDraft;
                  d.replies = replyDraft;
                }, 'Notification preview preferences saved.');
                setPanel(null);
              }}
            />
            <SavedState state={preferences} />
          </>
        ) : (
          <>
            <Copy>
              This is a preview of real-person support. Messages stay on this device and aren’t
              sent.
            </Copy>
            {item && (
              <TextAction
                label="Open this conversation"
                onPress={() => {
                  setPanel(null);
                  go('support', item.id);
                }}
              />
            )}
            <TextAction
              label="Notifications"
              onPress={() => {
                setPushDraft(null);
                setReplyDraft(null);
                setPanel('Notifications');
              }}
            />
            <TextAction
              label={demo ? 'Hide demo settings' : 'Demo settings'}
              onPress={() => setDemo(!demo)}
            />
            {demo && (
              <>
                <Copy size={12} muted>
                  Simulate agent events without contacting a person or sending real push
                  notifications.
                </Copy>
                {item && item.status !== 'resolved' ? (
                  <>
                    <Solid label="Add agent reply" onPress={() => demoReply()} />
                    <TextAction label="Agent resolves request" onPress={() => demoReply(true)} />
                    <TextAction
                      label="Preview reply notification"
                      onPress={() => demoReply(false, true)}
                    />
                  </>
                ) : (
                  <Copy>Open a current conversation to preview agent replies.</Copy>
                )}
                <Check
                  label="Fail the next demo send once"
                  checked={ui.failNext}
                  onChange={() => useSupportUI.setState({ failNext: !ui.failNext })}
                />
              </>
            )}
            <Solid label="Back to Support" onPress={() => setPanel(null)} />
          </>
        )}
      </Sheet>
    </MemberFrame>
  );
}
