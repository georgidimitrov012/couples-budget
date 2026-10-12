// The supermarket chains whose prices we import. `eik` is the company's
// registration number (ЕИК): the КЗП open-data archive names each chain's file
// "<name>_<eik>.csv", and the number is the stable part of that name.
//
// Display names are plain text on purpose — no chain logos (they're trademarks).

export type ChainId = 'lidl' | 'kaufland' | 'billa' | 'fantastico' | 'tmarket';

export type Chain = { id: ChainId; name: string; eik: string };

export const CHAINS: Chain[] = [
  { id: 'lidl', name: 'Lidl', eik: '131071587' },
  { id: 'kaufland', name: 'Kaufland', eik: '131129282' },
  { id: 'billa', name: 'Billa', eik: '130007884' },
  { id: 'fantastico', name: 'Fantastico', eik: '206255903' },
  { id: 'tmarket', name: 'T Market', eik: '131324923' },
];

export function chainName(id: string): string {
  return CHAINS.find((c) => c.id === id)?.name ?? id;
}
