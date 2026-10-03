import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { useEvent } from 'expo';
import { useIsFocused } from 'expo-router';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { AppField } from '@/components/app-field';
import { theme } from '@/theme';
import { useMotion } from '../onboarding/use-motion';
import { useMember } from '../home/store';
import { canWatch, formatTime, watchedSeconds } from '../home/model';
import { Card, Copy, Hit, MemberFrame, Solid, TextAction, type Go } from '../home/ui';
import { PageHeader, Sheet, Select, Check, Empty } from '../member/ui';
import { libraryCatalogue, requiredMembership, type Item } from './model';
import { RelatedEvents } from '../events/components';
const media: Record<string, number> = {
  direction: require('../../../assets/learning/direction.mp4'),
  priorities: require('../../../assets/learning/priorities.mp4'),
  blueprint: require('../../../assets/learning/blueprint.mp4'),
  rhythm: require('../../../assets/learning/rhythm.mp4'),
  delegate: require('../../../assets/learning/delegate.mp4'),
  review: require('../../../assets/learning/review.mp4'),
};
// These properties are mutable control APIs on Expo's external player, not React state.
function rate(player: VideoPlayer, value: number) {
  player.playbackRate = value;
}
export function LessonScreen({ id, go }: { id?: string; go: Go }) {
  const [attempt, setAttempt] = useState(0);
  const member = useMember((s) => s.data.member),
    lesson = libraryCatalogue.find((l) => l.id === id);
  if (!lesson || !canWatch(member, lesson) || lesson.available === false)
    return (
      <MemberFrame title="Lesson unavailable" active="library" go={go}>
        <PageHeader
          title={lesson && !canWatch(member, lesson) ? 'Not included' : 'Not available'}
          eyebrow="Your learning"
          back={() => go('library')}
        />
        {lesson && <Copy size={24}>{lesson.title}</Copy>}
        <Empty
          title={lesson?.course ?? 'Your learning'}
          detail={
            lesson && !canWatch(member, lesson)
              ? `This lesson needs ${requiredMembership(lesson)} membership. Your included lessons are still available.`
              : (lesson?.unavailableReason ??
                'This lesson is no longer available. Choose another lesson from your library.')
          }
          action={{
            label: lesson && !canWatch(member, lesson) ? 'View membership' : 'Back to Library',
            press: () => go(lesson && !canWatch(member, lesson) ? 'membership' : 'library'),
          }}
        />
        <TextAction label="Contact support" onPress={() => go('support')} />
      </MemberFrame>
    );
  return (
    <Player
      key={`${lesson.id}-${attempt}`}
      lesson={lesson}
      go={go}
      retry={() => setAttempt((n) => n + 1)}
    />
  );
}
function Player({ lesson, go, retry }: { lesson: Item; go: Go; retry: () => void }) {
  const state = useMember(),
    motion = useMotion(),
    focused = useIsFocused(),
    active = motion.active && focused;
  const [options, setOptions] = useState(false),
    [speed, setSpeed] = useState('1'),
    [seek, setSeek] = useState(''),
    [seekError, setSeekError] = useState(''),
    [description, setDescription] = useState(false),
    [expanded, setExpanded] = useState(false),
    [demo, setDemo] = useState(false),
    [forceFallback, setForceFallback] = useState(false),
    [localError, setLocalError] = useState(''),
    [badSource, setBadSource] = useState(false);
  const source = badSource
    ? {
        uri:
          Platform.OS === 'web'
            ? '/assets/missing-demo-recording.mp4'
            : 'file:///missing-demo-recording.mp4',
      }
    : media[lesson.id];
  const player = useVideoPlayer(source, (p) => {
    p.timeUpdateEventInterval = 1;
    p.loop = false;
  });
  const video = useRef<VideoView>(null),
    stage = useRef<View>(null),
    exitControl = useRef<View>(null);
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { currentTime } = useEvent(player, 'timeUpdate', {
    currentTime: player.currentTime,
    bufferedPosition: 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
  });
  const previous = useRef({ time: 0, wall: 0 }),
    ready = useRef(false);
  const error = status === 'error' || !!localError,
    complete = state.data.member.completed.includes(lesson.id),
    position = Number.isFinite(currentTime) ? currentTime : 0;
  const queue = libraryCatalogue.filter(
      (l) =>
        l.collection === lesson.collection &&
        l.available !== false &&
        canWatch(state.data.member, l) &&
        media[l.id],
    ),
    index = queue.findIndex((l) => l.id === lesson.id);
  useEffect(() => {
    const saved = useMember.getState().data.member.positions[lesson.id] ?? 0;
    ready.current = false;
    const resume = () => {
      if (ready.current || !(player.duration > 0)) return;
      ready.current = true;
      player.seekBy(
        (saved >= player.duration - 0.25 ? 0 : Math.min(saved, player.duration)) -
          player.currentTime,
      );
      previous.current = { time: player.currentTime, wall: performance.now() };
    };
    const loaded = player.addListener('sourceLoad', resume),
      changed = player.addListener('statusChange', (e) => {
        if (e.status === 'readyToPlay') resume();
      });
    if (player.status === 'readyToPlay') resume();
    const tick = player.addListener('timeUpdate', (e) => {
      if (!ready.current || !active || player.status === 'error') return;
      const wall = performance.now();
      const elapsed = player.playing
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
    const ended = player.addListener('playToEnd', () => {
      if (!active || !ready.current) return;
      player.pause();
      void useMember.getState().complete(lesson.id);
    });
    return () => {
      loaded.remove();
      changed.remove();
      tick.remove();
      ended.remove();
      void useMember.getState().savePlayback();
    };
  }, [player, lesson.id, active, badSource]);
  useEffect(() => {
    if (!active) {
      player.pause();
      void useMember.getState().savePlayback();
    }
  }, [active, player]);
  useEffect(() => {
    if (status === 'readyToPlay' || status === 'error') return;
    const timeout = setTimeout(() => {
      player.pause();
      setLocalError('The video is taking too long to load. Try again.');
    }, 15000);
    return () => clearTimeout(timeout);
  }, [status, player]);
  useEffect(() => {
    if (Platform.OS !== 'web' || !expanded) return;
    const host = stage.current as unknown as HTMLElement;
    if (!host) return;
    const isolated: HTMLElement[] = [];
    for (
      let branch: HTMLElement | null = host;
      branch?.parentElement;
      branch = branch.parentElement
    ) {
      for (const sibling of Array.from(branch.parentElement.children)) {
        if (sibling !== branch && sibling instanceof HTMLElement && !sibling.inert) {
          sibling.inert = true;
          isolated.push(sibling);
        }
      }
      if (branch.parentElement === document.body) break;
    }
    const onChange = () => {
      if (!document.fullscreenElement && !forceFallback) setExpanded(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpanded(false);
        return;
      }
      if (e.key === 'Tab') {
        const controls = Array.from(
          host.querySelectorAll<HTMLElement>('button:not(:disabled),[tabindex="0"]'),
        ).filter((e) => e.getClientRects().length);
        if (!controls.length) return;
        const first = controls[0],
          last = controls.at(-1)!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    host.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onChange);
    requestAnimationFrame(() => host.querySelector<HTMLElement>('button')?.focus());
    return () => {
      isolated.forEach((e) => {
        e.inert = false;
      });
      host.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onChange);
      if (document.fullscreenElement === host) void document.exitFullscreen().catch(() => {});
      requestAnimationFrame(() =>
        host.querySelector<HTMLElement>('[aria-label="Full screen"]')?.focus(),
      );
    };
  }, [expanded, forceFallback]);
  function pauseSave() {
    player.pause();
    if (ready.current && player.status !== 'error')
      useMember.getState().watch(lesson.id, player.currentTime, 0);
    void useMember.getState().savePlayback();
  }
  function jump(seconds: number) {
    player.seekBy(
      Math.max(-player.currentTime, Math.min(seconds, player.duration - player.currentTime)),
    );
    previous.current = { time: player.currentTime, wall: performance.now() };
    useMember.getState().watch(lesson.id, player.currentTime, 0);
    void useMember.getState().savePlayback();
  }
  async function fullscreen() {
    if (Platform.OS === 'web') {
      if (expanded) {
        setExpanded(false);
        return;
      }
      if (!forceFallback) {
        try {
          await (stage.current as unknown as HTMLElement).requestFullscreen();
        } catch {
          /* The fixed, isolated stage is the in-app fallback. */
        }
      }
      setExpanded(true);
    } else {
      try {
        await video.current?.enterFullscreen();
      } catch {
        setLocalError('Full screen could not open. Retry the video or keep watching inline.');
      }
    }
  }
  function play() {
    if (Platform.OS === 'web') {
      // Expo's web play() discards the HTML playback promise. Handle interruption
      // here so a rapid pause/navigation doesn't leave an unhandled rejection.
      const element = (stage.current as unknown as HTMLElement | null)?.querySelector('video');
      void element?.play().catch((error: Error) => {
        if (error.name !== 'AbortError')
          setLocalError('Playback could not start. Retry the video.');
      });
    } else player.play();
  }
  const footer = (
    <View style={{ gap: 8, paddingTop: 12 }}>
      <Solid
        label={complete ? 'Lesson complete' : 'Mark complete'}
        disabled={complete || error || status !== 'readyToPlay' || state.saving}
        onPress={() => {
          pauseSave();
          void state.complete(lesson.id);
        }}
      />
      <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
        {[
          { label: 'Previous lesson', item: queue[index - 1] },
          { label: 'Next lesson', item: queue[index + 1] },
        ].map(({ label, item }) => (
          <Hit
            key={label}
            disabled={!item}
            accessibilityState={{ disabled: !item }}
            onPress={() => {
              pauseSave();
              go('lesson', item.id);
            }}
            style={{ flex: 1, opacity: item ? 1 : 0.5 }}
          >
            <Copy size={12} style={{ textAlign: 'center' }}>
              {label}
            </Copy>
          </Hit>
        ))}
      </View>
    </View>
  );
  return (
    <MemberFrame title={lesson.title} active="library" go={go} footerContent={footer}>
      <PageHeader
        title={lesson.title}
        eyebrow={lesson.course}
        back={() => {
          pauseSave();
          go('library');
        }}
        options={() => {
          pauseSave();
          setSeek(String(Math.floor(player.currentTime)));
          setOptions(true);
        }}
        optionsLabel="Playback options"
      />
      <View
        ref={stage}
        className={expanded ? 'member-player-expanded' : undefined}
        role={expanded ? 'dialog' : undefined}
        aria-modal={expanded || undefined}
        accessibilityLabel={expanded ? 'Full screen lesson' : undefined}
        style={{
          width: '100%',
          aspectRatio: 16 / 9,
          backgroundColor: theme.colors.backgroundEnd,
          position: 'relative',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <VideoView
          ref={video}
          player={player}
          nativeControls={false}
          fullscreenOptions={{ enable: true }}
          contentFit="contain"
          onFullscreenExit={() => void useMember.getState().savePlayback()}
          style={{ width: '100%', height: '100%' }}
          accessibilityLabel={`${lesson.title}, silent visual preview`}
        />
        {!error && (
          <Hit
            accessibilityLabel={
              isPlaying ? 'Pause lesson' : position > 0 ? 'Resume lesson' : 'Play lesson'
            }
            disabled={status !== 'readyToPlay'}
            accessibilityState={{ disabled: status !== 'readyToPlay' }}
            onPress={() => (isPlaying ? pauseSave() : play())}
            style={{
              position: 'absolute',
              width: 64,
              height: 64,
              borderRadius: 32,
              borderWidth: 1,
              borderColor: theme.colors.white,
              backgroundColor: theme.colors.black + 'B3',
              alignItems: 'center',
            }}
          >
            <Copy size={24}>{isPlaying ? 'Ⅱ' : '▷'}</Copy>
          </Hit>
        )}
        {expanded && (
          <View
            style={{ position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', gap: 12 }}
          >
            <Hit
              accessibilityLabel="Back 10 seconds"
              disabled={error}
              onPress={() => jump(-10)}
              style={{ width: 48, backgroundColor: theme.colors.black, alignItems: 'center' }}
            >
              <Copy>−10</Copy>
            </Hit>
            <Hit
              accessibilityLabel="Forward 10 seconds"
              disabled={error}
              onPress={() => jump(10)}
              style={{ width: 48, backgroundColor: theme.colors.black, alignItems: 'center' }}
            >
              <Copy>+10</Copy>
            </Hit>
          </View>
        )}
        <View ref={exitControl} style={{ position: 'absolute', right: 12, bottom: 12 }}>
          <Hit
            accessibilityLabel={expanded ? 'Exit full screen' : 'Full screen'}
            onPress={() => void fullscreen()}
            style={{
              minWidth: 48,
              backgroundColor: theme.colors.black + 'B3',
              paddingHorizontal: 12,
              alignItems: 'center',
            }}
          >
            <Copy size={12}>{expanded ? 'Exit full screen' : '⛶'}</Copy>
          </Hit>
        </View>
      </View>
      {error ? (
        <View style={{ marginVertical: 16, gap: 12 }}>
          <Copy role="alert">
            {localError || 'The video could not load. Your last saved position is unchanged.'}
          </Copy>
          <Solid label="Retry video" onPress={retry} />
        </View>
      ) : (
        <Copy size={12} muted role="status" style={{ marginVertical: 16 }}>
          {status !== 'readyToPlay'
            ? 'Loading video…'
            : isPlaying
              ? 'Playing'
              : position
                ? `Ready to resume at ${formatTime(position)}`
                : 'Ready when you are'}
        </Copy>
      )}
      <Copy size={12} muted>
        {formatTime(position)} / {formatTime(lesson.minutes * 60)}
      </Copy>
      <Copy role="status" accessibilityLiveRegion="polite" style={{ marginVertical: 16 }}>
        {complete ? '✓ Lesson complete' : position ? 'In progress' : 'Not started'}
      </Copy>
      <Card>
        <Copy caps size={12}>
          One idea to try
        </Copy>
        <Copy>{lesson.takeaway}</Copy>
      </Card>
      <TextAction
        label={description ? 'Hide visual description' : 'Visual description'}
        onPress={() => setDescription(!description)}
      />
      {description && (
        <Copy size={12} muted>
          A still dark gradient, with no spoken audio, teaching text or meaningful visual action.
          This is a silent placeholder for the course recording; no caption cues are available.
        </Copy>
      )}
      <RelatedEvents lessonIds={[lesson.id]} go={go} />
      {!!state.error && (
        <>
          <Copy role="alert">{state.error}</Copy>
          <TextAction label="Retry saving progress" onPress={() => void state.savePlayback()} />
        </>
      )}
      {!!state.notice && (
        <Copy role="status" size={12}>
          {state.notice}
        </Copy>
      )}
      <Sheet title={options ? 'Playback options' : null} close={() => setOptions(false)}>
        <Copy>
          {formatTime(position)} / {formatTime(lesson.minutes * 60)}
        </Copy>
        <View
          accessibilityRole={Platform.OS === 'web' ? undefined : 'adjustable'}
          accessibilityLabel="Playback position"
          accessibilityValue={{
            min: 0,
            max: lesson.minutes * 60,
            now: Math.floor(position),
            text: formatTime(position),
          }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => jump(e.nativeEvent.actionName === 'increment' ? 10 : -10)}
        >
          <AppField
            nativeID="lesson-seek"
            label="Seek to time (seconds)"
            value={seek}
            onChangeText={(v) => {
              setSeek(v);
              setSeekError('');
            }}
            keyboardType="numeric"
            error={seekError}
          />
        </View>
        <Solid
          label="Go to position"
          disabled={error || status !== 'readyToPlay'}
          onPress={() => {
            const value = Number(seek);
            if (!seek.trim() || !Number.isFinite(value) || value < 0 || value > player.duration) {
              setSeekError(
                `Enter a time between 0 and ${Math.floor(player.duration || lesson.minutes * 60)} seconds.`,
              );
              return;
            }
            jump(value - player.currentTime);
            setOptions(false);
          }}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <TextAction label="Back 10 seconds" onPress={() => jump(-10)} />
          <TextAction label="Forward 10 seconds" onPress={() => jump(10)} />
        </View>
        <Select
          label="Playback speed"
          value={speed}
          onChange={(v) => {
            setSpeed(v);
            rate(player, Number(v));
          }}
          options={['0.75', '1', '1.25', '1.5', '2'].map((value) => ({
            value,
            label: value + '×',
          }))}
        />
        <Copy size={12} muted>
          Captions: this silent preview contains no spoken audio or caption cues. A visual
          description is available below the video.
        </Copy>
        <TextAction
          label="Visual description"
          onPress={() => {
            setOptions(false);
            setDescription(true);
          }}
        />
        <TextAction
          label="Ask AaronAI"
          onPress={() => {
            setOptions(false);
            go('coach');
          }}
        />
        <TextAction
          label="Contact support"
          onPress={() => {
            setOptions(false);
            go('support');
          }}
        />
        <TextAction
          label={demo ? 'Hide demo settings' : 'Demo settings'}
          onPress={() => setDemo(!demo)}
        />
        {demo && (
          <>
            <TextAction
              label="Simulate missing recording"
              onPress={() => {
                pauseSave();
                setBadSource(true);
                setOptions(false);
              }}
            />
            {Platform.OS === 'web' && (
              <Check
                label="Use in-app full screen"
                checked={forceFallback}
                onChange={() => setForceFallback(!forceFallback)}
              />
            )}
          </>
        )}
      </Sheet>
    </MemberFrame>
  );
}
