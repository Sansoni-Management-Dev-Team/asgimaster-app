import { Redirect } from 'expo-router';
import { backendConfigured } from '@/lib/api-config';
import { AuthCallbackScreen } from '@/features/session/auth-callback-screen';
export default function CallbackRoute() {
  return backendConfigured ? <AuthCallbackScreen /> : <Redirect href="/sign-in" />;
}
