import { buildPushMessage } from '../../supabase/functions/_shared/push-messages';

describe('buildPushMessage', () => {
  it('localizes the four events in English', () => {
    expect(buildPushMessage('listAdd', 'Alex', 'en', { itemName: 'milk' })).toEqual({
      title: '🛒 Shopping list',
      body: 'Alex added milk to the list',
      data: { screen: 'list' },
    });
    expect(buildPushMessage('listCheck', 'Alex', 'en', { itemName: 'bread' }).body).toBe(
      'Alex bought bread'
    );
    expect(buildPushMessage('memberJoin', 'Maria', 'en').body).toBe('Maria joined your household');
  });

  it('localizes in Bulgarian', () => {
    expect(buildPushMessage('listAdd', 'Алекс', 'bg', { itemName: 'мляко' }).body).toBe(
      'Алекс добави мляко в списъка'
    );
    expect(buildPushMessage('memberJoin', 'Мария', 'bg').data.screen).toBe('budget');
  });

  it('includes the category on an expense only when present', () => {
    expect(buildPushMessage('expense', 'Alex', 'en', { amount: '40.00 €', category: 'Groceries' }).body).toBe(
      'Alex added a 40.00 € expense · Groceries'
    );
    expect(buildPushMessage('expense', 'Alex', 'en', { amount: '40.00 €' }).body).toBe(
      'Alex added a 40.00 € expense'
    );
    expect(buildPushMessage('expense', 'Alex', 'en', { amount: '40.00 €', category: null }).body).toBe(
      'Alex added a 40.00 € expense'
    );
  });

  it('falls back to Bulgarian for an unknown locale', () => {
    const bg = buildPushMessage('listAdd', 'Alex', 'bg', { itemName: 'x' });
    expect(buildPushMessage('listAdd', 'Alex', 'de' as 'bg', { itemName: 'x' })).toEqual(bg);
  });

  it('routes shopping events to the list and money events to the budget', () => {
    expect(buildPushMessage('listAdd', 'A', 'en').data.screen).toBe('list');
    expect(buildPushMessage('listCheck', 'A', 'en').data.screen).toBe('list');
    expect(buildPushMessage('expense', 'A', 'en').data.screen).toBe('budget');
  });
});
