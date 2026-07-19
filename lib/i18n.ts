// App localization. Bulgarian is the default; English is the alternate. A flat
// key -> string map per language keeps lookups trivial; `{placeholder}` tokens
// are filled by translate(). The React context + persistence live in
// hooks/useTranslation.tsx — this module stays pure (no React) so it can be used
// by non-React code (e.g. lib/groceries.ts) and unit-tested directly.

export type Lang = 'bg' | 'en';
export const LANGS: Lang[] = ['bg', 'en'];
export const DEFAULT_LANG: Lang = 'bg';

export const LANG_LABEL: Record<Lang, string> = { bg: 'Български', en: 'English' };

type Dict = Record<string, string>;

const en: Dict = {
  // Common / shared
  'common.back': 'Back',
  'common.signOut': 'Sign out',
  'common.tryAgain': 'Try again',
  'common.done': 'Done',
  'common.close': 'Close',
  'error.tapRetry': '{error} — tap to retry',
  'error.enterCreds': 'Enter your email and password.',
  'error.enterCode': 'Enter your {length}-character invite code.',
  'error.passwordShort': 'Password must be at least {min} characters.',

  // Tabs
  'tab.home': 'Home',
  'tab.list': 'List',
  'tab.budget': 'Budget',

  // Scope (Ours / Mine)
  'scope.ours': 'Ours',
  'scope.mine': 'Mine',
  'scope.prefix': 'Scope',

  // Sign in
  'signin.title': 'Welcome back',
  'signin.subtitle': 'Sign in to your shared budget.',
  'signin.button': 'Sign in',
  'signin.noAccount': 'No account yet? ',
  'signin.createOne': 'Create one',
  'field.email': 'Email',
  'field.password': 'Password',

  // Sign up
  'signup.title': 'Create account',
  'signup.subtitle': 'Start your shared budget and shopping list.',
  'signup.button': 'Create account',
  'signup.checkTitle': 'Check your email',
  'signup.checkBody':
    'We sent a confirmation link to {email}. Tap it to finish creating your account, then sign in.',
  'signup.backToSignin': 'Back to sign in',
  'signup.haveAccount': 'Already have an account? ',
  'signup.signin': 'Sign in',
  'field.displayName': 'Display name',

  // Welcome / onboarding
  'welcome.title': 'Set up your household',
  'welcome.subtitle':
    'A household links you and your partner. Create one and share the code, or join with a code you already have.',
  'welcome.create': 'Create a household',
  'welcome.join': 'Join with a code',

  // Create household
  'create.title': 'Create a household',
  'create.subtitle':
    "Give it a name (or keep the default). You'll get an invite code to share with your partner.",
  'create.namePlaceholder': 'Household name (optional)',
  'create.button': 'Create household',

  // Join household
  'join.title': 'Join a household',
  'join.subtitle': 'Enter the 6-character code your partner shared with you.',
  'join.button': 'Join household',

  // Home
  'home.settings': 'Settings',
  'home.greeting': 'Hi, {name}',
  'home.shareCode': 'SHARE THIS CODE WITH YOUR PARTNER',
  'home.waiting': 'Waiting for your partner to join…',
  'home.regenerate': 'Regenerate code',
  'home.bothSetUp': "You're both set up. Next up: your shared shopping list and budget.",

  // Shopping list
  'list.title': 'Shopping list',
  'list.clearChecked': 'Clear checked ({count})',
  'list.clearCheckedA11y': 'Clear checked items',
  'list.addPlaceholder': 'Add an item…',
  'list.addItem': 'Add item',
  'list.commonItems': '✨  Common items',
  'list.hideCommon': '✕  Hide common items',
  'list.browseCommon': 'Browse common items',
  'list.emptyTitle': 'Your list is empty',
  'list.emptyHint': 'Add an item above, or tap “Common items” to pick from the basics.',
  'list.addNamed': 'Add {name}',
  'list.decrease': 'Decrease {name}',
  'list.increase': 'Increase {name}',
  'list.remove': 'Remove {name}',
  'common.retry': 'Retry',

  // Budget
  'budget.title': 'Budget',
  'budget.categories': 'Categories',
  'budget.manageCategories': 'Manage categories',
  'budget.thisMonth': 'this month',
  'budget.descPlaceholder': 'What was it for? (optional)',
  'budget.addExpense': 'Add expense',
  'budget.emptyTitle': 'No expenses yet',
  'budget.emptyHint':
    'Add what you spent above — mark it Ours to split it 50/50, or Mine to keep it private.',
  'budget.categoryBudgets': 'CATEGORY BUDGETS · THIS MONTH',
  'budget.none': 'None',
  'budget.forListItem': '🛒  FOR A LIST ITEM',
  'budget.bought': 'Bought',
  'budget.of': 'of {qty}',
  'budget.noListItem': 'No list item',
  'budget.listItem': 'List item: {name}',
  'budget.decreaseBought': 'Decrease quantity bought',
  'budget.increaseBought': 'Increase quantity bought',
  'budget.addToListA11y': 'Also add to shopping list',
  'budget.addToList': 'Add “{name}” to shopping list',
  'budget.expense': 'Expense',
  'budget.removeExpense': 'Remove {name}',
  'budget.limit': 'Limit {amount}',

  // Settle up
  'settle.allSquare': "You're all square",
  'settle.owesYou': '{name} owes you {amount}',
  'settle.youOwe': 'You owe {name} {amount}',
  'settle.lastSettled': 'Last settled {date}',
  'settle.settle': 'Settle',
  'settle.markSettled': 'Mark as settled',
  'settle.yourPartner': 'Your partner',

  // Categories
  'cat.title': 'Categories',
  'cat.namePlaceholder': 'Category name',
  'cat.limitPlaceholder': 'Monthly limit (optional)',
  'cat.limitA11y': 'Monthly limit',
  'cat.add': 'Add',
  'cat.addCategory': 'Add category',
  'cat.emptyTitle': 'No categories yet',
  'cat.emptyHint': 'Add one above to tag your expenses and set monthly limits.',
  'cat.limitShort': 'Limit',
  'cat.limitFor': 'Monthly limit for {name}',
  'cat.changeIcon': 'Change icon for {name}',
  'cat.removeCategory': 'Remove {name}',
  'cat.color': 'Color {color}',
  'cat.icon': 'Icon {icon}',

  // Settings
  'settings.title': 'Settings',
  'settings.account': 'ACCOUNT',
  'settings.language': 'LANGUAGE',
  'settings.leave': 'Leave household',
  'settings.leaveDesc': 'Exit this household and return to setup.',
  'settings.delete': 'Delete account',
  'settings.deleteDesc': 'Permanently delete your account and your data.',
  'settings.leaveTitle': 'Leave household?',
  'settings.leaveSolo': 'This deletes the household and everything in it. This cannot be undone.',
  'settings.leaveCouple':
    "Your budget entries, settlements and receipts in this household will be deleted, and it stays with your partner. This can't be undone.",
  'settings.leaveCancel': 'Cancel',
  'settings.leaveConfirm': 'Leave',
  'settings.deleteTitle': 'Delete account?',
  'settings.deleteBody':
    'This permanently deletes your account and your data. This cannot be undone.',
  'settings.deleteConfirm': 'Delete account',
  'settings.leaveFailed': 'Could not leave',
  'settings.deleteFailed': 'Could not delete account',

  // First-run explainer
  'intro.title': 'How this works',
  'intro.oursTitle': 'Ours & Mine',
  'intro.oursBody':
    'Tag each expense as Ours (shared, split 50/50) or Mine (private). The budget keeps them apart and shows who owes whom.',
  'intro.listTitle': 'A shared shopping list',
  'intro.listBody':
    'Add what you need — item, quantity, aisle. It updates live on both phones, no price needed.',
  'intro.linkTitle': 'List meets budget',
  'intro.linkBody':
    'Bought something? Log it in Budget and it ticks off your list. Buy fewer than planned and the rest stays.',
  'intro.gotIt': 'Got it',

  // Grocery aisle labels (keyed by GroceryCategoryKey)
  'grocery.produce': 'Vegetables',
  'grocery.fruit': 'Fruit',
  'grocery.dairy': 'Dairy & Eggs',
  'grocery.bakery': 'Bakery',
  'grocery.meat': 'Meat & Fish',
  'grocery.frozen': 'Frozen',
  'grocery.pantry': 'Pantry',
  'grocery.snacks': 'Snacks & Sweets',
  'grocery.beverages': 'Beverages',
  'grocery.household': 'Household',
  'grocery.personal': 'Personal Care',
  'grocery.baby': 'Baby',
  'grocery.pets': 'Pets',
  'grocery.other': 'Other',

  // Common shopping items (keyed by a stable slug)
  'item.milk': 'Milk',
  'item.eggs': 'Eggs',
  'item.butter': 'Butter',
  'item.cheese': 'Cheese',
  'item.yogurt': 'Yogurt',
  'item.bread': 'Bread',
  'item.rolls': 'Rolls',
  'item.bananas': 'Bananas',
  'item.apples': 'Apples',
  'item.lemons': 'Lemons',
  'item.oranges': 'Oranges',
  'item.tomatoes': 'Tomatoes',
  'item.potatoes': 'Potatoes',
  'item.onions': 'Onions',
  'item.cucumber': 'Cucumber',
  'item.carrots': 'Carrots',
  'item.peppers': 'Peppers',
  'item.lettuce': 'Lettuce',
  'item.garlic': 'Garlic',
  'item.chicken': 'Chicken',
  'item.mincedmeat': 'Minced meat',
  'item.fish': 'Fish',
  'item.ham': 'Ham',
  'item.rice': 'Rice',
  'item.pasta': 'Pasta',
  'item.flour': 'Flour',
  'item.sugar': 'Sugar',
  'item.salt': 'Salt',
  'item.oil': 'Oil',
  'item.coffee': 'Coffee',
  'item.tea': 'Tea',
  'item.water': 'Water',
  'item.juice': 'Juice',
  'item.chocolate': 'Chocolate',
  'item.chips': 'Chips',
  'item.cookies': 'Cookies',
  'item.toiletpaper': 'Toilet paper',
  'item.papertowels': 'Paper towels',
  'item.dishsoap': 'Dish soap',
  'item.laundrydetergent': 'Laundry detergent',
  'item.trashbags': 'Trash bags',
  'item.shampoo': 'Shampoo',
  'item.toothpaste': 'Toothpaste',
  'item.soap': 'Soap',
};

