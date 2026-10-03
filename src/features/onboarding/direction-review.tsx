import { Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CinemaButton, CinemaScreen, CinemaText } from './cinematic-ui';
import { cinema as c } from './cinematic-theme';
import { Crown } from './envelope';
import {
  displayAnswer,
  questions,
  summaryLabels,
  type OnboardingRecord,
  type Question,
} from './model';

const directionQuestions: readonly Question[] = ['goal', 'challenge', 'skills'];
const directionLabels = {
  ...summaryLabels,
  challenge: 'Your challenge',
  skills: 'Your growth',
};

export function DirectionReview({
  record,
  fade,
  fromHome,
  onEdit,
  onEnter,
}: {
  record: OnboardingRecord;
  fade: Animated.Value;
  fromHome: boolean;
  onEdit: (question: Question) => void;
  onEnter: () => void;
}) {
  return (
    <CinemaScreen
      title="Your saved direction"
      contentStyle={{ justifyContent: 'flex-start' }}
      backdrop={
        <LinearGradient
          colors={[c.ink, c.black]}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
      }
    >
      <Animated.View style={{ opacity: fade }}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            borderWidth: 1,
            borderColor: c.border,
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'center',
            marginTop: c.space.lg,
            marginBottom: c.space.xxl + c.space.lg,
          }}
        >
          <Crown size={40} color={c.white} />
        </View>
        <CinemaText
          variant="eyebrow"
          style={{
            color: c.muted,
            fontSize: c.type.small,
            letterSpacing: 2.8,
            marginBottom: c.space.xl,
          }}
        >
          This is your beginning
        </CinemaText>
        <CinemaText
          variant="title"
          style={{ fontSize: c.type.title, lineHeight: c.type.title * 1.1 }}
        >
          {'Your empire.\nYour direction.'}
        </CinemaText>
        <CinemaText
          style={{
            color: c.muted,
            fontSize: c.type.small,
            lineHeight: c.space.lg,
            marginTop: c.space.md,
            marginBottom: c.space.xl,
          }}
        >
          You’ve made your first move. Here’s the future you’re working towards.
        </CinemaText>
        <View style={{ borderTopWidth: 1, borderTopColor: c.border }}>
          {(fromHome ? questions : directionQuestions).map((question) => (
            <View
              key={question}
              style={{
                paddingVertical: c.space.md,
                borderBottomWidth: 1,
                borderBottomColor: c.fold,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: c.space.sm }}>
                <CinemaText
                  style={{
                    flex: 1,
                    color: c.muted,
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  {directionLabels[question]}
                </CinemaText>
                <CinemaButton
                  label="Edit"
                  accessibilityLabel={`Edit ${directionLabels[question].toLowerCase()}`}
                  onPress={() => onEdit(question)}
                  style={{ paddingHorizontal: c.space.sm, paddingVertical: 0 }}
                >
                  <CinemaText
                    style={{
                      color: c.white,
                      fontSize: 11,
                      fontWeight: '700',
                      letterSpacing: 0.8,
                      textTransform: 'uppercase',
                      textDecorationLine: 'underline',
                    }}
                  >
                    Edit
                  </CinemaText>
                </CinemaButton>
              </View>
              <CinemaText style={{ fontSize: 15, lineHeight: c.space.lg }}>
                {displayAnswer(record, question)}
              </CinemaText>
            </View>
          ))}
        </View>
        <CinemaButton
          label={fromHome ? 'Back to Home' : 'Enter my empire'}
          solid
          style={{ marginTop: c.space.xl + c.space.sm }}
          onPress={onEnter}
        />
      </Animated.View>
    </CinemaScreen>
  );
}
