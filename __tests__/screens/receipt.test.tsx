import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const mockScan = jest.fn();
const mockApply = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
  Link: ({ children }: { children?: React.ReactNode }) => children,
}));
jest.mock('../../hooks/useReceiptScan', () => ({
  useReceiptScan: () => ({
    scan: (...a: unknown[]) => mockScan(...a),
    apply: (...a: unknown[]) => mockApply(...a),
    scanning: false,
    applying: false,
    error: null,
  }),
}));
jest.mock('../../hooks/useShoppingList', () => ({ useShoppingList: () => ({ listId: 'L1' }) }));
jest.mock('../../hooks/useListItems', () => ({
  useListItems: () => ({ items: [{ id: 'li1', name: 'Milk', is_checked: false }] }),
}));

import * as ImagePicker from 'expo-image-picker';
import ReceiptScreen from '../../src/app/(app)/receipt';

const SCAN = {
  merchant: 'Kaufland',
  purchased_on: '2026-07-11',
  currency: 'BGN',
  items: [
    { name: 'Milk', quantity: 1, price: 2.5 },
    { name: 'Dish soap', quantity: 1, price: 4 },
  ],
};

const GRANTED = { granted: true, canAskAgain: true };

beforeEach(() => {
  // Both pickers ask for permission first. Re-set every run: clearMocks only
  // clears calls, so a mockResolvedValue would otherwise leak between tests.
  (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue(GRANTED);
  (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue(GRANTED);
  (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
    canceled: false,
    assets: [{ base64: 'aGVsbG8=', uri: 'file://r.jpg', mimeType: 'image/jpeg' }],
  });
  mockScan.mockResolvedValue(SCAN);
  mockApply.mockResolvedValue(true);
});

async function toReview(user: ReturnType<typeof userEvent.setup>) {
  await user.press(screen.getByLabelText('Choose from library'));
  // The scanned rows appear once extraction resolves.
  await screen.findByDisplayValue('Milk');
}

describe('ReceiptScreen', () => {
  it('offers capture options first', async () => {
    await render(<ReceiptScreen />);
    expect(screen.getByLabelText('Take photo')).toBeTruthy();
    expect(screen.getByLabelText('Choose from library')).toBeTruthy();
  });

  // AGENTS.md requires all three permission states. "Denied but askable" and
  // "blocked, only Settings can undo it" need different advice — and the library
  // picker previously asked for no permission at all.
  it('explains a refused photo permission without opening the picker', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: false,
      canAskAgain: true,
    });
    const user = userEvent.setup();
    await render(<ReceiptScreen />);
    await user.press(screen.getByLabelText('Choose from library'));

    expect(await screen.findByText(/Photo access is needed/i)).toBeTruthy();
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('points at Settings when the photo permission is blocked for good', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: false,
      canAskAgain: false,
    });
    const user = userEvent.setup();
    await render(<ReceiptScreen />);
    await user.press(screen.getByLabelText('Choose from library'));

    expect(await screen.findByText(/Turn it on in Settings/i)).toBeTruthy();
  });

  it('explains a refused camera permission without opening the camera', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: false,
      canAskAgain: true,
    });
    const user = userEvent.setup();
    await render(<ReceiptScreen />);
    await user.press(screen.getByLabelText('Take photo'));

    expect(await screen.findByText(/Camera access is needed/i)).toBeTruthy();
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('scans a picked photo and shows editable line items', async () => {
    const user = userEvent.setup();
    await render(<ReceiptScreen />);
    await toReview(user);

    expect(mockScan).toHaveBeenCalledWith({ base64: 'aGVsbG8=', mimeType: 'image/jpeg' });
    expect(screen.getByDisplayValue('Milk')).toBeTruthy();
    expect(screen.getByDisplayValue('Dish soap')).toBeTruthy();
    // Matched item defaults to "Check: Milk"; total sums both lines.
    expect(screen.getByLabelText(/Check: Milk/)).toBeTruthy();
    expect(screen.getByTestId('receipt-total').props.children).toBe('6.50 €');
  });

  it('submits the reviewed lines via apply()', async () => {
    const user = userEvent.setup();
    await render(<ReceiptScreen />);
    await toReview(user);

    await user.press(screen.getByLabelText('Submit receipt'));

    await waitFor(() => expect(mockApply).toHaveBeenCalled());
    const arg = mockApply.mock.calls[0][0];
    expect(arg.merchant).toBe('Kaufland');
    expect(arg.lines).toEqual([
      { name: 'Milk', amount: 2.5, scope: 'shared', action: 'check', list_item_id: 'li1' },
      { name: 'Dish soap', amount: 4, scope: 'shared', action: 'add', list_item_id: null },
    ]);
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('excludes a line that is marked Skip', async () => {
    const user = userEvent.setup();
    await render(<ReceiptScreen />);
    await toReview(user);

    // Skip the Dish soap line (the second "Skip" chip).
    const skips = screen.getAllByLabelText(/^Skip/);
    await user.press(skips[1]);
    expect(screen.getByTestId('receipt-total').props.children).toBe('2.50 €');

    await user.press(screen.getByLabelText('Submit receipt'));
    await waitFor(() => expect(mockApply).toHaveBeenCalled());
    expect(mockApply.mock.calls[0][0].lines).toEqual([
      { name: 'Milk', amount: 2.5, scope: 'shared', action: 'check', list_item_id: 'li1' },
    ]);
  });
});
