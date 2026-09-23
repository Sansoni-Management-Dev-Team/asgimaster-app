import { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppField } from '@/components/app-field';
import { theme } from '@/theme';
import { useMember } from './store';
import { getDashboard } from './model';
import { Card, Copy, Solid, TextAction, type Go } from './ui';
type Message = { role: 'user' | 'assistant'; text: string };
// Home's coaching/support handoffs use the same explicitly local sample replies as the web app.
export function Conversations({ kind, go }: { kind: 'coach' | 'support'; go: Go }) {
  const {
    data: { member, goal },
  } = useMember();
  const d = getDashboard(member, goal);
  const key = `master-app.native.${kind}.home-preview.v1`;
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [height, setHeight] = useState(120);
  const input = useRef<TextInput>(null);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(key)
      .then((raw) => {
        let parsed;
        try {
          parsed = raw ? JSON.parse(raw) : null;
        } catch {
          parsed = null;
        }
        if (active) {
          setMessages(
            Array.isArray(parsed?.messages)
              ? parsed.messages
                  .filter(
                    (m: Message) =>
                      ['user', 'assistant'].includes(m?.role) && typeof m.text === 'string',
                  )
                  .slice(-100)
              : [],
          );
          setStatus('ready');
        }
      })
      .catch(() => {
        if (active) setStatus('failed');
      });
    return () => {
      active = false;
    };
  }, [key, attempt]);
  function reply(question: string) {
    if (kind === 'support')
      return 'Hi, I’m Alex from Member Care. Thanks for explaining. What would a helpful outcome look like for you? This is a sample agent reply; no real agent has reviewed your request.';
    if (/\b(medic\w*|diagnos\w*|legal|lawyer|tax|invest\w*|financial advice)\b/i.test(question))
      return 'That needs support from a qualified professional. AaronAI offers general business learning and planning guidance, not medical, legal or financial advice.';
    if (/\b(human|support|payment|refund|billing|membership|account)\b/i.test(question))
      return 'A person is the right next step for that. I can’t change your membership, take payments, or contact your consultant for you. Member support can help with your request. This preview does not send requests.';
    if (/\b(lesson|learn|watch|next|progress)\b/i.test(question) && d.nextLesson)
      return `You’ve completed ${d.complete.length} of ${d.entitled.length} included lessons. Your next learning step is “${d.nextLesson.title}”. One idea to try: ${d.nextLesson.takeaway}`;
    return `Keep this week focused on “${goal.name}”. Choose one action that supports your goal. Give it a realistic place in your week. At your next check-in, review what changed and what needs adjusting. Which action feels manageable to start with?`;
  }
  async function send() {
    if (saving || status !== 'ready') return;
    if (!draft.trim() || draft.trim().length > 2000) {
      setError('Write a message of 2,000 characters or fewer.');
      input.current?.focus();
      return;
    }
    setSaving(true);
    setError('');
    const next: Message[] = [
      ...messages,
      { role: 'user', text: draft.trim() },
      { role: 'assistant', text: reply(draft) },
    ].slice(-100) as Message[];
    try {
      await AsyncStorage.setItem(key, JSON.stringify({ version: 1, messages: next }));
      setMessages(next);
      setDraft('');
    } catch {
      setError('This conversation could not be saved. Your draft is still here. Please try again.');
    } finally {
      setSaving(false);
    }
  }
  if (kind === 'coach' && !d.membership.ai)
    return (
      <Card>
        <Copy>AaronAI is not included in your current access.</Copy>
        <TextAction label="Contact member support" onPress={() => go('support')} />
      </Card>
    );
  if (status !== 'ready')
    return (
      <View style={{ gap: 16 }}>
        <Copy role={status === 'failed' ? 'alert' : 'status'}>
          {status === 'failed'
            ? 'This conversation could not be loaded.'
            : 'Loading your conversation…'}
        </Copy>
        {status === 'failed' && (
          <Solid
            label="Retry conversation"
            onPress={() => {
              setStatus('loading');
              setAttempt(attempt + 1);
            }}
          />
        )}
      </View>
    );
  return (
    <View style={{ gap: 16 }}>
      <Copy size={12} muted>
        {kind === 'coach'
          ? 'Demo coach · Sample replies'
          : 'Demo member support · No messages are sent'}
      </Copy>
      {!messages.length && (
        <Card>
          <Copy accessibilityRole="header" style={{ fontWeight: '700' }}>
            {kind === 'coach' ? 'A little guidance?' : 'Here to help'}
          </Copy>
          <Copy muted>
            {kind === 'coach'
              ? 'Work through your goal and next step.'
              : 'Help with your access, membership, learning or plan.'}
          </Copy>
        </Card>
      )}
      {messages.map((m, index) => (
        <Card key={index}>
          <Copy size={12} style={{ color: theme.colors.teal }}>
            {m.role === 'user' ? 'You' : kind === 'coach' ? 'AaronAI (demo)' : 'Member Care (demo)'}
          </Copy>
          <Copy>{m.text}</Copy>
        </Card>
      ))}
      {messages.length > 0 && (
        <Copy role="status" accessibilityLiveRegion="polite" size={12}>
          Sample reply ready. Conversation saved on this device.
        </Copy>
      )}
      <AppField
        nativeID={`${kind}-message`}
        inputRef={input}
        label={kind === 'coach' ? 'Message AaronAI' : 'How can we help?'}
        value={draft}
        onChangeText={(text) => {
          setDraft(text);
          setError('');
        }}
        error={error}
        multiline
        maxLength={2000}
        scrollEnabled={false}
        editable={!saving}
        onContentSizeChange={(e) => setHeight(Math.max(120, e.nativeEvent.contentSize.height))}
        style={{ height }}
      />
      <Solid
        label={saving ? 'Saving…' : 'Preview reply'}
        disabled={saving}
        onPress={() => void send()}
      />
      {kind === 'coach' && (
        <TextAction label="Contact member support" onPress={() => go('support')} />
      )}
    </View>
  );
}
