import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';

const mockUseCategories = jest.fn();
jest.mock('../../hooks/useCategories', () => ({ useCategories: () => mockUseCategories() }));
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

import CategoriesScreen from '../../src/app/(app)/categories';

type Cat = {
  id: string;
  household_id: string;
  owner_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  scope: 'private' | 'shared';
  monthly_limit: number | null;
};
function cat(over: Partial<Cat> = {}): Cat {
  return {
    id: 'c1',
    household_id: 'h1',
    owner_id: 'u1',
    name: 'Food',
    color: '#3c87f7',
    icon: null,
    scope: 'shared',
    monthly_limit: null,
    ...over,
  };
}

const FIRST_COLOR = '#e5484d';
const FIRST_ICON = '🛒';

function mockCategories(over: Partial<ReturnType<typeof baseValue>> = {}) {
  mockUseCategories.mockReturnValue({ ...baseValue(), ...over });
}
function baseValue() {
  return {
    categories: [] as Cat[],
    loading: false,
    error: null as string | null,
    refresh: jest.fn(),
    addCategory: jest.fn().mockResolvedValue({ error: null }),
    updateCategory: jest.fn().mockResolvedValue({ error: null }),
    removeCategory: jest.fn().mockResolvedValue({ error: null }),
  };
}

beforeEach(() => mockCategories());

describe('CategoriesScreen', () => {
  it('shows a spinner while loading', async () => {
    mockCategories({ loading: true });
    await render(<CategoriesScreen />);
    expect(screen.getByTestId('categories-loading')).toBeTruthy();
  });

  it('shows the empty state', async () => {
    await render(<CategoriesScreen />);
    expect(screen.getByText(/No categories yet/)).toBeTruthy();
  });

  it('adds a shared category with the default color', async () => {
    const addCategory = jest.fn().mockResolvedValue({ error: null });
    mockCategories({ addCategory });
    const user = userEvent.setup();
    await render(<CategoriesScreen />);

    await user.type(screen.getByPlaceholderText('Category name'), 'Groceries');
    await user.press(screen.getByLabelText('Add category'));
    expect(addCategory).toHaveBeenCalledWith({
      name: 'Groceries',
      color: FIRST_COLOR,
      icon: FIRST_ICON,
      scope: 'shared',
      monthlyLimit: null,
    });
  });

  it('adds a category with a chosen icon', async () => {
    const addCategory = jest.fn().mockResolvedValue({ error: null });
    mockCategories({ addCategory });
    const user = userEvent.setup();
    await render(<CategoriesScreen />);

    await user.type(screen.getByPlaceholderText('Category name'), 'Home');
    await user.press(screen.getByLabelText('Icon 🏠'));
    await user.press(screen.getByLabelText('Add category'));
    expect(addCategory).toHaveBeenCalledWith(expect.objectContaining({ name: 'Home', icon: '🏠' }));
  });

  it('changes an existing category icon (owner)', async () => {
    const updateCategory = jest.fn().mockResolvedValue({ error: null });
    const food = cat({ id: 'c1', name: 'Food', owner_id: 'u1' });
    mockCategories({ categories: [food], updateCategory });
    const user = userEvent.setup();
    await render(<CategoriesScreen />);

    await user.press(screen.getByLabelText('Change icon for Food'));
    // The add form also has an icon picker; the row's picker is the last one.
    const options = screen.getAllByLabelText('Icon 🏠');
    await user.press(options[options.length - 1]);
    expect(updateCategory).toHaveBeenCalledWith(food, { icon: '🏠' });
  });

  it('adds a category with a monthly limit', async () => {
    const addCategory = jest.fn().mockResolvedValue({ error: null });
    mockCategories({ addCategory });
    const user = userEvent.setup();
    await render(<CategoriesScreen />);

    await user.type(screen.getByPlaceholderText('Category name'), 'Groceries');
    await user.type(screen.getByLabelText('Monthly limit'), '300');
    await user.press(screen.getByLabelText('Add category'));
    expect(addCategory).toHaveBeenCalledWith({
      name: 'Groceries',
      color: FIRST_COLOR,
      icon: FIRST_ICON,
      scope: 'shared',
      monthlyLimit: 300,
    });
  });

  it('edits an existing category limit', async () => {
    const updateCategory = jest.fn().mockResolvedValue({ error: null });
    const food = cat({ id: 'c1', name: 'Food', owner_id: 'u1', monthly_limit: null });
    mockCategories({ categories: [food], updateCategory });
    const user = userEvent.setup();
    await render(<CategoriesScreen />);

    const input = screen.getByLabelText('Monthly limit for Food');
    await user.type(input, '80');
    fireEvent(input, 'endEditing');
    expect(updateCategory).toHaveBeenCalledWith(food, { monthlyLimit: 80 });
  });

  it('shows a partner-owned category limit read-only (no input)', async () => {
    mockCategories({
      categories: [cat({ id: 'c2', name: 'Rent', owner_id: 'u2', monthly_limit: 120 })],
    });
    await render(<CategoriesScreen />);
    expect(screen.getByText('Limit 120')).toBeTruthy();
    expect(screen.queryByLabelText('Monthly limit for Rent')).toBeNull();
  });

  it('adds a private ("Mine") category when toggled', async () => {
    const addCategory = jest.fn().mockResolvedValue({ error: null });
    mockCategories({ addCategory });
    const user = userEvent.setup();
    await render(<CategoriesScreen />);

    await user.type(screen.getByPlaceholderText('Category name'), 'Personal');
    await user.press(screen.getByLabelText('Scope: Mine'));
    await user.press(screen.getByLabelText('Add category'));
    expect(addCategory).toHaveBeenCalledWith({
      name: 'Personal',
      color: FIRST_COLOR,
      icon: FIRST_ICON,
      scope: 'private',
      monthlyLimit: null,
    });
  });

  it('does not add when the name is empty', async () => {
    const addCategory = jest.fn();
    mockCategories({ addCategory });
    const user = userEvent.setup();
    await render(<CategoriesScreen />);

    await user.press(screen.getByLabelText('Add category'));
    expect(addCategory).not.toHaveBeenCalled();
  });

  it('lists categories and only allows deleting your own', async () => {
    const removeCategory = jest.fn().mockResolvedValue({ error: null });
    mockCategories({
      categories: [
        cat({ id: 'c1', name: 'Food', owner_id: 'u1' }),
        cat({ id: 'c2', name: 'Rent', owner_id: 'u2' }),
      ],
      removeCategory,
    });
    const user = userEvent.setup();
    await render(<CategoriesScreen />);

    expect(screen.getByText('Food')).toBeTruthy();
    expect(screen.getByText('Rent')).toBeTruthy();
    // Partner-owned category has no delete affordance.
    expect(screen.queryByLabelText('Remove Rent')).toBeNull();

    await user.press(screen.getByLabelText('Remove Food'));
    expect(removeCategory).toHaveBeenCalled();
  });
});
