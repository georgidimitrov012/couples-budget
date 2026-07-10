import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';

const mockJoin = jest.fn();
jest.mock('../../hooks/useHousehold', () => ({
  useHousehold: () => ({ joinHousehold: mockJoin }),
}));

import JoinHouseholdScreen from '../../src/app/(app)/(onboarding)/join';

beforeEach(() => mockJoin.mockResolvedValue({ error: null }));

describe('JoinHouseholdScreen', () => {
  it('requires a 6-character code before calling the RPC', async () => {
    const user = userEvent.setup();
    await render(<JoinHouseholdScreen />);
    await user.type(screen.getByPlaceholderText('ABC123'), 'AB');
    await user.press(screen.getByText('Join household'));
    expect(screen.getByText(/Enter your 6-character invite code/)).toBeTruthy();
    expect(mockJoin).not.toHaveBeenCalled();
  });

  it('uppercases the code and surfaces the RPC error message', async () => {
    mockJoin.mockResolvedValue({ error: 'This household is already full' });
    const user = userEvent.setup();
    await render(<JoinHouseholdScreen />);
    await user.type(screen.getByPlaceholderText('ABC123'), 'abc123');
    await user.press(screen.getByText('Join household'));
    expect(mockJoin).toHaveBeenCalledWith('ABC123');
    expect(await screen.findByText('This household is already full')).toBeTruthy();
  });
});
