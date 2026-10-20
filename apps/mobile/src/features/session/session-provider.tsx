import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useStore } from 'zustand';
import { AppState, Platform } from 'react-native';
import { Link, Redirect, useIsFocused } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { backendConfigured } from '@/lib/api-config';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { AppButton } from '@/components/app-button';
import { getSessionController } from './runtime';
import { routeDecision } from './route-guard';
import { memberKey, type SessionController } from './session-controller';

const SessionContext = createContext<SessionController | null>(null);
export function useSessionController() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('Member session is unavailable.');
  return session;
}
export function useSessionState() {
  return useStore(useSessionController().store);
}
export function SessionBoundary({ children }: { children: ReactNode }) {
  if (!backendConfigured) return children;
  return Platform.OS === 'web' ? (
    <BrowserSessionBoundary>{children}</BrowserSessionBoundary>
  ) : (
    <ConfiguredSessionBoundary>{children}</ConfiguredSessionBoundary>
  );
}
const subscribeHydration = () => () => {};
const clientHydration = () => true;
const serverHydration = () => false;
function BrowserSessionBoundary({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(subscribeHydration, clientHydration, serverHydration);
  // Static export and initial hydration share this shell; credentials are read only on the client.
  if (!mounted) return <SessionStatus message="Restoring your member session…" />;
  return <ConfiguredSessionBoundary>{children}</ConfiguredSessionBoundary>;
}
function ConfiguredSessionBoundary({ children }: { children: ReactNode }) {
  const [configuration] = useState(() => {
    try {
      return { session: getSessionController() };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Invalid API configuration.' };
    }
  });
  useEffect(() => {
    const session = configuration.session;
    if (!session) return;
    void session.hydrate();
    let previous = AppState.currentState;
    const listener = AppState.addEventListener('change', (next) => {
      if (next === 'active' && previous !== 'active' && session.store.getState().status === 'ready')
        void session.hydrate({ background: true });
      previous = next;
    });
    return () => listener.remove();
  }, [configuration]);
  if (!configuration.session)
    return <SessionStatus message={configuration.error ?? 'Invalid API configuration.'} />;
  return (
    <SessionContext.Provider value={configuration.session}>{children}</SessionContext.Provider>
  );
}
export function SessionRouteBoundary({
  children,
  routeName,
}: {
  children: ReactNode;
  routeName: string;
}) {
  if (!backendConfigured) return children;
  return <MemberRouteBoundary routeName={routeName}>{children}</MemberRouteBoundary>;
}
function MemberRouteBoundary({ children, routeName }: { children: ReactNode; routeName: string }) {
  const session = useSessionController();
  const state = useSessionState();
  const focused = useIsFocused();
  const decision = routeDecision(state.status, routeName, focused);
  if (decision === 'hidden') return null;
  if (decision === 'loading') return <SessionStatus message="Restoring your member session…" />;
  if (decision === 'error')
    return <SessionStatus message={state.error} retry={() => void session.hydrate()} signIn />;
  if (decision === 'sign-in') return <Redirect href="/sign-in" />;
  if (decision === 'home') return <Redirect href="/home" />;
  return children;
}
export function SessionStatus({
  message,
  retry,
  signIn,
}: {
  message: string;
  retry?: () => void;
  signIn?: boolean;
}) {
  return (
    <AppScreen
      title="Member access"
      actions={
        <>
          {retry && <AppButton label="Try again" onPress={retry} />}
          {signIn && (
            <Link href="/sign-in" asChild>
              <AppButton label="Sign in again" variant="secondary" />
            </Link>
          )}
        </>
      }
    >
      <AppText variant="title">Member access</AppText>
      <AppText role={retry ? 'alert' : 'status'}>{message}</AppText>
    </AppScreen>
  );
}
export function useMemberProfile() {
  const session = useSessionController();
  const state = useSessionState();
  return useQuery({
    queryKey: memberKey(session.origin, state.memberId ?? ''),
    queryFn: ({ signal }) => session.refreshMember(signal),
    enabled: state.status === 'ready' && Boolean(state.memberId),
  });
}
