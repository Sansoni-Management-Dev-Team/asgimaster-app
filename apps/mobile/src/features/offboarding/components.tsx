import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Copy, Solid, TextAction } from '../home/ui';
import { useSupport } from '../support/store';
import type { Conversation } from '../support/model';
import { useHydrate } from '../member/ui';
import { pendingOffboarding } from './model';
import { intentLabels, reasonLabels } from './metadata';
import { theme } from '@/theme';

export function OffboardingEntry({ prominent = false }: { prominent?: boolean }) {
  const router = useRouter();
  const support = useSupport();
  useHydrate(support);
  const pending = pendingOffboarding(support.data);
  const Action = prominent ? Solid : TextAction;
  return (
    <View style={{ gap: 4 }}>
      <Action
        label={pending ? 'View callback request' : 'Leave my programme'}
        onPress={() =>
          router.push(
            pending
              ? { pathname: '/offboarding', params: { request: pending.id } }
              : '/offboarding',
          )
        }
      />
      {pending && (
        <Copy muted size={12}>
          Callback requested · Demo only
        </Copy>
      )}
    </View>
  );
}

export function CallbackSummary({ conversation }: { conversation: Conversation }) {
  const data = conversation.offboarding;
  if (!data) return null;
  return (
    <Card style={{ paddingHorizontal: 20, paddingVertical: 20, gap: 20 }}>
      <View style={{ gap: 4 }}>
        <Copy caps muted size={10}>
          Your request
        </Copy>
        <Copy size={18}>{intentLabels[data.intent]}</Copy>
      </View>
      <View style={{ gap: 4 }}>
        <Copy muted size={12}>
          Callback number
        </Copy>
        <Copy selectable>{data.phone}</Copy>
      </View>
      {!!data.preferredTime && (
        <View style={{ gap: 4 }}>
          <Copy muted size={12}>
            Preferred time / timezone
          </Copy>
          <Copy>{data.preferredTime}</Copy>
        </View>
      )}
      {data.reason && (
        <View style={{ gap: 4 }}>
          <Copy muted size={12}>
            Reason
          </Copy>
          <Copy>{reasonLabels[data.reason]}</Copy>
        </View>
      )}
      {!!data.note && (
        <View style={{ gap: 4 }}>
          <Copy muted size={12}>
            Your note
          </Copy>
          <Copy>{data.note}</Copy>
        </View>
      )}
      <View style={{ gap: 4 }}>
        <Copy muted size={12}>
          Request reference
        </Copy>
        <Copy selectable size={12} style={{ fontFamily: theme.fontNumbers }}>
          {conversation.id}
        </Copy>
      </View>
      <Copy muted size={12}>
        Programme at request: {data.membership.plan}
      </Copy>
    </Card>
  );
}
