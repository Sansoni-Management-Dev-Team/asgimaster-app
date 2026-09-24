import { View } from 'react-native';
import { useMember } from '../home/store';
import { Copy, EventCard, Section, TextAction, type Go } from '../home/ui';
import { useEvents } from './store';
import {
  selectEvents,
  relatedLessons,
  eventStatus,
  eventProgress,
  type EventStatus,
} from './model';
import { useHydrate, SavedState } from '../member/ui';
export const eventLabels: Record<EventStatus, string> = {
  open: 'Open',
  registered: 'Registered',
  attended: 'Attended',
  full: 'Fully booked',
  cancelled: 'Cancelled',
  ended: 'Ended',
  unavailable: 'Not available',
};
export function RelatedEvents({ lessonIds, go }: { lessonIds: string[]; go: Go }) {
  const state = useEvents(),
    member = useMember((s) => s.data.member);
  useHydrate(state);
  if (state.status !== 'ready') return <SavedState state={state} />;
  const events = selectEvents(member, state.data)
    .filter(
      (e) =>
        e.status !== 'cancelled' && relatedLessons(member, e).some((l) => lessonIds.includes(l.id)),
    )
    .slice(0, 2);
  if (!events.length) return null;
  return (
    <Section title="Put it into practice">
      <Copy size={12} muted style={{ marginBottom: 12 }}>
        Included events connected to this learning.
      </Copy>
      <View style={{ gap: 12 }}>
        {events.map((e) => (
          <EventCard
            key={e.id}
            event={e}
            status={eventLabels[eventStatus(member, e, state.data)]}
            press={() => go('event', e.id)}
          />
        ))}
      </View>
    </Section>
  );
}
export function EventSummary({ go }: { go: Go }) {
  const state = useEvents(),
    member = useMember((s) => s.data.member);
  useHydrate(state);
  const progress = eventProgress(member, state.data);
  return (
    <View style={{ gap: 12 }}>
      <Copy caps size={12}>
        Events in your plan
      </Copy>
      <Copy size={12} muted>
        Registrations are upcoming commitments. Attendance is recorded separately from lessons.
      </Copy>
      {(['upcoming', 'attended'] as const).map((kind) => (
        <View key={kind} style={{ gap: 12 }}>
          <Copy>
            {kind === 'upcoming' ? 'Upcoming' : 'Attended'} · {progress[kind].length}
          </Copy>
          {progress[kind].length ? (
            progress[kind].map((e) => (
              <EventCard
                key={e.id}
                event={e}
                status={eventLabels[eventStatus(member, e, state.data)]}
                press={() => go('event', e.id)}
              />
            ))
          ) : (
            <Copy muted>
              {kind === 'upcoming' ? 'No upcoming registrations.' : 'No attendance recorded yet.'}
            </Copy>
          )}
        </View>
      ))}
      <SavedState state={state} />
      <TextAction label="Browse events ↗" onPress={() => go('events')} />
    </View>
  );
}
