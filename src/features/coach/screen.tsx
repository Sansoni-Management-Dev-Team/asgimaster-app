import { useRef, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { theme } from '@/theme';
import { useMember } from '../home/store';
import { lessons, canWatch, membershipFor } from '../home/model';
import { Copy, Card, Hit, Icon, MemberFrame, Solid, TextAction, type Go } from '../home/ui';
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
import { useCoach, useCoachUI, sendCoach, stopReply } from './store';
import {
  currentConversation,
  coachAccess,
  deleteConversation,
  buildHandoff,
  type Handoff,
} from './model';
import { useSupport } from '../support/store';
import { startConversation } from '../support/model';
export function CoachScreen({ go }: { go: Go }) {
  const state = useCoach(),
    ui = useCoachUI(),
    support = useSupport();
  useHydrate(state);
  useHydrate(support);
  const { member, goal } = useMember((s) => s.data),
    chat = currentConversation(state.data),
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
  const sent = useRef(false),
    scroll = useRef<ScrollView>(null);
  const pending = state.data.conversations.some((c) =>
    c.messages.some((m) => m.status === 'pending'),
  );
  function send(text = draft) {
    const result = sendCoach(text);
    if (result) {
      setError(result);
      return;
    }
    setError('');
    ui.setDraft(key, '');
  }
  function choose(id: string | null) {
    stopReply();
    state.change((s) => {
      s.activeId = id;
    });
    setError('');
    setPanel(null);
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
      <>
        {chat?.messages.at(-1)?.role === 'assistant' && (
          <TextAction
            label="View new reply ↓"
            onPress={() => scroll.current?.scrollToEnd({ animated: false })}
          />
        )}{' '}
        {access === 'demo' ? (
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
            note="Saved on this device. Avoid sensitive information."
          />
        ) : (
          <View style={{ gap: 8, paddingTop: 12 }}>
            {access === 'waitlist' ? (
              <>
                <Solid
                  label={state.data.waitlisted ? 'Leave demo waitlist' : 'Join demo waitlist'}
                  onPress={() =>
                    state.change(
                      (s) => {
                        s.waitlisted = !s.waitlisted;
                      },
                      state.data.waitlisted
                        ? 'Left the demo waitlist.'
                        : 'Your interest is saved locally. No signup or notification was sent.',
                    )
                  }
                />
                <Copy size={12} muted>
                  {state.data.waitlisted
                    ? 'Your interest is saved on this device. No signup or notification was sent.'
                    : 'Demo only. Joining saves interest locally; no signup is sent.'}
                </Copy>
              </>
            ) : access === 'unavailable' ? (
              <TextAction
                label="Check availability"
                onPress={() =>
                  state.change(
                    () => {},
                    'AaronAI is still unavailable in this preview. History and human help remain available.',
                  )
                }
              />
            ) : null}
            <Solid label="Talk to a person" onPress={handoff} />
          </View>
        )}
      </>
    ) : null;
  return (
    <MemberFrame title="AaronAI" active="coach" go={go} footerContent={footer} contentRef={scroll}>
      <PageHeader
        title="AaronAI"
        subtitle={
          access === 'demo'
            ? 'Demo coach · No API connected'
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
              <Copy>
                {access === 'waitlist'
                  ? 'Not launched yet'
                  : access === 'locked'
                    ? 'Read-only access'
                    : 'Coach unavailable'}
              </Copy>
              <Copy muted>
                Your history is available, but new replies aren’t. Talk to a person for your next
                step.
              </Copy>
            </Card>
          )}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
              justifyContent: 'space-between',
              alignItems: 'center',
              marginVertical: 16,
            }}
          >
            <Copy size={12} muted>
              Conversation · {dateLabel(chat.createdAt)}
            </Copy>
            <TextAction label="New chat +" onPress={() => choose(null)} />
          </View>
          <View role="log" accessibilityLabel="Conversation with AaronAI" style={{ gap: 16 }}>
            {chat.messages.map((message) => {
              const lesson = lessons.find((l) => l.id === message.lessonId);
              return (
                <Card
                  key={message.id}
                  style={{
                    marginLeft: message.role === 'user' ? 24 : 0,
                    marginRight: message.role === 'assistant' ? 12 : 0,
                    backgroundColor:
                      message.role === 'user' ? theme.colors.backgroundEnd : theme.colors.surface,
                    borderTopWidth: message.role === 'assistant' ? 2 : 1,
                    borderTopColor:
                      message.role === 'assistant' ? theme.colors.teal : theme.colors.border,
                  }}
                >
                  <Copy
                    size={12}
                    style={{
                      color: message.role === 'assistant' ? theme.colors.teal : theme.colors.text,
                    }}
                  >
                    {message.role === 'assistant' ? '✧ AaronAI · Demo' : 'You'}
                  </Copy>
                  <Copy size={14} style={{ lineHeight: 23.8 }}>
                    {message.text}
                  </Copy>
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
                  )}{' '}
                  {message.handoff && <TextAction label="Review a handoff" onPress={handoff} />}{' '}
                  {message.status === 'failed' && (
                    <View
                      style={{
                        gap: 8,
                        paddingTop: 12,
                        borderTopWidth: 2,
                        borderColor: theme.colors.learning,
                      }}
                    >
                      <Copy size={12}>No reply yet</Copy>
                      <Copy size={12} muted>
                        {message.failure}
                      </Copy>
                      <Solid
                        label="Retry message"
                        disabled={pending || access !== 'demo'}
                        onPress={() => {
                          const error = sendCoach('', message.id);
                          setError(error ?? '');
                        }}
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
                </Card>
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
                ··· Preparing a demo reply
              </Copy>
              <TextAction label="Stop reply" onPress={() => stopReply()} />
            </View>
          )}
        </>
      ) : access === 'demo' ? (
        <>
          <Hero eyebrow={`A little clarity, ${member.firstName}`} title={'Think it\nthrough.'}>
            Turn your learning into a next step that feels manageable.
          </Hero>
          <View
            style={{
              borderLeftWidth: 2,
              borderColor: theme.colors.teal,
              paddingLeft: 12,
              gap: 4,
              marginBottom: 24,
            }}
          >
            <Copy caps size={9} muted>
              Your current goal
            </Copy>
            <Copy size={14}>{goal.name}</Copy>
          </View>
          <View style={{ gap: 8 }}>
            {[
              ['Find my next step', 'What should I do next?'],
              ['Make a plan for this week', 'Help me plan my week'],
              ['Put a lesson into practice', 'Help me apply a lesson'],
            ].map(([label, prompt]) => (
              <Hit
                key={label}
                onPress={() => send(prompt)}
                style={{
                  padding: 12,
                  borderWidth: 1,
                  borderColor: theme.colors.controlBorder,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <Copy size={14} style={{ flex: 1 }}>
                  {label}
                </Copy>
                <Icon name="right" />
              </Hit>
            ))}
          </View>
        </>
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
            ? 'AaronAI isn’t ready to launch. You can join the demo waitlist. Your consultant and member support can help you keep moving.'
            : access === 'locked'
              ? 'AaronAI isn’t included in your current access. You can still read saved conversations and contact member support.'
              : 'AaronAI can’t reply right now. Your history is still available. A person can help in the meantime.'}
        </Hero>
      )}
      <SavedState state={state} />
      <Sheet title={panel} close={() => setPanel(null)}>
        {panel === 'History' ? (
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
            <Copy>Reflect on learning, break down a goal and explore a manageable next step.</Copy>
            <Copy>
              It cannot change your plan, make payments, update membership or act on your behalf. It
              does not replace your consultant or qualified medical, legal or financial advice. It
              is not an emergency service.
            </Copy>
            <Copy>
              Check important decisions with a person who understands your situation. This demo only
              knows the sample goal, lesson descriptions and learning progress. Replies are
              scripted; no API or private consultation notes are connected.
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
                  Preview launch readiness and reply errors. Prompts are unlimited; no real service
                  is affected.
                </Copy>
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
