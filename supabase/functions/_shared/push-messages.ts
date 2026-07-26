// Pure push-notification message templates, shared by the push-notify Edge
// Function (Deno) and its unit test (Jest). No Deno APIs here so both can import
// it. Bulgarian is the default; unknown locales fall back to it.

export type PushEvent = 'listAdd' | 'listCheck' | 'expense' | 'memberJoin';
export type PushLocale = 'bg' | 'en';

export type PushMessage = {
  title: string;
  body: string;
  data: { screen: 'list' | 'budget' };
};

export type PushOpts = { itemName?: string; amount?: string; category?: string | null };

const TEMPLATES: Record<PushLocale, Record<PushEvent, { title: string; body: string }>> = {
  en: {
    listAdd: { title: '🛒 Shopping list', body: '{actor} added {item} to the list' },
    listCheck: { title: '✅ Shopping list', body: '{actor} bought {item}' },
    expense: { title: '💸 Budget', body: '{actor} added a {amount} expense{category}' },
    memberJoin: { title: '🎉 Couples Budget', body: '{actor} joined your household' },
  },
  bg: {
    listAdd: { title: '🛒 Списък за пазаруване', body: '{actor} добави {item} в списъка' },
    listCheck: { title: '✅ Списък за пазаруване', body: '{actor} купи {item}' },
    expense: { title: '💸 Бюджет', body: '{actor} добави разход {amount}{category}' },
    memberJoin: { title: '🎉 Общ бюджет', body: '{actor} се присъедини към домакинството' },
  },
};

const SCREEN: Record<PushEvent, 'list' | 'budget'> = {
  listAdd: 'list',
  listCheck: 'list',
  expense: 'budget',
  memberJoin: 'budget',
};

/** Compose the localized title/body/route for a partner-triggered event. */
export function buildPushMessage(
  event: PushEvent,
  actorName: string,
  locale: PushLocale,
  opts: PushOpts = {}
): PushMessage {
  const lang: PushLocale = locale === 'en' ? 'en' : 'bg';
  const tmpl = TEMPLATES[lang][event];
  const category = opts.category ? ` · ${opts.category}` : '';
  const body = tmpl.body
    .replace('{actor}', actorName)
    .replace('{item}', opts.itemName ?? '')
    .replace('{amount}', opts.amount ?? '')
    .replace('{category}', category);
  return { title: tmpl.title, body, data: { screen: SCREEN[event] } };
}
