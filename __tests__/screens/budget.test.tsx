import { render, screen, userEvent } from '@testing-library/react-native';

const mockUseTransactions = jest.fn();
const mockUseCategories = jest.fn();
const mockUseHousehold = jest.fn();
const mockUseSettleUp = jest.fn();
jest.mock('../../hooks/useTransactions', () => ({ useTransactions: () => mockUseTransactions() }));
jest.mock('../../hooks/useCategories', () => ({ useCategories: () => mockUseCategories() }));
jest.mock('../../hooks/useAuth', () => {
  const user = { id: 'u1' };
  return { useAuth: () => ({ user }) };
});
jest.mock('../../hooks/useHousehold', () => ({ useHousehold: () => mockUseHousehold() }));
jest.mock('../../hooks/useSettleUp', () => ({ useSettleUp: () => mockUseSettleUp() }));

import BudgetScreen from '../../src/app/(app)/(tabs)/budget';

const ME = { user_id: 'u1', role: 'owner', joined_at: '', display_name: 'Alex' };
const PARTNER = { user_id: 'u2', role: 'member', joined_at: '', display_name: 'Maria' };
const COUPLE = { household: { id: 'h1' }, members: [ME, PARTNER] };
const SOLO = { household: { id: 'h1' }, members: [ME] };

const FOOD = {
  id: 'c1',
  household_id: 'h1',
  owner_id: 'u1',
  name: 'Food',
  color: '#3c87f7',
  scope: 'shared' as const,
  monthly_limit: null as number | null,
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

const settleBase = {
  balance: 0,
  settlements: [],
  lastSettledOn: null as string | null,
  loading: false,
  error: null as string | null,
  settling: false,
  settleUp: jest.fn(),
  retry: jest.fn(),
};

beforeEach(() => {
  mockUseTransactions.mockReturnValue({ ...base });
  mockUseCategories.mockReturnValue({ categories: [] });
  // Solo by default so the settle card doesn't interfere with unrelated tests.
  mockUseHousehold.mockReturnValue(SOLO);
  mockUseSettleUp.mockReturnValue({ ...settleBase });
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

  it('shows category budget progress when a category has a limit', async () => {
    mockUseTransactions.mockReturnValue({
      ...base,
      items: [
        tx({ id: 's1', scope: 'shared', amount: 12, category_id: 'c1' }),
        tx({ id: 's2', scope: 'shared', amount: 8, category_id: 'c1' }),
      ],
    });
    mockUseCategories.mockReturnValue({ categories: [{ ...FOOD, monthly_limit: 50 }] });
    await render(<BudgetScreen />);
    expect(screen.getByTestId('category-budgets')).toBeTruthy();
    expect(screen.getByText('20.00 / 50.00')).toBeTruthy();
  });

  it('shows an over-limit category budget', async () => {
    mockUseTransactions.mockReturnValue({
      ...base,
      items: [tx({ id: 's1', scope: 'shared', amount: 20, category_id: 'c1' })],
    });
    mockUseCategories.mockReturnValue({ categories: [{ ...FOOD, monthly_limit: 10 }] });
    await render(<BudgetScreen />);
    expect(screen.getByText('20.00 / 10.00')).toBeTruthy();
  });

  it('hides the budgets section when no category has a limit', async () => {
    mockUseCategories.mockReturnValue({ categories: [FOOD] }); // monthly_limit null
    await render(<BudgetScreen />);
    expect(screen.queryByTestId('category-budgets')).toBeNull();
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

  it('hides the settle card until the partner has joined', async () => {
    await render(<BudgetScreen />);
    expect(screen.queryByTestId('settle-balance')).toBeNull();
  });

  it('shows who owes whom when the partner owes the user', async () => {
    mockUseHousehold.mockReturnValue(COUPLE);
    mockUseSettleUp.mockReturnValue({ ...settleBase, balance: 12 });
    await render(<BudgetScreen />);
    expect(screen.getByText('Maria owes you 12.00')).toBeTruthy();
    expect(screen.getByLabelText('Mark as settled')).toBeTruthy();
  });

  it('shows who owes whom when the user owes the partner', async () => {
    mockUseHousehold.mockReturnValue(COUPLE);
    mockUseSettleUp.mockReturnValue({ ...settleBase, balance: -7.5 });
    await render(<BudgetScreen />);
    expect(screen.getByText('You owe Maria 7.50')).toBeTruthy();
  });

  it('shows all-square (no settle button) with the last settle date', async () => {
    mockUseHousehold.mockReturnValue(COUPLE);
    mockUseSettleUp.mockReturnValue({ ...settleBase, balance: 0, lastSettledOn: '2026-07-01' });
    await render(<BudgetScreen />);
    expect(screen.getByText("You're all square")).toBeTruthy();
    expect(screen.getByText(/Last settled 2026-07-01/)).toBeTruthy();
    expect(screen.queryByLabelText('Mark as settled')).toBeNull();
  });

  it('records a settlement when "Mark as settled" is pressed', async () => {
    const settleUp = jest.fn();
    mockUseHousehold.mockReturnValue(COUPLE);
    mockUseSettleUp.mockReturnValue({ ...settleBase, balance: 12, settleUp });
    const user = userEvent.setup();
    await render(<BudgetScreen />);

    await user.press(screen.getByLabelText('Mark as settled'));
    expect(settleUp).toHaveBeenCalled();
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
