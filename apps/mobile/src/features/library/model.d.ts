import type { Lesson, Member } from '../home/model';
export type Collection = {
  id: string;
  title: string;
  description: string;
  number: string;
  motif: string;
};
export type Item = Lesson & { collection: string; available?: boolean; unavailableReason?: string };
export type Filters = { scope?: string; progress?: string; query?: string; collection?: string };
export const collections: Collection[];
export const libraryCatalogue: Item[];
export function contentState(
  member: Member,
  item: Item,
): 'locked' | 'unavailable' | 'completed' | 'in-progress' | 'not-started';
export function requiredMembership(item: Item): string;
export function getLibrary(
  member: Member,
  filters?: Filters,
  catalogue?: Item[],
): {
  scope: string;
  progress: string;
  query: string;
  collection: string;
  items: Item[];
  options: Collection[];
  groups: (Collection & { items: Item[]; ready: Item[]; completed: number })[];
  overview: boolean;
  includedCount: number;
  comingSoonCount: number;
  lockedCount: number;
};
