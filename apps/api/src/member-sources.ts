export type SourceState = {
  name: string;
  status: 'not_configured' | 'not_connected' | 'unavailable';
};

// Source adapters never create identities or infer links from an email match.
// Replace each stub with a read-only connector once source contracts are agreed.
export type MemberSource = {
  name: string;
  inspect: (memberId?: string) => Promise<SourceState>;
};
export type SourceConfiguration = {
  maxioAU: boolean;
  maxioNZ: boolean;
  hubspot: boolean;
};

export function createMemberSources(configuration?: SourceConfiguration): MemberSource[] {
  return [
    ['Maxio AU', configuration?.maxioAU],
    ['Maxio NZ', configuration?.maxioNZ],
    ['HubSpot', configuration?.hubspot],
  ].map(([name, configured]) => ({
    name: name as string,
    // Credentials alone are not evidence of a working or refreshed integration.
    inspect: async () => ({
      name: name as string,
      status: configured ? 'not_connected' : 'not_configured',
    }),
  }));
}

export async function inspectSources(sources: MemberSource[], memberId?: string) {
  return Promise.all(
    sources.map(async (source): Promise<SourceState> => {
      try {
        return await source.inspect(memberId);
      } catch {
        // Raw vendor exceptions may contain credentials or personal information.
        return { name: source.name, status: 'unavailable' };
      }
    }),
  );
}
