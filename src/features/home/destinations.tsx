import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppField } from '@/components/app-field';
import { theme } from '@/theme';
import { useMember } from './store';
import { getDashboard } from './model';
import { EventSummary } from '../events/components';
import { Card, Copy, Heading, Hit, Solid, TextAction, type Destination, type Go } from './ui';
import { type Sheet } from './dashboard';

export function MemberDestination({
  view,
  id,
  go,
  open,
}: {
  view: Destination;
  id?: string;
  go: Go;
  open: (sheet: Sheet) => void;
}) {
  const state = useMember();
  const { member, goal } = state.data;
  const d = getDashboard(member, goal);
  const router = useRouter();
  const heading = {
    library: 'Library',
    events: 'Events',
    coach: 'AaronAI',
    support: 'Support',
    profile: 'Profile',
    membership: 'Your membership',
    lesson: 'Your lesson',
    event: 'Event details',
    plan: 'Your plan',
    home: 'Today',
  }[view];
  return (
    <>
      <Heading title={heading} back={() => go('home')} />
      {(view === 'profile' || view === 'membership') && (
        <View style={{ gap: 16 }}>
          <Card>
            <Copy size={24} style={{ fontWeight: '700' }}>
              {member.firstName}
            </Copy>
            <Copy muted>{d.membership.name} membership</Copy>
            <Copy style={{ color: theme.colors.teal }}>
              {d.membership.status === 'active'
                ? 'Membership active'
                : d.membership.status === 'payment_due'
                  ? 'Payment needs attention'
                  : 'Membership paused'}
            </Copy>
          </Card>
          <Copy caps accessibilityRole="header" size={12}>
            Your access
          </Copy>
          <Copy>{d.entitled.length} included lessons</Copy>
          <Copy>{d.membership.ai ? 'AaronAI guidance included' : 'AaronAI not included'}</Copy>
          <Copy>
            {d.membership.coach ? 'Consultant support included' : 'Member support included'}
          </Copy>
          <Solid
            label={d.membership.status === 'payment_due' ? 'Get payment help' : 'Contact support'}
            onPress={() => go('support')}
          />
          <TextAction label="View my plan" onPress={() => go('plan')} />
          <TextAction label="Notifications" onPress={() => go('support', 'settings')} />
          <TextAction
            label="View my direction"
            onPress={() =>
              router.push({ pathname: '/onboarding', params: { step: 'complete', from: 'home' } })
            }
          />
          <TextAction label="Demo settings" onPress={() => open('demo')} />
        </View>
      )}
      {view === 'plan' && (
        <>
          <Plan />
          <EventSummary go={go} />
        </>
      )}
    </>
  );
}
function Plan() {
  const state = useMember();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(state.data.goal);
  const router = useRouter();
  if (!editing)
    return (
      <View style={{ gap: 16 }}>
        <Copy size={24} style={{ fontWeight: '700' }}>
          {state.data.goal.name}
        </Copy>
        <Copy>{state.data.goal.success}</Copy>
        <Copy muted>{state.data.goal.weeks} weeks</Copy>
        <Solid
          label="Adjust my goal"
          onPress={() => {
            setDraft(state.data.goal);
            setEditing(true);
          }}
        />
        <TextAction
          label="View my direction"
          onPress={() =>
            router.push({ pathname: '/onboarding', params: { step: 'complete', from: 'home' } })
          }
        />
      </View>
    );
  return (
    <View style={{ gap: 16 }}>
      <AppField
        nativeID="plan-name"
        label="My goal (required)"
        value={draft.name}
        onChangeText={(name) => setDraft({ ...draft, name })}
        maxLength={120}
      />
      <AppField
        nativeID="plan-success"
        label="Success looks like (required)"
        value={draft.success}
        onChangeText={(success) => setDraft({ ...draft, success })}
        maxLength={1000}
        multiline
        style={{ minHeight: 120 }}
      />
      <Copy>Timeframe</Copy>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {['4', '8', '12', '26', '52'].map((weeks) => (
          <Hit
            key={weeks}
            onPress={() => setDraft({ ...draft, weeks })}
            accessibilityState={{ selected: draft.weeks === weeks }}
          >
            <Copy style={{ color: draft.weeks === weeks ? theme.colors.teal : theme.colors.muted }}>
              {weeks} weeks
            </Copy>
          </Hit>
        ))}
      </View>
      <Solid
        label="Save my goal"
        disabled={state.saving}
        onPress={() => {
          void state.saveGoal(draft).then((ok) => {
            if (ok) setEditing(false);
          });
        }}
      />
      <TextAction label="Cancel" onPress={() => setEditing(false)} />
    </View>
  );
}
