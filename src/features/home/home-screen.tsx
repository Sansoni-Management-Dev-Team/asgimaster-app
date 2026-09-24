import { useEffect, useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { isComplete } from '@/features/onboarding/model';
import { ProgressLoading } from '@/features/onboarding/progress-loading';
import { useOnboarding } from '@/features/onboarding/store';
import { useMember } from './store';
import { getDashboard } from './model';
import { Dashboard, type Sheet } from './dashboard';
import { MemberSheets } from './sheets';
import { MemberDestination } from './destinations';
import { Copy, Heading, MemberFrame, Solid, type Destination, type Go, type Tab } from './ui';
import { LibraryScreen } from '../library/screen';
import { LessonScreen } from '../library/player';
import { EventsScreen } from '../events/screen';
import { CoachScreen } from '../coach/screen';
import { SupportScreen } from '../support/screen';
const titles: Record<Destination, string> = {
  home: 'Today',
  library: 'Library',
  events: 'Events',
  coach: 'AaronAI',
  support: 'Support',
  profile: 'Profile',
  membership: 'Your membership',
  lesson: 'Your lesson',
  event: 'Event details',
  plan: 'Your plan',
};
export function HomeScreen() {
  const onboarding = useOnboarding();
  const hydrate = onboarding.hydrate;
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  if (onboarding.hydration !== 'ready') return <ProgressLoading />;
  if (!isComplete(onboarding.record)) return <Redirect href="/onboarding" />;
  return <MemberHome />;
}
function MemberHome() {
  const state = useMember();
  const hydrate = state.hydrate;
  const router = useRouter();
  const params = useLocalSearchParams<{ view?: string; id?: string }>();
  const view: Destination =
    params.view && Object.hasOwn(titles, params.view) ? (params.view as Destination) : 'home';
  const [sheet, setSheet] = useState<Sheet | null>(null);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  const go: Go = (next, id) => {
    setSheet(null);
    state.clearError();
    router.push({ pathname: '/home', params: { view: next, ...(id ? { id } : {}) } });
  };
  const open = (next: Sheet) => {
    state.clearError();
    setSheet(next);
  };
  const d = getDashboard(state.data.member, state.data.goal);
  function next() {
    if (d.next.kind === 'lesson' && d.nextLesson) go('lesson', d.nextLesson.id);
    else open(d.next.kind as Sheet);
  }
  const active: Tab =
    view === 'lesson'
      ? 'library'
      : view === 'event'
        ? 'events'
        : ['home', 'library', 'events', 'coach', 'support'].includes(view)
          ? (view as Tab)
          : 'home';
  const migrated =
    state.status === 'ready' ? (
      view === 'library' ? (
        <LibraryScreen go={go} />
      ) : view === 'lesson' ? (
        <LessonScreen id={params.id} go={go} />
      ) : view === 'events' || view === 'event' ? (
        <EventsScreen id={params.id} go={go} progress={() => open('progress')} />
      ) : view === 'coach' ? (
        <CoachScreen go={go} />
      ) : view === 'support' ? (
        <SupportScreen id={params.id} go={go} />
      ) : null
    ) : null;
  if (migrated)
    return (
      <>
        {migrated}
        <MemberSheets sheet={sheet} close={() => setSheet(null)} open={open} go={go} />
      </>
    );
  return (
    <MemberFrame
      title={titles[view]}
      active={active}
      go={go}
      primary={
        view === 'home' && state.status === 'ready'
          ? { label: d.next.label, press: next }
          : undefined
      }
    >
      {state.status !== 'ready' ? (
        <>
          <Heading title="Today" />
          <Copy role={state.status === 'failed' ? 'alert' : 'status'}>
            {state.error || 'Loading your Home progress…'}
          </Copy>
          {state.status === 'failed' && (
            <Solid label="Retry loading Home" onPress={() => void hydrate()} />
          )}
        </>
      ) : (
        <>
          {view === 'home' ? (
            <Dashboard go={go} open={open} next={next} />
          ) : (
            <MemberDestination
              key={`${view}-${params.id ?? ''}`}
              view={view}
              id={params.id}
              go={go}
              open={open}
            />
          )}
          {!!state.error && !sheet && (
            <Copy role="alert" style={{ marginTop: 16 }}>
              {state.error}
            </Copy>
          )}
          {!!state.notice && !sheet && (
            <Copy
              role="status"
              accessibilityLiveRegion="polite"
              size={12}
              style={{ marginTop: 16 }}
            >
              {state.notice}
            </Copy>
          )}
          <MemberSheets sheet={sheet} close={() => setSheet(null)} open={open} go={go} />
        </>
      )}
    </MemberFrame>
  );
}
