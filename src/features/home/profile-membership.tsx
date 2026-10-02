import { View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/theme';
import { Crown } from '../onboarding/envelope';
import { isComplete, hasAnswer, questions } from '../onboarding/model';
import { useOnboarding } from '../onboarding/store';
import { useMember } from './store';
import { getDashboard } from './model';
import { MembershipCardFinish } from './membership-card-finish';
import { formatCardCode, formatCardExpiry } from './membership-card';
import { Card, Copy, Hit, Icon, Section, TextAction, cardStyle, type Go } from './ui';
import type { Sheet } from './dashboard';
import { OffboardingEntry } from '../offboarding/components';

function AccountRow({
  title,
  detail,
  press,
}: {
  title: string;
  detail: string;
  press: () => void;
}) {
  return (
    <Hit
      onPress={press}
      accessibilityLabel={title}
      accessibilityHint={detail}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Copy>{title}</Copy>
        <Copy muted size={12}>
          {detail}
        </Copy>
      </View>
    </Hit>
  );
}
export function Profile({ go, open }: { go: Go; open: (sheet: Sheet) => void }) {
  const router = useRouter();
  const { width, fontScale } = useWindowDimensions();
  const { member, goal, membershipCard } = useMember((s) => s.data);
  const record = useOnboarding((s) => s.record);
  const d = getDashboard(member, goal);
  const complete = isComplete(record);
  const count = questions.filter((q) => hasAnswer(record, q)).length;
  return (
    <>
      <Hit
        onPress={() => go('membership')}
        accessibilityLabel={`View membership details, ${d.membership.name} plan. Membership ${membershipStatus(d.membership.status).toLowerCase()}. Expires ${formatCardExpiry(membershipCard.expiresOn)}. Card ID ${formatCardCode(membershipCard.code)}.`}
        accessibilityHint="Opens your membership details."
        style={[
          cardStyle,
          {
            borderWidth: 0,
            paddingHorizontal: 24,
            paddingVertical: 16,
            gap: 8,
            marginTop: 16,
            marginBottom: 32,
          },
        ]}
      >
        <MembershipCardFinish />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <View aria-hidden style={{ width: 32, height: 32 }}>
            <View style={{ position: 'absolute', top: 1, left: 0 }}>
              <Crown size={32} color={theme.colors.black} />
            </View>
            <View style={{ position: 'absolute', top: 0, left: 0 }}>
              <Crown size={32} color={theme.colors.accentPressed} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
            {d.membership.status !== 'active' && <Icon name="lock" size={16} />}
            <Copy size={12} style={{ flexShrink: 1 }}>
              {membershipStatus(d.membership.status)}
            </Copy>
          </View>
        </View>
        <View style={{ gap: 4 }}>
          <Copy caps size={10} style={{ color: theme.colors.accentPressed }}>
            Your membership
          </Copy>
          <Copy
            caps
            size={width < 360 && d.membership.name.length > 8 ? 28 : 34}
            style={{
              lineHeight: 40,
              textShadowColor: theme.colors.black,
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 1,
            }}
          >
            {d.membership.status === 'paused' ? 'On pause' : d.membership.name}
          </Copy>
          {!!member.firstName && <Copy size={14}>{member.firstName}</Copy>}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
          <View style={{ flexGrow: 1, minWidth: 90 * fontScale, maxWidth: '100%' }}>
            <Copy size={12}>{formatCardExpiry(membershipCard.expiresOn)}</Copy>
          </View>
          <View
            style={{
              flexGrow: 1,
              minWidth: 72 * fontScale,
              maxWidth: '100%',
              alignItems: 'flex-end',
            }}
          >
            <Copy
              size={11}
              style={{ fontFamily: theme.fontNumbers, letterSpacing: 0.5, textAlign: 'right' }}
            >
              {formatCardCode(membershipCard.code)}
            </Copy>
          </View>
        </View>
      </Hit>
      <Card style={{ padding: 24, gap: 16 }}>
        <Copy caps muted size={10}>
          {complete ? 'Your direction' : 'Make this yours'}
        </Copy>
        <Copy size={20} style={{ fontWeight: '700' }}>
          {complete ? goal.name : 'Start with a clear direction.'}
        </Copy>
        <Copy muted size={12}>
          {complete
            ? 'Your answers shape your Home and learning recommendations.'
            : count
              ? `${count} of ${questions.length} answers saved. Your next chapter is taking shape.`
              : 'Add your goal and priorities to personalise your experience.'}
        </Copy>
        <TextAction
          label={
            complete ? 'View my direction' : count ? 'Continue setting up' : 'Set up my direction'
          }
          onPress={() =>
            router.push(
              complete
                ? { pathname: '/onboarding', params: { step: 'complete', from: 'home' } }
                : '/onboarding',
            )
          }
        />
      </Card>
      <Section title="Your account">
        <AccountRow
          title="Membership details"
          detail={
            d.membership.status === 'paused'
              ? 'Membership paused'
              : `${d.membership.name} · ${membershipStatus(d.membership.status)}`
          }
          press={() => go('membership')}
        />
        <AccountRow
          title="View my plan"
          detail={goal.name ? 'Your goal and timeframe' : 'Your plan starts with your direction'}
          press={() => go('plan')}
        />
        <AccountRow
          title="Notifications"
          detail="Choose how you stay in the loop"
          press={() => go('support', 'settings')}
        />
        <AccountRow
          title="Contact support"
          detail="Help with your membership or the app"
          press={() => go('support')}
        />
      </Section>
      <Section title="Prototype tools">
        <TextAction label="Demo settings" onPress={() => open('demo')} />
        <TextAction
          label="Preview empty Home"
          onPress={() => router.push({ pathname: '/home', params: { preview: 'empty' } })}
        />
        <Copy muted size={12}>
          Explore the first-run experience or different membership states.
        </Copy>
      </Section>
    </>
  );
}

export function membershipStatus(status: string) {
  return status === 'active' ? 'Active' : status === 'payment_due' ? 'Payment due' : 'Paused';
}
export function MembershipDetails({ go }: { go: Go }) {
  const { member, goal } = useMember((s) => s.data);
  const d = getDashboard(member, goal);
  const paused = d.membership.status === 'paused';
  const payment = d.membership.status === 'payment_due';
  return (
    <>
      <View style={{ marginTop: 16, gap: 12 }}>
        <Copy caps accessibilityRole="header" size={32} style={{ lineHeight: 40 }}>
          {paused ? 'On pause.' : `${d.membership.name}.`}
        </Copy>
        <Copy style={{ fontWeight: '700' }}>
          {payment
            ? 'Let’s get your payment sorted.'
            : paused
              ? 'Your foundations are still here.'
              : 'Your membership is active.'}
        </Copy>
        <Copy muted size={12}>
          {payment
            ? 'Your learning access remains active. Contact member support for help with your payment.'
            : paused
              ? 'Keep exploring your foundation lessons. Contact us when you’re ready to discuss your membership.'
              : 'Explore your included learning and turn your direction into action.'}
        </Copy>
      </View>
      <Section title="Your membership access">
        <AccountRow
          title="Your learning library"
          detail={`${d.entitled.length} lessons · ${d.membership.access.length > 1 ? 'Foundations and growth' : 'Foundations'}`}
          press={() => go('library')}
        />
        {d.membership.ai ? (
          <AccountRow
            title="AaronAI guidance"
            detail="Work through your next step, at your pace"
            press={() => go('coach')}
          />
        ) : (
          <View
            style={{
              paddingVertical: 20,
              gap: 4,
              borderBottomWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <Copy>AaronAI guidance</Copy>
            <Copy muted size={12}>
              Unavailable while your membership is paused
            </Copy>
          </View>
        )}
        <AccountRow
          title={d.membership.coach ? 'Your consultant' : 'Member support'}
          detail={
            d.membership.coach
              ? 'Support with your goals and next steps'
              : 'Help with your membership and app'
          }
          press={() => go('support')}
        />
      </Section>
      <View style={{ marginTop: 32, gap: 16 }}>
        <Copy caps size={12}>
          Here when you need us
        </Copy>
        <Copy muted size={12}>
          For membership changes, access or payment questions, speak with our support team.
        </Copy>
        <TextAction
          label={
            payment
              ? 'Get payment help'
              : paused
                ? 'Discuss my membership'
                : 'Contact member support'
          }
          onPress={() => go('support')}
        />
        <TextAction label="Back to my profile" onPress={() => go('profile')} />
      </View>
      <View style={{ marginTop: 32 }}>
        <OffboardingEntry prominent />
      </View>
    </>
  );
}
