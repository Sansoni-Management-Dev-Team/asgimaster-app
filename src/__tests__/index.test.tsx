import { render } from '@testing-library/react-native';
import { describe, expect, it } from '@jest/globals';

import Index from '../app/index';

// Smoke test: proves the Jest + jest-expo + NativeWind render pipeline works end to end.
// It should fail loudly if the styling or babel transform breaks rendering.
// Kept out of src/app so Expo Router's require.context does not treat it as a route.
describe('Index screen', () => {
  it('renders the app name', async () => {
    const { getByText } = await render(<Index />);
    expect(getByText('mlai-sansoni')).toBeTruthy();
  });
});
