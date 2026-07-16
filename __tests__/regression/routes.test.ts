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

  it('registers the categories, receipt and settings modals at the (app) level (siblings of the tabs)', () => {
    const files = fs.readdirSync(appDir);
    expect(files).toContain('categories.tsx');
    expect(files).toContain('receipt.tsx');
    expect(files).toContain('settings.tsx');
  });
});
