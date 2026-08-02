import { render, screen, userEvent } from '@testing-library/react-native';

const mockUseRecurringRules = jest.fn();
const mockUseCategories = jest.fn();
jest.mock('../../hooks/useRecurringRules', () => ({
  useRecurringRules: () => mockUseRecurringRules(),
}));
jest.mock('../../hooks/useCategories', () => ({ useCategories: () => mockUseCategories() }));

import RecurringScreen from '../../src/app/(app)/recurring';

type Rule = {
  id: string;
  household_id: string;
  owner_id: string;
  category_id: string | null;
  amount: number;
  description: string | null;
  scope: 'private' | 'shared';
  day_of_month: number;
  last_charged_month: string | null;
  created_at: string;
};
function rule(over: Partial<Rule> = {}): Rule {
  return {
    id: 'r1',
    household_id: 'h1',
    owner_id: 'u1',
    category_id: null,
    amount: 900,
    description: 'Rent',
    scope: 'shared',
    day_of_month: 1,
    last_charged_month: null,
    created_at: '2026-07-01T00:00:00Z',
    ...over,
  };
}

function base() {
  return {
    rules: [] as Rule[],
    loading: false,
    error: null as string | null,
    addRule: jest.fn().mockResolvedValue({ error: null }),
    removeRule: jest.fn().mockResolvedValue({ error: null }),
    retry: jest.fn(),
  };
}
function mockRecurring(over: Partial<ReturnType<typeof base>> = {}) {
  mockUseRecurringRules.mockReturnValue({ ...base(), ...over });
}

beforeEach(() => {
  mockRecurring();
  mockUseCategories.mockReturnValue({ categories: [] });
});

describe('RecurringScreen', () => {
  it('shows a spinner while loading', async () => {
    mockRecurring({ loading: true });
    await render(<RecurringScreen />);
    expect(screen.getByTestId('recurring-loading')).toBeTruthy();
  });

  it('shows the empty state when there are no rules', async () => {
    await render(<RecurringScreen />);
    expect(screen.getByText(/No recurring expenses/)).toBeTruthy();
  });

  it('lists an existing rule with its day and amount', async () => {
    mockRecurring({ rules: [rule({ description: 'Rent', amount: 900, day_of_month: 1 })] });
    await render(<RecurringScreen />);
    expect(screen.getByText('Rent')).toBeTruthy();
    expect(screen.getByText(/on day 1/)).toBeTruthy();
    expect(screen.getByText(/900\.00/)).toBeTruthy();
  });

  it('adds a rule from the form', async () => {
    const addRule = jest.fn().mockResolvedValue({ error: null });
    mockRecurring({ addRule });
    const user = userEvent.setup();
    await render(<RecurringScreen />);

    await user.type(screen.getByPlaceholderText('0.00'), '900');
    await user.press(screen.getByLabelText('Add recurring expense'));

    expect(addRule).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 900, dayOfMonth: 1, scope: 'shared' })
    );
  });

  it('removes a rule', async () => {
    const removeRule = jest.fn().mockResolvedValue({ error: null });
    mockRecurring({ rules: [rule({ id: 'r1', description: 'Rent' })], removeRule });
    const user = userEvent.setup();
    await render(<RecurringScreen />);

    await user.press(screen.getByLabelText('Remove Rent'));
    expect(removeRule).toHaveBeenCalled();
  });

  it('keeps Add disabled until a positive amount is entered', async () => {
    const addRule = jest.fn().mockResolvedValue({ error: null });
    mockRecurring({ addRule });
    const user = userEvent.setup();
    await render(<RecurringScreen />);

    // No amount yet → pressing the disabled button does nothing.
    await user.press(screen.getByLabelText('Add recurring expense'));
    expect(addRule).not.toHaveBeenCalled();
  });
});
