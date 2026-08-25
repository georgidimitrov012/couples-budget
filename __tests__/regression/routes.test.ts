import fs from 'fs';
import path from 'path';

const appDir = path.join(__dirname, '..', '..', 'src', 'app', '(app)');

// Regression: onboarding's landing screen is `welcome`, not `index`. An `index`
// here would resolve to `/` and collide with the tabs' home route, which broke
// the Expo Router route tree.
describe('route structure', () => {
  it('onboarding uses welcome (no index) so it does not collide with the tabs /', () => {
    const files = fs.readdirSync(path.join(appDir, '(onboarding)'));
    expect(files).toContain('welcome.tsx');
    expect(files).not.toContain('index.tsx');
  });

  it('the tabs group owns index (/), the shopping list, and the budget', () => {
    const files = fs.readdirSync(path.join(appDir, '(tabs)'));
    expect(files).toContain('index.tsx');
    expect(files).toContain('list.tsx');
    expect(files).toContain('budget.tsx');
    // The template Explore tab was replaced by the shopping list.
    expect(files).not.toContain('explore.tsx');
  });

  it('registers the categories, recurring, receipt, settings and stats modals at the (app) level (siblings of the tabs)', () => {
    const files = fs.readdirSync(appDir);
    expect(files).toContain('categories.tsx');
    expect(files).toContain('recurring.tsx');
    expect(files).toContain('receipt.tsx');
    expect(files).toContain('settings.tsx');
    expect(files).toContain('stats.tsx');
  });

  // Regression: receipt scanning was shelved by deleting its entry-point Link
  // from the List tab (1ef1709). The screen, its route registration and the whole
  // backend stayed in place, so nothing failed — the feature was simply invisible
  // in the app for weeks. Existing-file checks can't catch that; a screen is only
  // "shipped" if something navigates to it.
  it('keeps a reachable entry point to the receipt scanner on the List tab', () => {
    const list = fs.readFileSync(path.join(appDir, '(tabs)', 'list.tsx'), 'utf8');
    expect(list).toMatch(/href=["']\/receipt["']/);
  });

  it('registers every (app)-level modal it links to in the stack', () => {
    const layout = fs.readFileSync(path.join(appDir, '_layout.tsx'), 'utf8');
    for (const route of ['categories', 'recurring', 'receipt', 'settings', 'stats']) {
      expect(layout).toContain(`name="${route}"`);
    }
  });
});
