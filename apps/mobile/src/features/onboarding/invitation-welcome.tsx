import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Keyboard,
  Platform,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useIsFocused } from 'expo-router';
import { useFonts } from 'expo-font';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { create } from 'zustand';
import { ARRIVAL, Envelope, OPENED } from './envelope';
import { CinemaButton, CinemaField, CinemaScreen, CinemaText, MotionIcon } from './cinematic-ui';
import { cinema as c, shade } from './cinematic-theme';
import { useMotion } from './use-motion';

// The invitation's name is session-only, as in Concept 2.
const useInvitation = create<{ name: string }>(() => ({
  name: '',
}));
type Stage = 'approach' | 'delivery' | 'opening' | 'revealed';
function BackgroundFilm({
  visible,
  playing,
  level,
}: {
  visible: boolean;
  playing: boolean;
  level: Animated.Value;
}) {
  const { height } = useWindowDimensions();
  const [firstFrame, setFirstFrame] = useState(false);
  const player = useVideoPlayer(
    require('../../../assets/onboarding/customer-stories-loop.mp4'),
    (player) => {
      player.loop = true;
      player.muted = true;
      player.audioMixingMode = 'mixWithOthers';
    },
  );
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  useEffect(() => {
    if (visible && playing && status !== 'error') player.play();
    else player.pause();
    return () => player.pause();
  }, [visible, playing, player, status]);
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      style={[StyleSheet.absoluteFill, { opacity: level, overflow: 'hidden' }]}
    >
      <Image
        source={require('../../../assets/onboarding/customer-stories-poster.webp')}
        contentFit="cover"
        contentPosition="top center"
        style={{ width: '100%', height: height * 0.8 }}
        accessible={false}
      />
      <VideoView
        player={player}
        nativeControls={false}
        playsInline
        contentFit="cover"
        surfaceType="textureView"
        allowsPictureInPicture={false}
        allowsVideoFrameAnalysis={false}
        onFirstFrameRender={() => setFirstFrame(true)}
        style={{
          position: 'absolute',
          width: '100%',
          height: height * 0.8,
          opacity: firstFrame && status !== 'error' ? 1 : 0,
        }}
      />
      <LinearGradient
        colors={[shade(0.35), shade(0.3), shade(0.68), c.black, c.black]}
        locations={[0, 0.22, 0.48, 0.78, 1]}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}
