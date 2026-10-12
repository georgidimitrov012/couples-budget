import { render, screen, userEvent } from '@testing-library/react-native';

const mockUseShoppingList = jest.fn();
const mockUseListItems = jest.fn();
jest.mock('../../hooks/useShoppingList', () => ({ useShoppingList: () => mockUseShoppingList() }));
jest.mock('../../hooks/useListItems', () => ({
  useListItems: (...a: unknown[]) => mockUseListItems(...a),
}));
// The deals feature is tested on its own (__tests__/features/deals); here we only
// check the List tab's one hook-in point.
const mockSaleFor = jest.fn();
jest.mock('@/features/deals', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    useDeals: () => ({ saleFor: (name: string) => mockSaleFor(name) }),
    DealBadge: ({ deal }: { deal: { best: { chain: string } } }) =>
      React.createElement(Text, null, `deal at ${deal.best.chain}`),
  };
});

import ListScreen from '../../src/app/(app)/(tabs)/list';

type Item = {
  id: string;
  list_id: string;
  name: string;
  quantity: number;
  category: string | null;
  is_checked: boolean;
  added_by: string;
  created_at: string;
};
function item(over: Partial<Item> = {}): Item {
  return {
    id: 'i1',
    list_id: 'L1',
    name: 'Milk',
    quantity: 1,
    category: 'dairy',
    is_checked: false,
    added_by: 'u1',
    created_at: '2020-01-01T00:00:00Z',
    ...over,
  };
}

const noopItems = {
  items: [] as Item[],
  loading: false,
  error: null as string | null,
  addItem: jest.fn(),
  toggleItem: jest.fn(),
  setQuantity: jest.fn(),
  removeItem: jest.fn(),
  clearChecked: jest.fn(),
  retry: jest.fn(),
};

beforeEach(() => {
  mockUseShoppingList.mockReturnValue({ listId: 'L1', loading: false, error: null, retry: jest.fn() });
  mockUseListItems.mockReturnValue({ ...noopItems });
  mockSaleFor.mockReturnValue(null);
});

describe('ListScreen', () => {
  it('shows a spinner while the list is resolving', async () => {
    mockUseShoppingList.mockReturnValue({ listId: null, loading: true, error: null, retry: jest.fn() });
    await render(<ListScreen />);
    expect(screen.getByTestId('list-loading')).toBeTruthy();
    expect(screen.queryByText(/list is empty/)).toBeNull();
  });

  it('shows the empty state when there are no items', async () => {
    await render(<ListScreen />);
    expect(screen.getByText(/list is empty/)).toBeTruthy();
  });

  it('groups items by category, shows quantity, and the clear-checked control', async () => {
    mockUseListItems.mockReturnValue({
      ...noopItems,
      items: [
        item({ id: 'i1', name: 'Milk', quantity: 2, category: 'dairy' }),
        item({ id: 'i2', name: 'Bread', category: 'bakery' }),
        item({ id: 'i3', name: 'Eggs', category: 'dairy', is_checked: true }),
      ],
    });
    await render(<ListScreen />);
    expect(screen.getByText('Milk')).toBeTruthy();
    expect(screen.getByText('Bread')).toBeTruthy();
    expect(screen.getByText('Eggs')).toBeTruthy();
    // Category section headers (emoji + uppercased label).
    expect(screen.getByText(/DAIRY & EGGS/)).toBeTruthy();
    expect(screen.getByText(/BAKERY/)).toBeTruthy();
    // Milk's quantity shows in its stepper.
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText(/Clear checked \(1\)/)).toBeTruthy();
  });

  it('adds a typed item with an auto-assigned category', async () => {
    const addItem = jest.fn().mockResolvedValue(undefined);
    mockUseListItems.mockReturnValue({ ...noopItems, addItem });
    const user = userEvent.setup();
    await render(<ListScreen />);

    await user.type(screen.getByPlaceholderText('Add an item…'), 'Bread');
    await user.press(screen.getByLabelText('Add item'));
    expect(addItem).toHaveBeenCalledWith('Bread', { category: 'bakery' });
  });

  it('adds a common item from the catalog', async () => {
    const addItem = jest.fn().mockResolvedValue(undefined);
    mockUseListItems.mockReturnValue({ ...noopItems, addItem });
    const user = userEvent.setup();
    await render(<ListScreen />);

    await user.press(screen.getByLabelText('Browse common items'));
    await user.press(screen.getByLabelText('Add Bread'));
    expect(addItem).toHaveBeenCalledWith('Bread', { category: 'bakery' });
  });

  it('steps an item quantity up', async () => {
    const setQuantity = jest.fn();
    mockUseListItems.mockReturnValue({
      ...noopItems,
      items: [item({ id: 'i1', name: 'Milk', quantity: 2 })],
      setQuantity,
    });
    const user = userEvent.setup();
    await render(<ListScreen />);

    await user.press(screen.getByLabelText('Increase Milk'));
    expect(setQuantity).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1' }), 3);
  });

  it('toggles and removes an item', async () => {
    const toggleItem = jest.fn();
    const removeItem = jest.fn();
    mockUseListItems.mockReturnValue({
      ...noopItems,
      items: [item({ id: 'i1', name: 'Milk' })],
      toggleItem,
      removeItem,
    });
    const user = userEvent.setup();
    await render(<ListScreen />);

    await user.press(screen.getByLabelText('Milk'));
    expect(toggleItem).toHaveBeenCalled();
    await user.press(screen.getByLabelText('Remove Milk'));
    expect(removeItem).toHaveBeenCalled();
  });

  it('clears checked items', async () => {
    const clearChecked = jest.fn();
    mockUseListItems.mockReturnValue({
      ...noopItems,
      items: [item({ id: 'i1', name: 'Milk', is_checked: true })],
      clearChecked,
    });
    const user = userEvent.setup();
    await render(<ListScreen />);

    await user.press(screen.getByLabelText('Clear checked items'));
    expect(clearChecked).toHaveBeenCalled();
  });

  it('shows an error banner and retries both hooks on tap', async () => {
    const listRetry = jest.fn();
    const itemsRetry = jest.fn();
    mockUseShoppingList.mockReturnValue({
      listId: 'L1',
      loading: false,
      error: 'Network down',
      retry: listRetry,
    });
    mockUseListItems.mockReturnValue({ ...noopItems, retry: itemsRetry });
    const user = userEvent.setup();
    await render(<ListScreen />);

    expect(screen.getByText(/Network down/)).toBeTruthy();
    await user.press(screen.getByLabelText('Retry'));
    expect(listRetry).toHaveBeenCalled();
    expect(itemsRetry).toHaveBeenCalled();
  });

  it('shows a deal badge under an item that is on sale, never under a checked one', async () => {
    mockSaleFor.mockImplementation((name: string) =>
      name === 'Tomatoes' || name === 'Eggs' ? { best: { chain: name === 'Tomatoes' ? 'lidl' : 'billa' } } : null
    );
    mockUseListItems.mockReturnValue({
      ...noopItems,
      items: [
        item({ id: 'i1', name: 'Tomatoes', category: 'produce' }),
        item({ id: 'i2', name: 'Bread', category: 'bakery' }),
        item({ id: 'i3', name: 'Eggs', category: 'dairy', is_checked: true }),
      ],
    });
    await render(<ListScreen />);
    expect(screen.getByText('deal at lidl')).toBeTruthy();
    expect(screen.queryByText('deal at billa')).toBeNull();
    expect(mockSaleFor).not.toHaveBeenCalledWith('Eggs');
  });
});

