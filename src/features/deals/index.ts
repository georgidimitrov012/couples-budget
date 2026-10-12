// Supermarket deals — a self-contained, removable feature. See docs/DEALS.md.
// The rest of the app may import from this file only (enforced by
// __tests__/regression/deals-containment.test.ts).

export { DealBadge } from './DealBadge';
export { useDeals, type Deals, type ItemDeal } from './useDeals';
