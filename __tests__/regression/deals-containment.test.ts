// The supermarket-deals feature must stay removable in one sitting (docs/DEALS.md):
// all its code lives in src/features/deals, and the rest of the app touches it
// only through the List tab, via the feature's index. If this fails, a new
// dependency on the feature crept in — route it through the List tab or update
// the removal steps in docs/DEALS.md together with this allow-list.

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

const ROOT = join(__dirname, '..', '..');
const FEATURE = join('src', 'features', 'deals');
const ALLOWED = [join('src', 'app', '(app)', '(tabs)', 'list.tsx')];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(path);
  }
  return out;
}

const appFiles = ['src', 'lib', 'hooks'].flatMap((d) => walk(join(ROOT, d))).map((p) => relative(ROOT, p));

describe('deals feature containment', () => {
  it('only the List tab depends on the deals feature', () => {
    const dependents = appFiles.filter(
      (p) => !p.startsWith(FEATURE + sep) && /features\/deals/.test(readFileSync(join(ROOT, p), 'utf8'))
    );
    expect(dependents).toEqual(ALLOWED);
  });

  it('the List tab imports it through the index, not its internals', () => {
    const src = readFileSync(join(ROOT, ALLOWED[0]), 'utf8');
    expect(src).toMatch(/from '@\/features\/deals'/);
    expect(src).not.toMatch(/features\/deals\/\w/);
  });

  it('the price job is manual-only during development and obeys the switch', () => {
    const workflow = readFileSync(join(ROOT, '.github', 'workflows', 'deals-ingest.yml'), 'utf8');
    expect(workflow).toMatch(/workflow_dispatch:/);
    // At launch, uncomment the schedule and update this expectation (docs/DEALS.md).
    expect(workflow).not.toMatch(/^\s*schedule:/m);

    const job = readFileSync(join(ROOT, FEATURE, 'ingest', 'run.mjs'), 'utf8');
    expect(job).toMatch(/feature_flags\?key=eq\.deals/);
  });
});