// Regression: items added in Bulgarian stayed Bulgarian after switching to
// English, so the list mixed languages and "Carrots" duplicated "Моркови".
describe('ListScreen — items follow the viewer’s language', () => {
  it('shows a catalog item stored in Bulgarian in English, and free text as typed', async () => {
    mockUseListItems.mockReturnValue({
      ...noopItems,
      items: [
        item({ id: 'i1', name: 'Моркови', category: 'produce' }),
        item({ id: 'i2', name: 'Домат за салата', category: 'produce' }),
      ],
    });
    await render(<ListScreen />);
    expect(screen.getByText('Carrots')).toBeTruthy();
    expect(screen.queryByText('Моркови')).toBeNull();
    expect(screen.getByText('Домат за салата')).toBeTruthy();
  });

  it('typing an item that is already listed in the other language bumps it instead of adding a twin', async () => {
    const addItem = jest.fn();
    const setQuantity = jest.fn().mockResolvedValue(undefined);
    const listed = item({ id: 'i1', name: 'Моркови', category: 'produce', quantity: 1 });
    mockUseListItems.mockReturnValue({ ...noopItems, items: [listed], addItem, setQuantity });
    const user = userEvent.setup();
    await render(<ListScreen />);

    await user.type(screen.getByPlaceholderText('Add an item…'), 'carrots');
    await user.press(screen.getByLabelText('Add item'));
    expect(addItem).not.toHaveBeenCalled();
    expect(setQuantity).toHaveBeenCalledWith(listed, 2);
  });

  it('the catalog marks an item listed in the other language and bumps it', async () => {
    const addItem = jest.fn();
    const setQuantity = jest.fn();
    const listed = item({ id: 'i1', name: 'Моркови', category: 'produce', quantity: 1 });
    mockUseListItems.mockReturnValue({ ...noopItems, items: [listed], addItem, setQuantity });
    const user = userEvent.setup();
    await render(<ListScreen />);

    await user.press(screen.getByLabelText('Browse common items'));
    expect(screen.getByText(/✓ Carrots/)).toBeTruthy();
    await user.press(screen.getByLabelText('Add Carrots'));
    expect(addItem).not.toHaveBeenCalled();
    expect(setQuantity).toHaveBeenCalledWith(listed, 2);
  });
});

// Regression: "Hide common items" read like a filter; people couldn't find the
// way back to their list.
describe('ListScreen — common items', () => {
  it('has a clear Done button that counts what was added and returns to the list', async () => {
    const addItem = jest.fn();
    mockUseListItems.mockReturnValue({
      ...noopItems,
      items: [item({ id: 'i1', name: 'Milk' })],
      addItem,
    });
    const user = userEvent.setup();
    await render(<ListScreen />);

    await user.press(screen.getByLabelText('Browse common items'));
    expect(screen.getByText(/Tap to add/)).toBeTruthy();
    await user.press(screen.getByLabelText('Add Bread'));
    await user.press(screen.getByLabelText('Add Eggs'));
    expect(screen.getByText('2 added to your list')).toBeTruthy();

    await user.press(screen.getByLabelText('Done, back to your list'));
    expect(screen.getByText('Milk')).toBeTruthy();
    expect(screen.getByLabelText('Browse common items')).toBeTruthy();
  });
});
