import { render, screen, userEvent } from '@testing-library/react-native';

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
  scope: 'private' | 'shared';
};
function cat(over: Partial<Cat> = {}): Cat {
  return {
    id: 'c1',
    household_id: 'h1',
    owner_id: 'u1',
    name: 'Food',
    color: '#3c87f7',
    scope: 'shared',
    ...over,
  };
}

const FIRST_COLOR = '#e5484d';

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
      scope: 'shared',
    });
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
      scope: 'private',
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
