import { initialsFor } from '../../src/components/avatar';

describe('initialsFor', () => {
  it('takes the first and last initial of a full name', () => {
    expect(initialsFor('Alex Rivera')).toBe('AR');
    expect(initialsFor('Maria del Carmen')).toBe('MC');
  });

  it('takes a single initial for one-word names', () => {
    expect(initialsFor('maria')).toBe('M');
  });

  it('falls back to "?" for empty or missing names', () => {
    expect(initialsFor('')).toBe('?');
    expect(initialsFor('   ')).toBe('?');
    expect(initialsFor(null)).toBe('?');
    expect(initialsFor(undefined)).toBe('?');
  });

  it('uppercases and handles extra whitespace', () => {
    expect(initialsFor('  jo   black ')).toBe('JB');
  });
});