const bg: Dict = {
  // Common / shared
  'common.back': 'Назад',
  'common.signOut': 'Изход',
  'common.tryAgain': 'Опитай пак',
  'common.done': 'Готово',
  'common.close': 'Затвори',
  'error.tapRetry': '{error} — докосни за нов опит',
  'error.enterCreds': 'Въведи имейл и парола.',
  'error.enterCode': 'Въведи {length}-символния код за покана.',
  'error.passwordShort': 'Паролата трябва да е поне {min} символа.',

  // Tabs
  'tab.home': 'Начало',
  'tab.list': 'Списък',
  'tab.budget': 'Бюджет',

  // Scope (Ours / Mine)
  'scope.ours': 'Общи',
  'scope.mine': 'Лични',
  'scope.prefix': 'Вид',

  // Sign in
  'signin.title': 'Добре дошъл отново',
  'signin.subtitle': 'Влез в общия си бюджет.',
  'signin.button': 'Вход',
  'signin.noAccount': 'Нямаш профил? ',
  'signin.createOne': 'Създай',
  'field.email': 'Имейл',
  'field.password': 'Парола',

  // Sign up
  'signup.title': 'Създай профил',
  'signup.subtitle': 'Започни общия си бюджет и списък за пазаруване.',
  'signup.button': 'Създай профил',
  'signup.checkTitle': 'Провери имейла си',
  'signup.checkBody':
    'Изпратихме връзка за потвърждение до {email}. Докосни я, за да завършиш регистрацията, и после влез.',
  'signup.backToSignin': 'Обратно към входа',
  'signup.haveAccount': 'Вече имаш профил? ',
  'signup.signin': 'Вход',
  'field.displayName': 'Име за показване',

  // Welcome / onboarding
  'welcome.title': 'Създай своето домакинство',
  'welcome.subtitle':
    'Домакинството свързва теб и партньора ти. Създай едно и сподели кода, или се присъедини с код, който вече имаш.',
  'welcome.create': 'Създай домакинство',
  'welcome.join': 'Присъедини се с код',

  // Create household
  'create.title': 'Създай домакинство',
  'create.subtitle':
    'Дай му име (или остави по подразбиране). Ще получиш код за покана, който да споделиш с партньора си.',
  'create.namePlaceholder': 'Име на домакинството (по избор)',
  'create.button': 'Създай домакинство',

  // Join household
  'join.title': 'Присъедини се към домакинство',
  'join.subtitle': 'Въведи 6-символния код, който партньорът ти сподели.',
  'join.button': 'Присъедини се',

  // Home
  'home.settings': 'Настройки',
  'home.greeting': 'Здравей, {name}',
  'home.shareCode': 'СПОДЕЛИ ТОЗИ КОД С ПАРТНЬОРА СИ',
  'home.waiting': 'Изчакване партньорът ти да се присъедини…',
  'home.regenerate': 'Нов код',
  'home.bothSetUp': 'Готови сте. Следва: общият ви списък за пазаруване и бюджет.',

  // Shopping list
  'list.title': 'Списък за пазаруване',
  'list.clearChecked': 'Изчисти отметнатите ({count})',
  'list.clearCheckedA11y': 'Изчисти отметнатите продукти',
  'list.addPlaceholder': 'Добави продукт…',
  'list.addItem': 'Добави продукт',
  'list.commonItems': '✨  Често купувани',
  'list.hideCommon': '✕  Скрий често купуваните',
  'list.browseCommon': 'Разгледай често купуваните',
  'list.emptyTitle': 'Списъкът ти е празен',
  'list.emptyHint': 'Добави продукт отгоре или докосни „Често купувани“, за да избереш от основните.',
  'list.addNamed': 'Добави {name}',
  'list.decrease': 'Намали {name}',
  'list.increase': 'Увеличи {name}',
  'list.remove': 'Премахни {name}',
  'common.retry': 'Нов опит',

  // Budget
  'budget.title': 'Бюджет',
  'budget.categories': 'Категории',
  'budget.manageCategories': 'Управление на категориите',
  'budget.thisMonth': 'този месец',
  'budget.descPlaceholder': 'За какво беше? (по избор)',
  'budget.addExpense': 'Добави разход',
  'budget.emptyTitle': 'Още няма разходи',
  'budget.emptyHint':
    'Добави какво си похарчил отгоре — отбележи го Общ, за да го разделите 50/50, или Личен, за да остане само твой.',
  'budget.categoryBudgets': 'БЮДЖЕТИ ПО КАТЕГОРИЯ · ТОЗИ МЕСЕЦ',
  'budget.none': 'Няма',
  'budget.forListItem': '🛒  ЗА ПРОДУКТ ОТ СПИСЪКА',
  'budget.bought': 'Купени',
  'budget.of': 'от {qty}',
  'budget.noListItem': 'Без продукт от списъка',
  'budget.listItem': 'Продукт: {name}',
  'budget.decreaseBought': 'Намали купеното количество',
  'budget.increaseBought': 'Увеличи купеното количество',
  'budget.addToListA11y': 'Добави и в списъка за пазаруване',
  'budget.addToList': 'Добави „{name}“ в списъка',
  'budget.expense': 'Разход',
  'budget.removeExpense': 'Премахни {name}',
  'budget.limit': 'Лимит {amount}',

  // Settle up
  'settle.allSquare': 'Няма задължения',
  'settle.owesYou': '{name} ти дължи {amount}',
  'settle.youOwe': 'Дължиш на {name} {amount}',
  'settle.lastSettled': 'Последно изравнено {date}',
  'settle.settle': 'Изравни',
  'settle.markSettled': 'Отбележи като изравнено',
  'settle.yourPartner': 'Партньорът ти',

  // Categories
  'cat.title': 'Категории',
  'cat.namePlaceholder': 'Име на категория',
  'cat.limitPlaceholder': 'Месечен лимит (по избор)',
  'cat.limitA11y': 'Месечен лимит',
  'cat.add': 'Добави',
  'cat.addCategory': 'Добави категория',
  'cat.emptyTitle': 'Още няма категории',
  'cat.emptyHint': 'Добави една отгоре, за да отбелязваш разходите си и да задаваш месечни лимити.',
  'cat.limitShort': 'Лимит',
  'cat.limitFor': 'Месечен лимит за {name}',
  'cat.changeIcon': 'Смени иконата за {name}',
  'cat.removeCategory': 'Премахни {name}',
  'cat.color': 'Цвят {color}',
  'cat.icon': 'Икона {icon}',

  // Settings
  'settings.title': 'Настройки',
  'settings.account': 'ПРОФИЛ',
  'settings.language': 'ЕЗИК',
  'settings.leave': 'Напусни домакинството',
  'settings.leaveDesc': 'Излез от това домакинство и се върни към настройката.',
  'settings.delete': 'Изтрий профила',
  'settings.deleteDesc': 'Изтрий безвъзвратно профила и данните си.',
  'settings.leaveTitle': 'Да напуснеш домакинството?',
  'settings.leaveSolo': 'Това изтрива домакинството и всичко в него. Действието е необратимо.',
  'settings.leaveCouple':
    'Твоите разходи, изравнявания и касови бележки в това домакинство ще бъдат изтрити, а то остава за партньора ти. Действието е необратимо.',
  'settings.leaveCancel': 'Отказ',
  'settings.leaveConfirm': 'Напусни',
  'settings.deleteTitle': 'Да изтрием профила?',
  'settings.deleteBody': 'Това изтрива безвъзвратно профила и данните ти. Действието е необратимо.',
  'settings.deleteConfirm': 'Изтрий профила',
  'settings.leaveFailed': 'Неуспешно напускане',
  'settings.deleteFailed': 'Неуспешно изтриване на профила',

  // First-run explainer
  'intro.title': 'Как работи',
  'intro.oursTitle': 'Общи и Лични',
  'intro.oursBody':
    'Отбелязвай всеки разход като Общ (споделен, разделен 50/50) или Личен (само твой). Бюджетът ги разделя и показва кой на кого дължи.',
  'intro.listTitle': 'Общ списък за пазаруване',
  'intro.listBody':
    'Добавяй каквото ти трябва — продукт, количество, раздел. Обновява се на живо и на двата телефона, без цена.',
  'intro.linkTitle': 'Списък и бюджет заедно',
  'intro.linkBody':
    'Купи ли нещо? Запиши го в Бюджет и то се отмята от списъка. Купиш ли по-малко, остатъкът остава.',
  'intro.gotIt': 'Разбрах',

  // Grocery aisle labels
  'grocery.produce': 'Зеленчуци',
  'grocery.fruit': 'Плодове',
  'grocery.dairy': 'Мляко и яйца',
  'grocery.bakery': 'Хляб и печива',
  'grocery.meat': 'Месо и риба',
  'grocery.frozen': 'Замразени',
  'grocery.pantry': 'Бакалия',
  'grocery.snacks': 'Закуски и сладки',
  'grocery.beverages': 'Напитки',
  'grocery.household': 'Домакински',
  'grocery.personal': 'Лична хигиена',
  'grocery.baby': 'Бебе',
  'grocery.pets': 'Домашни любимци',
  'grocery.other': 'Други',

  // Common shopping items
  'item.milk': 'Мляко',
  'item.eggs': 'Яйца',
  'item.butter': 'Масло',
  'item.cheese': 'Сирене',
  'item.yogurt': 'Кисело мляко',
  'item.bread': 'Хляб',
  'item.rolls': 'Хлебчета',
  'item.bananas': 'Банани',
  'item.apples': 'Ябълки',
  'item.lemons': 'Лимони',
  'item.oranges': 'Портокали',
  'item.tomatoes': 'Домати',
  'item.potatoes': 'Картофи',
  'item.onions': 'Лук',
  'item.cucumber': 'Краставици',
  'item.carrots': 'Моркови',
  'item.peppers': 'Чушки',
  'item.lettuce': 'Маруля',
  'item.garlic': 'Чесън',
  'item.chicken': 'Пиле',
  'item.mincedmeat': 'Кайма',
  'item.fish': 'Риба',
  'item.ham': 'Шунка',
  'item.rice': 'Ориз',
  'item.pasta': 'Макарони',
  'item.flour': 'Брашно',
  'item.sugar': 'Захар',
  'item.salt': 'Сол',
  'item.oil': 'Олио',
  'item.coffee': 'Кафе',
  'item.tea': 'Чай',
  'item.water': 'Вода',
  'item.juice': 'Сок',
  'item.chocolate': 'Шоколад',
  'item.chips': 'Чипс',
  'item.cookies': 'Бисквити',
  'item.toiletpaper': 'Тоалетна хартия',
  'item.papertowels': 'Кухненска хартия',
  'item.dishsoap': 'Препарат за съдове',
  'item.laundrydetergent': 'Прах за пране',
  'item.trashbags': 'Торби за боклук',
  'item.shampoo': 'Шампоан',
  'item.toothpaste': 'Паста за зъби',
  'item.soap': 'Сапун',
};

export const translations: Record<Lang, Dict> = { en, bg };

export function isLang(v: string | null | undefined): v is Lang {
  return v === 'bg' || v === 'en';
}

/**
 * Look up a key for the given language, filling `{token}` placeholders. Falls
 * back to English, then to the raw key, so a missing translation degrades
 * visibly rather than crashing.
 */
export function translate(
  lang: Lang,
  key: string,
  params?: Record<string, string | number>
): string {
  let s = translations[lang]?.[key] ?? en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}
