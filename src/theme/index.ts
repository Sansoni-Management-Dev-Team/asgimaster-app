import { Platform } from 'react-native';
import tokens from './tokens.generated.json';

const rem = (value: string) => Number.parseFloat(value) * 16;
export const theme = {
  colors: {
    backgroundStart: tokens['color-background-start'],
    backgroundEnd: tokens['color-background-end'],
    text: tokens['color-text'],
    muted: tokens['color-text-muted'],
    subtle: tokens['color-text-subtle'],
    teal: tokens['color-teal'],
    black: tokens['color-black'],
    white: tokens['color-white'],
    surface: tokens['color-surface'],
    raised: tokens['color-surface-raised'],
    course: tokens['color-course-progress'],
    learning: tokens['color-learning-progress'],
    actions: tokens['color-actions-progress'],
    controlBorder: tokens['color-control-border'],
    border: tokens['color-border'],
  },
  space: {
    xs: rem(tokens['space-1']),
    sm: rem(tokens['space-2']),
    md: rem(tokens['space-4']),
    lg: rem(tokens['space-5']),
    xl: rem(tokens['space-6']),
    xxl: rem(tokens['space-7']),
  },
  radius: {
    md: rem(tokens['radius-md']),
    lg: rem(tokens['radius-lg']),
    pill: Number.parseFloat(tokens['radius-pill']),
  },
  target: rem(tokens['target-min']),
  pageMax: rem(tokens['page-max']),
  // Commercial fonts are not bundled; select available families from the fallback stack.
  fontWords: Platform.select({
    ios: 'Helvetica Neue',
    android: 'sans-serif',
    default: tokens['font-words'].split(',').slice(1).join(','),
  }),
  fontNumbers: Platform.select({
    ios: 'Arial',
    android: 'sans-serif',
    default: tokens['font-dashboard-numbers'].split(',').slice(2).join(','),
  }),
  type: {
    small: rem(tokens['text-sm']),
    body: rem(tokens['text-md']),
    title: rem(tokens['text-2xl'].match(/clamp\(([^,]+)/)?.[1] ?? '2rem'),
    tracking: Number.parseFloat(tokens['tracking-headline']),
  },
} as const;
