import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Keyboard, Platform, TextInput, View } from 'react-native';
import {
  Redirect,
  useIsFocused,
  useLocalSearchParams,
  useNavigation,
  useRouter,
  type NativeStackNavigationProp,
} from 'expo-router';
import { Choice } from './choice';
import { CinemaButton, CinemaField, CinemaScreen, CinemaText } from './cinematic-ui';
import { cinema as c } from './cinematic-theme';
import { InvitationWelcome } from './invitation-welcome';
import { Interlude } from './interlude';
import { DirectionReview } from './direction-review';
import { useMotion } from './use-motion';
import { QuestionReveal, useQuestionEntrance } from './question-entrance';
import { useOnboarding } from './store';
import {
  fields,
  guardedStep,
  hasAnswer,
  incomeTypeFor,
  isComplete,
  isQuestion,
  LONG_ANSWER_LIMIT,
  ownershipOptions,
  questions,
  rangesFor,
  resumeStep,
  roleOptions,
  summaryLabels,
  type Question,
  type Step,
} from './model';

type ScreenStep = Step | 'beginning' | 'direction';
const industries = [
  'Technology',
  'Property',
  'Retail',
  'Hospitality',
  'Construction',
  'Healthcare',
];
const copy: Record<Question, { title: string; description: string; placeholder?: string }> = {
  decision: { title: 'What will you\nbuild next?', description: '' },
  industry: {
    title: 'Where do\nyou play?',
    description: 'Tell us the industry you’re in, or the one you want to step into.',
    placeholder: 'Type your industry',
  },
  role: {
    title: 'Where are\nyou today?',
    description: 'A little about your starting point helps shape what comes next.',
  },
  income: { title: 'Your starting\npoint.', description: '' },
  goal: {
    title: 'Think bigger.\nMake it yours.',
    description: 'A year from now, what would make you proud? Describe the outcome you want.',
    placeholder: 'In the next 12 months, I want to…',
  },
  challenge: {
    title: 'What’s standing\nin your way?',
    description: 'The clearer the challenge, the better the starting point.',
    placeholder: 'The thing holding me back is…',
  },
  skills: {
    title: 'Who do you\nwant to become?',
    description: 'What skills or habits would help you take your next step?',
    placeholder: 'I want to get better at…',
  },
};
export function OnboardingScreen() {
  const state = useOnboarding();
  const router = useRouter();
  const navigation = useNavigation<
    NativeStackNavigationProp<{
      home: undefined;
      onboarding: { step?: ScreenStep; edit?: string; from?: string; replay?: string };
    }>
  >();
  const focused = useIsFocused();
  const motion = useMotion();
  const params = useLocalSearchParams<{
    step?: string;
    edit?: string;
    from?: string;
    replay?: string;
  }>();
  const [validation, setValidation] = useState<{ step: ScreenStep; message: string } | null>(null);
  const [customIndustry, setCustomIndustry] = useState(false);
  const input = useRef<TextInput>(null);
  const choiceRefs = useRef<(View | null)[]>([]);
  const choiceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fade] = useState(() => new Animated.Value(0));
  const requested = typeof params.step === 'string' ? params.step : undefined;
  const step: ScreenStep =
    requested === 'beginning'
      ? 'beginning'
      : requested === 'direction' && hasAnswer(state.record, 'decision')
        ? 'direction'
        : guardedStep(requested, state.record);
  const options =
    step === 'decision'
      ? ownershipOptions
      : step === 'role'
        ? roleOptions
        : step === 'income'
          ? rangesFor(incomeTypeFor(state.record.answers.rolePerspective)).map((range) => ({
              value: range,
              label: range.replaceAll('m', 'M').replaceAll('-', '–'),
            }))
          : step === 'industry'
            ? industries.map((value) => ({ value, label: value }))
            : null;
  const textQuestion = !options || step === 'industry';
  const fieldIndex = (options?.length ?? 0) + 1;
  const footerIndex = fieldIndex + (textQuestion ? 1 : 0);
  const entrance = useQuestionEntrance({
    screen: step,
    enabled: focused && state.hydration === 'ready' && isQuestion(step),
    count: footerIndex + 1,
    motion,
  });
  const error = validation?.step === step ? validation.message : '';
  const setError = (message: string) => setValidation(message ? { step, message } : null);
  const hydrate = state.hydrate;
  const editing = params.edit === '1';
  const fromHome = params.from === 'home';
  // Keep an intentional replay separate from stale question history, including after reload.
  const replaying = requested === 'welcome' || params.replay === '1';
  const resumeHome =
    isComplete(state.record) && !replaying && (!requested || (state.enteredApp && !fromHome));
  const href = (next: ScreenStep, edit = editing) => ({
    pathname: '/onboarding' as const,
    params: {
      step: next,
      edit: edit ? '1' : '0',
      ...(fromHome ? { from: 'home' } : {}),
      ...(replaying ? { replay: '1' } : {}),
    },
  });
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  useEffect(() => {
    if (focused && state.hydration === 'ready' && !resumeHome && requested !== step)
      router.setParams({ step });
  }, [focused, state.hydration, requested, step, router, resumeHome]);
  function cancelChoice() {
    if (choiceTimer.current) clearTimeout(choiceTimer.current);
    choiceTimer.current = null;
  }
  useEffect(() => {
    if (!focused || !motion.active) cancelChoice();
    return cancelChoice;
  }, [focused, motion.active, step]);
  useEffect(() => {
    if (!focused || !motion.ready) return;
    // Questions reveal each part independently; this layer only handles their exit.
    if (isQuestion(step)) {
      fade.setValue(1);
      return;
    }
    fade.setValue(motion.reduced ? 1 : 0);
    const animation = Animated.timing(fade, {
      toValue: 1,
      duration: motion.reduced ? 0 : 650,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [step, focused, motion.ready, motion.reduced, fade]);
  function depart(action: () => void) {
    cancelChoice();
    Animated.timing(fade, {
      toValue: 0,
      duration: motion.reduced ? 0 : 650,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && navigation.isFocused()) action();
    });
  }
  function returnTo(target: Step, edit = false) {
    const stack = navigation.getState();
    const previous = stack?.routes[(stack.index ?? 0) - 1];
    depart(() => {
      if (
        previous?.name === 'onboarding' &&
        previous.params &&
        'step' in previous.params &&
        previous.params.step === target
      )
        router.back();
      else router.replace(href(target, edit));
    });
  }
  function enterApp() {
    // Drop the entire question stack so system Back cannot restart onboarding.
    depart(() => {
      state.enterApp();
      navigation.reset({ index: 0, routes: [{ name: 'home' }] });
    });
  }
  function back() {
    cancelChoice();
    if (state.saving) return;
    Keyboard.dismiss();
    if (editing && isComplete(state.record) && isQuestion(step)) {
      state.cancelDraft(step);
      returnTo('complete');
      return;
    }
    if (step === 'complete') {
      returnTo('skills');
      return;
    }
    if (isQuestion(step)) returnTo(questions[questions.indexOf(step) - 1] ?? 'welcome', editing);
  }
  async function submit(value?: string) {
    cancelChoice();
    if (!isQuestion(step) || !navigation.isFocused()) return;
    const result = await state.submit(step, value ?? state.drafts[step] ?? '');
    if (!navigation.isFocused()) return;
    if (!result.ok) {
      setError(result.storage ? '' : result.error);
      if (!result.storage) {
        input.current?.focus();
        choiceRefs.current[0]?.focus();
      }
      if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(result.error);
      return;
    }
    Keyboard.dismiss();
    if (Platform.OS !== 'web')
      AccessibilityInfo.announceForAccessibility('Answer saved on this device.');
    if (editing) {
      if (isComplete(result.record)) returnTo('complete');
      else depart(() => router.replace(href(resumeStep(result.record), true)));
    } else
      depart(() =>
        router.push(
          href(
            step === 'decision'
              ? 'direction'
              : (questions[questions.indexOf(step) + 1] ?? 'complete'),
            false,
          ),
        ),
      );
  }
  function choose(value: string) {
    if (!isQuestion(step)) return;
    cancelChoice();
    state.setDraft(step, value);
    setError('');
    setCustomIndustry(false);
    choiceTimer.current = setTimeout(() => {
      if (navigation.isFocused()) void submit(value);
    }, 500);
  }
  if (state.hydration !== 'ready')
    return (
      <CinemaScreen title="Your onboarding">
        <CinemaText variant="title" style={{ textAlign: 'center', fontSize: 26 }}>
          Your next chapter
        </CinemaText>
        <CinemaText
          role={state.hydration === 'failed' ? 'alert' : 'status'}
          accessibilityLiveRegion="polite"
          style={{ textAlign: 'center', marginVertical: 24 }}
        >
          {state.storageError || 'Loading your saved progress…'}
        </CinemaText>
        {state.hydration === 'failed' && (
          <CinemaButton label="Retry loading progress" onPress={() => void hydrate()} />
        )}
      </CinemaScreen>
    );
  if (resumeHome) return <Redirect href="/home" />;
  if (step === 'welcome')
    return (
      <InvitationWelcome
        notice={state.notice}
        initialName={state.nameDraft || state.record.name}
        onAccept={(name) => {
          state.setName(name);
          router.push(href('beginning', false));
        }}
      />
    );
  if (step === 'beginning' || step === 'direction')
    return (
      <Interlude
        direction={step === 'direction'}
        onComplete={() =>
          router.replace(href(step === 'direction' ? 'industry' : 'decision', false))
        }
      />
    );
  if (step === 'complete')
    return (
      <DirectionReview
        record={state.record}
        fade={fade}
        fromHome={fromHome}
        onEdit={(question) => depart(() => router.push(href(question, true)))}
        onEnter={enterApp}
      />
    );
  const q = copy[step];
  const value = state.drafts[step] ?? state.record.answers[fields[step]] ?? '';
  const common = step === 'industry' && industries.includes(value) && !customIndustry;
  const description =
    step === 'income'
      ? incomeTypeFor(state.record.answers.rolePerspective) === 'business-owner'
        ? 'What’s your annual business revenue or salary range?'
        : 'What’s your annual salary range?'
      : q.description;
  return (
    <CinemaScreen title={summaryLabels[step]}>
      <Animated.View style={{ opacity: fade }}>
        <QuestionReveal
          entrance={entrance}
          index={0}
          style={{ marginBottom: c.space.xl + c.space.sm, gap: c.space.xl }}
        >
          <CinemaText
            variant="title"
            style={{
              textAlign: 'center',
              fontSize: c.type.title,
              lineHeight: c.type.title * 1.25,
              marginHorizontal: -c.space.md,
            }}
          >
            {q.title}
          </CinemaText>
          {!!description && (
            <CinemaText
              style={{
                color: c.muted,
                textAlign: 'center',
                maxWidth: 290,
                alignSelf: 'center',
                fontSize: c.type.small,
                lineHeight: c.space.lg,
              }}
            >
              {description}
            </CinemaText>
          )}
        </QuestionReveal>
        {options && (
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={`${q.title.replace('\n', ' ')}. Selecting an answer continues automatically.`}
            aria-invalid={Boolean(error)}
            style={{
              rowGap: c.space.md,
              columnGap: c.space.sm,
              flexDirection: step === 'industry' ? 'row' : 'column',
              flexWrap: step === 'industry' ? 'wrap' : 'nowrap',
            }}
          >
            {options.map((option, index) => (
              <QuestionReveal
                key={option.value}
                entrance={entrance}
                index={index + 1}
                style={step === 'industry' ? { width: '48%', flexGrow: 1 } : undefined}
              >
                <Choice
                  label={option.label}
                  description={'description' in option ? option.description : undefined}
                  selected={value === option.value && (step !== 'industry' || !customIndustry)}
                  disabled={state.saving}
                  reduced={motion.reduced}
                  industry={step === 'industry'}
                  controlRef={(node) => {
                    choiceRefs.current[index] = node;
                  }}
                  tabStop={
                    value === option.value ||
                    (!options.some((o) => o.value === value) && index === 0)
                  }
                  onPress={() => choose(option.value)}
                  onNavigate={(direction) => {
                    entrance.revealAll();
                    const next = (index + direction + options.length) % options.length;
                    choose(options[next].value);
                    requestAnimationFrame(() => choiceRefs.current[next]?.focus());
                  }}
                />
              </QuestionReveal>
            ))}
          </View>
        )}
        {textQuestion && (
          <QuestionReveal
            entrance={entrance}
            index={fieldIndex}
            style={{ marginTop: step === 'industry' ? 32 : 0 }}
          >
            <CinemaField
              label={step === 'industry' ? 'Other industry' : summaryLabels[step] + ' (required)'}
              visibleLabel={step === 'industry'}
              nativeID={`onboarding-${step}`}
              inputRef={input}
              value={common ? '' : value}
              placeholder={q.placeholder}
              maxLength={step === 'industry' ? 120 : LONG_ANSWER_LIMIT}
              multiline={step !== 'industry'}
              textAlignVertical="top"
              editable={!state.saving}
              error={error}
              onFocus={() => {
                if (step === 'industry') {
                  cancelChoice();
                  if (common) state.setDraft(step, '');
                  setCustomIndustry(true);
                }
              }}
              onChangeText={(text) => {
                cancelChoice();
                state.setDraft(step, text);
                setError('');
              }}
              returnKeyType={step === 'industry' ? 'go' : 'default'}
              submitBehavior={step === 'industry' ? 'submit' : 'newline'}
              onSubmitEditing={step === 'industry' ? () => void submit() : undefined}
            />
          </QuestionReveal>
        )}
        {!!error && !textQuestion && (
          <CinemaText
            role="alert"
            accessibilityLiveRegion="polite"
            style={{ textAlign: 'center', fontSize: 13 }}
          >
            {error}
          </CinemaText>
        )}
        {!!state.storageError && (
          <CinemaText
            role="alert"
            accessibilityLiveRegion="polite"
            style={{ textAlign: 'center', fontSize: 13, marginTop: 16 }}
          >
            {state.storageError}
          </CinemaText>
        )}
        {state.saving && (
          <CinemaText
            role="status"
            accessibilityLiveRegion="polite"
            style={{ textAlign: 'center', fontSize: 12 }}
          >
            Saving…
          </CinemaText>
        )}
        <QuestionReveal entrance={entrance} index={footerIndex}>
          {textQuestion && (step !== 'industry' || (!!value.trim() && !common)) && (
            <View style={{ paddingTop: 16 }}>
              <CinemaButton
                label={
                  editing ? 'Save changes' : step === 'skills' ? 'This is my beginning' : 'Continue'
                }
                prominent
                disabled={state.saving}
                onPress={() => void submit()}
              />
            </View>
          )}
          <View style={{ marginTop: 8 }}>
            <CinemaButton
              label={editing && isComplete(state.record) ? 'Cancel edit' : 'Back'}
              disabled={state.saving}
              onPress={back}
            />
          </View>
        </QuestionReveal>
      </Animated.View>
    </CinemaScreen>
  );
}
