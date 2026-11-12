// Public addresses of the shop: /shop and one page per product, /shop/p/<id>-<slug>.
// The API builds the same slug (PFA-BACKEND/app/services/shop_urls.py) and serves these pages
// with their title, description and link preview; keep the two in step.

export const SHOP_ORIGIN = 'https://asaaspro.com';
const SLUG_MAX = 60;

// 'Dymatize ISO100 – 1,37 kg' -> 'dymatize-iso100-1-37-kg': no accents, lower case, dashes.
export const slugify = (name) => {
  let slug = (name || '')
    .normalize('NFKD')
    .replace(/[^\x00-\x7f]/g, '') // eslint-disable-line no-control-regex
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length > SLUG_MAX) {
    slug = slug.slice(0, SLUG_MAX);
    if (slug.includes('-')) slug = slug.slice(0, slug.lastIndexOf('-'));
  }
  return slug;
};

export const productPath = (p) => {
  const slug = slugify(p.name);
  return slug ? `/shop/p/${p.id}-${slug}` : `/shop/p/${p.id}`;
};

// The shop's own domain, so a link shared from the staff app still opens the public shop.
export const productLink = (p) => `${SHOP_ORIGIN}${productPath(p)}`;

// The product asked for by the address: /shop/p/12-whey (now) or /shop?p=12 (old links).
export const linkedProductId = (location) => {
  const match = location.pathname.match(/^\/shop\/p\/(\d+)/);
  if (match) return Number(match[1]);
  const old = new URLSearchParams(location.search).get('p');
  return old && /^\d+$/.test(old) ? Number(old) : null;
};

// The address's query without the old ?p=, e.g. to keep ?utm_source=facebook.
export const queryWithoutProduct = (search) => {
  const params = new URLSearchParams(search);
  params.delete('p');
  const rest = params.toString();
  return rest ? `?${rest}` : '';
};
