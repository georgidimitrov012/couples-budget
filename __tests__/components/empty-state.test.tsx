import { render, screen } from '@testing-library/react-native';

import { EmptyState } from '../../src/components/empty-state';

describe('EmptyState', () => {
  it('renders the emoji, title and hint', async () => {
    await render(<EmptyState emoji="🛒" title="Nothing here" hint="Add something above." />);
    expect(screen.getByText('🛒')).toBeTruthy();
    expect(screen.getByText('Nothing here')).toBeTruthy();
    expect(screen.getByText('Add something above.')).toBeTruthy();
  });

  it('omits the hint when it is not provided', async () => {
    await render(<EmptyState emoji="📭" title="Empty" />);
    expect(screen.getByText('Empty')).toBeTruthy();
    expect(screen.queryByText('Add something above.')).toBeNull();
  });
});
