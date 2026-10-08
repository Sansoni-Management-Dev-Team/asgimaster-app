import { useCallback, useRef, useState } from 'react';
import { BackHandler, Keyboard, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { AppField } from '@/components/app-field';
import { theme } from '@/theme';
import { Copy, Hit, Solid, TextAction } from '../home/ui';
import { useMember } from '../home/store';
import { membershipFor } from '../home/model';
import { Crown } from '../onboarding/envelope';
import { useSupport } from '../support/store';
import { useHydrate } from '../member/ui';
import { CallbackSummary } from './components';
import { callbackErrors, emptyDraft, pendingOffboarding } from './model';
import {
  intentLabels,
  reasonLabels,
  type OffboardingIntent,
  type OffboardingReason,
} from './metadata';
import { submitCallback } from './store';

type Step = 'intro' | 'reason' | 'offer' | 'callback';
const titles = {
  intro: 'Thinking of leaving the Sansoni-verse?',
  reason: 'What’s changed?',
  offer: 'Want to keep app access?',
  callback: 'Let’s talk.',
};

export function OffboardingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ request?: string }>();
  const member = useMember();
  const support = useSupport();
  useHydrate(support);
  useFocusEffect(
    useCallback(() => {
      void useMember.getState().hydrate();
    }, []),
  );
  const [step, setStep] = useState<Step>('intro');
  const [callbackFrom, setCallbackFrom] = useState<Step>('intro');
  const [draft, setDraft] = useState(emptyDraft);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState<string>();
  const phoneInput = useRef<TextInput>(null);
  const submitting = useRef(false);
  const ready = member.status === 'ready' && support.status === 'ready';
  const requestedId = savedId ?? params.request;
  const receipt = requestedId
    ? support.data.conversations.find((item) => item.id === requestedId && item.offboarding)
    : pendingOffboarding(support.data);
  const missing = ready && !!requestedId && !receipt;
  const failed = member.status === 'failed' || support.status === 'failed';
  const errors = callbackErrors(draft);
  const busy = support.saving;
  const leave = useCallback(
    () => router.replace({ pathname: '/home', params: { view: 'membership' } }),
    [router],
  );
  const back = useCallback(() => {
    if (busy) return;
    Keyboard.dismiss();
    setError('');
    if (receipt || missing || step === 'intro') leave();
    else setStep(step === 'callback' ? callbackFrom : step === 'offer' ? 'reason' : 'intro');
  }, [busy, receipt, missing, step, callbackFrom, leave]);
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        back();
        return true;
      });
      return () => subscription.remove();
    }, [back]),
  );
  function advance(next: Step) {
    Keyboard.dismiss();
    setError('');
    setStep(next);
  }
  function callback(intent: OffboardingIntent) {
    setDraft((previous) => ({ ...previous, intent }));
    setCallbackFrom(step);
    advance('callback');
  }
  async function submit() {
    if (!ready || submitting.current || busy) return;
    setAttempted(true);
    setError('');
    if (Object.values(errors).some(Boolean)) {
      if (errors.phone) phoneInput.current?.focus();
      return;
    }
    submitting.current = true;
    Keyboard.dismiss();
    try {
      const plan = membershipFor(member.data.member);
      const result = await submitCallback(draft, {
        plan: plan.name,
        status: plan.status,
        cardCode: member.data.membershipCard.code,
      });
      if (result.conversation) setSavedId(result.conversation.id);
      else setError(result.error ?? 'Your request could not be saved. Please try again.');
    } finally {
      submitting.current = false;
    }
  }
  const heading = !ready
    ? failed
      ? 'Let’s try again.'
      : 'Loading your membership.'
    : missing
      ? 'Request not found.'
      : receipt
        ? 'Your callback request.'
        : titles[step];
  const viewKey = !ready
    ? 'loading'
    : missing
      ? 'missing'
      : receipt
        ? `receipt-${receipt.id}`
        : step;
  const actions = !ready ? (
    <>
      {failed && (
        <Solid
          label="Retry loading"
          onPress={() => {
            void member.hydrate();
            void support.hydrate();
          }}
        />
      )}
      <TextAction label="Back to membership" onPress={leave} />
    </>
  ) : missing ? (
    <TextAction label="Back to membership" onPress={leave} />
  ) : receipt ? (
    <>
      <Solid
        label="View request in Support"
        onPress={() =>
          router.replace({ pathname: '/home', params: { view: 'support', id: receipt.id } })
        }
      />
      <TextAction label="Back to membership" onPress={leave} />
    </>
  ) : step === 'intro' ? (
    <>
      <Solid label="Talk to someone" onPress={() => callback('discuss')} />
      <Hit onPress={() => advance('reason')}>
        <Copy size={14} style={{ textAlign: 'center', color: theme.colors.accent }}>
          Continue with leaving
        </Copy>
      </Hit>
    </>
  ) : step === 'reason' ? (
    <>
      <Solid label="Continue" onPress={() => advance('offer')} />
    </>
  ) : step === 'offer' ? (
    <>
      <Solid label="Explore digital access" onPress={() => callback('digital-access')} />
      <Hit onPress={() => callback('leave-programme')}>
        <Copy size={14} style={{ textAlign: 'center', color: theme.colors.accent }}>
          Continue leaving
        </Copy>
      </Hit>
    </>
  ) : (
    <>
      <Copy muted size={12}>
        Prototype only. Saved on this device; no real callback will be arranged.
      </Copy>
      <Solid
        label={busy ? 'Saving request…' : 'Request a callback'}
        disabled={busy}
        onPress={() => void submit()}
      />
      {busy && (
        <Copy role="status" accessibilityLiveRegion="polite">
          Saving your request…
        </Copy>
      )}
    </>
  );
  return (
    <AppScreen
      key={viewKey}
      title={heading}
      actions={actions}
      showBranding={false}
      contentAlignment="bottom"
    >
      {ready && !missing && !receipt && (
        <Hit onPress={back} disabled={busy} style={{ alignSelf: 'flex-start' }}>
          <Copy>Back</Copy>
        </Hit>
      )}
      <View style={{ gap: 24 }}>
        {ready && step === 'intro' && !receipt && !missing && (
          <Crown size={40} color={theme.colors.text} />
        )}
        <AppText variant="title" style={{ fontSize: 32, lineHeight: 40 }}>
          {heading}
        </AppText>
      </View>
      {!ready ? (
        <Copy role={failed ? 'alert' : 'status'}>
          {failed
            ? 'Your saved membership or requests could not be loaded. Please retry.'
            : 'Checking your saved requests…'}
        </Copy>
      ) : missing ? (
        <Copy>
          This request isn’t available on this device. Return to your membership to find your
          current request.
        </Copy>
      ) : receipt ? (
        <>
          <Copy role="status" accessibilityLiveRegion="polite">
            {receipt.status === 'resolved'
              ? 'This request is marked resolved.'
              : 'Your callback request is saved.'}
          </Copy>
          <Copy muted>
            Prototype only. No team member has been contacted and no real callback has been
            arranged.
          </Copy>
          <CallbackSummary conversation={receipt} />
          <Copy>
            Your membership and access remain unchanged. Any programme changes need separate
            confirmation from the team.
          </Copy>
          <Copy muted size={12}>
            A preferred time is a request, not a confirmed booking.
          </Copy>
        </>
      ) : step === 'intro' ? (
        <Copy muted>Let’s find the next step that works for you.</Copy>
      ) : step === 'reason' ? (
        <>
          <Copy muted>
            Share what’s changed, if you’d like. You can continue without choosing a reason.
          </Copy>
          <View style={{ gap: 12 }}>
            {(Object.entries(reasonLabels) as [OffboardingReason, string][]).map(
              ([value, label]) => (
                <Hit
                  key={value}
                  accessibilityLabel={label}
                  accessibilityState={{ selected: draft.reason === value }}
                  onPress={() =>
                    setDraft((previous) => ({
                      ...previous,
                      reason: previous.reason === value ? null : value,
                    }))
                  }
                  style={{
                    minHeight: 56,
                    borderWidth: 1,
                    borderColor:
                      draft.reason === value ? theme.colors.accent : theme.colors.controlBorder,
                    backgroundColor:
                      draft.reason === value ? theme.colors.accent : 'transparent',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <Copy
                    style={{
                      flex: 1,
                      color: draft.reason === value ? theme.colors.onAccent : theme.colors.text,
                    }}
                  >
                    {label}
                  </Copy>
                </Hit>
              ),
            )}
          </View>
          <AppField
            nativeID="offboarding-note"
            label="Anything you’d like to add? (optional)"
            hint="Up to 400 characters."
            value={draft.note}
            multiline
            maxLength={400}
            onChangeText={(note) => setDraft((previous) => ({ ...previous, note }))}
            style={{ minHeight: 104 }}
          />
        </>
      ) : step === 'offer' ? (
        <>
          <Copy>Leaving your programme doesn’t have to mean leaving the app.</Copy>
          <Copy muted>
            Our team can talk through digital-only access options with you. Pricing and available
            access will be confirmed together.
          </Copy>
          <Copy muted size={12}>
            Exploring this option won’t change your current programme or commit you to a new plan.
          </Copy>
        </>
      ) : (
        <>
          <View style={{ gap: 8 }}>
            <Copy caps muted size={10}>
              You’d like to
            </Copy>
            <Copy size={20}>{intentLabels[draft.intent]}</Copy>
          </View>
          {!!(draft.reason || draft.note) && (
            <View style={{ gap: 8 }}>
              <Copy muted size={12}>
                What you’ve shared
              </Copy>
              {draft.reason && <Copy>{reasonLabels[draft.reason]}</Copy>}
              {!!draft.note && <Copy>{draft.note}</Copy>}
            </View>
          )}
          <AppField
            nativeID="callback-phone"
            label="Phone number (required)"
            hint="Include your country code, for example +61 400 000 000."
            value={draft.phone}
            inputRef={phoneInput}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            editable={!busy}
            maxLength={40}
            error={attempted ? errors.phone : ''}
            onChangeText={(phone) => {
              setDraft((previous) => ({ ...previous, phone }));
              setError('');
            }}
          />
          <AppField
            nativeID="callback-time"
            label="Preferred time / timezone (optional)"
            hint="For example: weekday afternoons, Sydney time. This is a request, not a booking."
            value={draft.preferredTime}
            editable={!busy}
            maxLength={160}
            error={attempted ? errors.preferredTime : ''}
            onChangeText={(preferredTime) =>
              setDraft((previous) => ({ ...previous, preferredTime }))
            }
          />
          <Copy muted size={12}>
            Your membership and access stay the same while you discuss your options.
          </Copy>
          {!!error && (
            <Copy role="alert" accessibilityLiveRegion="polite">
              {error}
            </Copy>
          )}
        </>
      )}
    </AppScreen>
  );
}
