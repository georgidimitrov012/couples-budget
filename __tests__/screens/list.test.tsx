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
  is_checked: boolean;
  added_by: string;
};
function item(over: Partial<Item> = {}): Item {
  return {
    id: 'i1',
    list_id: 'L1',
    name: 'Milk',
    quantity: 1,
    is_checked: false,
    added_by: 'u1',
    ...over,
  };
}

const noopItems = {
  items: [] as Item[],
  loading: false,
  error: null as string | null,
  addItem: jest.fn(),
  toggleItem: jest.fn(),
  removeItem: jest.fn(),
  clearChecked: jest.fn(),
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
    expect(screen.queryByText(/No items yet/)).toBeNull();
  });

  it('shows the empty state when there are no items', async () => {
    await render(<ListScreen />);
    expect(screen.getByText(/No items yet/)).toBeTruthy();
  });

  it('renders items, quantity, and the clear-checked control', async () => {
    mockUseListItems.mockReturnValue({
      ...noopItems,
      items: [
        item({ id: 'i1', name: 'Milk', quantity: 2 }),
        item({ id: 'i2', name: 'Eggs', is_checked: true }),
      ],
    });
    await render(<ListScreen />);
    expect(screen.getByText(/Milk/)).toBeTruthy();
    expect(screen.getByText(/×2/)).toBeTruthy();
    expect(screen.getByText('Eggs')).toBeTruthy();
    expect(screen.getByText(/Clear checked \(1\)/)).toBeTruthy();
  });

  it('adds an item via the input and Add button', async () => {
    const addItem = jest.fn().mockResolvedValue(undefined);
    mockUseListItems.mockReturnValue({ ...noopItems, addItem });
    const user = userEvent.setup();
    await render(<ListScreen />);

    await user.type(screen.getByPlaceholderText('Add an item…'), 'Bread');
    await user.press(screen.getByLabelText('Add item'));
    expect(addItem).toHaveBeenCalledWith('Bread');
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

  it('shows an error banner and retries on tap', async () => {
    const retry = jest.fn();
    mockUseShoppingList.mockReturnValue({ listId: 'L1', loading: false, error: 'Network down', retry });
    const user = userEvent.setup();
    await render(<ListScreen />);

    expect(screen.getByText(/Network down/)).toBeTruthy();
    await user.press(screen.getByLabelText('Retry'));
    expect(retry).toHaveBeenCalled();
  });
});
