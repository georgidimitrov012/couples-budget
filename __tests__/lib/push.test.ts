import { notificationRoute } from '../../lib/push';

describe('notificationRoute', () => {
  it('routes shopping events to the list and money events to the budget', () => {
    expect(notificationRoute({ screen: 'list' })).toBe('/list');
    expect(notificationRoute({ screen: 'budget' })).toBe('/budget');
  });

  it('returns null for unknown, missing or non-object data', () => {
    expect(notificationRoute({ screen: 'other' })).toBeNull();
    expect(notificationRoute({})).toBeNull();
    expect(notificationRoute(null)).toBeNull();
    expect(notificationRoute(undefined)).toBeNull();
    expect(notificationRoute('list')).toBeNull();
  });
});
