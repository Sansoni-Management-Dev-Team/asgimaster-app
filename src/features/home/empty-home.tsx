import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/theme';
import { useOnboarding } from '../onboarding/store';
import { Crown } from '../onboarding/envelope';
import { questions, hasAnswer } from '../onboarding/model';
import { Card, Copy, Heading, Solid, TextAction, type Go } from './ui';

export function EmptyHome({ go, preview = false }: { go: Go; preview?: boolean }) {
  const router = useRouter();
  const record = useOnboarding((s) => s.record);
  const count = preview ? 0 : questions.filter((q) => hasAnswer(record, q)).length;
  return (
    <>
      <Heading
        title="Today"
        profile={{
          label: 'Your profile and settings',
          press: () => go('profile'),
        }}
      />
      {preview && (
        <Card style={{ marginBottom: 24 }}>
          <Copy caps size={10}>
            Empty Home preview
          </Copy>
          <Copy muted size={12}>
            Your saved direction and progress are kept.
          </Copy>
          <TextAction label="Show my personalised Home" onPress={() => router.replace('/home')} />
        </Card>
      )}
      <View style={{ paddingTop: 24, paddingBottom: 36, gap: 24 }}>
        <Crown size={40} color={theme.colors.text} />
        <Copy caps size={10} muted>
          Your next chapter
        </Copy>
        <Copy caps size={32} accessibilityRole="header" style={{ lineHeight: 38 }}>
          {'Your empire.\nStarts with you.'}
        </Copy>
        <Copy muted>
          Tell us where you want to go. We’ll bring your goal, priorities and next steps together
          here.
        </Copy>
        <Solid
          label={count ? 'Continue setting up' : 'Set up my direction'}
          onPress={() =>
            router.push(
              preview
                ? { pathname: '/onboarding', params: { step: 'welcome', replay: '1' } }
                : '/onboarding',
            )
          }
        />
        {count > 0 && (
          <Copy muted size={12}>
            {count} of {questions.length} answers saved. Pick up where you left off.
          </Copy>
        )}
      </View>
      <View style={{ borderTopWidth: 1, borderColor: theme.colors.border }}>
        {[
          ['01', 'Your direction', 'Your 12-month goal, challenge and growth priorities.'],
          ['02', 'Your next move', 'Learning selected around what matters to you.'],
          ['03', 'Your progress', 'Every lesson and action you take, built up over time.'],
        ].map(([number, title, detail]) => (
          <View
            key={number}
            style={{
              flexDirection: 'row',
              gap: 20,
              paddingVertical: 24,
              borderBottomWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <Copy muted size={12} style={{ fontFamily: theme.fontNumbers }}>
              {number}
            </Copy>
            <View style={{ flex: 1, gap: 8 }}>
              <Copy caps size={12}>
                {title}
              </Copy>
              <Copy muted size={12}>
                {detail}
              </Copy>
            </View>
          </View>
        ))}
      </View>
      <View style={{ marginTop: 24, gap: 8 }}>
        <Copy muted size={12}>
          Explore your membership while you find your direction.
        </Copy>
        <TextAction label="Browse the library" onPress={() => go('library')} />
        <TextAction label="View membership" onPress={() => go('membership')} />
      </View>
    </>
  );
}
