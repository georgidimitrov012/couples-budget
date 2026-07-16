import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

const mockUseHousehold = jest.fn();
const mockLeave = jest.fn();
const mockDelete = jest.fn();

jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'a@b.com', user_metadata: { display_name: 'Alice' } } }),
}));
jest.mock('../../hooks/useHousehold', () => ({ useHousehold: () => mockUseHousehold() }));
jest.mock('../../hooks/useAccount', () => ({ useAccount: () => ({ deleteAccount: mockDelete }) }));

import SettingsScreen from '../../src/app/(app)/settings';

// Auto-confirm: invoke the destructive button the screen passes to Alert.
function autoConfirm() {
  return jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    const destructive = (buttons ?? []).find((b) => b.style === 'destructive');
    destructive?.onPress?.();
  });
}

beforeEach(() => {
  mockLeave.mockReset().mockResolvedValue({ error: null });
  mockDelete.mockReset().mockResolvedValue({ error: null });
  mockUseHousehold.mockReturnValue({
    household: { id: 'h1', name: 'Our Home', invite_code: 'ABC123' },
    members: [{ user_id: 'u1' }, { user_id: 'u2' }],
    leaveHousehold: mockLeave,
  });
});

afterEach(() => jest.restoreAllMocks());

describe('SettingsScreen', () => {
  it('shows the account info and both destructive actions', async () => {
    await render(<SettingsScreen />);
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('a@b.com')).toBeTruthy();
    expect(screen.getByText('Our Home')).toBeTruthy();
    expect(screen.getByLabelText('Leave household')).toBeTruthy();
    expect(screen.getByLabelText('Delete account')).toBeTruthy();
  });

  it('leaves the household after confirming', async () => {
    autoConfirm();
    const user = userEvent.setup();
    await render(<SettingsScreen />);
    await user.press(screen.getByLabelText('Leave household'));
    await waitFor(() => expect(mockLeave).toHaveBeenCalled());
  });

  it('deletes the account after confirming', async () => {
    autoConfirm();
    const user = userEvent.setup();
    await render(<SettingsScreen />);
    await user.press(screen.getByLabelText('Delete account'));
    await waitFor(() => expect(mockDelete).toHaveBeenCalled());
  });

  it('does nothing if the confirmation is dismissed', async () => {
    // Default Alert mock: do not press any button (user cancels).
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<SettingsScreen />);
    await user.press(screen.getByLabelText('Leave household'));
    await user.press(screen.getByLabelText('Delete account'));
    expect(mockLeave).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
