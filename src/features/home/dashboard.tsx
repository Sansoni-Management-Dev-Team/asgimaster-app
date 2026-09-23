import { View, useWindowDimensions } from 'react-native';
import { theme } from '@/theme';
import { getDashboard, formatTime } from './model';
import { eventStatus, nextEvent, registrationFor, isEventDay, ticketLabel } from '../events/model';
import { useEvents } from '../events/store';
import { eventLabels } from '../events/components';
import { useHydrate, SavedState } from '../member/ui';
import { useMember } from './store';
import {
  Card,
  Copy,
  EventCard,
  Heading,
  Hit,
  Icon,
  LessonRow,
  Metric,
  Section,
  cardStyle,
  type Go,
} from './ui';
export type Sheet = 'progress' | 'focus' | 'reflection' | 'support-menu' | 'demo';
export function Dashboard({
  go,
  open,
  next,
}: {
  go: Go;
  open: (sheet: Sheet) => void;
  next: () => void;
}) {
  const {
    data: { member, goal },
  } = useMember();
  const d = getDashboard(member, goal);
  const { fontScale } = useWindowDimensions();
  const events = useEvents();
  useHydrate(events);
  const event = events.status === 'ready' ? nextEvent(member, events.data) : null;
  const paused = d.membership.status === 'paused',
    payment = d.membership.status === 'payment_due';
  return (
    <>
      <Heading
        title="Today"
        avatar={{
          initials: member.initials,
          label: `${member.firstName}'s profile and settings`,
          press: () => go('profile'),
        }}
      />
      <View
        style={{
          paddingTop: 24,
          paddingBottom: 32,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <Metric
          label="Course"
          value={d.coursePercent}
          unit="%"
          percent={d.coursePercent}
          color={theme.colors.course}
          description={`${d.complete.length} of ${d.entitled.length} included lessons complete, ${d.coursePercent} percent`}
          press={() => open('progress')}
        />
        <Metric
          label="Learning"
          value={d.weeklyMinutes}
          unit="m"
          percent={(d.weeklyMinutes / 60) * 100}
          color={theme.colors.learning}
          description={`${d.weeklyMinutes} of 60 learning minutes this week`}
          press={() => open('progress')}
        />
        <Metric
          label="Actions"
          value={d.actionsDone}
          unit="/3"
          percent={(d.actionsDone / 3) * 100}
          color={theme.colors.actions}
          description={`${d.actionsDone} of 3 weekly actions complete`}
          press={() => open('progress')}
        />
      </View>
      {(paused || payment) && (
        <Card style={{ marginBottom: 16 }}>
          <Copy style={{ fontWeight: '700' }}>
            {paused ? 'Your membership is paused' : 'A payment needs attention'}
          </Copy>
          <Copy size={12} muted>
            {paused
              ? 'Your foundation lessons are still available.'
              : 'Your learning access is still active.'}
          </Copy>
          <Hit onPress={() => go('membership')}>
            <Copy size={12} style={{ color: theme.colors.teal }}>
              Review membership ↗
            </Copy>
          </Hit>
        </Card>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Hit
          grid="status"
          onPress={() => go('membership')}
          style={[cardStyle, { flex: 1, minWidth: 128 * fontScale, minHeight: 96 }]}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <Copy size={10} caps>
              Membership
            </Copy>
            <Copy size={10} muted>
              ›
            </Copy>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name={paused || payment ? 'lock' : 'check'} />
            <Copy size={12} style={{ color: theme.colors.teal, fontWeight: '700', flex: 1 }}>
              {paused ? 'Limited access' : payment ? 'Payment due' : `${d.membership.name} active`}
            </Copy>
          </View>
          <Copy size={11} muted style={{ marginTop: 4 }}>
            {d.entitled.length} lessons included
          </Copy>
        </Hit>
        <Hit
          grid="status"
          onPress={() => open('support-menu')}
          style={[cardStyle, { flex: 1, minWidth: 128 * fontScale, minHeight: 96 }]}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <Copy size={10} caps>
              Your support
            </Copy>
            <Copy size={10} muted>
              ›
            </Copy>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="chat" />
            <Copy size={12} style={{ color: theme.colors.teal, fontWeight: '700', flex: 1 }}>
              Here to help
            </Copy>
          </View>
          <Copy size={11} muted style={{ marginTop: 4 }}>
            {d.membership.coach
              ? 'AaronAI + your consultant'
              : d.membership.ai
                ? 'AaronAI + member support'
                : 'Member support'}
          </Copy>
        </Hit>
      </View>
      <View style={{ marginTop: 32 }}>
        <Copy
          size={24}
          caps
          accessibilityRole="header"
          style={{ lineHeight: 31.2, marginBottom: 8 }}
        >
          My day
        </Copy>
        <Copy size={12} muted style={{ marginBottom: 12 }}>
          Your focus: {goal.name}
        </Copy>
        <Hit
          onPress={next}
          style={[cardStyle, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}
        >
          {fontScale < 1.5 && (
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: theme.colors.raised,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={d.next.kind === 'lesson' ? 'arrow' : 'check'} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Copy size={10} caps style={{ color: theme.colors.teal, marginBottom: 4 }}>
              Your next move
            </Copy>
            <Copy size={16} style={{ fontWeight: '700', lineHeight: 22.4 }}>
              {d.next.title}
            </Copy>
            <Copy size={11} muted style={{ marginTop: 4 }}>
              {d.next.detail}
            </Copy>
          </View>
          <Copy size={20} muted>
            ›
          </Copy>
        </Hit>
      </View>
      {d.resume && (
        <Section title="Continue watching">
          <Hit
            onPress={() => go('lesson', d.resume.id)}
            style={[
              cardStyle,
              {
                paddingVertical: 0,
                paddingHorizontal: 0,
                flexDirection: 'row',
                overflow: 'hidden',
              },
            ]}
          >
            {fontScale < 1.5 && (
              <View
                style={{
                  width: 84,
                  minHeight: 112,
                  padding: 12,
                  backgroundColor: theme.colors.backgroundEnd,
                  justifyContent: 'space-between',
                  borderRightWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <Icon name="play" size={28} />
                <Copy caps size={10} style={{ color: theme.colors.teal }}>
                  Master Class
                </Copy>
              </View>
            )}
            <View style={{ flex: 1, padding: 12, justifyContent: 'center' }}>
              <Copy size={9} caps muted>
                {d.resume.course}
              </Copy>
              <Copy size={14} style={{ fontWeight: '700', marginVertical: 4 }}>
                {d.resume.title}
              </Copy>
              <Copy size={11} muted>
                {formatTime(member.positions[d.resume.id])} / {d.resume.minutes}:00 ·{' '}
                {Math.max(
                  1,
                  Math.ceil((d.resume.minutes * 60 - member.positions[d.resume.id]) / 60),
                )}{' '}
                min left
              </Copy>
              <View style={{ marginTop: 12, height: 3, backgroundColor: theme.colors.raised }}>
                <View
                  style={{
                    height: 3,
                    width: `${Math.min(100, (member.positions[d.resume.id] / (d.resume.minutes * 60)) * 100)}%`,
                    backgroundColor: theme.colors.teal,
                  }}
                />
              </View>
            </View>
          </Hit>
        </Section>
      )}
      {event && (
        <Section
          title={
            registrationFor(events.data, event.id)?.status === 'registered'
              ? 'Your next event'
              : 'Included events'
          }
          action={() => go('events')}
        >
          <EventCard
            event={event}
            status={eventLabels[eventStatus(member, event, events.data)]}
            press={() => go('event', event.id)}
          />
          {registrationFor(events.data, event.id)?.status === 'registered' && isEventDay(event) && (
            <Hit onPress={() => go('event', event.id + '/ticket')}>
              <Copy size={12} style={{ color: theme.colors.teal }}>
                Today · {ticketLabel(event)} ↗
              </Copy>
            </Hit>
          )}
        </Section>
      )}
      {!!events.warning && <SavedState state={events} />}
      <Section
        title={d.recommendations.length ? 'Picked for you' : 'Your learning'}
        action={() => go('library')}
      >
        {d.recommendations.length ? (
          <Card style={{ padding: 8, gap: 8 }}>
            {d.recommendations.map((l) => (
              <LessonRow
                key={l.id}
                lesson={l}
                detail={
                  l.tags.some((tag) => `${goal.name} ${goal.success}`.toLowerCase().includes(tag))
                    ? 'For your current goal'
                    : 'Included in your programme'
                }
                press={() => go('lesson', l.id)}
              />
            ))}
          </Card>
        ) : (
          <Card>
            <Copy size={14}>
              {d.incomplete.length
                ? 'Your next lesson is ready above.'
                : "You've finished every lesson included in your membership. Revisit any lesson in Library."}
            </Copy>
          </Card>
        )}
      </Section>
      <Hit
        onPress={() => open('progress')}
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          paddingVertical: 16,
          marginTop: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="check" />
          <Copy size={12}>This week’s actions</Copy>
        </View>
        <Copy size={12}>{d.actionsDone} of 3 ›</Copy>
      </Hit>
      {d.membership.ai && (
        <Hit
          onPress={() => go('coach')}
          style={[cardStyle, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}
        >
          <Icon name="spark" />
          <View style={{ flex: 1 }}>
            <Copy size={14} style={{ fontWeight: '700' }}>
              A little guidance?
            </Copy>
            <Copy size={11} muted style={{ marginTop: 4 }}>
              Work through your next step with AaronAI.
            </Copy>
          </View>
          <Copy size={20} muted>
            ›
          </Copy>
        </Hit>
      )}
    </>
  );
}
