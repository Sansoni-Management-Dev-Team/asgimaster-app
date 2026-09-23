import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useEvent } from 'expo';
import { useIsFocused } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useMotion } from '@/features/onboarding/use-motion';
import { useMember } from './store';
import { canWatch, type Lesson, watchedSeconds } from './model';
import { Card, Copy, Solid, TextAction } from './ui';
const media: Record<string, number> = {
  direction: require('../../../assets/learning/direction.mp4'),
  priorities: require('../../../assets/learning/priorities.mp4'),
  blueprint: require('../../../assets/learning/blueprint.mp4'),
  rhythm: require('../../../assets/learning/rhythm.mp4'),
  delegate: require('../../../assets/learning/delegate.mp4'),
  review: require('../../../assets/learning/review.mp4'),
};
export function LessonPlayer({ lesson }: { lesson: Lesson }) {
  const member = useMember((state) => state.data.member);
  if (!canWatch(member, lesson))
    return (
      <Card>
        <Copy>This lesson is not included in your current membership.</Copy>
      </Card>
    );
  return <Playable lesson={lesson} />;
}
function Playable({ lesson }: { lesson: Lesson }) {
  const state = useMember();
  const motion = useMotion();
  const focused = useIsFocused();
  const active = motion.active && focused;
  const player = useVideoPlayer(media[lesson.id], (p) => {
    p.timeUpdateEventInterval = 1;
    p.loop = false;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const previous = useRef({ time: 0, wall: 0 });
  useEffect(() => {
    const saved = useMember.getState().data.member.positions[lesson.id] || 0;
    let resumed = false;
    const resume = () => {
      if (resumed) return;
      const duration = player.duration;
      if (duration > 0) {
        resumed = true;
        player.seekBy(
          (saved >= duration - 0.25 ? 0 : Math.min(saved, duration)) - player.currentTime,
        );
        previous.current = { time: player.currentTime, wall: performance.now() };
      }
    };
    const loaded = player.addListener('sourceLoad', resume);
    // SDK 57's web player reports readiness without emitting sourceLoad.
    const ready = player.addListener('statusChange', (event) => {
      if (event.status === 'readyToPlay') resume();
    });
    if (player.status === 'readyToPlay') resume();
    const tick = player.addListener('timeUpdate', (e) => {
      if (!resumed) return;
      const wall = performance.now();
      const elapsed =
        player.playing && active
          ? watchedSeconds(
              previous.current.time,
              e.currentTime,
              (wall - previous.current.wall) / 1000,
              player.playbackRate,
            )
          : 0;
      previous.current = { time: e.currentTime, wall };
      useMember.getState().watch(lesson.id, e.currentTime, elapsed);
      if (elapsed > 0) void useMember.getState().savePlayback();
    });
    return () => {
      loaded.remove();
      ready.remove();
      tick.remove();
      void useMember.getState().savePlayback();
    };
  }, [player, lesson.id, active]);
  useEffect(() => {
    if (!active) {
      player.pause();
      void useMember.getState().savePlayback();
    }
  }, [active, player]);
  const complete = state.data.member.completed.includes(lesson.id);
  return (
    <View style={{ gap: 16 }}>
      <Copy caps size={12} muted>
        {lesson.course}
      </Copy>
      <Copy accessibilityRole="header" size={24} style={{ fontWeight: '700' }}>
        {lesson.title}
      </Copy>
      <VideoView
        player={player}
        nativeControls
        contentFit="contain"
        accessibilityLabel={`${lesson.title}, silent visual preview`}
        style={{ width: '100%', aspectRatio: 16 / 9 }}
      />
      <Copy size={12} muted>
        Silent visual preview. No spoken lesson audio.
      </Copy>
      {status === 'error' ? (
        <>
          <Copy role="alert">
            This video could not be loaded. Your saved progress is unchanged.
          </Copy>
          <Solid
            label="Retry video"
            onPress={() => {
              void player.replaceAsync(media[lesson.id]);
            }}
          />
        </>
      ) : (
        <>
          <Solid
            label={isPlaying ? 'Pause lesson' : 'Play lesson'}
            disabled={status !== 'readyToPlay'}
            onPress={() => (isPlaying ? player.pause() : player.play())}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <TextAction
              label="Back 30 seconds"
              onPress={() => {
                player.seekBy(-Math.min(30, player.currentTime));
              }}
            />
            <TextAction
              label="Forward 30 seconds"
              onPress={() => {
                player.seekBy(Math.min(30, player.duration - player.currentTime));
              }}
            />
          </View>
        </>
      )}
      <Card>
        <Copy caps size={12}>
          One idea to try
        </Copy>
        <Copy>{lesson.takeaway}</Copy>
      </Card>
      <Copy role="status" accessibilityLiveRegion="polite">
        {complete ? '✓ Lesson complete' : 'In progress'}
      </Copy>
      <Solid
        label={complete ? 'Lesson complete' : 'Mark complete'}
        disabled={complete || state.saving || status !== 'readyToPlay'}
        onPress={() => {
          player.pause();
          void state.complete(lesson.id);
        }}
      />
    </View>
  );
}
