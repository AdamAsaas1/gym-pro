// Shop search engine: every word must match, accents and case ignored, small typos forgiven,
// common French / English / Arabic product words treated as synonyms, best matches first.

// Arabic short vowels, Quranic marks and the tatweel stretch.
const ARABIC_MARKS = /[ؐ-ًؚ-ٰٟـ]/g;
const NOT_LETTER = /[^a-z0-9؀-ۿ]+/;
// Little words that carry no meaning in a product search ("prise de masse" -> "prise masse").
const STOPWORDS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'et', 'en', 'pour', 'au', 'aux', 'of', 'the', 'for', 'and', 'with', 'avec']);

// One comparable form per word: no accents, lower case, Arabic letter variants folded.
export const fold = (s) => (s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(ARABIC_MARKS, '')
  .replace(/[آأإٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

export const words = (s) => fold(s).split(NOT_LETTER).filter(Boolean);
const compact = (s) => words(s).join('');

const SYNONYM_GROUPS = [
  ['whey', 'proteine', 'proteines', 'protein', 'proteins', 'isolate', 'isolat', 'بروتين', 'واي'],
  ['creatine', 'creatin', 'kreatin', 'كرياتين'],
  ['gainer', 'gainers', 'masse', 'prise', 'mass', 'grossir', 'ماس', 'جينر', 'جاينر'],
  ['preworkout', 'booster', 'pump', 'energie', 'energy', 'طاقه'],
  ['vitamine', 'vitamines', 'vitamin', 'vitamins', 'multivitamine', 'multivitamin', 'فيتامين', 'فيتامينات'],
  ['omega', 'omega3', 'fish', 'اوميغا', 'اوميجا'],
  ['bcaa', 'eaa', 'amino', 'aminos', 'glutamine', 'امينو'],
  ['collagene', 'collagen', 'كولاجين'],
  ['magnesium', 'مغنيسيوم'],
  ['zinc', 'زنك'],
  ['bruleur', 'burner', 'carnitine', 'fatburner', 'minceur', 'حارق'],
  ['chocolat', 'chocolate', 'choco', 'cacao', 'شوكولا', 'شوكولاته'],
  ['vanille', 'vanilla', 'فانيلا'],
  ['fraise', 'strawberry', 'فراوله'],
  ['gants', 'gant', 'gloves', 'glove', 'قفازات'],
  ['ceinture', 'belt', 'حزام'],
  ['shaker', 'شيكر'],
  ['tshirt', 'teeshirt', 'maillot', 'تيشيرت'],
].map((g) => g.map((w) => compact(w)));

const SYNONYMS = new Map();
SYNONYM_GROUPS.forEach((g) => g.forEach((w) => SYNONYMS.set(w, g)));

// Edit distance with swapped letters counted once ("protien" → "protein" is one slip).
export function distance(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}
const tolerance = (w) => (w.length >= 7 ? 2 : w.length >= 4 ? 1 : 0);

// The words a typed word can stand for: itself, its synonyms, or the synonyms of what it was probably meant to be.
function alternatives(token) {
  const group = SYNONYMS.get(token)
    || (token.length >= 5 && SYNONYM_GROUPS.find((g) => g.some((w) => distance(w, token, 1) <= 1)));
  return group ? [token, ...group.filter((w) => w !== token)] : [token];
}

const queryTokens = (q) => words(q).filter((w) => !STOPWORDS.has(w) && (w.length > 1 || /\d/.test(w)));

function scoreToken(token, idx) {
  const alts = alternatives(token);
  let best = 0;
  let variant = null;
  alts.forEach((a, i) => {
    const weight = i === 0 ? 1 : 0.8;
    let s = 0;
    if (idx.name.includes(a)) s = 10;
    else if (idx.name.some((w) => w.startsWith(a))) s = 8;
    else if (a.length >= 3 && idx.nameCompact.includes(a)) s = 6;
    else if (i === 0 && tolerance(a) && idx.name.some((w) => distance(w, a, tolerance(a)) <= tolerance(a))) s = 4;
    const v = idx.variants.find((x) => x.words.some((w) => w.startsWith(a)));
    if (v && 5 > s) { s = 5; variant = v.variant; }
    if (!s && idx.category.some((w) => w.startsWith(a))) s = 3;
    if (!s && a.length >= 3 && idx.description.some((w) => w.startsWith(a))) s = 2;
    if (s * weight > best) best = s * weight;
  });
  return { score: best, variant };
}

// Built once per product list and language: the words each product can be found by.
export function createSearch(products, catLabel) {
  const index = products.map((p) => ({
    p,
    name: words(p.name),
    nameCompact: compact(p.name),
    category: words(`${p.category || ''} ${catLabel(p.category) || ''}`),
    description: words(p.description),
    variants: (p.variants || []).map((v) => ({ variant: v, words: words(v.name) })),
  }));
  const vocabulary = [...new Set(index.flatMap((i) => i.name).filter((w) => w.length >= 3 && !/^\d+$/.test(w)))];

  const search = (q) => {
    const tokens = queryTokens(q);
    if (!tokens.length) return [];
    const phrase = compact(q);
    const results = [];
    index.forEach((idx) => {
      let total = 0;
      let variant = null;
      for (const tk of tokens) {
        const r = scoreToken(tk, idx);
        if (!r.score) return;
        total += r.score;
        variant = variant || r.variant;
      }
      if (idx.nameCompact.startsWith(phrase)) total += 8;
      else if (idx.nameCompact.includes(phrase)) total += 5;
      if (idx.p.in_stock) total += 2;
      results.push({ p: idx.p, score: total, variant });
    });
    return results.sort((a, b) => b.score - a.score);
  };

  // "Did you mean": each unknown word swapped for the closest word of a product name.
  const suggest = (q) => {
    const tokens = queryTokens(q);
    let changed = false;
    const fixed = tokens.map((tk) => {
      if (vocabulary.includes(tk) || SYNONYMS.has(tk)) return tk;
      let best = null;
      let bestD = 3;
      vocabulary.forEach((w) => {
        const d = distance(w, tk, 2);
        if (d < bestD && d <= Math.max(1, tolerance(tk) + 1)) { best = w; bestD = d; }
      });
      if (best) { changed = true; return best; }
      return tk;
    });
    const next = fixed.join(' ');
    return changed && search(next).length ? next : null;
  };

  return { search, suggest };
}

// Splits text into plain and matched parts so the typed words can be highlighted in a product name.
export function highlight(text, q) {
  const tokens = queryTokens(q).flatMap((tk) => alternatives(tk)).filter((w) => w.length >= 2);
  if (!text || !tokens.length) return [{ text, hit: false }];
  let folded = '';
  const origin = [];
  [...text].forEach((ch, i) => {
    const f = fold(ch).replace(new RegExp(NOT_LETTER.source, 'g'), '');
    for (const c of f) { folded += c; origin.push(i); }
  });
  const chars = [...text];
  const hit = new Array(chars.length).fill(false);
  tokens.forEach((tk) => {
    let at = folded.indexOf(tk);
    while (at !== -1) {
      for (let k = at; k < at + tk.length; k++) hit[origin[k]] = true;
      at = folded.indexOf(tk, at + tk.length);
    }
  });
  // Spaces between two highlighted letters belong to the same highlight.
  for (let i = 1; i < chars.length - 1; i++) if (!hit[i] && /\s/.test(chars[i]) && hit[i - 1] && hit[i + 1]) hit[i] = true;
  const parts = [];
  chars.forEach((ch, i) => {
    const last = parts[parts.length - 1];
    if (last && last.hit === hit[i]) last.text += ch; else parts.push({ text: ch, hit: hit[i] });
  });
  return parts;
}
