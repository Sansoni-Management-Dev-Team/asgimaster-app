import { backendConfigured } from '@/lib/api-config';
import { MemberHomeScreen } from '@/features/session/home-screen';
import { HomeScreen } from '@/features/home/home-screen';
export default function HomeRoute() {
  return backendConfigured ? <MemberHomeScreen /> : <HomeScreen />;
}
