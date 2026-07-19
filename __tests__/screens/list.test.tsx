import { render, screen, userEvent } from '@testing-library/react-native';

const mockUseShoppingList = jest.fn();
const mockUseListItems = jest.fn();
jest.mock('../../hooks/useShoppingList', () => ({ useShoppingList: () => mockUseShoppingList() }));
jest.mock('../../hooks/useListItems', () => ({
  useListItems: (...a: unknown[]) => mockUseListItems(...a),
}));

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
});
