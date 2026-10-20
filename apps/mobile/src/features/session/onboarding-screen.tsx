import { useCallback, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { OnboardingExperience } from '@/features/onboarding/onboarding-screen';
import { answerQuestion, fields, isComplete, type Question } from '@/features/onboarding/model';
import { createPendingOperation } from './pending-operation';
import type { OnboardingState } from '@/features/onboarding/store';
import { SessionStatus, useMemberProfile, useSessionController } from './session-provider';
import { OnboardingRecordSchema, type OnboardingRecord } from '@mlai-sansoni/contracts';

const hydrated = async () => {};
export function MemberOnboardingScreen() {
  const profile = useMemberProfile();
  if (!profile.data)
    return (
      <SessionStatus
        message={profile.error?.message ?? 'Loading your saved direction…'}
        retry={profile.error ? () => void profile.refetch() : undefined}
      />
    );
  return <AccountOnboarding key={profile.data.member.id} />;
}
function AccountOnboarding() {
  const session = useSessionController();
  const profile = useMemberProfile();
  const record = profile.data!.onboarding;
  const [drafts, setDrafts] = useState<Partial<Record<Question, string>>>({});
  const [nameDraft, setNameDraft] = useState(record.name ?? profile.data!.member.displayName);
  const [enteredApp, setEnteredApp] = useState(isComplete(record));
  const [storageError, setError] = useState('');
  const [operation] = useState(createPendingOperation);
  const saving = useRef(false);
  const mutation = useMutation({
    mutationFn: ({ next, key }: { next: OnboardingRecord; key: string }) =>
      session.saveOnboarding(next, key),
    retry: false,
  });
  const submit = useCallback<OnboardingState['submit']>(
    async (step, value) => {
      if (saving.current) return { ok: false, error: 'Your answer is being saved.' };
      const result = answerQuestion(
        { ...record, ...(nameDraft ? { name: nameDraft } : {}) },
        step,
        value,
      );
      if (result.error) return { ok: false, error: result.error };
      const key = operation.keyFor(result.record);
      saving.current = true;
      setError('');
      try {
        const saved = await mutation.mutateAsync({
          next: OnboardingRecordSchema.parse(result.record),
          key,
        });
        operation.acknowledge(key);
        setDrafts((previous) => ({
          ...previous,
          [step]: saved.answers[fields[step]] ?? '',
          ...(step === 'role' ? { income: saved.answers.incomeRange ?? '' } : {}),
        }));
        return { ok: true, record: saved };
      } catch {
        const error = 'Your answer could not be saved. It is still here. Please try again.';
        setError(error);
        return { ok: false, error, storage: true };
      } finally {
        saving.current = false;
      }
    },
    [mutation, nameDraft, record, operation],
  );
  return (
    <OnboardingExperience
      isolatedInvitation
      onSaveName={async (name) => {
        if (saving.current) return false;
        const next = OnboardingRecordSchema.parse({ ...record, name });
        const key = operation.keyFor(next);
        saving.current = true;
        try {
          await mutation.mutateAsync({ next, key });
          operation.acknowledge(key);
          setNameDraft(name);
          return true;
        } catch {
          return false;
        } finally {
          saving.current = false;
        }
      }}
      state={{
        record,
        drafts,
        nameDraft,
        setName: setNameDraft,
        hydration: 'ready',
        hydrate: hydrated,
        enteredApp,
        enterApp: () => setEnteredApp(true),
        notice: '',
        storageError,
        saving: mutation.isPending,
        setDraft: (step, value) => {
          if (!saving.current) {
            setDrafts((previous) => ({ ...previous, [step]: value }));
            setError('');
          }
        },
        cancelDraft: (step) =>
          setDrafts((previous) => ({ ...previous, [step]: record.answers[fields[step]] ?? '' })),
        submit,
      }}
    />
  );
}
