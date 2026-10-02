import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, View, ScrollView } from 'react-native';
import { theme } from '@/theme';
import { useMember } from '../home/store';
import { lessons, canWatch, membershipFor } from '../home/model';
import { Copy, Card, Hit, MemberFrame, Solid, TextAction, type Go } from '../home/ui';
import {
  PageHeader,
  Hero,
  Sheet,
  Select,
  Composer,
  Empty,
  Check,
  Multiline,
  useHydrate,
  SavedState,
  dateLabel,
} from '../member/ui';
import { useCoach, useCoachUI, sendCoach, stopReply, openAcquisition } from './store';
import {
  currentConversation,
  coachAccess,
  deleteConversation,
  buildHandoff,
  type Handoff,
} from './model';
import { scenarios, stageLabel, type Entry, type PlanKey, type Stage } from './acquisition';
import {
  AcquisitionOpening,
  AcquisitionPlan,
  AaronAvatar,
  Facts,
  SummaryCard,
  type PlanFocus,
} from './acquisition-ui';
import { useSupport } from '../support/store';
import { startConversation } from '../support/model';

export function CoachScreen({ go }: { go: Go }) {
  const state = useCoach(),
    ui = useCoachUI(),
    support = useSupport();
  useHydrate(state);
  useHydrate(support);
  const { member } = useMember((s) => s.data);
  const chat = currentConversation(state.data),
    access = coachAccess(member, ui.mode),
    key = chat?.id ?? 'new',
    draft = ui.drafts[key] ?? '';
  const [error, setError] = useState(''),
    [panel, setPanel] = useState<string | null>(null),
    [demo, setDemo] = useState(false),
    [mode, setMode] = useState(ui.mode),
    [fail, setFail] = useState(ui.failNext),
    [team, setTeam] = useState('support'),
    [note, setNote] = useState(''),
    [share, setShare] = useState(false),
    [review, setReview] = useState<Handoff | null>(null),
    [handoffError, setHandoffError] = useState('');
  const [view, setView] = useState<'chat' | 'plan'>('chat');
  const [planFocus, setPlanFocus] = useState<PlanFocus | null>(null);
  const sent = useRef(false),
    scroll = useRef<ScrollView>(null),
    planTop = useRef(0);
  const pending = state.data.conversations.some((c) =>
    c.messages.some((m) => m.status === 'pending'),
  );
  const plan = chat?.acquisition;
  const announcement = error || state.warning || state.notice;
  useEffect(() => {
    // Android and web use the live regions below; iOS needs an explicit announcement.
    if (Platform.OS === 'ios' && announcement)
      AccessibilityInfo.announceForAccessibility(announcement);
  }, [announcement]);
  const scrollPlan = useCallback(
    (y: number) => scroll.current?.scrollTo({ y: planTop.current + y, animated: false }),
    [],
  );
  function switchView(next: 'chat' | 'plan', target?: PlanKey) {
    setPlanFocus((previous) => (target ? { key: target, at: (previous?.at ?? 0) + 1 } : null));
    setView(next);
    if (next === 'plan')
      state.change((s) => {
        const p = currentConversation(s)?.acquisition;
        if (p) p.unread = 0;
      });
    if (!target) requestAnimationFrame(() => scroll.current?.scrollTo({ y: 0, animated: false }));
  }
  function send(text = draft) {
    const result = sendCoach(text);
    if (result) {
      setError(result);
      return;
    }
    setError('');
    ui.setDraft(key, '');
    requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: false }));
  }
  function choose(id: string | null) {
    stopReply();
    state.change((s) => {
      s.activeId = id;
    });
    setError('');
    setPanel(null);
    setView('chat');
    setPlanFocus(null);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }
  function start(entry: Entry, scenario?: Stage) {
    const result = openAcquisition(entry, scenario);
    if (result) {
      setError(result);
      return;
    }
    setError('');
    setPanel(null);
    setView('chat');
    setPlanFocus(null);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }
  function handoff() {
    setTeam('support');
    setNote('I’d like help choosing my next step.');
    setShare(false);
    setHandoffError('');
    setReview(null);
    sent.current = false;
    setPanel('Talk to a person');
  }
  function confirm() {
    if (!review || sent.current) return;
    const result = support.change(
      (s) =>
        startConversation(
          s,
          {
            topic: review.team === 'Your consultant' ? 'consultant' : 'general',
            text: review.note,
            context: review.transcript,
          },
          { consultant: membershipFor(member).coach },
        ),
      'Reviewed AaronAI handoff kept locally. Nothing was sent.',
    );
    if (!result) {
      setHandoffError('Support history is still loading. Please retry.');
      return;
    }
    if (!result.conversation) {
      setHandoffError(result.error);
      return;
    }
    sent.current = true;
    setPanel(null);
    go('support', result.conversation.id);
  }
  const footer =
    state.status === 'ready' ? (
      access === 'demo' ? (
        chat && view === 'chat' ? (
          <>
            {chat.messages.at(-1)?.role === 'assistant' && (
              <TextAction
                label="View new reply"
                onPress={() => scroll.current?.scrollToEnd({ animated: false })}
              />
            )}
            <Composer
              label="Message AaronAI"
              draft={draft}
              setDraft={(text) => {
                ui.setDraft(key, text);
                setError('');
              }}
              send={() => send()}
              disabled={pending}
              error={error}
              placeholder={chat.messages.length ? 'Reply…' : 'Start here…'}
              note="Saved on this device."
            />
          </>
        ) : null
      ) : (
        <View style={{ gap: 8, paddingTop: 12 }}>
          {access === 'waitlist' && (
            <>
              <Solid
                label={state.data.waitlisted ? 'Leave demo waitlist' : 'Join demo waitlist'}
                onPress={() =>
                  state.change((s) => {
                    s.waitlisted = !s.waitlisted;
                  }, 'Your preference is saved locally. No signup or notification was sent.')
                }
              />
              <Copy size={12} muted>
                No signup or notification is sent.
              </Copy>
            </>
          )}
          {access === 'unavailable' && (
            <TextAction
              label="Check availability"
              onPress={() =>
                state.change(
                  () => {},
                  'AaronAI is still unavailable in this preview. History and human help remain available.',
                )
              }
            />
          )}
          <Solid label="Talk to a person" onPress={handoff} />
        </View>
      )
    ) : null;

  return (
    <MemberFrame title="AaronAI" active="coach" go={go} footerContent={footer} contentRef={scroll}>
      <PageHeader
        title="AaronAI"
        subtitle={
          access === 'demo'
            ? 'Demo'
            : access === 'waitlist'
              ? 'Not launched yet'
              : access === 'locked'
                ? 'Read-only access'
                : 'Temporarily unavailable'
        }
        history={() => setPanel('History')}
        options={() => {
          setMode(ui.mode);
          setFail(ui.failNext);
          setPanel('Coach options');
        }}
      />
      {state.status !== 'ready' ? (
        <Empty
          title={state.status === 'failed' ? 'Couldn’t load history' : 'Loading conversations'}
          detail="Your saved conversations will appear here."
        />
      ) : chat ? (
        <>
          {access !== 'demo' && (
            <Card>
              <Copy>Your history is available, but new replies aren’t.</Copy>
              <TextAction label="Talk to a person" onPress={handoff} />
            </Card>
          )}
          <View style={{ paddingBottom: 16, gap: 8 }}>
            <Copy accessibilityRole="header" size={18}>
              {chat.title}
            </Copy>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 12,
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Copy size={12} muted>
                {plan ? stageLabel(plan.stage) : 'Earlier conversation'}
              </Copy>
              <TextAction label="New conversation" onPress={() => choose(null)} />
            </View>
            {plan && (
              <TextAction
                label={
                  plan.facts.length
                    ? `${plan.facts.length} ${plan.facts.length === 1 ? 'fact' : 'facts'} in context`
                    : 'What Aaron is carrying'
                }
                onPress={() => setPanel('What Aaron is carrying')}
              />
            )}
          </View>
          {plan && (
            <View
              accessibilityRole="tablist"
              accessibilityLabel="Conversation views"
              style={{ flexDirection: 'row', gap: 8 }}
            >
              {(['chat', 'plan'] as const).map((tab) => (
                <Hit
                  key={tab}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: view === tab }}
                  accessibilityHint={
                    tab === 'plan' && plan.unread > 0
                      ? `${plan.unread} new plan ${plan.unread === 1 ? 'update' : 'updates'}`
                      : undefined
                  }
                  accessibilityLabel={
                    tab === 'chat'
                      ? 'Chat'
                      : plan.stage === 'SCOUTING'
                        ? 'Search Plan'
                        : 'Deal Plan'
                  }
                  onPress={() => switchView(tab)}
                  style={{
                    flex: 1,
                    padding: 12,
                    gap: 4,
                    alignItems: 'center',
                    borderBottomWidth: 2,
                    borderColor: view === tab ? theme.colors.accent : theme.colors.border,
                    backgroundColor: view === tab ? theme.colors.surface : 'transparent',
                  }}
                >
                  <Copy size={14}>
                    {tab === 'chat'
                      ? 'Chat'
                      : plan.stage === 'SCOUTING'
                        ? 'Search Plan'
                        : 'Deal Plan'}
                  </Copy>
                  {tab === 'plan' && plan.unread > 0 && (
                    <Copy size={12} muted>
                      {plan.unread} new
                    </Copy>
                  )}
                </Hit>
              ))}
            </View>
          )}
          {view === 'plan' && plan ? (
            <AcquisitionPlan
              key={chat.id}
              plan={plan}
              focus={planFocus}
              scrollTo={scrollPlan}
              onLayout={(event) => {
                planTop.current = event.nativeEvent.layout.y;
              }}
            />
          ) : (
            <>
              {!chat.messages.length && plan && (
                <AcquisitionOpening entry={plan.entry} pick={start} />
              )}
              <View
                role="log"
                accessibilityLabel="Conversation with AaronAI"
                style={{ gap: 28, paddingVertical: chat.messages.length ? 24 : 0 }}
              >
                {chat.messages.map((message) => {
                  const lesson = lessons.find((l) => l.id === message.lessonId);
                  return message.role === 'user' ? (
                    <View
                      key={message.id}
                      style={{
                        alignSelf: 'flex-end',
                        maxWidth: '92%',
                        gap: 8,
                        padding: 16,
                        backgroundColor: theme.colors.raised,
                        borderRadius: theme.radius.md,
                      }}
                    >
                      <Copy size={11} muted>
                        You
                      </Copy>
                      <Copy selectable size={15}>
                        {message.text}
                      </Copy>
                      {message.status === 'failed' && (
                        <View style={{ gap: 8, marginTop: 8 }}>
                          <Copy size={12}>No reply yet</Copy>
                          <Copy size={12} muted>
                            {message.failure}
                          </Copy>
                          <TextAction
                            label="Retry message"
                            disabled={pending || access !== 'demo'}
                            onPress={() => setError(sendCoach('', message.id) ?? '')}
                          />
                          <TextAction
                            label="Remove message"
                            onPress={() =>
                              state.change((s) => {
                                const c = currentConversation(s);
                                if (c)
                                  c.messages = c.messages.filter(
                                    (m) => m.id !== message.id || m.status !== 'failed',
                                  );
                              }, 'Unanswered message removed.')
                            }
                          />
                        </View>
                      )}
                    </View>
                  ) : (
                    <View key={message.id} style={{ gap: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <AaronAvatar />
                        <Copy size={12}>Aaron</Copy>
                      </View>
                      {message.text.split('\n\n').map((paragraph, i) => (
                        <Copy selectable key={i} size={15} style={{ lineHeight: 25 }}>
                          {paragraph}
                        </Copy>
                      ))}
                      {message.summary && <SummaryCard summary={message.summary} />}
                      {plan && !!message.updates?.length && (
                        <View style={{ gap: 4, paddingTop: 8 }}>
                          <Copy size={11} muted>
                            Updated on your plan
                          </Copy>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {message.updates.map((update, i) => (
                              <Hit
                                key={i}
                                accessibilityLabel={`View ${update.label} on plan`}
                                onPress={() => switchView('plan', update.key)}
                                style={{
                                  borderWidth: 1,
                                  borderColor: theme.colors.controlBorder,
                                  paddingHorizontal: 12,
                                  paddingVertical: 8,
                                  maxWidth: '100%',
                                }}
                              >
                                <Copy size={12}>
                                  {update.label}
                                  {update.count > 1 ? ` · ${update.count}` : ''}
                                </Copy>
                              </Hit>
                            ))}
                          </View>
                        </View>
                      )}
                      {lesson && (
                        <Solid
                          label={
                            canWatch(member, lesson)
                              ? `Open lesson: ${lesson.title}`
                              : 'Lesson not included in your current access'
                          }
                          disabled={!canWatch(member, lesson)}
                          onPress={() => go('lesson', lesson.id)}
                        />
                      )}
                      {message.handoff && <TextAction label="Review a handoff" onPress={handoff} />}
                    </View>
                  );
                })}
              </View>
              {chat.messages.some((m) => m.status === 'pending') && (
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 8,
                  }}
                >
                  <Copy size={12} muted role="status">
                    Reading what you wrote…
                  </Copy>
                  <TextAction label="Stop reply" onPress={() => stopReply()} />
                </View>
              )}
            </>
          )}
        </>
      ) : access === 'demo' ? (
        <AcquisitionOpening pick={start} />
      ) : (
        <Hero
          eyebrow={access === 'waitlist' ? 'A new way to move forward' : 'You’re not on your own'}
          title={
            access === 'waitlist'
              ? 'Coming soon'
              : access === 'locked'
                ? 'Human help.\nStill here.'
                : 'Taking a pause'
          }
        >
          {access === 'waitlist'
            ? 'AaronAI isn’t ready to launch. Your consultant and member support can help you keep moving.'
            : access === 'locked'
              ? 'AaronAI isn’t included in your current access. You can still read saved conversations and contact member support.'
              : 'AaronAI can’t reply right now. Your history is still available. A person can help in the meantime.'}
        </Hero>
      )}
      {!!error && (!chat || view === 'plan') && <Copy role="alert">{error}</Copy>}
      <SavedState state={state} />
      <Sheet title={panel} close={() => setPanel(null)}>
        {panel === 'What Aaron is carrying' ? (
          <>
            <Facts facts={chat?.acquisition?.facts ?? []} />
            <Copy size={12} muted>
              These are the notes held for this conversation. Example scenarios contain fictional
              facts.
            </Copy>
          </>
        ) : panel === 'History' ? (
          <>
            <Copy size={12} muted>
              Saved on this device, not across devices. Delete a conversation from its options.
            </Copy>
            {state.data.conversations.length ? (
              [...state.data.conversations]
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                .map((c) => (
                  <Hit
                    key={c.id}
                    accessibilityState={{ selected: c.id === chat?.id }}
                    onPress={() => choose(c.id)}
                    style={{
                      paddingVertical: 16,
                      borderBottomWidth: 1,
                      borderColor: theme.colors.border,
                      gap: 8,
                    }}
                  >
                    <Copy>{c.title}</Copy>
                    <Copy size={12} muted>
                      {dateLabel(c.updatedAt)} ·{' '}
                      {c.messages.filter((m) => m.role === 'user').length} messages
                      {c.messages.some((m) => m.status === 'failed') ? ' · Needs retry' : ''}
                      {c.acquisition ? ` · ${stageLabel(c.acquisition.stage)}` : ' · Earlier chat'}
                      {c.id === chat?.id ? ' · Current' : ''}
                    </Copy>
                  </Hit>
                ))
            ) : (
              <Empty
                title="A fresh start"
                detail="Your conversations will appear after your first message."
              />
            )}
            <Solid label="New conversation" onPress={() => choose(null)} />
          </>
        ) : panel === 'Delete conversation?' ? (
          <>
            <Copy>This removes this conversation from this device. It cannot be undone.</Copy>
            <Solid
              label="Delete conversation"
              onPress={() => {
                stopReply();
                if (chat)
                  state.change((s) => deleteConversation(s, chat.id), 'Conversation deleted.');
                setPanel(null);
              }}
            />
            <TextAction label="Keep conversation" onPress={() => setPanel(null)} />
          </>
        ) : panel === 'About AaronAI' ? (
          <>
            <Copy caps size={12} muted>
              A thinking partner, not your consultant
            </Copy>
            <Copy>
              Explore what to buy, work through a business acquisition, and keep your questions and
              findings together.
            </Copy>
            <Copy>
              It cannot change your plan, make payments, update membership or act on your behalf. It
              does not replace your consultant or qualified medical, legal or financial advice. It
              is not an emergency service.
            </Copy>
            <Copy>
              Replies are scripted. New conversations retain your notes without analysing them.
              Select a labelled example in Demo settings to explore richer plans. No AI service or
              private consultation notes are connected.
            </Copy>
            <Copy>
              Messages stay on this device. Avoid sensitive information. Handoffs and waitlist
              entries are also demos.
            </Copy>
            <Solid label="Talk to a person" onPress={handoff} />
          </>
        ) : panel === 'Talk to a person' ? (
          <>
            <Copy>
              Choose who can help. Review your request before finishing this demo. Nothing is sent.
            </Copy>
            <Select
              label="Who can help?"
              value={membershipFor(member).coach ? team : 'support'}
              onChange={setTeam}
              options={[
                { value: 'support', label: 'Member support · app and access' },
                ...(membershipFor(member).coach
                  ? [{ value: 'consultant', label: 'Your consultant · plan and learning' }]
                  : []),
              ]}
            />
            <Multiline
              label="What do you need? (required)"
              value={note}
              onChange={(v) => {
                setNote(v);
                setHandoffError('');
              }}
              error={handoffError}
            />
            {chat && (
              <>
                <Check
                  label="Include this conversation"
                  checked={share}
                  onChange={() => setShare(!share)}
                />
                <Copy size={12} muted>
                  Off by default. Only share what you’re comfortable including.
                </Copy>
              </>
            )}
            <Solid
              label="Review request"
              onPress={() => {
                if (!note.trim() || note.length > 2000) {
                  setHandoffError('Add a short message about the help you need.');
                  return;
                }
                setReview(buildHandoff(chat, { team, note, includeConversation: share }, member));
                setPanel('Review request');
              }}
            />
          </>
        ) : panel === 'Review request' && review ? (
          <>
            <Copy caps size={12}>
              {review.team}
            </Copy>
            <Card>
              <Copy>Your message</Copy>
              <Copy>{review.note}</Copy>
            </Card>
            <Copy caps size={12}>
              Conversation sharing
            </Copy>
            <Copy>
              {review.transcript
                ? 'Included below. Check it before continuing.'
                : 'Not included. Only your request message would be shared.'}
            </Copy>
            {!!review.transcript && (
              <Card>
                <Copy size={12}>{review.transcript}</Copy>
              </Card>
            )}
            <Copy size={12} muted>
              Prototype only. No request is sent to a person.
            </Copy>
            {!!handoffError && <Copy role="alert">{handoffError}</Copy>}
            <SavedState state={support} />
            <Solid
              label="Confirm demo handoff"
              disabled={support.status !== 'ready'}
              onPress={confirm}
            />
            <TextAction label="Edit request" onPress={() => setPanel('Talk to a person')} />
          </>
        ) : (
          <>
            <Solid label="New conversation" onPress={() => choose(null)} />
            <TextAction label="About AaronAI" onPress={() => setPanel('About AaronAI')} />
            <TextAction label="Talk to a person" onPress={handoff} />
            {chat && (
              <TextAction
                label="Delete this conversation"
                onPress={() => setPanel('Delete conversation?')}
              />
            )}
            <TextAction
              label={demo ? 'Hide demo settings' : 'Demo settings'}
              onPress={() => setDemo(!demo)}
            />
            {demo && (
              <>
                <Copy size={12} muted>
                  Each scenario creates a separate conversation with fictional details. Your
                  existing conversations are preserved.
                </Copy>
                <Copy caps size={12}>
                  Example scenarios
                </Copy>
                {scenarios.map(([stage, label]) => (
                  <TextAction
                    key={stage}
                    label={`Preview ${label}`}
                    disabled={access !== 'demo'}
                    onPress={() => start(stage === 'SCOUTING' ? 'searching' : 'has_target', stage)}
                  />
                ))}
                <Select
                  label="Coach availability"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: 'demo', label: 'Demo conversation' },
                    { value: 'waitlist', label: 'Launch waitlist' },
                    { value: 'unavailable', label: 'Temporarily unavailable' },
                  ]}
                />
                <Check
                  label="Make the next reply fail once"
                  checked={fail}
                  onChange={() => setFail(!fail)}
                />
              </>
            )}
            <Solid
              label="Apply demo settings"
              onPress={() => {
                ui.setMode(mode);
                useCoachUI.setState({ failNext: fail });
                setPanel(null);
              }}
            />
          </>
        )}
      </Sheet>
    </MemberFrame>
  );
}
