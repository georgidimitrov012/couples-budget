import { render, screen, userEvent } from '@testing-library/react-native';

const mockUseTransactions = jest.fn();
const mockUseCategories = jest.fn();
const mockUseShoppingList = jest.fn();
const mockUseListItems = jest.fn();
jest.mock('../../hooks/useTransactions', () => ({ useTransactions: () => mockUseTransactions() }));
jest.mock('../../hooks/useCategories', () => ({ useCategories: () => mockUseCategories() }));
jest.mock('../../hooks/useShoppingList', () => ({ useShoppingList: () => mockUseShoppingList() }));
jest.mock('../../hooks/useListItems', () => ({
  useListItems: (...a: unknown[]) => mockUseListItems(...a),
}));

import StatsScreen from '../../src/app/(app)/stats';

type Tx = {
  id: string;
  amount: number;
  scope: 'private' | 'shared';
  occurred_on: string;
  category_id: string | null;
};
function thisMonthDate(day = 15): string {
  return monthDate(0, day);
}
// A date `offset` months from now (0 = this month, -1 = last month).
function monthDate(offset: number, day = 15): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function tx(over: Partial<Tx> = {}): Tx {
  return { id: 't1', amount: 10, scope: 'shared', occurred_on: thisMonthDate(), category_id: null, ...over };
}

const FOOD = { id: 'c1', name: 'Food', color: '#3c87f7', icon: null };

beforeEach(() => {
  mockUseTransactions.mockReturnValue({ items: [], loading: false });
  mockUseCategories.mockReturnValue({ categories: [] });
  mockUseShoppingList.mockReturnValue({ listId: 'L1' });
  mockUseListItems.mockReturnValue({ items: [] });
});

describe('StatsScreen', () => {
  it('shows the empty state when there is no spending this month', async () => {
    await render(<StatsScreen />);
    expect(screen.getByText(/No spending yet/)).toBeTruthy();
  });

  it('shows the loading spinner before data arrives', async () => {
    mockUseTransactions.mockReturnValue({ items: [], loading: true });
    await render(<StatsScreen />);
    expect(screen.getByTestId('stats-loading')).toBeTruthy();
  });

  it('totals the month, splits Ours/Mine and breaks down by category', async () => {
    mockUseTransactions.mockReturnValue({
      items: [
        tx({ id: 's1', scope: 'shared', amount: 30, category_id: 'c1' }),
        tx({ id: 'p1', scope: 'private', amount: 10, category_id: null }),
      ],
      loading: false,
    });
    mockUseCategories.mockReturnValue({ categories: [FOOD] });
    await render(<StatsScreen />);

    expect(screen.getByText('40.00 €')).toBeTruthy(); // month total
    expect(screen.getByText('Food')).toBeTruthy(); // category breakdown
    expect(screen.getByText('Uncategorized')).toBeTruthy(); // the null-category bucket
  });

  it('reflects the shopping-list snapshot', async () => {
    mockUseTransactions.mockReturnValue({ items: [tx({ amount: 5 })], loading: false });
    mockUseListItems.mockReturnValue({
      items: [
        { id: 'i1', is_checked: false },
        { id: 'i2', is_checked: true },
        { id: 'i3', is_checked: true },
      ],
    });
    await render(<StatsScreen />);
    expect(screen.getByText('To buy')).toBeTruthy();
    expect(screen.getByText('Bought')).toBeTruthy();
  });

  it('navigates to the previous month and shows its total', async () => {
    mockUseTransactions.mockReturnValue({
      items: [
        // This month: 20 shared (Food) + 10 private = 30 total.
        tx({ id: 'a', scope: 'shared', amount: 20, category_id: 'c1', occurred_on: monthDate(0) }),
        tx({ id: 'b', scope: 'private', amount: 10, category_id: null, occurred_on: monthDate(0) }),
        // Last month: 8 shared (Food) + 4 private = 12 total.
        tx({ id: 'c', scope: 'shared', amount: 8, category_id: 'c1', occurred_on: monthDate(-1) }),
        tx({ id: 'd', scope: 'private', amount: 4, category_id: null, occurred_on: monthDate(-1) }),
      ],
      loading: false,
    });
    mockUseCategories.mockReturnValue({ categories: [FOOD] });
    const user = userEvent.setup();
    await render(<StatsScreen />);

    expect(screen.getByText('30.00 €')).toBeTruthy(); // this month's total
    await user.press(screen.getByLabelText('Previous month'));
    expect(screen.getByText('12.00 €')).toBeTruthy(); // last month's total
  });
});
