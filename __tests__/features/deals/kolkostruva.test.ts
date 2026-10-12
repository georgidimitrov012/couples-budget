import { isImportedGroup } from '@/features/deals/groups';
import { cleanName, collapseChain, parseCsv, parsePrice } from '@/features/deals/ingest/kolkostruva';

const HEADER =
  'Населено място,Търговски обект,Наименование на продукта,Код на продукта,Категория,Цена на дребно,Цена в промоция';

describe('parseCsv', () => {
  it('handles a BOM, quoted commas, escaped quotes and CRLF', () => {
    const text = '﻿a,b,c\r\n"София, ул. 1","say ""hi""",3\r\n';
    expect(parseCsv(text)).toEqual([
      ['a', 'b', 'c'],
      ['София, ул. 1', 'say "hi"', '3'],
    ]);
  });

  it('keeps a newline inside quotes and drops blank lines', () => {
    expect(parseCsv('x,"two\nlines"\n\n\ny,z')).toEqual([
      ['x', 'two\nlines'],
      ['y', 'z'],
    ]);
  });
});

describe('parsePrice', () => {
  it('reads both decimal styles', () => {
    expect(parsePrice('1,29')).toBe(1.29);
    expect(parsePrice(' 2.35 ')).toBe(2.35);
  });

  it('treats empty, zero (Kaufland’s "no promo") and junk as no price', () => {
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('0')).toBeNull();
    expect(parsePrice('n/a')).toBeNull();
    expect(parsePrice(undefined)).toBeNull();
  });
});

describe('cleanName', () => {
  it("tidies Billa's ALL-CAPS names but keeps Latin brands", () => {
    expect(cleanName('053 ПУЕШКО ФИЛЕ СЛАЙС КФМ 160Г')).toBe('Пуешко филе слайс кфм 160г');
    expect(cleanName('КИСЕЛО МЛЯКО 2% 400Г BILLA')).toBe('Кисело мляко 2% 400г BILLA');
  });

  it('leaves normally-cased names alone (including leading numbers)', () => {
    expect(cleanName('Terter Кисело мляко краве 2,9%')).toBe('Terter Кисело мляко краве 2,9%');
    expect(cleanName('100 бр Салфетки')).toBe('100 бр Салфетки');
  });
});

describe('collapseChain', () => {
  const store = (n: number) => `Магазин ${n}`;
  function table(rows: string[][]) {
    return parseCsv([HEADER, ...rows.map((r) => r.map((f) => `"${f}"`).join(','))].join('\n'));
  }

  it('collapses per-store rows into one product with promo share', () => {
    const t = table([
      ['68134', store(1), 'Домати кг', 'K1', '54', '2.35', '1.29'],
      ['68134', store(2), 'Домати кг', 'K1', '54', '2.35', '1.29'],
      ['10135', store(3), 'Домати кг', 'K1', '54', '2.35', '0'],
      ['10135', store(4), 'Домати кг', 'K1', '54', '2.49', '1.29'],
    ]);
    expect(collapseChain(t, isImportedGroup)).toEqual([
      {
        product_code: 'K1',
        product_name: 'Домати кг',
        group_code: 54,
        retail_price: 2.35, // most common across stores
        promo_price: 1.29,
        promo_share: 0.75, // 3 of 4 stores
      },
    ]);
  });

  it('drops tobacco, unpriced rows, bogus promos and >90%-off typos', () => {
    const t = table([
      ['1', store(1), 'Цигари', 'T1', '78', '3.80', ''],
      ['1', store(1), 'Без цена', 'X1', '54', '', ''],
      ['1', store(1), 'Мляко', 'M1', '6', '1.20', '1.50'],
      ['1', store(1), 'Кисело мляко', 'Y1', '7', '1.37', '0.01'],
    ]);
    expect(collapseChain(t, isImportedGroup)).toEqual([
      { product_code: 'M1', product_name: 'Мляко', group_code: 6, retail_price: 1.2, promo_price: null, promo_share: 0 },
      { product_code: 'Y1', product_name: 'Кисело мляко', group_code: 7, retail_price: 1.37, promo_price: null, promo_share: 0 },
    ]);
  });

  it('keys products by name when a chain leaves the code empty', () => {
    const t = table([
      ['1', store(1), 'Банани', '', '52', '1.84', ''],
      ['1', store(2), 'Банани', '', '52', '1.84', ''],
    ]);
    expect(collapseChain(t, isImportedGroup)).toHaveLength(1);
  });

  it('finds columns by name, not position', () => {
    const shuffled = parseCsv(
      'Цена в промоция,Категория,Наименование на продукта,Цена на дребно,Код на продукта\n1.29,54,Домати кг,2.35,K1'
    );
    expect(collapseChain(shuffled, isImportedGroup)[0]).toMatchObject({ retail_price: 2.35, promo_price: 1.29 });
  });

  it('fails loudly when the file format changes', () => {
    expect(() => collapseChain(parseCsv('Име,Цена\nДомати,1'), isImportedGroup)).toThrow(/format changed/);
  });
});
