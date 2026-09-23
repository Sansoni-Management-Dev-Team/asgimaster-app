import tokens from '@/theme/tokens.generated.json';
import { theme } from '@/theme';

// Concept 2 overrides the member-app palette. Values come from the existing design system.
export const cinema = {
  ...theme,
  black: tokens['color-black'],
  white: tokens['color-white'],
  muted: tokens['color-mono-400'],
  quiet: tokens['color-mono-500'],
  border: tokens['color-mono-600'],
  paper: tokens['color-mono-100'],
  ink: tokens['color-mono-900'],
  surface: tokens['color-mono-850'],
  fold: tokens['color-mono-800'],
  dark: tokens['color-mono-950'],
  corner: 3.2,
};
export const shade = (opacity: number) =>
  `${cinema.black}${Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0')}`;
