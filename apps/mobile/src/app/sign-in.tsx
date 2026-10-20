import { backendConfigured } from '@/lib/api-config';
import { MemberSignInScreen } from '@/features/session/sign-in-screen';
import { SignInScreen } from '@/features/access/sign-in-screen';
export default function SignInRoute() {
  return backendConfigured ? <MemberSignInScreen /> : <SignInScreen />;
}
