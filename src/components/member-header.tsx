import type { ReactNode } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { AppText } from './app-text';
import { theme } from '@/theme';

export function MemberHeader({
  title,
  actions,
  back,
  context,
}: {
  title: string;
  actions?: ReactNode;
  back?: ReactNode;
  context?: ReactNode;
}) {
  const { fontScale } = useWindowDimensions();
  return (
    <View
      testID="member-header"
      style={{ paddingTop: theme.space.xs, paddingBottom: theme.space.lg, gap: theme.space.sm }}
    >
      {back}
      <View
        style={{
          minHeight: theme.target,
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          columnGap: theme.space.sm,
          rowGap: theme.space.sm,
        }}
      >
        <AppText
          variant="title"
          style={{
            fontSize: theme.type.screenTitle,
            lineHeight: theme.type.screenTitle * 1.2,
            letterSpacing: theme.type.screenTitle * theme.type.tracking,
            flexBasis: 144 * fontScale,
            flexGrow: 1,
            maxWidth: '100%',
          }}
        >
          {title}
        </AppText>
        {actions && (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: theme.space.sm,
              marginLeft: 'auto',
            }}
          >
            {actions}
          </View>
        )}
      </View>
      {context}
    </View>
  );
}
