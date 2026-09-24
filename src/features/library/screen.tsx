import { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { create } from 'zustand';
import Svg, { Path, Circle } from 'react-native-svg';
import { AppField } from '@/components/app-field';
import { theme } from '@/theme';
import { useMember } from '../home/store';
import { membershipFor } from '../home/model';
import { Copy, Hit, Icon, MemberFrame, Solid, TextAction, cardStyle, type Go } from '../home/ui';
import { PageHeader, Select, Sheet, Empty } from '../member/ui';
import {
  getLibrary,
  contentState,
  requiredMembership,
  type Filters,
  type Item,
  type Collection,
} from './model';
import { RelatedEvents } from '../events/components';
const initial: Filters = { scope: 'included', query: '', collection: 'all', progress: 'all' };
const useFilters = create<{ filters: Filters; set: (changes: Filters) => void; reset: () => void }>(
  (set) => ({
    filters: { ...initial },
    set: (changes) => set((s) => ({ filters: { ...s.filters, ...changes } })),
    reset: () => set((s) => ({ filters: { ...initial, scope: s.filters.scope } })),
  }),
);
function Cover({ group, restricted }: { group: Collection; restricted: boolean }) {
  const color = restricted ? theme.colors.muted : theme.colors.teal;
  return (
    <View
      className="collection-cover"
      style={{
        width: 92,
        padding: 12,
        backgroundColor: theme.colors.backgroundEnd,
        borderRightWidth: 1,
        borderColor: theme.colors.border,
        justifyContent: 'space-between',
        gap: 28,
        overflow: 'hidden',
      }}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 92 180"
        style={{ position: 'absolute' }}
        accessible={false}
        aria-hidden
      >
        {group.motif === 'orbit'
          ? [16, 32, 48, 64].map((r) => (
              <Circle
                key={r}
                cx={12}
                cy={105}
                r={r}
                stroke={theme.colors.border}
                strokeWidth={0.7}
                fill="none"
              />
            ))
          : Array.from({ length: 12 }, (_, i) => (
              <Path
                key={i}
                d={`M0 ${i * 24} L92 ${i * 24 - 70}`}
                stroke={theme.colors.border}
                strokeWidth={0.7}
              />
            ))}
      </Svg>
      <Copy size={32} style={{ fontFamily: theme.fontNumbers, lineHeight: 32, color }}>
        {group.number}
      </Copy>
      <View style={{ alignSelf: 'flex-end' }}>
        <Icon name={restricted ? 'lock' : 'library'} color={color} />
      </View>
    </View>
  );
}
export function LibraryScreen({ go }: { go: Go }) {
  const member = useMember((s) => s.data.member),
    { filters, set, reset } = useFilters();
  const d = getLibrary(member, filters);
  const [panel, setPanel] = useState<'preview' | null>(null),
    [phase, setPhase] = useState('ready'),
    [preview, setPreview] = useState('ready'),
    [locked, setLocked] = useState<Item | null>(null);
  const { fontScale, width } = useWindowDimensions();
  const filtered = !d.overview;
  const title = d.overview
    ? d.scope === 'included'
      ? 'Your collections'
      : 'All collections'
    : (d.options.find((o) => o.id === d.collection)?.title ?? 'Your results');
  const openItem = (item: Item) =>
    contentState(member, item) === 'locked' ? setLocked(item) : go('lesson', item.id);
  return (
    <MemberFrame title="Library" active="library" go={go}>
      <PageHeader
        title="Library"
        eyebrow="Your learning"
        options={() => {
          setPreview(phase);
          setPanel('preview');
        }}
        optionsLabel="Library preview options"
      />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 16,
        }}
      >
        <Copy
          size={11}
          style={{
            color: theme.colors.teal,
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: 99,
            paddingVertical: 4,
            paddingHorizontal: 8,
          }}
        >
          {membershipFor(member).name} access
        </Copy>
        <Copy size={12} muted>
          {d.includedCount} included · {d.comingSoonCount} coming soon
        </Copy>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <AppField
            nativeID="library-search"
            label="Search library"
            labelStyle={{ fontSize: 12, lineHeight: 18 }}
            style={{ borderWidth: 1, backgroundColor: theme.colors.backgroundEnd }}
            placeholder="Search topics or lessons"
            value={filters.query ?? ''}
            onChangeText={(query) => set({ query })}
            maxLength={120}
            autoCapitalize="none"
            returnKeyType="search"
          />
        </View>
        {!!filters.query && (
          <Hit
            accessibilityLabel="Clear search"
            onPress={() => set({ query: '' })}
            style={{
              width: 48,
              borderWidth: 1,
              borderColor: theme.colors.controlBorder,
              alignItems: 'center',
            }}
          >
            <Icon name="close" color={theme.colors.text} />
          </Hit>
        )}
      </View>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          borderWidth: 1,
          borderColor: theme.colors.controlBorder,
          borderRadius: 999,
          padding: 4,
          gap: 4,
          marginTop: 16,
          marginBottom: 12,
        }}
      >
        {[
          ['included', 'Included'],
          ['all', 'Explore all'],
        ].map(([value, label]) => (
          <Hit
            key={value}
            accessibilityState={{ selected: d.scope === value }}
            onPress={() => set({ scope: value })}
            style={{
              flex: 1,
              minWidth: 96,
              padding: 8,
              borderRadius: 999,
              backgroundColor: d.scope === value ? theme.colors.teal : 'transparent',
              alignItems: 'center',
            }}
          >
            <Copy
              size={12}
              style={{ color: d.scope === value ? theme.colors.black : theme.colors.muted }}
            >
              {label}
            </Copy>
          </Hit>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <View
          className="member-filter"
          style={{ flex: 1, minWidth: 128 * fontScale, maxWidth: '100%' }}
        >
          <Select
            label="Collection"
            value={d.collection}
            onChange={(collection) => set({ collection })}
            options={[
              { value: 'all', label: 'All collections' },
              ...d.options.map((o) => ({ value: o.id, label: o.title })),
            ]}
          />
        </View>
        <View
          className="member-filter"
          style={{ flex: 1, minWidth: 128 * fontScale, maxWidth: '100%' }}
        >
          <Select
            label="Progress"
            value={d.progress}
            onChange={(progress) => set({ progress })}
            options={[
              { value: 'all', label: 'All progress' },
              { value: 'not-started', label: 'Not started' },
              { value: 'in-progress', label: 'In progress' },
              { value: 'completed', label: 'Completed' },
            ]}
          />
        </View>
      </View>
      {filtered && <TextAction label="Clear filters" onPress={reset} />}
      {phase === 'loading' ? (
        <Empty
          title="Loading your library"
          detail="Getting your collections ready. Loading-state preview; no network request is running."
          action={{ label: 'Finish loading preview', press: () => setPhase('ready') }}
        />
      ) : phase === 'error' ? (
        <Empty
          title="Couldn’t load"
          detail="Your progress is safe. Try loading the library again."
          action={{ label: 'Try again', press: () => setPhase('ready') }}
        />
      ) : phase === 'empty' ? (
        <>
          <Empty
            title="A fresh start"
            detail="There aren’t any collections here yet. Your consultant can help you find your starting point."
            action={{ label: 'Contact support', press: () => go('support') }}
          />
          <TextAction label="Reload library" onPress={() => setPhase('ready')} />
        </>
      ) : !d.items.length ? (
        <Empty
          title="No matches"
          detail="No lessons match this search and these filters. Try another topic or clear your filters."
          action={{ label: 'Clear filters', press: reset }}
        />
      ) : (
        <>
          {filtered && <TextAction label="← Back to collections" onPress={reset} />}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              marginTop: 16,
              marginBottom: 16,
            }}
          >
            <Copy caps size={14} accessibilityRole="header" style={{ flexShrink: 1 }}>
              {title}
            </Copy>
            <Copy size={11} muted>
              {d.overview ? `${d.groups.length} collections` : `${d.items.length} lessons`}
            </Copy>
          </View>
          {d.scope === 'all' && (
            <Copy size={12} muted style={{ marginBottom: 16 }}>
              Locked content needs a different membership. Unavailable content is not ready to
              watch.
            </Copy>
          )}
          <View style={{ gap: 16 }}>
            {d.overview
              ? d.groups.map((group) => {
                  const locked = group.items.every((i) => contentState(member, i) === 'locked'),
                    pending = !locked && !group.ready.length,
                    restricted = locked || pending;
                  return (
                    <Hit
                      key={group.id}
                      onPress={() => set({ collection: group.id })}
                      style={[
                        cardStyle,
                        {
                          paddingHorizontal: 0,
                          paddingVertical: 0,
                          overflow: 'hidden',
                          flexDirection: fontScale > 1.5 || width < 300 ? 'column' : 'row',
                        },
                      ]}
                    >
                      <Cover group={group} restricted={restricted} />
                      <View style={{ flex: 1, paddingVertical: 16, paddingHorizontal: 12, gap: 8 }}>
                        <Copy
                          size={10}
                          style={{ color: restricted ? theme.colors.muted : theme.colors.teal }}
                        >
                          {locked ? '♙ Not included' : pending ? '◷ Coming soon' : '✓ Included'}
                        </Copy>
                        <Copy size={16} style={{ fontWeight: '700', lineHeight: 20.8 }}>
                          {group.title}
                        </Copy>
                        <Copy size={11} muted>
                          {group.description}
                        </Copy>
                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            gap: 8,
                            marginTop: 4,
                          }}
                        >
                          <Copy size={10} muted style={{ flex: 1 }}>
                            {locked
                              ? `${requiredMembership(group.items[0])} membership required`
                              : pending
                                ? 'Recording being prepared'
                                : `${group.ready.length} lessons · ${group.ready.reduce((n, l) => n + l.minutes, 0)} min`}
                          </Copy>
                          <Icon name="arrow" size={18} color={theme.colors.text} />
                        </View>
                        {!restricted && (
                          <>
                            <View style={{ height: 3, backgroundColor: theme.colors.raised }}>
                              <View
                                style={{
                                  height: 3,
                                  width: `${(group.completed / group.ready.length) * 100}%`,
                                  backgroundColor: theme.colors.teal,
                                }}
                              />
                            </View>
                            <Copy size={10} muted>
                              {group.completed} of {group.ready.length} complete
                            </Copy>
                          </>
                        )}
                      </View>
                    </Hit>
                  );
                })
              : d.items.map((item) => {
                  const status = contentState(member, item);
                  return (
                    <Hit
                      key={item.id}
                      onPress={() => openItem(item)}
                      style={[
                        cardStyle,
                        { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 96 },
                      ]}
                    >
                      {fontScale < 1.5 && (
                        <Icon
                          name={
                            status === 'locked' ? 'lock' : status === 'completed' ? 'check' : 'play'
                          }
                          size={24}
                        />
                      )}
                      <View style={{ flex: 1, gap: 8 }}>
                        <Copy caps size={9} muted>
                          {item.course} · {item.minutes} min
                        </Copy>
                        <Copy size={14} style={{ fontWeight: '700' }}>
                          {item.title}
                        </Copy>
                        <Copy size={11} muted>
                          {status === 'locked'
                            ? `Locked · ${requiredMembership(item)} membership required`
                            : status === 'unavailable'
                              ? 'Unavailable · Recording being prepared'
                              : status === 'completed'
                                ? 'Completed · Watch again'
                                : status === 'in-progress'
                                  ? `Continue · ${Math.floor(member.positions[item.id] / 60)} of ${item.minutes} min watched`
                                  : 'Included · Ready to start'}
                        </Copy>
                      </View>
                      <Copy>›</Copy>
                    </Hit>
                  );
                })}
          </View>
          {d.overview && d.scope === 'included' && d.lockedCount > 0 && (
            <Hit onPress={() => set({ scope: 'all' })} style={{ paddingVertical: 20 }}>
              <Copy size={12} muted>
                Looking for more?
              </Copy>
              <Copy size={14}>Explore the full library ↗</Copy>
            </Hit>
          )}
          <RelatedEvents lessonIds={d.items.map((i) => i.id)} go={go} />
        </>
      )}
      <Copy
        role="status"
        accessibilityLiveRegion="polite"
        size={11}
        muted
        style={{ marginTop: 16 }}
      >
        {phase === 'ready'
          ? `${d.items.length} matching lessons in ${d.groups.length} collections.`
          : `Library ${phase} preview.`}
      </Copy>
      <Sheet
        title={locked ? 'Not included' : panel ? 'Library preview' : null}
        close={() => {
          setLocked(null);
          setPanel(null);
        }}
      >
        {locked ? (
          <>
            <Copy caps size={12} muted>
              {locked.course}
            </Copy>
            <Copy size={20}>{locked.title}</Copy>
            <Copy>
              This lesson needs {requiredMembership(locked)} membership. Your included lessons are
              still available.
            </Copy>
            <Solid
              label="View membership"
              onPress={() => {
                setLocked(null);
                go('membership');
              }}
            />
          </>
        ) : (
          <>
            <Copy>
              Try loading, empty and error states. These local previews do not change your progress.
            </Copy>
            <Select
              label="Library state"
              value={preview}
              onChange={setPreview}
              options={[
                { value: 'ready', label: 'Ready · sample catalogue' },
                { value: 'loading', label: 'Loading · hold preview' },
                { value: 'empty', label: 'Empty · no collections' },
                { value: 'error', label: 'Error · try again' },
              ]}
            />
            <Solid
              label="Apply preview"
              onPress={() => {
                setPhase(preview);
                setPanel(null);
              }}
            />
          </>
        )}
      </Sheet>
    </MemberFrame>
  );
}
