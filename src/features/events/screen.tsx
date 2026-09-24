import { useState } from 'react';
import { create } from 'zustand';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { theme } from '@/theme';
import { useMember } from '../home/store';
import {
  Card,
  Copy,
  EventCard,
  Icon,
  MemberFrame,
  Solid,
  TextAction,
  LessonRow,
  type Go,
} from '../home/ui';
import { PageHeader, Segments, Sheet, Select, Empty, useHydrate, SavedState } from '../member/ui';
import { useEvents } from './store';
import { eventLabels } from './components';
import {
  eventCatalogue,
  canAttend,
  eventStatus,
  selectEvents,
  eventDate,
  eventTime,
  eventMonth,
  ticketLabel,
  registrationFor,
  relatedLessons,
  registerEvent,
  cancelRegistration,
  simulateCheckIn,
  parseEventRoute,
  type MemberEvent,
} from './model';
function SampleCode() {
  const cells = [];
  for (let y = 0; y < 25; y++)
    for (let x = 0; x < 25; x++) {
      if ((x < 8 && y < 8) || (x > 16 && y < 8) || (x < 8 && y > 16)) continue;
      if ((x * 17 + y * 13 + x * y * 3) % 7 < 3)
        cells.push(<Rect key={`${x}-${y}`} x={x + 3} y={y + 3} width={1} height={1} />);
    }
  return (
    <Svg
      width="100%"
      height={220}
      viewBox="0 0 31 31"
      fill={theme.colors.black}
      accessible={false}
      aria-hidden
    >
      <Rect width={31} height={31} fill={theme.colors.white} />
      {cells}
      {[
        [3, 3],
        [21, 3],
        [3, 21],
      ].map(([x, y]) => (
        <ViewlessSquares key={`${x}-${y}`} x={x} y={y} />
      ))}
    </Svg>
  );
}
function ViewlessSquares({ x, y }: { x: number; y: number }) {
  return (
    <>
      <Rect x={x} y={y} width={7} height={7} />
      <Rect x={x + 1} y={y + 1} width={5} height={5} fill={theme.colors.white} />
      <Rect x={x + 2} y={y + 2} width={3} height={3} />
    </>
  );
}
function Overview({ event }: { event: MemberEvent }) {
  return (
    <View style={{ gap: 12 }}>
      <Copy caps size={12} style={{ color: theme.colors.teal }}>
        {event.format === 'online' ? 'Online' : 'In person'} · {event.hours}{' '}
        {event.hours === 1 ? 'hour' : 'hours'}
      </Copy>
      <Copy size={24} style={{ fontWeight: '700', lineHeight: 31.2 }} accessibilityRole="header">
        {event.title}
      </Copy>
      <Copy muted>
        {eventDate(event)} · {eventTime(event)}
      </Copy>
      <Copy muted>{event.location}</Copy>
    </View>
  );
}
function EventSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View
      style={{ paddingVertical: 24, borderTopWidth: 1, borderColor: theme.colors.border, gap: 12 }}
    >
      <Copy caps size={12} muted accessibilityRole="header">
        {title}
      </Copy>
      {children}
    </View>
  );
}
const useDisplay = create(() => ({ format: 'all', phase: 'ready' }));
const setFormat = (format: string) => useDisplay.setState({ format });
const setPhase = (phase: string) => useDisplay.setState({ phase });
export function EventsScreen({ id, go, progress }: { id?: string; go: Go; progress: () => void }) {
  const state = useEvents();
  useHydrate(state);
  const { member, goal } = useMember((s) => s.data);
  const route = parseEventRoute(`#events${id ? '/' + id : ''}`),
    event = eventCatalogue(state.data).find((e) => e.id === route.id);
  const { format, phase } = useDisplay();
  const [panel, setPanel] = useState<string | null>(null),
    [preview, setPreview] = useState('ready'),
    [error, setError] = useState(''),
    [demo, setDemo] = useState(false);
  const allowed = event && canAttend(member, event),
    view = route.view === 'list' ? 'list' : allowed ? route.view : 'unavailable';
  const status = allowed ? eventStatus(member, event, state.data) : 'unavailable',
    record = event ? registrationFor(state.data, event.id) : null;
  const titles: Record<string, string> = {
    list: 'Events',
    detail: 'Event details',
    confirmed: 'You’re registered',
    ticket: event?.format === 'online' ? 'Online access' : 'My ticket',
    'checked-in': 'Attendance recorded',
    unavailable: 'Not available',
  };
  const registered = status === 'registered' || status === 'attended';
  const pageValid =
    view === 'list' ||
    view === 'detail' ||
    (view === 'checked-in' ? status === 'attended' : registered);
  const list = selectEvents(member, state.data, { format, mine: route.mine });
  const mineCount = selectEvents(member, state.data, { mine: true }).length;
  function mutate(action: 'register' | 'cancel' | 'check-in') {
    if (!event) return;
    const result = state.change(
      (data) =>
        action === 'register'
          ? registerEvent(member, data, event)
          : action === 'cancel'
            ? cancelRegistration(member, data, event)
            : simulateCheckIn(member, data, event),
      action === 'register'
        ? 'Demo registration saved. No real booking was made.'
        : action === 'cancel'
          ? 'Demo registration cancelled.'
          : 'Demo attendance recorded.',
    );
    if (!result?.ok) {
      setError(result?.reason ?? 'Wait for saved events to load.');
      return;
    }
    setPanel(null);
    go(
      'event',
      `${event.id}${action === 'register' ? '/confirmed' : action === 'check-in' ? '/checked-in' : ''}`,
    );
  }
  const footer =
    state.status === 'ready' && event && allowed && pageValid && view !== 'list' ? (
      <View style={{ gap: 8, paddingTop: 12 }}>
        {status === 'open' ? (
          <Solid label="Register" onPress={() => mutate('register')} />
        ) : status === 'registered' ? (
          view === 'ticket' ? (
            event.format === 'online' ? (
              <Solid label="Preview joining" onPress={() => setPanel('Join preview')} />
            ) : (
              <Copy size={12} muted>
                Show this sample pass in the demo. It is not valid for admission.
              </Copy>
            )
          ) : (
            <Solid label={ticketLabel(event)} onPress={() => go('event', event.id + '/ticket')} />
          )
        ) : status === 'attended' ? (
          <Solid
            label={view === 'checked-in' ? 'View my progress' : 'View attendance'}
            onPress={() =>
              view === 'checked-in' ? progress() : go('event', event.id + '/checked-in')
            }
          />
        ) : (
          <>
            <Copy size={12} muted>
              {status === 'full'
                ? 'Fully booked. Registration is closed.'
                : status === 'cancelled'
                  ? 'This event has been cancelled.'
                  : 'This event has ended.'}
            </Copy>
            <Solid label="Browse events" onPress={() => go('events')} />
          </>
        )}
        {status === 'registered' && (
          <TextAction
            label="Cancel registration"
            onPress={() => setPanel('Cancel registration?')}
          />
        )}
        <Copy size={10} muted style={{ textAlign: 'center' }}>
          Demo · sample events, no live registration.
        </Copy>
      </View>
    ) : (
      <Copy size={10} muted style={{ textAlign: 'center', marginTop: 12 }}>
        Demo · sample events, no live registration.
      </Copy>
    );
  return (
    <MemberFrame title={titles[view] ?? 'Events'} active="events" go={go} footerContent={footer}>
      <PageHeader
        stacked
        title={titles[view] ?? 'Events'}
        eyebrow={view === 'list' ? 'Master App' : undefined}
        back={view !== 'list' ? () => go('events') : undefined}
        options={() => {
          setPreview(phase);
          setPanel('Events preview');
        }}
        optionsLabel="Events demo options"
      />
      {state.status !== 'ready' ? (
        <Empty
          title={state.status === 'failed' ? 'Couldn’t load events' : 'Loading events'}
          detail={
            state.status === 'failed'
              ? 'Your saved registrations are unchanged.'
              : 'Getting your included events ready.'
          }
        />
      ) : view === 'list' ? (
        <>
          <Segments
            value={route.mine ? 'mine' : 'upcoming'}
            onChange={(v) => go('events', v === 'mine' ? 'mine' : undefined)}
            options={[
              { value: 'upcoming', label: 'Upcoming' },
              { value: 'mine', label: `My events (${mineCount})` },
            ]}
          />
          <View style={{ marginTop: 16, marginBottom: 8 }}>
            <Segments
              pills
              value={format}
              onChange={setFormat}
              options={[
                { value: 'all', label: 'All' },
                { value: 'in-person', label: 'In person' },
                { value: 'online', label: 'Online' },
              ]}
            />
          </View>
          {phase === 'loading' ? (
            <Empty
              title="Loading events"
              detail="Getting your included events ready. This is a local loading-state preview."
              action={{ label: 'Finish loading preview', press: () => setPhase('ready') }}
            />
          ) : phase === 'error' ? (
            <Empty
              title="Couldn’t load events"
              detail="Your saved registrations are unchanged. Try again."
              action={{ label: 'Try again', press: () => setPhase('ready') }}
            />
          ) : !list.length || (phase === 'empty' && !route.mine) ? (
            <Empty
              title={route.mine ? 'No events yet' : 'Nothing scheduled'}
              detail={
                route.mine
                  ? 'Your registrations and attended events will appear here.'
                  : 'No included events match this view. Change the format or show all upcoming events.'
              }
              action={{
                label: 'Show all upcoming',
                press: () => {
                  setFormat('all');
                  setPhase('ready');
                  go('events');
                },
              }}
            />
          ) : (
            <View style={{ gap: 12, marginTop: 16 }}>
              {list.map((e, i) => (
                <View key={e.id} style={{ gap: 12 }}>
                  {(!i || eventMonth(list[i - 1]) !== eventMonth(e)) && (
                    <Copy
                      caps
                      size={12}
                      muted
                      accessibilityRole="header"
                      style={{ marginTop: i ? 12 : 0 }}
                    >
                      {eventMonth(e)}
                    </Copy>
                  )}
                  <EventCard
                    event={e}
                    status={eventLabels[eventStatus(member, e, state.data)]}
                    press={() => go('event', e.id)}
                  />
                </View>
              ))}
            </View>
          )}
        </>
      ) : !allowed || view === 'unavailable' ? (
        <Empty
          title="Event not available"
          detail="This link is invalid or isn’t available with your current access."
          action={{ label: 'Back to events', press: () => go('events') }}
        />
      ) : !pageValid ? (
        <Empty
          title="Access not available"
          detail="A current registration is required. This event or registration may have ended or been cancelled."
          action={{ label: 'View event details', press: () => go('event', event.id) }}
        />
      ) : (
        <>
          {view === 'detail' && (
            <Card
              style={{
                height: 128,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
              }}
            >
              <Icon name="events" size={48} />
            </Card>
          )}
          {(view === 'confirmed' || view === 'checked-in') && (
            <View
              style={{
                width: 64,
                height: 64,
                borderWidth: 1,
                borderColor: theme.colors.teal,
                borderRadius: 32,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
              }}
            >
              <Icon name="check" size={32} />
            </View>
          )}
          <Overview event={event} />
          {view === 'detail' ? (
            <>
              <Copy size={10} style={{ marginVertical: 16 }}>
                {eventLabels[status]}
              </Copy>
              <Copy style={{ marginBottom: 24 }}>{event.description}</Copy>
              <EventSection title="In your plan">
                <Card style={{ borderLeftWidth: 2, borderLeftColor: theme.colors.teal }}>
                  <Copy>{goal.name}</Copy>
                  <Copy>{event.goalNote}</Copy>
                  <Copy size={12} muted>
                    Registration adds an upcoming commitment. Attendance is separate from lesson
                    completion.
                  </Copy>
                </Card>
              </EventSection>
              {relatedLessons(member, event).length > 0 && (
                <EventSection title="Before the event">
                  {relatedLessons(member, event).map((l) => (
                    <LessonRow
                      key={l.id}
                      lesson={l}
                      detail={`${member.completed.includes(l.id) ? 'Completed' : 'Included'} · ${l.minutes} min`}
                      press={() => go('lesson', l.id)}
                    />
                  ))}
                </EventSection>
              )}
              <EventSection title="Come prepared">
                <Copy>{event.preparation}</Copy>
                <Copy muted>Hosted by {event.host} · fictional demo event.</Copy>
              </EventSection>
              <EventSection title="On the day">
                {event.agenda.map((a) => (
                  <View key={a.minutes} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                    <Copy size={14} muted style={{ minWidth: 96 }}>
                      {eventTime(event, event.start + a.minutes * 60000)}
                    </Copy>
                    <Copy style={{ flex: 1, minWidth: 140 }}>{a.title}</Copy>
                  </View>
                ))}
              </EventSection>
            </>
          ) : view === 'confirmed' ? (
            <>
              <EventSection title="Added to your plan">
                <Card>
                  <Copy>{goal.name}</Copy>
                  <Copy>
                    An upcoming commitment. It becomes an attended event only after check-in.
                  </Copy>
                </Card>
              </EventSection>
              <EventSection title="Before the day">
                <Copy>{event.preparation}</Copy>
                <Copy muted>Demo only. No reminder will be sent.</Copy>
              </EventSection>
              <TextAction
                label="Preview calendar reminder"
                onPress={() => setPanel('Calendar reminder preview')}
              />
            </>
          ) : view === 'ticket' ? (
            <>
              <Card style={{ padding: 24, marginTop: 24, alignItems: 'center' }}>
                {event.format === 'in-person' ? (
                  <>
                    <SampleCode />
                    <Copy size={12} style={{ color: theme.colors.teal }}>
                      Demo QR · not valid for admission
                    </Copy>
                  </>
                ) : (
                  <>
                    <Icon name="events" size={64} />
                    <Copy size={20}>Join from your device</Copy>
                    <Copy>A meeting link will appear here in the live app.</Copy>
                  </>
                )}
                <Copy size={20}>{member.firstName}</Copy>
                <Copy size={12} style={{ textAlign: 'center', flexShrink: 1 }}>
                  {record?.passId}
                </Copy>
                <Copy size={12} style={{ color: theme.colors.teal }}>
                  {status === 'attended' ? 'Attendance already recorded' : 'Sample registration'}
                </Copy>
              </Card>
              <Copy size={12} muted style={{ marginVertical: 16 }}>
                Saved data is local to this device when storage is available. This is not a real
                admission pass or guaranteed offline access.
              </Copy>
              <TextAction label="Offline preview" onPress={() => setPanel('Offline preview')} />
              {event.format === 'in-person' && (
                <TextAction label="Wallet preview" onPress={() => setPanel('Wallet preview')} />
              )}
              <TextAction
                label={demo ? 'Hide demo controls' : 'Demo controls'}
                onPress={() => setDemo(!demo)}
              />
              {demo && status === 'registered' && (
                <>
                  <Copy size={12} muted>
                    Simulates staff check-in. No scanner or real attendance service is connected.
                  </Copy>
                  <Solid label="Simulate staff check-in" onPress={() => mutate('check-in')} />
                </>
              )}
            </>
          ) : (
            <>
              <EventSection title="You were here">
                <Copy>Attendance recorded in this demo.</Copy>
                {record?.checkedInAt && (
                  <Copy muted>{new Date(record.checkedInAt).toLocaleString('en-AU')}</Copy>
                )}
                <Copy size={12} muted>
                  Attendance is separate from learning minutes, lesson completion and weekly
                  actions.
                </Copy>
              </EventSection>
              <TextAction label="Back to My events" onPress={() => go('events', 'mine')} />
            </>
          )}
        </>
      )}
      {!!error && <Copy role="alert">{error}</Copy>}
      <SavedState state={state} />
      <Sheet title={panel} close={() => setPanel(null)}>
        {panel === 'Events preview' ? (
          <>
            <Copy>
              Local demo states only. Registrations and learning progress will not be changed.
            </Copy>
            <Select
              label="Screen state"
              value={preview}
              onChange={setPreview}
              options={[
                ['ready', 'Upcoming events'],
                ['loading', 'Loading'],
                ['error', 'Loading error'],
                ['empty', 'Empty list'],
                ['full', 'Fully booked event'],
                ['cancelled', 'Cancelled event'],
                ['ended', 'Ended event'],
                ['unavailable', 'Inaccessible link'],
              ].map(([value, label]) => ({ value, label }))}
            />
            <Solid
              label="Apply preview"
              onPress={() => {
                setPanel(null);
                if (['ready', 'loading', 'error', 'empty'].includes(preview)) {
                  setPhase(preview);
                  if (view !== 'list' || route.mine) go('events');
                  return;
                }
                const selected = eventCatalogue(state.data).find(
                  (e) =>
                    canAttend(member, e) &&
                    (preview === 'ended' ? e.end < Date.now() : e.status === preview),
                );
                go('event', selected?.id ?? 'unavailable');
              }}
            />
          </>
        ) : panel === 'Cancel registration?' ? (
          <>
            <Copy>{event?.title}</Copy>
            <Copy>
              Your upcoming commitment will be removed and this sample pass will no longer be valid.
            </Copy>
            <Solid label="Cancel registration" onPress={() => mutate('cancel')} />
            <TextAction label="Keep registration" onPress={() => setPanel(null)} />
          </>
        ) : (
          <>
            {panel === 'Offline preview' && event && allowed && registered && (
              <Card>
                <Copy size={12} style={{ color: theme.colors.teal }}>
                  Simulated offline state · no connectivity change
                </Copy>
                <Overview event={event} />
                {event.format === 'in-person' ? (
                  <>
                    <SampleCode />
                    <Copy size={12}>Demo QR · not valid for admission</Copy>
                    <Copy>{member.firstName}</Copy>
                    <Copy size={12}>{record?.passId}</Copy>
                  </>
                ) : (
                  <Copy>Joining an online event needs an internet connection.</Copy>
                )}
              </Card>
            )}
            <Copy>
              {panel === 'Wallet preview'
                ? 'In the live app, an issued pass could be added to a supported wallet. This demo creates no wallet pass.'
                : panel === 'Offline preview'
                  ? 'This is a preview only. Local registration data is saved when storage is available, but reopening this screen offline is not guaranteed.'
                  : panel === 'Join preview'
                    ? 'This would open the meeting in the live app. No call is opened and no attendance is recorded in this preview.'
                    : 'This would add an event and reminder in the live app. This preview changes no calendar and sends no reminder.'}
            </Copy>
            <Solid label="Close preview" onPress={() => setPanel(null)} />
          </>
        )}
      </Sheet>
    </MemberFrame>
  );
}
