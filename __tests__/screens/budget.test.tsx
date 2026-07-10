import { render, screen, userEvent } from '@testing-library/react-native';

const mockUseTransactions = jest.fn();
const mockUseCategories = jest.fn();
jest.mock('../../hooks/useTransactions', () => ({ useTransactions: () => mockUseTransactions() }));
jest.mock('../../hooks/useCategories', () => ({ useCategories: () => mockUseCategories() }));

import BudgetScreen from '../../src/app/(app)/(tabs)/budget';

const FOOD = {
  id: 'c1',
  household_id: 'h1',
  owner_id: 'u1',
  name: 'Food',
  color: '#3c87f7',
  scope: 'shared' as const,
};

// A date in the current month so it lands in the "this month" totals.
function thisMonthDate(day = 15): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

type Tx = {
  id: string;
  household_id: string;
  category_id: string | null;
  owner_id: string;
  amount: number;
  description: string | null;
  occurred_on: string;
  scope: 'private' | 'shared';
  created_at: string;
};
function tx(over: Partial<Tx> = {}): Tx {
  return {
    id: 't1',
    household_id: 'h1',
    category_id: null,
    owner_id: 'u1',
    amount: 10,
    description: 'Groceries',
    occurred_on: thisMonthDate(),
    scope: 'shared',
    created_at: '2026-07-01T00:00:00Z',
    ...over,
  };
}

const base = {
  items: [] as Tx[],
  loading: false,
  error: null as string | null,
  addTransaction: jest.fn(),
  removeTransaction: jest.fn(),
  retry: jest.fn(),
};

beforeEach(() => {
  mockUseTransactions.mockReturnValue({ ...base });
  mockUseCategories.mockReturnValue({ categories: [] });
});

describe('BudgetScreen', () => {
  it('shows a spinner while loading', async () => {
    mockUseTransactions.mockReturnValue({ ...base, loading: true });
    await render(<BudgetScreen />);
    expect(screen.getByTestId('budget-loading')).toBeTruthy();
  });

  it('shows the empty state when there are no transactions', async () => {
    await render(<BudgetScreen />);
    expect(screen.getByText(/No expenses yet/)).toBeTruthy();
  });

  it('totals Ours (shared) and Mine (private) for the current month', async () => {
    mockUseTransactions.mockReturnValue({
      ...base,
      items: [
        tx({ id: 's1', scope: 'shared', amount: 12 }),
        tx({ id: 's2', scope: 'shared', amount: 8 }),
        tx({ id: 'p1', scope: 'private', amount: 5.5 }),
        // Previous month — must be excluded from the totals.
        tx({ id: 'old', scope: 'shared', amount: 999, occurred_on: '2000-01-01' }),
      ],
    });
    await render(<BudgetScreen />);
    expect(screen.getByTestId('summary-ours').props.children).toBe('20.00');
    expect(screen.getByTestId('summary-mine').props.children).toBe('5.50');
  });

  it('adds a shared expense from the form', async () => {
    const addTransaction = jest.fn().mockResolvedValue(undefined);
    mockUseTransactions.mockReturnValue({ ...base, addTransaction });
    const user = userEvent.setup();
    await render(<BudgetScreen />);

    await user.type(screen.getByPlaceholderText('0.00'), '12.50');
    await user.type(screen.getByPlaceholderText('What was it for? (optional)'), 'Coffee');
    await user.press(screen.getByLabelText('Add expense'));

    expect(addTransaction).toHaveBeenCalledWith({ amount: 12.5, description: 'Coffee', scope: 'shared' });
  });

  it('adds a private ("Mine") expense when the scope is toggled', async () => {
    const addTransaction = jest.fn().mockResolvedValue(undefined);
    mockUseTransactions.mockReturnValue({ ...base, addTransaction });
    const user = userEvent.setup();
    await render(<BudgetScreen />);

    await user.type(screen.getByPlaceholderText('0.00'), '5');
    await user.press(screen.getByLabelText('Scope: Mine'));
    await user.press(screen.getByLabelText('Add expense'));

    expect(addTransaction).toHaveBeenCalledWith({ amount: 5, description: '', scope: 'private' });
  });

  it('does not add when the amount is empty/invalid', async () => {
    const addTransaction = jest.fn();
    mockUseTransactions.mockReturnValue({ ...base, addTransaction });
    const user = userEvent.setup();
    await render(<BudgetScreen />);

    await user.press(screen.getByLabelText('Add expense'));
    expect(addTransaction).not.toHaveBeenCalled();
  });

  it('tags a new expense with the selected category', async () => {
    const addTransaction = jest.fn().mockResolvedValue(undefined);
    mockUseTransactions.mockReturnValue({ ...base, addTransaction });
    mockUseCategories.mockReturnValue({ categories: [FOOD] });
    const user = userEvent.setup();
    await render(<BudgetScreen />);

    await user.type(screen.getByPlaceholderText('0.00'), '10');
    await user.press(screen.getByLabelText('Category: Food'));
    await user.press(screen.getByLabelText('Add expense'));

    expect(addTransaction).toHaveBeenCalledWith({
      amount: 10,
      description: '',
      scope: 'shared',
      categoryId: 'c1',
    });
  });

  it('shows the category label on a transaction row', async () => {
    mockUseTransactions.mockReturnValue({
      ...base,
      items: [tx({ id: 't1', description: 'Lunch', category_id: 'c1' })],
    });
    mockUseCategories.mockReturnValue({ categories: [FOOD] });
    await render(<BudgetScreen />);

    expect(screen.getByText('Lunch')).toBeTruthy();
    // "Food" appears both in the picker chip and on the row.
    expect(screen.getAllByText('Food').length).toBeGreaterThanOrEqual(2);
  });

  it('shows an error banner and retries on tap', async () => {
    const retry = jest.fn();
    mockUseTransactions.mockReturnValue({ ...base, error: 'Network down', retry });
    const user = userEvent.setup();
    await render(<BudgetScreen />);

    expect(screen.getByText(/Network down/)).toBeTruthy();
    await user.press(screen.getByLabelText('Retry'));
    expect(retry).toHaveBeenCalled();
  });

  it('renders a transaction and removes it', async () => {
    const removeTransaction = jest.fn();
    mockUseTransactions.mockReturnValue({
      ...base,
      items: [tx({ id: 't1', description: 'Groceries', amount: 12 })],
      removeTransaction,
    });
    const user = userEvent.setup();
    await render(<BudgetScreen />);

    expect(screen.getByText('Groceries')).toBeTruthy();
    await user.press(screen.getByLabelText('Remove Groceries'));
    expect(removeTransaction).toHaveBeenCalled();
  });
});
