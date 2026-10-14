# Device checklist

A ~15-minute pass on a real phone before merging anything that changes the UI. Most bugs that
reach a device sit *between* features (List ↔ Budget, Bulgarian ↔ English), where unit tests
don't look — so this walks the joins. Tick through it in **Bulgarian first**, then repeat the
starred (★) steps in English.

## Accounts
- [ ] Sign up with an empty name / a bad email (`test@x`) / a 5-character password / two
      different passwords → each shows its own clear message, nothing is created.
- [ ] Sign up again with an email that already has an account → "Вече има профил с този имейл".
- [ ] Sign in with a wrong password → "Грешен имейл или парола" (not English).
- [ ] **Забравена парола?** → email → code arrives → enter code + new password → signed in →
      sign out → sign in with the new password works. A wrong code says it's wrong/expired.

## Shopping list ★
- [ ] Add items from **Често купувани**: the "Добавени в списъка: N" count rises; **✓ Готово**
      and the phone's back button both return to the list.
- [ ] Type an item that's already listed (also in the other language: "Carrots" with "Моркови"
      on the list) → its quantity goes up, no second row.
- [ ] Switch language (Settings) → every common item on the list switches too; your own text
      stays as typed.
- [ ] Deals badge on a common item; tap it → one row per chain, "Всички N продукта ›" opens a
      chain and "‹ Всички вериги" comes back. No badge for a tiny (<10%) discount.

## Budget ★
- [ ] Title "Бюджет" fully visible; Статистика / Категории / Повтарящи се in a row below it.
- [ ] With "Моркови" on the list, add an expense "Carrots" → the note "Съвпада с „Моркови“…"
      appears → save → Моркови is ticked off on the list.
- [ ] Same, but tap **Няма** first → the item stays on the list.
- [ ] Off-list expense with "Запиши … и в списъка като купено" ticked → appears on the list as
      bought (ticked).
- [ ] Date row: ‹ goes to Вчера; › is disabled at Днес. Save → the expense has that date.
- [ ] Go to last month with ‹ in the month switcher → the form is there, date = last day of
      that month → save → it shows in that month and its totals.
- [ ] Edit an expense → change its date → it moves to the right day/month.

## Everywhere
- [ ] No title or button cut off, on every screen, in both languages.
- [ ] Airplane mode on a list/budget screen → banner + retry, nothing crashes.
