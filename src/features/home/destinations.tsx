import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppField } from '@/components/app-field';
import { theme } from '@/theme';
import { useMember } from './store';
import { Profile, MembershipDetails } from './profile-membership';
import { EventSummary } from '../events/components';
import { Copy, Heading, Hit, Solid, TextAction, type Destination, type Go } from './ui';
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
      {view === 'profile' && <Profile go={go} open={open} />}
      {view === 'membership' && <MembershipDetails go={go} />}
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
  if (!state.data.goal.name)
    return (
      <View style={{ gap: 24, paddingVertical: 24 }}>
        <Copy caps size={28}>
          Your plan starts here.
        </Copy>
        <Copy muted>Set your direction to bring your goal and priorities into one place.</Copy>
        <Solid label="Set up my direction" onPress={() => router.push('/onboarding')} />
      </View>
    );
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
            <Copy
              style={{ color: draft.weeks === weeks ? theme.colors.accent : theme.colors.muted }}
            >
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