export function InvitationWelcome({
  onAccept,
  notice,
  initialName = '',
}: {
  onAccept: (name: string) => void;
  notice?: string;
  initialName?: string;
}) {
  const invitation = useInvitation();
  const [name, setName] = useState(invitation.name || initialName);
  const [error, setError] = useState('');
  const [stage, setStage] = useState<Stage>('approach');
  const [replayCount, setReplayCount] = useState(0);
  const [filmVisible, setFilmVisible] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [loaded] = useFonts({ Caveat: require('../../../assets/onboarding/caveat-medium.ttf') });
  const [clock] = useState(() => new Animated.Value(0));
  const elapsed = useRef(0);
  const [film] = useState(() => new Animated.Value(0));
  const [exitOpacity] = useState(() => new Animated.Value(1));
  const [exiting, setExiting] = useState(false);
  const exitRequested = useRef(false);
  const input = useRef<TextInput>(null);
  const motion = useMotion();
  const focused = useIsFocused();
  const { height, fontScale } = useWindowDimensions();

  useEffect(() => {
    let cancelled = false;
    if (!focused) {
      exitRequested.current = false;
      queueMicrotask(() => {
        if (!cancelled) setExiting(false);
      });
      return () => {
        cancelled = true;
      };
    }
    if (!exiting) {
      exitOpacity.setValue(1);
      return;
    }
    if (!motion.active) return;
    const animation = Animated.timing(exitOpacity, {
      toValue: 0,
      duration: motion.reduced ? 0 : 750,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !cancelled) onAccept(invitation.name);
    });
    return () => {
      cancelled = true;
      animation.stop();
    };
  }, [exitOpacity, exiting, focused, invitation.name, motion.active, motion.reduced, onAccept]);

  useEffect(() => {
    const listener = clock.addListener(({ value }) => {
      elapsed.current = value;
    });
    return () => clock.removeListener(listener);
  }, [clock]);
  useEffect(() => {
    if (
      !motion.ready ||
      !focused ||
      !motion.active ||
      (stage !== 'approach' && stage !== 'opening')
    )
      return;
    let cancelled = false;
    const target = stage === 'approach' ? ARRIVAL : OPENED;
    const finish = () => {
      if (cancelled) return;
      setStage(stage === 'approach' ? 'delivery' : 'revealed');
      const message =
        stage === 'approach'
          ? 'Your invitation has arrived. Confirm your name to open it.'
          : `Your letter is open, ${invitation.name}.`;
      setAnnouncement(message);
      if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(message);
    };
    const animation = Animated.timing(clock, {
      toValue: target,
      duration: motion.reduced ? 0 : Math.max(0, target - elapsed.current),
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished) finish();
    });
    return () => {
      cancelled = true;
      animation.stop();
    };
  }, [
    clock,
    focused,
    invitation.name,
    motion.active,
    motion.ready,
    motion.reduced,
    replayCount,
    stage,
  ]);
  useEffect(() => {
    let cancelled = false;
    const reveal = stage === 'delivery' || stage === 'opening';
    if (reveal)
      queueMicrotask(() => {
        if (!cancelled) setFilmVisible(true);
      });
    const animation = Animated.timing(film, {
      toValue: reveal ? 1 : 0,
      duration: motion.reduced ? 0 : reveal ? 4000 : stage === 'revealed' ? 1500 : 0,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !cancelled && !reveal) setFilmVisible(false);
    });
    return () => {
      cancelled = true;
      animation.stop();
    };
  }, [film, motion.reduced, replayCount, stage]);
  function replay() {
    if (exitRequested.current) return;
    clock.stopAnimation();
    clock.setValue(0);
    elapsed.current = 0;
    film.stopAnimation();
    film.setValue(0);
    setFilmVisible(false);
    // Also restart when replay is pressed during the approach itself.
    setReplayCount((count) => count + 1);
    setStage('approach');
    setError('');
    setAnnouncement('Invitation animation restarted.');
  }
  function confirm() {
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!clean || clean.length > 80) {
      setError(
        clean
          ? 'Use a name of 80 characters or fewer.'
          : 'Enter your name to open your invitation.',
      );
      input.current?.focus();
      return;
    }
    Keyboard.dismiss();
    setName(clean);
    useInvitation.setState({ name: clean });
    setStage('opening');
  }
  function accept() {
    if (stage !== 'revealed' || !focused || exitRequested.current) return;
    exitRequested.current = true;
    setExiting(true);
  }
  const replayControl = (
    <CinemaButton
      label="Replay invitation"
      onPress={replay}
      disabled={exiting}
      style={{
        ...(exiting ? { opacity: 1 } : {}),
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 48,
        width: 48,
        paddingHorizontal: 0,
      }}
    >
      <MotionIcon name="replay" />
    </CinemaButton>
  );
  return (
    <View style={{ flex: 1, backgroundColor: c.black }}>
      <Animated.View testID="invitation-fade" style={{ flex: 1, opacity: exitOpacity }}>
        <CinemaScreen
          title="Your private invitation"
          backdrop={
            <BackgroundFilm
              key={replayCount}
              visible={filmVisible}
              playing={focused && motion.active && !motion.reduced}
              level={film}
            />
          }
          contentStyle={stage === 'approach' ? { justifyContent: 'center' } : { paddingBottom: 64 }}
        >
          <CinemaText
            variant="title"
            style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}
          >
            Your private invitation
          </CinemaText>
          {stage === 'delivery' && (
            <View style={{ alignItems: 'flex-end', minHeight: 56, marginBottom: 'auto' }}>
              {replayControl}
            </View>
          )}
          <Envelope
            clock={clock}
            name={invitation.name}
            opening={stage === 'opening' || stage === 'revealed'}
            revealed={stage === 'revealed'}
            fontLoaded={loaded}
            phase={stage}
            reducedMotion={motion.reduced}
          />
          {stage === 'approach' && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
              {replayControl}
            </View>
          )}
          {stage === 'delivery' && (
            <View
              style={{
                gap: 18,
                paddingTop: Math.max(24, Math.min(120, (height * 0.25 - 104) / fontScale)),
              }}
            >
              <LinearGradient
                pointerEvents="none"
                colors={[shade(0), c.black, c.black]}
                locations={[0, 0.07, 1]}
                style={StyleSheet.absoluteFill}
              />
              <CinemaText style={{ fontSize: 13.4, color: c.muted }}>
                Confirm your name to open your invitation.
              </CinemaText>
              <CinemaField
                label="Your name"
                visibleLabel
                underline
                nativeID="invitation-name"
                inputRef={input}
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  setError('');
                }}
                error={error}
                maxLength={80}
                autoComplete="name"
                autoCapitalize="words"
                returnKeyType="go"
                onSubmitEditing={confirm}
              />
              <CinemaButton solid label="Accept the Envelope" onPress={confirm} />
            </View>
          )}
          {(stage === 'opening' || stage === 'revealed') && (
            <View testID="invitation-actions" style={{ gap: 18 }}>
              {/* Keep the same measured footer throughout opening, including larger text. */}
              <View style={{ alignItems: 'center' }}>{replayControl}</View>
              <View
                pointerEvents={stage === 'revealed' ? 'auto' : 'none'}
                accessibilityElementsHidden={stage !== 'revealed'}
                importantForAccessibility={stage === 'revealed' ? 'auto' : 'no-hide-descendants'}
                aria-hidden={stage !== 'revealed'}
                style={{ opacity: stage === 'revealed' ? 1 : 0 }}
              >
                <CinemaButton
                  solid
                  label="Accept my invitation"
                  disabled={stage !== 'revealed' || exiting}
                  style={exiting ? { opacity: 1 } : undefined}
                  onPress={accept}
                />
              </View>
            </View>
          )}
          {!!notice && (
            <CinemaText role="alert" style={{ fontSize: 13, marginTop: 16 }}>
              {notice}
            </CinemaText>
          )}
          <CinemaText
            role="status"
            accessibilityLiveRegion="polite"
            style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}
          >
            {announcement}
          </CinemaText>
        </CinemaScreen>
      </Animated.View>
    </View>
  );
}
