// How shopping-list words map onto the state's official product groups.
//
// КЗП's price data tags every product with one of 101 numbered groups from the
// "голяма потребителска кошница" (1–85 groceries & household goods, then
// medicines). Matching a list item to a *group* — not fuzzy text — is what keeps
// "масло" (butter) away from motor oil and "лук" away from луканка.
//
// Each concept lists the words a person might type (Bulgarian + English) and the
// groups they mean. `stems` is a sanity check on the chains' own filing: a
// product must contain one of them to count (e.g. a tomato must say "домат"),
// so a product a chain misfiled into the group can't show up as a "deal".
// An empty `stems` means the group is narrow enough to trust as-is.
//
// Deliberately absent: group 78 (tobacco — advertising ban; never imported) and
// the medicine groups. Items with no concept here simply never get a badge.

export type Concept = {
  groups: number[];
  bg: string[];
  en?: string[];
  stems: string[];
};

/** Groups the ingest job keeps. Tobacco (78) and medicines (86+) are dropped. */
export function isImportedGroup(code: number): boolean {
  return Number.isInteger(code) && code >= 1 && code <= 85 && code !== 78;
}

export const CONCEPTS: Concept[] = [
  // Bread & dough (1–5)
  { groups: [1, 2, 3, 4], bg: ['хляб'], en: ['bread'], stems: ['хляб', 'добруджа'] },
  { groups: [1], bg: ['бял хляб'], en: ['white bread'], stems: ['хляб'] },
  { groups: [2], bg: ['хляб добруджа', 'добруджа'], stems: ['добруджа'] },
  { groups: [3], bg: ['ръжен хляб'], en: ['rye bread'], stems: ['ръж'] },
  { groups: [4], bg: ['типов хляб'], stems: ['типов'] },
  { groups: [5], bg: ['точени кори', 'кори за баница', 'кори'], en: ['filo', 'phyllo'], stems: ['кори'] },

  // Dairy & eggs (6–14, 31–32)
  { groups: [6], bg: ['мляко', 'прясно мляко'], en: ['milk', 'fresh milk'], stems: ['мляк'] },
  { groups: [7], bg: ['кисело мляко'], en: ['yogurt', 'yoghurt'], stems: ['мляк'] },
  { groups: [8, 9], bg: ['сирене', 'бяло сирене', 'краве сирене'], en: ['cheese', 'white cheese', 'feta'], stems: ['сирен'] },
  { groups: [10, 11], bg: ['кашкавал'], en: ['yellow cheese', 'kashkaval'], stems: ['кашкавал'] },
  { groups: [12], bg: ['масло', 'краве масло'], en: ['butter'], stems: ['масло'] },
  { groups: [13, 14], bg: ['извара'], en: ['cottage cheese', 'curd'], stems: ['извара'] },
  { groups: [31, 32], bg: ['яйца', 'яйце'], en: ['eggs', 'egg'], stems: ['яйц'] },

  // Meat & fish (15–30)
  { groups: [15, 16, 17], bg: ['пиле', 'пилешко', 'пилешко месо'], en: ['chicken'], stems: ['пил'] },
  { groups: [15], bg: ['цяло пиле'], en: ['whole chicken'], stems: ['пил'] },
  { groups: [16], bg: ['пилешко филе', 'пилешки гърди'], en: ['chicken breast', 'chicken fillet'], stems: ['филе'] },
  { groups: [17], bg: ['пилешки бут', 'пилешки бутчета', 'бутчета'], en: ['chicken legs', 'chicken thighs', 'drumsticks'], stems: ['бут'] },
  { groups: [18, 19, 20, 21, 22], bg: ['свинско', 'свинско месо'], en: ['pork'], stems: ['свин'] },
  { groups: [18], bg: ['свинска плешка', 'плешка'], en: ['pork shoulder'], stems: ['плешка'] },
  { groups: [19], bg: ['свински бут'], en: ['pork leg'], stems: ['бут'] },
  { groups: [20], bg: ['свински шол'], en: ['pork loin'], stems: ['шол'] },
  { groups: [21], bg: ['свински врат', 'врат'], en: ['pork neck'], stems: ['врат'] },
  { groups: [23, 24], bg: ['телешко', 'телешко месо'], en: ['beef', 'veal'], stems: ['телеш'] },
  { groups: [25], bg: ['кайма', 'мляно месо'], en: ['minced meat', 'mince', 'ground meat'], stems: ['кайма', 'мляно'] },
  { groups: [26], bg: ['кренвирши', 'кренвирш'], en: ['hot dogs', 'frankfurters', 'wieners'], stems: ['кренвирш'] },
  { groups: [27, 28], bg: ['колбас', 'колбаси'], en: ['sausage', 'sausages'], stems: [] },
  { groups: [27, 28], bg: ['шунка'], en: ['ham'], stems: ['шунк'] },
  { groups: [27, 28], bg: ['салам'], en: ['salami'], stems: ['салам'] },
  { groups: [27], bg: ['наденица'], stems: ['надениц'] },
  { groups: [28], bg: ['луканка'], stems: ['луканк'] },
  { groups: [28], bg: ['суджук'], stems: ['суджук'] },
  { groups: [28], bg: ['шпек'], stems: ['шпек'] },
  { groups: [29, 30], bg: ['риба'], en: ['fish'], stems: [] },
  { groups: [29, 30], bg: ['скумрия'], en: ['mackerel'], stems: ['скумри'] },
  { groups: [29, 30], bg: ['пъстърва'], en: ['trout'], stems: ['пъстърв'] },
  { groups: [29, 30], bg: ['лаврак'], en: ['sea bass'], stems: ['лаврак'] },
  { groups: [29, 30], bg: ['ципура'], en: ['sea bream'], stems: ['ципур'] },

  // Pantry (33–49)
  { groups: [33], bg: ['боб'], en: ['beans'], stems: ['боб'] },
  { groups: [34], bg: ['леща'], en: ['lentils'], stems: ['леща'] },
  { groups: [35], bg: ['ориз'], en: ['rice'], stems: ['ориз'] },
  { groups: [36, 37], bg: ['макарони', 'паста'], en: ['pasta', 'macaroni'], stems: [] },
  { groups: [37], bg: ['спагети'], en: ['spaghetti'], stems: ['спагет'] },
  { groups: [38], bg: ['захар'], en: ['sugar'], stems: ['захар'] },
  { groups: [39], bg: ['сол'], en: ['salt'], stems: ['сол'] },
  { groups: [40, 41], bg: ['брашно'], en: ['flour'], stems: ['брашн'] },
  { groups: [42], bg: ['олио', 'слънчогледово олио'], en: ['oil', 'sunflower oil', 'cooking oil'], stems: ['олио'] },
  { groups: [43], bg: ['зехтин'], en: ['olive oil'], stems: ['зехтин'] },
  { groups: [44, 45], bg: ['оцет'], en: ['vinegar'], stems: ['оцет'] },
  { groups: [44], bg: ['винен оцет'], en: ['wine vinegar'], stems: ['оцет'] },
  { groups: [45], bg: ['ябълков оцет'], en: ['apple cider vinegar', 'cider vinegar'], stems: ['оцет'] },
  { groups: [46], bg: ['боб консерва', 'консервиран боб'], en: ['canned beans'], stems: ['боб'] },
  { groups: [47], bg: ['грах', 'грах консерва'], en: ['peas', 'canned peas'], stems: ['грах'] },
  { groups: [48], bg: ['консервирани домати', 'домати консерва', 'белени домати'], en: ['canned tomatoes', 'chopped tomatoes'], stems: ['домат'] },
  { groups: [49], bg: ['лютеница'], en: ['lyutenitsa'], stems: ['лютениц'] },

  // Fruit & vegetables (50–62)
  { groups: [50], bg: ['лимони', 'лимон'], en: ['lemons', 'lemon'], stems: ['лимон'] },
  { groups: [51], bg: ['портокали', 'портокал'], en: ['oranges', 'orange'], stems: ['портокал'] },
  { groups: [52], bg: ['банани', 'банан'], en: ['bananas', 'banana'], stems: ['банан'] },
  { groups: [53], bg: ['ябълки', 'ябълка'], en: ['apples', 'apple'], stems: ['ябълк'] },
  { groups: [54], bg: ['домати', 'домат'], en: ['tomatoes', 'tomato'], stems: ['домат'] },
  { groups: [55], bg: ['лук', 'кромид лук', 'кромид'], en: ['onions', 'onion'], stems: ['лук', 'кромид'] },
  { groups: [56], bg: ['моркови', 'морков'], en: ['carrots', 'carrot'], stems: ['морков'] },
  { groups: [57], bg: ['зеле', 'бяло зеле'], en: ['cabbage'], stems: ['зеле'] },
  { groups: [58], bg: ['краставици', 'краставица'], en: ['cucumber', 'cucumbers'], stems: ['краставиц'] },
  { groups: [59], bg: ['чесън'], en: ['garlic'], stems: ['чесън'] },
  { groups: [60], bg: ['гъби'], en: ['mushrooms'], stems: ['гъби'] },
  { groups: [61], bg: ['картофи', 'картоф'], en: ['potatoes', 'potato'], stems: ['картоф'] },
  { groups: [62], bg: ['маслини'], en: ['olives'], stems: ['маслин'] },

  // Baby, bakery & sweets (63–69)
  { groups: [63], bg: ['каша', 'бебешка каша'], en: ['baby cereal'], stems: ['каша'] },
  { groups: [64], bg: ['детско пюре', 'бебешко пюре'], en: ['baby food'], stems: ['пюре'] },
  { groups: [65], bg: ['адаптирано мляко'], en: ['baby formula', 'formula'], stems: [] },
  { groups: [66], bg: ['бисквити'], en: ['cookies', 'biscuits'], stems: ['бисквит'] },
  { groups: [67], bg: ['кроасани', 'кроасан'], en: ['croissants', 'croissant'], stems: ['кроасан'] },
  { groups: [68], bg: ['баница'], stems: ['баниц'] },
  { groups: [69], bg: ['шоколад'], en: ['chocolate'], stems: ['шоколад'] },

  // Drinks (70–77)
  { groups: [70, 71], bg: ['кафе'], en: ['coffee'], stems: ['кафе'] },
  { groups: [70], bg: ['мляно кафе'], en: ['ground coffee'], stems: ['кафе'] },
  { groups: [71], bg: ['кафе на зърна'], en: ['coffee beans'], stems: ['кафе'] },
  { groups: [72], bg: ['чай'], en: ['tea'], stems: ['чай'] },
  { groups: [73], bg: ['вода', 'минерална вода'], en: ['water', 'mineral water'], stems: ['вода'] },
  { groups: [74], bg: ['бира'], en: ['beer'], stems: ['бира'] },
  { groups: [75, 76], bg: ['вино'], en: ['wine'], stems: ['вино'] },
  { groups: [75], bg: ['бяло вино'], en: ['white wine'], stems: ['вино'] },
  { groups: [76], bg: ['червено вино'], en: ['red wine'], stems: ['вино'] },
  { groups: [77], bg: ['ракия'], en: ['rakia'], stems: ['ракия'] },

  // Household & personal care (79–85)
  { groups: [79], bg: ['препарат за съдове', 'веро'], en: ['dish soap', 'washing-up liquid', 'dishwashing liquid'], stems: [] },
  { groups: [80], bg: ['четка за зъби'], en: ['toothbrush'], stems: ['четка'] },
  { groups: [81], bg: ['паста за зъби'], en: ['toothpaste'], stems: ['паст'] },
  { groups: [82], bg: ['шампоан'], en: ['shampoo'], stems: ['шампоан'] },
  { groups: [83], bg: ['сапун'], en: ['soap'], stems: ['сапун'] },
  { groups: [84], bg: ['мокри кърпи', 'мокри кърпички'], en: ['wet wipes'], stems: ['кърп'] },
  { groups: [85], bg: ['тоалетна хартия'], en: ['toilet paper'], stems: ['хартия'] },
];
