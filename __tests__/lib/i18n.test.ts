import { DEFAULT_LANG, isLang, LANGS, translate, translations } from '../../lib/i18n';

describe('translate', () => {
  it('returns the string in the requested language', () => {
    expect(translate('en', 'tab.budget')).toBe('Budget');
    expect(translate('bg', 'tab.budget')).toBe('Бюджет');
  });

  it('interpolates {placeholders}', () => {
    expect(translate('en', 'home.greeting', { name: 'Alex' })).toBe('Hi, Alex');
    expect(translate('bg', 'home.greeting', { name: 'Alex' })).toBe('Здравей, Alex');
    expect(translate('en', 'budget.of', { qty: 3 })).toBe('of 3');
  });

  it('returns the raw key when it is unknown in both languages', () => {
    expect(translate('bg', 'nope.missing')).toBe('nope.missing');
  });

  it('defaults to Bulgarian', () => {
    expect(DEFAULT_LANG).toBe('bg');
  });
});

describe('isLang', () => {
  it('recognizes the supported codes only', () => {
    expect(isLang('bg')).toBe(true);
    expect(isLang('en')).toBe(true);
    expect(isLang('fr')).toBe(false);
    expect(isLang(null)).toBe(false);
    expect(isLang(undefined)).toBe(false);
  });
});

describe('dictionary parity', () => {
  it('every language defines exactly the same keys', () => {
    for (const lang of LANGS) {
      expect(Object.keys(translations[lang]).sort()).toEqual(
        Object.keys(translations.en).sort()
      );
    }
  });
});
