import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ShoppingBag, Plus, Minus, X, Search, Truck, Store, Phone, MessageCircle, Instagram, Trash2, ChevronLeft, ArrowRight,
  Menu, MapPin, Heart, Share2, Check, Wallet, Dumbbell, Shirt, FlaskConical, LayoutGrid, Package, SlidersHorizontal, Clock3,
  ChevronRight, SearchX, CornerDownLeft, Gift,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getShopInfo, getShopProducts, getShopProduct, createShopOrder, trackShopOrder } from '../api/client';
import { linkedProductId, productLink, productPath, queryWithoutProduct } from './shopUrls';
import { createSearch, fold, highlight } from './shopSearch';
import './Shop.css';

const CART_KEY = 'asaas_shop_cart_v1';
const UTM_KEY = 'asaas_shop_utm_v1';
const FAV_KEY = 'asaas_shop_favs_v1';
const RECENT_KEY = 'asaas_shop_recent_v1';
const LAST_ORDER_KEY = 'asaas_shop_last_order_v1';
// The shop's brand. The gym's own name (ASAAS GYM) comes from the settings, in `info.name`.
const SHOP_NAME = 'ASAASpro';
const LANG_KEY = 'asaas_shop_lang_v1';
const SEARCHES_KEY = 'asaas_shop_searches_v1';
// Search shortcuts by need; each one only shows when it finds products.
const SEARCH_GOALS = [
  ['proteins', 'Protéines', 'protéine'],
  ['creatine', 'Créatine', 'créatine'],
  ['mass', 'Prise de masse', 'prise de masse'],
  ['preworkout', 'Pré-workout', 'pré-workout'],
  ['aminos', 'BCAA & acides aminés', 'bcaa'],
  ['vitamins', 'Vitamines', 'vitamine'],
  ['omega', 'Oméga-3', 'oméga'],
  ['collagen', 'Collagène', 'collagène'],
  ['burner', 'Brûle-graisse', 'brûleur'],
  ['gloves', 'Gants', 'gants'],
  ['belt', 'Ceinture', 'ceinture'],
  ['shaker', 'Shaker', 'shaker'],
];
const CITIES = [
  'Tanger', 'Casablanca', 'Rabat', 'Marrakech', 'Fès', 'Meknès', 'Agadir', 'Tétouan', 'Oujda', 'Kénitra', 'Salé',
  'Témara', 'Mohammedia', 'El Jadida', 'Nador', 'Larache', 'Asilah', 'Al Hoceima', 'Chefchaouen', 'Safi',
  'Béni Mellal', 'Khouribga', 'Settat', 'Taza', 'Essaouira', 'Ouarzazate', 'Errachidia', 'Guelmim', 'Laâyoune', 'Dakhla',
];
const CATEGORY_LABELS = { supplements: 'Compléments', accessories: 'Accessoires', clothing: 'Vêtements' };
const CATEGORY_ICONS = { supplements: FlaskConical, accessories: Dumbbell, clothing: Shirt };

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9؀-ۿ]/g, '');
// Amounts are wrapped in left-to-right isolates so "35 DH" stays in order inside Arabic sentences.
const fmt = (n) => `⁦${Math.round(n * 100) / 100} DH⁩`;
const unitPrice = (p) => (p.promo && p.promo > 0 && p.promo < p.price ? p.promo : p.price);
const discount = (p) => (p.promo > 0 && p.promo < p.price ? Math.round((1 - p.promo / p.price) * 100) : 0);
const safeRead = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const safeWrite = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } };
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const cartKey = (productId, variantId) => (variantId ? `${productId}:${variantId}` : String(productId));
const hasVariants = (p) => (p?.variants?.length || 0) > 0;
// Cart amount from which delivery is free, set in the staff app ("Réglages boutique"). null: never.
const freeShippingFrom = (info) => (info?.free_shipping_from > 0 ? info.free_shipping_from : null);
const SHAKER = /shaker/i;
// Clothing and accessories come in sizes, or colours when every option is named after one;
// everything else (supplements) in flavours.
const SIZED_CATEGORIES = ['clothing', 'accessories'];
const COLOUR_NAME = /^(vert|verte|rouge|bleu|bleue|noir|noire|blanc|blanche|orange|rose|jaune|gris|grise|violet|violette|marron|beige|kaki|transparent|transparente|multicolore)(\s.*)?$/i;
const VARIANT_TEXT = {
  flavour: {
    one: ['shop.flavour', 'Goût'],
    count: ['shop.nFlavours', '{{count}} goûts'],
    choose: ['shop.chooseFlavour', 'Choisir le goût'],
    required: ['shop.errFlavour', 'Choisissez un goût pour {{name}} : retirez-le du panier puis ajoutez-le depuis sa page.'],
  },
  size: {
    one: ['shop.size', 'Taille'],
    count: ['shop.nSizes', '{{count}} tailles'],
    choose: ['shop.chooseSize', 'Choisir la taille'],
    required: ['shop.errSize', 'Choisissez une taille pour {{name}} : retirez-le du panier puis ajoutez-le depuis sa page.'],
  },
  colour: {
    one: ['shop.colour', 'Couleur'],
    count: ['shop.nColours', '{{count}} couleurs'],
    choose: ['shop.chooseColour', 'Choisir la couleur'],
    required: ['shop.errColour', 'Choisissez une couleur pour {{name}} : retirez-le du panier puis ajoutez-le depuis sa page.'],
  },
};
const variantKind = (p) => {
  if (!SIZED_CATEGORIES.includes(p?.category)) return 'flavour';
  return hasVariants(p) && p.variants.every((v) => COLOUR_NAME.test(v.name.trim())) ? 'colour' : 'size';
};
const variantText = (t, p, which, opts) => {
  const [key, fallback] = VARIANT_TEXT[variantKind(p)][which];
  return t(key, fallback, opts);
};

// "0612..." -> "212612..." for wa.me links.
const waNumber = (phone) => {
  const d = (phone || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) return d.slice(2);
  if (d.startsWith('0') && d.length === 10) return `212${d.slice(1)}`;
  return d;
};
const waLink = (number, text) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

function useEscape(onClose) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}

// Product photo; without one, a quiet frame with the category mark and the product's name.
function ProductImage({ src, alt, name, category }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    const Icon = CATEGORY_ICONS[category] || Package;
    return (
      <span className="ps-noimg" aria-hidden="true">
        <Icon size={30} strokeWidth={1.4} />
        <span>{name}</span>
      </span>
    );
  }
  return <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setBroken(true)} />;
}

function Stepper({ value, onChange, min = 1, small }) {
  const { t } = useTranslation();
  return (
    <div className={`ps-stepper${small ? ' ps-stepper--sm' : ''}`}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={t('shop.less', 'Moins')}><Minus size={15} /></button>
      <span aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(20, value + 1))} disabled={value >= 20} aria-label={t('shop.more', 'Plus')}><Plus size={15} /></button>
    </div>
  );
}

function Price({ p, large }) {
  const pct = discount(p);
  return (
    <p className={`ps-price${large ? ' ps-price--lg' : ''}`}>
      <span>{fmt(unitPrice(p))}</span>
      {pct > 0 && <s>{fmt(p.price)}</s>}
    </p>
  );
}

function ProductCard({ p, qty, fav, onFav, onOpen, onAdd, onQty, catLabel }) {
  const { t } = useTranslation();
  const pct = discount(p);
  return (
    <article className={`ps-card${p.in_stock ? '' : ' is-out'}`}>
      <div className="ps-card__media">
        <button className="ps-card__img" onClick={() => onOpen(p)} aria-label={`${t('shop.details', 'Détails')} : ${p.name}`}>
          <ProductImage src={p.image_url} alt={p.name} name={p.name} category={p.category} />
        </button>
        {pct > 0 && <span className="ps-badge">-{pct}%</span>}
        {!p.in_stock && <span className="ps-badge ps-badge--out">{t('shop.outOfStock', 'Rupture')}</span>}
        <button className={`ps-fav${fav ? ' is-on' : ''}`} onClick={() => onFav(p.id)} aria-pressed={fav} aria-label={fav ? t('shop.unfav', 'Retirer des favoris') : t('shop.fav', 'Ajouter aux favoris')}>
          <Heart size={18} />
        </button>
        {p.in_stock && !qty && (
          <button className="ps-quickadd" onClick={(e) => (hasVariants(p) ? onOpen(p) : onAdd(p, e.currentTarget))} aria-label={hasVariants(p) ? `${variantText(t, p, 'choose')} : ${p.name}` : `${t('shop.addToCart', 'Ajouter au panier')} : ${p.name}`}>
            <Plus size={20} />
          </button>
        )}
      </div>
      <div className="ps-card__body">
        {p.category && <span className="ps-card__cat">{catLabel(p.category)}</span>}
        <button className="ps-card__name" onClick={() => onOpen(p)}>{p.name}</button>
        {hasVariants(p) && <span className="ps-card__flavours">{variantText(t, p, 'count', { count: p.variants.length })}</span>}
        <div className="ps-card__foot">
          <Price p={p} />
          {p.in_stock && p.low_stock && <span className="ps-low">{t('shop.lowStock', 'Dernières pièces')}</span>}
        </div>
        {/* Once in the cart, the card becomes its own quantity control (down to zero removes it). */}
        {p.in_stock && qty > 0 && !hasVariants(p) && <Stepper small value={qty} min={0} onChange={(v) => onQty(p.id, v)} />}
      </div>
    </article>
  );
}

export default function Shop() {
  const { t, i18n } = useTranslation();
  const [info, setInfo] = useState(null);
  const [products, setProducts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('featured');
  const [onlyStock, setOnlyStock] = useState(false);
  const [onlyPromo, setOnlyPromo] = useState(false);
  const [onlyFav, setOnlyFav] = useState(false);
  const [cart, setCart] = useState(() => safeRead(CART_KEY, {})); // { productId: qty }
  const [favs, setFavs] = useState(() => safeRead(FAV_KEY, []));
  const [recent, setRecent] = useState(() => safeRead(RECENT_KEY, []));
  const [searches, setSearches] = useState(() => safeRead(SEARCHES_KEY, []));
  const [detail, setDetail] = useState(null);
  const [detailVariant, setDetailVariant] = useState(null); // flavour to preselect, e.g. found by a search
  // All photos of the products opened in this visit, so a cart line can show its flavour's packaging.
  const [photos, setPhotos] = useState({});
  const [panel, setPanel] = useState(null); // null | 'cart' | 'checkout' | 'done'
  const [order, setOrder] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const cartBtn = useRef(null);
  // The shop's title, sent by the server with /shop ("Compléments alimentaires… | ASAASpro").
  // Arriving on a product page, the server sent that product's title instead.
  const pageTitle = useRef(linkedProductId(window.location) == null ? document.title : `${SHOP_NAME} — ${t('shop.title', 'Boutique en ligne')}`);

  const loadProducts = () => getShopProducts()
    .then(setProducts)
    .catch(() => setLoadError(true))
    .finally(() => setLoaded(true));

  useEffect(() => {
    const saved = safeRead(LANG_KEY, 'fr');
    if (saved && saved !== i18n.language) i18n.changeLanguage(saved);
    getShopInfo().then(setInfo).catch(() => setLoadError(true));
    loadProducts();
    // Remember where the visitor came from (e.g. ?utm_source=instagram on the ad link).
    const src = new URLSearchParams(window.location.search).get('utm_source');
    if (src) safeWrite(UTM_KEY, src.slice(0, 50));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { safeWrite(CART_KEY, cart); }, [cart]);
  useEffect(() => { safeWrite(FAV_KEY, favs); }, [favs]);
  useEffect(() => { safeWrite(RECENT_KEY, recent); }, [recent]);
  useEffect(() => { safeWrite(SEARCHES_KEY, searches); }, [searches]);
  // The browser tab names the open product. Title, description and canonical address for
  // Google come with the page itself, from the server.
  useEffect(() => {
    document.title = detail ? `${detail.name} | ${SHOP_NAME}` : pageTitle.current;
  }, [detail]);

  // A product's address (/shop/p/12-whey, or an old /shop?p=12) opens that product. The
  // address under it becomes /shop, so closing the product shows the shop.
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current || !products.length) return;
    deepLinked.current = true;
    const id = linkedProductId(window.location);
    if (id == null) return;
    window.history.replaceState(window.history.state, '', `/shop${queryWithoutProduct(window.location.search)}`);
    const p = products.find((x) => x.id === id);
    if (p) setDetail(p);
  }, [products]);

  // Scroll lock, and the phone's back button closes what is open instead of leaving the shop.
  const overlayOpen = !!(detail || panel || menuOpen || searchOpen);
  useEffect(() => {
    if (!overlayOpen) return undefined;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    window.history.pushState({ shopOverlay: true }, '');
    const onPop = () => { setDetail(null); setPanel(null); setMenuOpen(false); setSearchOpen(false); };
    window.addEventListener('popstate', onPop);
    return () => {
      root.style.overflow = prev;
      window.removeEventListener('popstate', onPop);
      if (window.history.state?.shopOverlay) window.history.back();
    };
  }, [overlayOpen]);
  // While a product is open the address is its own page, ready to copy or share.
  useEffect(() => {
    if (!window.history.state?.shopOverlay) return;
    const path = detail ? productPath(detail) : '/shop';
    if (window.location.pathname !== path) window.history.replaceState(window.history.state, '', `${path}${window.location.search}`);
  }, [detail, overlayOpen]);

  const byId = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))]
    .sort((a, b) => (b === 'supplements') - (a === 'supplements')), [products]);
  const catLabel = useCallback((c) => t(`shop.categories.${c}`, CATEGORY_LABELS[c] || c), [t]);
  const engine = useMemo(() => createSearch(products, catLabel), [products, catLabel]);

  const visible = useMemo(() => {
    // With a search, the catalogue keeps only what the search finds, best matches first.
    const rank = query.trim() ? new Map(engine.search(query).map((r, i) => [r.p.id, i])) : null;
    const list = products.filter((p) => (category === 'all' || p.category === category)
      && (!rank || rank.has(p.id))
      && (!onlyStock || p.in_stock)
      && (!onlyPromo || discount(p) > 0)
      && (!onlyFav || favs.includes(p.id)));
    const sorted = [...list];
    if (sort === 'price-asc') sorted.sort((a, b) => unitPrice(a) - unitPrice(b));
    if (sort === 'price-desc') sorted.sort((a, b) => unitPrice(b) - unitPrice(a));
    if (sort === 'discount') sorted.sort((a, b) => discount(b) - discount(a));
    if (sort === 'featured') {
      sorted.sort(rank
        ? (a, b) => rank.get(a.id) - rank.get(b.id)
        : (a, b) => (b.in_stock - a.in_stock) || (discount(b) > 0) - (discount(a) > 0));
    }
    return sorted;
  }, [products, category, query, engine, onlyStock, onlyPromo, onlyFav, favs, sort]);

  const onSale = useMemo(() => products.filter((p) => p.in_stock && discount(p) > 0).sort((a, b) => discount(b) - discount(a)), [products]);
  const bestPct = onSale.length ? discount(onSale[0]) : 0;
  const hero = useMemo(() => onSale.find((p) => p.image_url) || products.find((p) => p.image_url && p.in_stock) || onSale[0] || products[0], [onSale, products]);
  // Hero product: an in-stock product with a real photo, biggest discount first (old seed paths /assets/... have no file).
  // Supplements are the shop's main line, so accessories and clothing only show there when no supplement qualifies.
  const showcase = useMemo(() => {
    const ready = products
      .filter((p) => p.in_stock && p.image_url && !p.image_url.startsWith('/assets/'))
      .sort((a, b) => discount(b) - discount(a));
    const supplements = ready.filter((p) => p.category === 'supplements');
    return (supplements.length ? supplements : ready).slice(0, 1);
  }, [products]);
  const recentProducts = useMemo(() => recent.map((id) => byId[id]).filter(Boolean), [recent, byId]);

  const lines = useMemo(() => Object.entries(cart)
    .map(([key, qty]) => {
      const [pid, vid] = key.split(':').map(Number);
      const product = byId[pid];
      const variant = vid ? product?.variants?.find((v) => v.id === vid) : null;
      // A line whose flavour no longer exists, or a flavoured product saved without a flavour, is dropped.
      if (!product || (hasVariants(product) ? !variant : vid)) return { product: null, qty };
      const photo = variant?.image_index != null ? photos[pid]?.[variant.image_index] : null;
      return { key, product, variant, qty, photo: photo || product.image_url };
    })
    .filter((l) => l.product && l.qty > 0), [cart, byId, photos]);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + unitPrice(l.product) * l.qty, 0);

  const setQty = (id, qty) => setCart((c) => {
    const next = { ...c };
    if (qty <= 0) delete next[id]; else next[id] = Math.min(qty, 20);
    return next;
  });

  const showToast = (kind, payload) => {
    setToast({ kind, payload });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  // The product flies to the cart.
  const fly = (from) => {
    const target = cartBtn.current;
    if (!from || !target || reducedMotion()) return;
    const a = from.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    const dot = document.createElement('span');
    dot.className = 'ps-flydot';
    Object.assign(dot.style, { left: `${a.left + a.width / 2 - 12}px`, top: `${a.top + a.height / 2 - 12}px` });
    document.body.appendChild(dot);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    dot.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) scale(0.9)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.4)`, opacity: 0.2 },
    ], { duration: 650, easing: 'cubic-bezier(0.22, 0.9, 0.24, 1)' }).onfinish = () => {
      dot.remove();
      target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out' });
    };
  };

  const add = (p, qty = 1, from, variant) => {
    const key = cartKey(p.id, variant?.id);
    setQty(key, (cart[key] || 0) + qty);
    fly(from);
    navigator.vibrate?.(12);
    showToast('added', p);
  };
  const rememberSearch = (q) => {
    const v = q.trim();
    if (v.length < 2) return;
    setSearches((list) => [v, ...list.filter((x) => fold(x) !== fold(v))].slice(0, 6));
  };
  const toggleFav = (id) => setFavs((f) => (f.includes(id) ? f.filter((x) => x !== id) : [id, ...f]));
  const openProduct = (p, variantId = null) => {
    setDetailVariant(variantId);
    setDetail(p);
    setRecent((r) => [p.id, ...r.filter((x) => x !== p.id)].slice(0, 10));
  };
  const share = async (p) => {
    const url = productLink(p);
    try {
      if (navigator.share) { await navigator.share({ title: p.name, text: `${p.name} — ${fmt(unitPrice(p))}`, url }); return; }
      await navigator.clipboard.writeText(url);
      showToast('copied');
    } catch { /* share sheet dismissed */ }
  };

  const gymName = (info?.name || 'ASAAS GYM').trim();
  const freeFrom = freeShippingFrom(info);
  const wa = waNumber(info?.whatsapp);
  const city = info?.local_city || 'Tanger';
  const isAr = i18n.language === 'ar';
  const switchLang = () => { const next = isAr ? 'fr' : 'ar'; i18n.changeLanguage(next); safeWrite(LANG_KEY, next); };

  const goTo = (id) => {
    setMenuOpen(false);
    setSearchOpen(false);
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' }), 60);
  };
  const openCategory = (c) => { setCategory(c); setOnlyFav(false); goTo('catalogue'); };
  const showFavs = () => { setCategory('all'); setOnlyFav(true); goTo('catalogue'); };
  const resetFilters = () => { setCategory('all'); setQuery(''); setOnlyStock(false); setOnlyPromo(false); setOnlyFav(false); setSort('featured'); };
  const filtersOn = category !== 'all' || query || onlyStock || onlyPromo || onlyFav || sort !== 'featured';

  const cartWaText = () => {
    const rows = lines.map((l) => `• ${l.qty} × ${l.product.name}${l.variant ? ` (${l.variant.name})` : ''} — ${fmt(unitPrice(l.product) * l.qty)}`).join('\n');
    return `${t('shop.waCartIntro', 'Bonjour, je voudrais commander :')}\n${rows}\n${t('shop.subtotal', 'Sous-total')} : ${fmt(subtotal)}`;
  };

  const cardProps = (p) => ({
    p, qty: cart[cartKey(p.id)], fav: favs.includes(p.id), onFav: toggleFav, onOpen: openProduct,
    onAdd: (prod, el) => add(prod, 1, el), onQty: (id, v) => setQty(cartKey(id), v), catLabel,
  });

  const navLinks = [
    ['catalogue', t('shop.navShop', 'Boutique')],
    onSale.length > 0 && ['promos', t('shop.navPromos', 'Promotions')],
    ['categories', t('shop.navCategories', 'Catégories')],
    ['about', t('shop.navAbout', 'La salle')],
    ['contact', t('shop.navContact', 'Contact')],
  ].filter(Boolean);

  return (
    <div className="shop ps" dir={isAr ? 'rtl' : 'ltr'} lang={isAr ? 'ar' : 'fr'}>
      <p className="ps-note-bar">
        <Truck size={15} /> {freeFrom
          ? t('shop.barFree', 'Livraison offerte dès {{amount}} · Paiement à la livraison partout au Maroc', { amount: fmt(freeFrom) })
          : t('shop.barLine', 'Paiement à la livraison partout au Maroc · Retrait gratuit à la salle à {{city}}', { city })}
      </p>

      <header className="ps-header">
        <div className="ps-header__row">
          <button className="ps-logo" onClick={() => window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' })} aria-label={SHOP_NAME}>
            <img src={info?.logo_base64 || '/logo_asaas.jpg'} alt="" />
            <span>{SHOP_NAME}</span>
          </button>
          <nav className="ps-nav" aria-label={t('shop.menu', 'Menu')}>
            {navLinks.map(([id, label]) => <button key={id} onClick={() => goTo(id)}>{label}</button>)}
          </nav>
          <div className="ps-actions">
            <button className="ps-searchbtn" onClick={() => setSearchOpen(true)}>
              <Search size={18} /><span>{t('shop.searchPh', 'Rechercher un produit')}</span>
            </button>
            <button className="ps-lang ps-hide-sm" onClick={switchLang} aria-label={isAr ? 'Français' : 'العربية'}>{isAr ? 'FR' : 'ع'}</button>
            <button className="ps-iconbtn ps-hide-sm" onClick={showFavs} aria-label={`${t('shop.favorites', 'Favoris')} (${favs.length})`}>
              <Heart size={21} />{favs.length > 0 && <span className="ps-count">{favs.length}</span>}
            </button>
            <button ref={cartBtn} className="ps-iconbtn ps-cartbtn" onClick={() => setPanel('cart')} aria-label={`${t('shop.cart', 'Panier')} (${count})`}>
              <ShoppingBag size={21} />{count > 0 && <span className="ps-count ps-count--lime">{count}</span>}
            </button>
            <button className="ps-iconbtn ps-menubtn" onClick={() => setMenuOpen(true)} aria-label={t('shop.menu', 'Menu')}><Menu size={22} /></button>
          </div>
        </div>
      </header>

      <main>
        <section className="ps-hero">
          <div className="ps-hero__copy">
            <h1>{t('shop.heroTitle', 'La nutrition sportive choisie par nos coachs.')}</h1>
            <p>{t('shop.heroSub', 'La boutique de la salle {{name}} à {{city}}. Commandez en deux minutes, sans compte, et payez à la livraison.', { name: gymName, city })}</p>
            <div className="ps-hero__ctas">
              <button className="ps-btn ps-btn--dark" onClick={() => goTo('catalogue')}>{t('shop.shopNow', 'Découvrir la boutique')} <ArrowRight size={17} className="flip-rtl" /></button>
              {onSale.length > 0 && <button className="ps-btn ps-btn--line" onClick={() => goTo('promos')}>{t('shop.seePromos', 'Voir les promotions')}</button>}
            </div>
            <ul className="ps-hero__facts">
              {freeFrom && <li className="is-hl"><Gift size={18} /> {t('shop.freeFrom', 'Livraison offerte dès {{amount}}', { amount: fmt(freeFrom) })}</li>}
              <li><Wallet size={18} /> {t('shop.factCod', 'Paiement à la livraison')}</li>
              <li><Truck size={18} /> {info ? t('shop.factDelivery', '{{city}} {{local}} · Maroc {{other}}', { city, local: fmt(info.fee_local), other: fmt(info.fee_other) }) : t('shop.perkDelivery', 'Livraison partout au Maroc')}</li>
              <li><Store size={18} /> {t('shop.factPickup', 'Retrait gratuit à la salle')}</li>
            </ul>
          </div>
          {(showcase.length > 0 || hero) && (
            <HeroProducts items={showcase.length ? showcase : [hero]} onOpen={openProduct} />
          )}
        </section>

        {bestPct > 0 && (
          <section className="ps-promo" aria-label={t('shop.navPromos', 'Promotions')}>
            <p className="ps-promo__pct">-{bestPct}%</p>
            <div className="ps-promo__text">
              <h2>{t('shop.promoTitle', 'Jusqu’à -{{pct}}% en ce moment', { pct: bestPct })}</h2>
              <p>{t('shop.promoSub', '{{count}} produits à prix réduit, tant qu’il y a du stock.', { count: onSale.length })}</p>
            </div>
            <button className="ps-btn ps-btn--dark" onClick={() => goTo('promos')}>{t('shop.seePromos', 'Voir les promotions')} <ArrowRight size={17} className="flip-rtl" /></button>
          </section>
        )}

        <section id="categories" className="ps-section">
          <div className="ps-section__head"><h2>{t('shop.catTitle', 'Acheter par catégorie')}</h2></div>
          <div className="ps-cats">
            {categories.map((c) => {
              const Icon = CATEGORY_ICONS[c] || Package;
              const n = products.filter((p) => p.category === c).length;
              return (
                <button key={c} className="ps-cat" onClick={() => openCategory(c)}>
                  <span className="ps-cat__icon"><Icon size={26} strokeWidth={1.6} /></span>
                  <span className="ps-cat__name">{catLabel(c)}</span>
                  <span className="ps-cat__count">{t('shop.nProducts', '{{count}} produits', { count: n })}</span>
                  <ArrowRight size={18} className="ps-cat__go flip-rtl" />
                </button>
              );
            })}
            <button className="ps-cat ps-cat--all" onClick={() => openCategory('all')}>
              <span className="ps-cat__icon"><LayoutGrid size={26} strokeWidth={1.6} /></span>
              <span className="ps-cat__name">{t('shop.allProducts', 'Tous les produits')}</span>
              <span className="ps-cat__count">{t('shop.nProducts', '{{count}} produits', { count: products.length })}</span>
              <ArrowRight size={18} className="ps-cat__go flip-rtl" />
            </button>
          </div>
        </section>

        {onSale.length > 0 && (
          <section id="promos" className="ps-section">
            <div className="ps-section__head">
              <h2>{t('shop.navPromos', 'Promotions')}</h2>
              <button className="ps-link" onClick={() => { resetFilters(); setOnlyPromo(true); goTo('catalogue'); }}>{t('shop.seeAll', 'Tout voir')} <ArrowRight size={16} className="flip-rtl" /></button>
            </div>
            <div className="ps-rail">{onSale.map((p) => <ProductCard key={p.id} {...cardProps(p)} />)}</div>
          </section>
        )}

        <section id="catalogue" className="ps-section">
          <div className="ps-section__head">
            <h2>{onlyFav ? t('shop.favorites', 'Favoris') : category === 'all' ? t('shop.catalogue', 'Toute la boutique') : catLabel(category)}</h2>
            <span className="ps-muted">{t('shop.nResults', '{{count}} produit(s)', { count: visible.length })}</span>
          </div>

          <div className="ps-toolbar">
            <div className="ps-chips" role="tablist" aria-label={t('shop.navCategories', 'Catégories')}>
              <button role="tab" aria-selected={category === 'all' && !onlyFav} onClick={() => { setCategory('all'); setOnlyFav(false); }}>{t('shop.all', 'Tout')}</button>
              {categories.map((c) => (
                <button key={c} role="tab" aria-selected={category === c && !onlyFav} onClick={() => { setCategory(c); setOnlyFav(false); }}>{catLabel(c)}</button>
              ))}
              {favs.length > 0 && <button role="tab" aria-selected={onlyFav} onClick={() => { setOnlyFav(true); setCategory('all'); }}><Heart size={14} /> {t('shop.favorites', 'Favoris')} ({favs.length})</button>}
            </div>
            <div className="ps-filters">
              <label className="ps-sort">
                <SlidersHorizontal size={16} />
                <span className="ps-sr">{t('shop.sortBy', 'Trier par')}</span>
                <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t('shop.sortBy', 'Trier par')}>
                  <option value="featured">{t('shop.sortFeatured', 'Recommandés')}</option>
                  <option value="price-asc">{t('shop.sortPriceAsc', 'Prix croissant')}</option>
                  <option value="price-desc">{t('shop.sortPriceDesc', 'Prix décroissant')}</option>
                  <option value="discount">{t('shop.sortDiscount', 'Meilleures remises')}</option>
                </select>
              </label>
              <button className="ps-toggle" aria-pressed={onlyStock} onClick={() => setOnlyStock((v) => !v)}>{onlyStock && <Check size={15} />} {t('shop.inStockOnly', 'En stock')}</button>
              <button className="ps-toggle" aria-pressed={onlyPromo} onClick={() => setOnlyPromo((v) => !v)}>{onlyPromo && <Check size={15} />} {t('shop.promoOnly', 'En promo')}</button>
              {query && <button className="ps-toggle is-query" onClick={() => setQuery('')}>« {query} » <X size={14} /></button>}
              {filtersOn && <button className="ps-link" onClick={resetFilters}>{t('shop.reset', 'Réinitialiser')}</button>}
            </div>
          </div>

          <div className="ps-grid">
            {loadError && (
              <div className="ps-empty">
                <p>{t('shop.loadError', 'La boutique est momentanément indisponible. Réessayez dans un instant.')}</p>
                <button className="ps-btn ps-btn--line" onClick={() => { setLoadError(false); loadProducts(); }}>{t('shop.retry', 'Réessayer')}</button>
              </div>
            )}
            {!loaded && !loadError && Array.from({ length: 4 }, (_, i) => <div key={i} className="ps-card ps-card--skeleton" aria-hidden="true" />)}
            {visible.map((p) => <ProductCard key={p.id} {...cardProps(p)} />)}
            {loaded && !loadError && products.length > 0 && visible.length === 0 && (
              <div className="ps-empty">
                <p>{onlyFav ? t('shop.noFav', 'Aucun favori pour le moment. Touchez le cœur d’un produit pour le garder ici.') : t('shop.noResult', 'Aucun produit ne correspond.')}</p>
                <button className="ps-btn ps-btn--line" onClick={resetFilters}>{t('shop.showAll', 'Voir tous les produits')}</button>
              </div>
            )}
            {loaded && !loadError && products.length === 0 && <div className="ps-empty"><p>{t('shop.emptyShop', 'Les produits arrivent bientôt.')}</p></div>}
          </div>
        </section>

        {recentProducts.length > 0 && (
          <section className="ps-section">
            <div className="ps-section__head">
              <h2><Clock3 size={22} /> {t('shop.recent', 'Vus récemment')}</h2>
              <button className="ps-link" onClick={() => setRecent([])}>{t('shop.clearRecent', 'Effacer')}</button>
            </div>
            <div className="ps-rail">{recentProducts.map((p) => <ProductCard key={p.id} {...cardProps(p)} />)}</div>
          </section>
        )}

        <section className="ps-section">
          <div className="ps-benefits">
            <div><Wallet size={26} strokeWidth={1.6} /><strong>{t('shop.b1', 'Paiement à la livraison')}</strong><span>{t('shop.b1Sub', 'Vous payez en espèces à la réception. Aucun paiement en ligne.')}</span></div>
            <div><Truck size={26} strokeWidth={1.6} /><strong>{t('shop.b2', 'Livraison partout au Maroc')}</strong><span>{info ? t('shop.b2Sub', '{{city}} : {{local}}. Autres villes : {{other}}.', { city, local: fmt(info.fee_local), other: fmt(info.fee_other) }) : ''}</span></div>
            <div><Store size={26} strokeWidth={1.6} /><strong>{t('shop.b3', 'Retrait gratuit')}</strong><span>{t('shop.b3Sub', 'Commandez en ligne, récupérez à l’accueil de la salle à {{city}}.', { city })}</span></div>
            <div><MessageCircle size={26} strokeWidth={1.6} /><strong>{t('shop.b4', 'Conseil des coachs')}</strong><span>{t('shop.b4Sub', 'Une question sur un produit ? Écrivez-nous sur WhatsApp.')}</span></div>
          </div>
        </section>

        <section id="about" className="ps-section ps-about">
          <div className="ps-about__copy">
            <h2>{t('shop.aboutTitle', 'Une vraie salle derrière la boutique.')}</h2>
            <p>{t('shop.aboutP1', '{{name}} est une salle de sport à {{city}}. Les compléments et accessoires de cette boutique sont choisis par les coachs de la salle.', { name: gymName, city })}</p>
            <p>{t('shop.aboutP2', 'Vous vous entraînez chez nous ? Retirez votre commande gratuitement à l’accueil. Ailleurs au Maroc ? Nous livrons chez vous.')}</p>
            {wa && <a className="ps-btn ps-btn--wa" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle size={18} /> {t('shop.aboutCtaWa', 'Nous écrire sur WhatsApp')}</a>}
          </div>
        </section>
      </main>

      <footer id="contact" className="ps-footer">
        <div className="ps-footer__inner">
          <div className="ps-footer__brand">
            <span className="ps-logo ps-logo--static"><img src={info?.logo_base64 || '/logo_asaas.jpg'} alt="" /><span>{SHOP_NAME}</span></span>
            <p>{t('shop.footerLine', 'Salle de sport et boutique de nutrition sportive à {{city}}.', { city })}</p>
            <button className="ps-lang ps-lang--wide" onClick={switchLang}>{isAr ? 'Français' : 'العربية'}</button>
          </div>
          <div className="ps-footer__col">
            <h3>{t('shop.navShop', 'Boutique')}</h3>
            {categories.map((c) => <button key={c} onClick={() => openCategory(c)}>{catLabel(c)}</button>)}
            {onSale.length > 0 && <button onClick={() => goTo('promos')}>{t('shop.navPromos', 'Promotions')}</button>}
            <button onClick={showFavs}>{t('shop.favorites', 'Favoris')}</button>
            <button onClick={() => setPanel('track')}>{t('shop.trackTitle', 'Suivre ma commande')}</button>
          </div>
          <div className="ps-footer__col">
            <h3>{t('shop.infoTitle', 'Livraison et paiement')}</h3>
            {info && <p>{city} : {fmt(info.fee_local)}</p>}
            {info && <p>{t('shop.otherCities', 'Autres villes')} : {fmt(info.fee_other)}</p>}
            {freeFrom && <p>{t('shop.freeFrom', 'Livraison offerte dès {{amount}}', { amount: fmt(freeFrom) })}</p>}
            <p>{t('shop.cod', 'Paiement à la livraison')}</p>
            <p>{t('shop.pickup', 'Retrait à la salle')} : {t('shop.free', 'Gratuit')}</p>
          </div>
          <div className="ps-footer__col">
            <h3>{t('shop.navContact', 'Contact')}</h3>
            {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle size={17} /> <span dir="ltr">{info.whatsapp}</span></a>}
            {info?.instagram_url && <a href={info.instagram_url} target="_blank" rel="noreferrer"><Instagram size={17} /> Instagram</a>}
            <p><MapPin size={17} /> {gymName}, {city}</p>
          </div>
        </div>
        <p className="ps-footer__legal">© {new Date().getFullYear()} {SHOP_NAME}</p>
      </footer>

      {wa && !overlayOpen && (
        <a className={`ps-wafab${toast ? ' is-raised' : ''}`} href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={26} /></a>
      )}
      {/* The cart drawer already shows what was added. */}
      {toast && !panel && (
        <div className="ps-toast" role="status">
          {toast.kind === 'added' ? (
            <>
              <span><Check size={18} /> {t('shop.addedToCart', 'Ajouté au panier')}</span>
              <button onClick={() => { setToast(null); setPanel('cart'); }}>{t('shop.viewCart', 'Voir le panier')}</button>
            </>
          ) : <span><Check size={18} /> {t('shop.linkCopied', 'Lien copié')}</span>}
        </div>
      )}

      {menuOpen && (
        <div className="ps-overlay ps-overlay--left" onMouseDown={(e) => { if (e.target === e.currentTarget) setMenuOpen(false); }}>
          <nav className="ps-menu" aria-label={t('shop.menu', 'Menu')}>
            <div className="ps-menu__head">
              <span className="ps-logo ps-logo--static"><img src={info?.logo_base64 || '/logo_asaas.jpg'} alt="" /><span>{SHOP_NAME}</span></span>
              <button className="ps-iconbtn" onClick={() => setMenuOpen(false)} aria-label={t('shop.close', 'Fermer')}><X size={22} /></button>
            </div>
            <button className="ps-menu__search" onClick={() => { setMenuOpen(false); setSearchOpen(true); }}><Search size={18} /> {t('shop.searchPh', 'Rechercher un produit')}</button>
            <p className="ps-menu__label">{t('shop.navCategories', 'Catégories')}</p>
            {categories.map((c) => {
              const Icon = CATEGORY_ICONS[c] || Package;
              return <button key={c} onClick={() => openCategory(c)}><Icon size={20} strokeWidth={1.6} /> {catLabel(c)}</button>;
            })}
            {onSale.length > 0 && <button className="is-promo" onClick={() => goTo('promos')}><span className="ps-badge ps-badge--inline">%</span> {t('shop.navPromos', 'Promotions')}</button>}
            <p className="ps-menu__label">{SHOP_NAME}</p>
            <button onClick={showFavs}><Heart size={20} strokeWidth={1.6} /> {t('shop.favorites', 'Favoris')} ({favs.length})</button>
            <button onClick={() => { setMenuOpen(false); setPanel('cart'); }}><ShoppingBag size={20} strokeWidth={1.6} /> {t('shop.cart', 'Panier')} ({count})</button>
            <button onClick={() => { setMenuOpen(false); setPanel('track'); }}><Package size={20} strokeWidth={1.6} /> {t('shop.trackTitle', 'Suivre ma commande')}</button>
            <button onClick={() => goTo('about')}><Store size={20} strokeWidth={1.6} /> {t('shop.navAbout', 'La salle')}</button>
            <button onClick={() => goTo('contact')}><Phone size={20} strokeWidth={1.6} /> {t('shop.navContact', 'Contact')}</button>
            <div className="ps-menu__foot">
              <button className="ps-lang ps-lang--wide" onClick={switchLang}>{isAr ? 'Français' : 'العربية'}</button>
              {wa && <a className="ps-btn ps-btn--wa ps-btn--sm" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle size={17} /> WhatsApp</a>}
            </div>
          </nav>
        </div>
      )}

      {searchOpen && (
        <SearchOverlay
          engine={engine} products={products} catLabel={catLabel} categories={categories} onSale={onSale}
          recentProducts={recentProducts} searches={searches} onForget={() => setSearches([])} wa={wa}
          initial={query}
          onClose={() => setSearchOpen(false)}
          onPick={(p, q, v) => { rememberSearch(q); setSearchOpen(false); openProduct(p, v?.id); }}
          onSubmit={(q) => { rememberSearch(q); setQuery(q); setCategory('all'); setOnlyFav(false); goTo('catalogue'); }}
          onCategory={openCategory}
          onAdd={(p, el, q) => { rememberSearch(q); add(p, 1, el); }}
        />
      )}

      {detail && (
        <ProductDetail
          p={detail} initialVariant={detailVariant} onPhotos={(id, list) => setPhotos((m) => ({ ...m, [id]: list }))} fav={favs.includes(detail.id)} onFav={toggleFav} onShare={share} wa={wa} catLabel={catLabel} info={info}
          related={products.filter((x) => x.category === detail.category && x.id !== detail.id).slice(0, 6)}
          onOpen={openProduct}
          onClose={() => setDetail(null)}
          onAdd={(p, qty, variant) => { add(p, qty, null, variant); setDetail(null); }}
        />
      )}

      {panel && (
        <div className="ps-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && panel !== 'done') setPanel(null); }}>
          <aside className="ps-drawer" role="dialog" aria-modal="true" aria-label={t('shop.cart', 'Panier')}>
            {panel === 'cart' && (
              <CartPanel
                lines={lines} count={count} subtotal={subtotal} info={info} freeFrom={freeFrom} products={products} wa={wa} waText={cartWaText} setQty={setQty}
                onUpsellAdd={(p) => { setQty(cartKey(p.id), (cart[cartKey(p.id)] || 0) + 1); navigator.vibrate?.(12); }}
                onOpen={(p) => { setPanel(null); openProduct(p); }}
                onClose={() => setPanel(null)} onCheckout={() => setPanel('checkout')}
              />
            )}
            {panel === 'checkout' && (
              <CheckoutPanel
                lines={lines} subtotal={subtotal} info={info} freeFrom={freeFrom}
                onBack={() => setPanel('cart')}
                onDone={(o, phone) => { safeWrite(LAST_ORDER_KEY, { reference: o.reference, phone }); setOrder(o); setCart({}); setPanel('done'); loadProducts(); }}
                onStockChanged={loadProducts}
              />
            )}
            {panel === 'done' && order && <DonePanel order={order} info={info} onClose={() => setPanel(null)} onTrack={() => setPanel('track')} />}
            {panel === 'track' && <TrackPanel wa={wa} onClose={() => setPanel(null)} />}
          </aside>
        </div>
      )}
    </div>
  );
}

// Product photos arrive with wide white margins of different sizes; cropping them to the product
// lets every hero product fill its space the same way. Photos a browser may not read (other sites
// without CORS) are kept as they are.
const trimmed = new Map();
function useTrimmedPhoto(src) {
  const [out, setOut] = useState(() => trimmed.get(src) || null);
  useEffect(() => {
    if (!src) return undefined;
    if (trimmed.has(src)) { setOut(trimmed.get(src)); return undefined; }
    let alive = true;
    const done = (value) => { trimmed.set(src, value); if (alive) setOut(value); };
    const img = new Image();
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const k = Math.min(1, 400 / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * k));
        const h = Math.max(1, Math.round(img.naturalHeight * k));
        const probe = document.createElement('canvas');
        probe.width = w; probe.height = h;
        const ctx = probe.getContext('2d', { willReadFrequently: true });
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
        const px = ctx.getImageData(0, 0, w, h).data;
        let top = h; let left = w; let right = -1; let bottom = -1;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            if (px[i] < 236 || px[i + 1] < 236 || px[i + 2] < 236) {
              if (x < left) left = x; if (x > right) right = x;
              if (y < top) top = y; if (y > bottom) bottom = y;
            }
          }
        }
        if (right <= left || bottom <= top) { done(src); return; }
        const sx = Math.max(0, left / k - 2); const sy = Math.max(0, top / k - 2);
        const sw = Math.min(img.naturalWidth - sx, (right - left + 1) / k + 4);
        const sh = Math.min(img.naturalHeight - sy, (bottom - top + 1) / k + 4);
        const scale = Math.min(1, 900 / Math.max(sw, sh));
        const crop = document.createElement('canvas');
        crop.width = Math.round(sw * scale); crop.height = Math.round(sh * scale);
        const c = crop.getContext('2d');
        c.fillStyle = '#fff'; c.fillRect(0, 0, crop.width, crop.height);
        c.drawImage(img, sx, sy, sw, sh, 0, 0, crop.width, crop.height);
        done(crop.toDataURL('image/jpeg', 0.92));
      } catch {
        done(src);
      }
    };
    img.onerror = () => done(src);
    img.src = src;
    return () => { alive = false; };
  }, [src]);
  return out;
}

function HeroProduct({ p, lead, solo, onOpen }) {
  const photo = useTrimmedPhoto(p.image_url);
  const pct = discount(p);
  return (
    <button className={`ps-hero__prod${lead ? ' is-lead' : ''}`} onClick={() => onOpen(p)} aria-label={p.name}>
      <span className={`ps-hero__prodimg${photo ? ' is-ready' : ''}`}>
        {photo && <img src={photo} alt={p.name} decoding="async" />}
      </span>
      {solo && <span className="ps-hero__prodname">{p.name}</span>}
      <span className="ps-hero__prodprice">
        {pct > 0 && <em>-{pct}%</em>}
        <b>{fmt(unitPrice(p))}</b>
        {pct > 0 && <s>{fmt(p.price)}</s>}
      </span>
    </button>
  );
}

// Hero: one real product (up to three if asked) standing straight on the white page, no panel, no disc.
// It opens its product page.
function HeroProducts({ items, onOpen }) {
  const { t } = useTranslation();
  // Middle slot for the lead product: [2nd, 1st, 3rd].
  const placed = items.length === 3 ? [items[1], items[0], items[2]] : items;
  return (
    <div className={`ps-hero__products is-${items.length}`} aria-label={t('shop.featured', 'Produits à la une')}>
      {placed.map((p) => <HeroProduct key={p.id} p={p} lead={p === items[0]} solo={items.length === 1} onOpen={onOpen} />)}
    </div>
  );
}

// Search sheet: smart results as you type (typos, synonyms, flavours, Arabic), highlighted matches,
// quick add, filters by category, recent searches, shortcuts by need, and a way out when nothing is found.
function SearchOverlay({ engine, products, catLabel, categories, onSale, recentProducts, searches, onForget, wa, initial, onClose, onPick, onSubmit, onCategory, onAdd }) {
  const { t } = useTranslation();
  const [q, setQ] = useState(initial || '');
  const [tab, setTab] = useState('all');
  const [added, setAdded] = useState(null);
  const input = useRef(null);
  const list = useRef(null);
  const addedTimer = useRef(null);
  useEscape(onClose);
  useEffect(() => { input.current?.focus(); return () => clearTimeout(addedTimer.current); }, []);
  useEffect(() => { setTab('all'); }, [q]);

  const typed = q.trim();
  const results = useMemo(() => (typed ? engine.search(typed) : []), [engine, typed]);
  const suggestion = useMemo(() => (typed && !results.length ? engine.suggest(typed) : null), [engine, typed, results.length]);
  const goals = useMemo(() => SEARCH_GOALS
    .map(([key, label, query]) => ({ key, label: t(`shop.goals.${key}`, label), query, count: engine.search(query).length }))
    .filter((g) => g.count > 0), [engine, t]);
  const catCounts = useMemo(() => Object.fromEntries(categories.map((c) => [c, products.filter((p) => p.category === c).length])), [categories, products]);

  const resultCats = [...new Set(results.map((r) => r.p.category).filter(Boolean))];
  const promoCount = results.filter((r) => discount(r.p) > 0).length;
  const shown = results.filter((r) => (tab === 'all' ? true : tab === 'promo' ? discount(r.p) > 0 : r.p.category === tab));

  const fill = (value) => { setQ(value); input.current?.focus(); };
  const quickAdd = (p, el) => {
    onAdd(p, el, typed);
    setAdded(p.id);
    clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAdded(null), 1600);
  };
  // Arrow keys walk from the field through the results and back.
  const onKeyDown = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = [input.current, ...(list.current?.querySelectorAll('.ps-res__main') || [])];
    const at = items.indexOf(document.activeElement);
    if (at === -1) return;
    e.preventDefault();
    items[Math.max(0, Math.min(items.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
  };

  return (
    <div className="ps-overlay ps-overlay--top" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ps-search" role="dialog" aria-modal="true" aria-label={t('shop.search', 'Rechercher')} onKeyDown={onKeyDown}>
        <form className="ps-search__bar" role="search" onSubmit={(e) => { e.preventDefault(); if (typed) onSubmit(typed); }}>
          <span className="ps-search__field">
            <Search size={20} aria-hidden="true" />
            <input
              ref={input} type="search" enterKeyHint="search" autoComplete="off" spellCheck="false" value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('shop.searchHint', 'Whey, créatine, gainer, goût…')}
              aria-label={t('shop.searchPh', 'Rechercher un produit')}
            />
            {q && <button type="button" className="ps-search__clear" onClick={() => fill('')} aria-label={t('shop.clear', 'Effacer')}><X size={16} /></button>}
          </span>
          <button type="button" className="ps-search__close" onClick={onClose}>{t('shop.cancel', 'Annuler')}</button>
        </form>

        {typed && results.length > 0 && (resultCats.length > 1 || promoCount > 0) && (
          <div className="ps-search__tabs" role="group" aria-label={t('shop.filter', 'Filtrer')}>
            <button className={tab === 'all' ? 'is-on' : ''} aria-pressed={tab === 'all'} onClick={() => setTab('all')}>{t('shop.all', 'Tout')} <span>{results.length}</span></button>
            {resultCats.length > 1 && resultCats.map((c) => (
              <button key={c} className={tab === c ? 'is-on' : ''} aria-pressed={tab === c} onClick={() => setTab(c)}>
                {catLabel(c)} <span>{results.filter((r) => r.p.category === c).length}</span>
              </button>
            ))}
            {promoCount > 0 && (
              <button className={`is-promo${tab === 'promo' ? ' is-on' : ''}`} aria-pressed={tab === 'promo'} onClick={() => setTab('promo')}>
                {t('shop.navPromos', 'Promotions')} <span>{promoCount}</span>
              </button>
            )}
          </div>
        )}

        <div className="ps-search__body">
          <p className="ps-sr" aria-live="polite">
            {typed ? t('shop.nResults', '{{count}} produit(s)', { count: results.length }) : ''}
          </p>

          {!typed && (
            <>
              {searches.length > 0 && (
                <section className="ps-search__sec">
                  <div className="ps-search__head">
                    <h3>{t('shop.recentSearches', 'Recherches récentes')}</h3>
                    <button onClick={onForget}>{t('shop.clearHistory', 'Effacer')}</button>
                  </div>
                  <div className="ps-search__chips">
                    {searches.map((s) => <button key={s} className="ps-chip ps-chip--recent" onClick={() => fill(s)}><Clock3 size={15} aria-hidden="true" /> {s}</button>)}
                  </div>
                </section>
              )}

              {goals.length > 0 && (
                <section className="ps-search__sec">
                  <h3>{t('shop.byNeed', 'Recherches par besoin')}</h3>
                  <div className="ps-search__chips">
                    {goals.map((g) => <button key={g.key} className="ps-chip" onClick={() => fill(g.query)}>{g.label} <span>{g.count}</span></button>)}
                  </div>
                </section>
              )}

              <section className="ps-search__sec">
                <h3>{t('shop.navCategories', 'Catégories')}</h3>
                <div className="ps-search__cats">
                  {categories.map((c) => {
                    const Icon = CATEGORY_ICONS[c] || Package;
                    return (
                      <button key={c} onClick={() => onCategory(c)}>
                        <span className="ps-search__caticon"><Icon size={22} strokeWidth={1.6} /></span>
                        <b>{catLabel(c)}</b>
                        <small>{t('shop.nProducts', '{{count}} produits', { count: catCounts[c] })}</small>
                      </button>
                    );
                  })}
                </div>
              </section>

              {recentProducts.length > 0 ? (
                <section className="ps-search__sec">
                  <h3>{t('shop.recent', 'Vus récemment')}</h3>
                  <div className="ps-search__rail">
                    {recentProducts.slice(0, 8).map((p) => (
                      <button key={p.id} className="ps-search__mini" onClick={() => onPick(p, '')}>
                        <span className="ps-search__miniimg"><ProductImage src={p.image_url} alt="" name="" category={p.category} /></span>
                        <span className="ps-search__mininame">{p.name}</span>
                        <Price p={p} />
                      </button>
                    ))}
                  </div>
                </section>
              ) : onSale.length > 0 && (
                <section className="ps-search__sec">
                  <h3>{t('shop.navPromos', 'Promotions')}</h3>
                  <ul className="ps-res-list">
                    {onSale.slice(0, 4).map((p) => <SearchRow key={p.id} p={p} q="" catLabel={catLabel} onPick={onPick} onAdd={quickAdd} added={added === p.id} />)}
                  </ul>
                </section>
              )}
            </>
          )}

          {typed && results.length === 0 && (
            <div className="ps-search__empty">
              <span className="ps-search__emptyicon"><SearchX size={28} strokeWidth={1.6} /></span>
              <p className="ps-search__emptytitle">{t('shop.noResultFor', 'Aucun produit pour « {{q}} ».', { q: typed })}</p>
              {suggestion ? (
                <p>{t('shop.didYouMean', 'Vouliez-vous dire')} <button className="ps-search__fix" onClick={() => fill(suggestion)}>{suggestion}</button> ?</p>
              ) : (
                <p>{t('shop.searchTip', "Vérifiez l'orthographe ou essayez un mot plus simple.")}</p>
              )}
              {goals.length > 0 && (
                <div className="ps-search__chips ps-search__chips--center">
                  {goals.slice(0, 6).map((g) => <button key={g.key} className="ps-chip" onClick={() => fill(g.query)}>{g.label}</button>)}
                </div>
              )}
              {wa && (
                <a className="ps-btn ps-btn--wa ps-btn--sm" href={waLink(wa, t('shop.waAsk', 'Bonjour, avez-vous « {{q}} » ?', { q: typed }))} target="_blank" rel="noreferrer">
                  <MessageCircle size={17} /> {t('shop.askWa', 'Demandez-le-nous sur WhatsApp')}
                </a>
              )}
            </div>
          )}

          {shown.length > 0 && (
            <ul className="ps-res-list" ref={list}>
              {shown.slice(0, 8).map((r) => (
                <SearchRow key={r.p.id} p={r.p} q={typed} variant={r.variant} catLabel={catLabel} onPick={onPick} onAdd={quickAdd} added={added === r.p.id} />
              ))}
            </ul>
          )}
        </div>

        {results.length > 0 && (
          <div className="ps-search__foot">
            <button className="ps-btn ps-btn--dark ps-btn--block" onClick={() => onSubmit(typed)}>
              {results.length === 1 ? t('shop.seeResult', 'Voir le résultat') : t('shop.seeResults', 'Voir les {{count}} résultats', { count: results.length })} <ArrowRight size={17} className="flip-rtl" />
            </button>
            <span className="ps-search__kbd" aria-hidden="true"><CornerDownLeft size={13} /> {t('shop.enterHint', 'Entrée')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SearchRow({ p, q, variant, catLabel, onPick, onAdd, added }) {
  const { t } = useTranslation();
  const pct = discount(p);
  const parts = highlight(p.name, q);
  let meta = catLabel(p.category);
  if (variant) meta = `${variantText(t, p, 'one')} : ${variant.name}`;
  else if (hasVariants(p)) meta = `${meta} · ${variantText(t, p, 'count', { count: p.variants.length })}`;
  return (
    <li className={`ps-res${p.in_stock ? '' : ' is-out'}`}>
      <button className="ps-res__main" onClick={() => onPick(p, q, variant)}>
        <span className="ps-res__img">
          <ProductImage src={p.image_url} alt="" name="" category={p.category} />
          {pct > 0 && <span className="ps-res__pct">-{pct}%</span>}
        </span>
        <span className="ps-res__txt">
          <b>{parts.map((part, i) => (part.hit ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>))}</b>
          <small className={variant ? 'is-variant' : ''}>{variant && <Check size={13} aria-hidden="true" />}{meta}</small>
          {!p.in_stock
            ? <small className="ps-res__stock is-out">{t('shop.outOfStock', 'Rupture')}</small>
            : p.low_stock && <small className="ps-res__stock">{t('shop.lowStock', 'Dernières pièces')}</small>}
        </span>
        <Price p={p} />
      </button>
      {p.in_stock && (hasVariants(p) ? (
        <button className="ps-res__add" onClick={() => onPick(p, q, variant)} aria-label={`${variantText(t, p, 'choose')} : ${p.name}`}><ChevronRight size={18} className="flip-rtl" /></button>
      ) : (
        <button className={`ps-res__add${added ? ' is-done' : ''}`} onClick={(e) => onAdd(p, e.currentTarget)} aria-label={`${t('shop.addToCart', 'Ajouter au panier')} : ${p.name}`}>
          {added ? <Check size={18} /> : <Plus size={18} />}
        </button>
      ))}
    </li>
  );
}

function ProductDetail({ p, initialVariant, onPhotos, fav, onFav, onShare, wa, info, catLabel, related, onOpen, onClose, onAdd }) {
  const { t } = useTranslation();
  const [qty, setQty] = useState(1);
  const [images, setImages] = useState(p.image_url ? [p.image_url] : []);
  const [current, setCurrent] = useState(0);
  const pct = discount(p);
  const firstInStock = () => p.variants?.find((v) => v.id === initialVariant && v.in_stock) || p.variants?.find((v) => v.in_stock) || null;
  const [variant, setVariant] = useState(firstInStock);
  const canBuy = p.in_stock && (!hasVariants(p) || variant?.in_stock);
  useEscape(onClose);

  useEffect(() => {
    setQty(1); setCurrent(0); setImages(p.image_url ? [p.image_url] : []); setVariant(firstInStock());
    getShopProduct(p.id).then((d) => { if (d.images?.length) { setImages(d.images); onPhotos?.(p.id, d.images); } }).catch(() => {});
  }, [p.id, p.image_url]);
  // Picking a flavour shows the photo of its packaging, when one is linked to it.
  const photoOf = (v) => (v?.image_index != null ? images[v.image_index] : null);
  useEffect(() => {
    if (variant?.image_index != null && variant.image_index < images.length) setCurrent(variant.image_index);
  }, [variant, images]);
  const flavourPhotos = hasVariants(p) && p.variants.some((v) => photoOf(v));

  const waText = t('shop.waProduct', 'Bonjour, je voudrais commander : {{qty}} × {{name}} ({{price}}). {{link}}', { qty, name: variant ? `${p.name} — ${variant.name}` : p.name, price: fmt(unitPrice(p) * qty), link: productLink(p) });

  return (
    <div className="ps-overlay ps-overlay--center" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ps-detail" role="dialog" aria-modal="true" aria-label={p.name}>
        <button className="ps-detail__close ps-iconbtn" onClick={onClose} aria-label={t('shop.close', 'Fermer')}><X size={22} /></button>
        <div className="ps-detail__grid">
          <div className="ps-detail__gallery">
            <div className="ps-detail__img">
              <ProductImage src={images[current]} alt={p.name} name={p.name} category={p.category} />
              {pct > 0 && <span className="ps-badge">-{pct}%</span>}
            </div>
            {images.length > 1 && (
              <div className="ps-thumbs">
                {images.map((src, i) => (
                  <button key={i} aria-pressed={i === current} onClick={() => setCurrent(i)} aria-label={`${t('shop.photo', 'Photo')} ${i + 1}`}>
                    <ProductImage src={src} alt="" name="" category={p.category} />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="ps-detail__body">
            {p.category && <span className="ps-card__cat">{catLabel(p.category)}</span>}
            <h2>{p.name}</h2>
            <Price p={p} large />
            <p className={`ps-stock${p.in_stock ? (p.low_stock ? ' is-low' : '') : ' is-out'}`}>
              <i /> {!p.in_stock ? t('shop.outOfStockLong', 'Rupture de stock pour le moment') : p.low_stock ? t('shop.lowStock', 'Dernières pièces') : t('shop.inStock', 'En stock')}
            </p>
            {p.description && <p className="ps-detail__desc">{p.description}</p>}

            {hasVariants(p) && (
              <fieldset className="ps-flavours">
                <legend>{variantText(t, p, 'one')}{variant ? <> : <b>{variant.name}</b></> : ''}</legend>
                <div className="ps-flavours__list" role="radiogroup" aria-label={variantText(t, p, 'one')}>
                  {p.variants.map((v) => (
                    <button
                      key={v.id} type="button" role="radio" aria-checked={variant?.id === v.id} disabled={!v.in_stock}
                      className={`ps-flavour${v.in_stock ? '' : ' is-out'}${flavourPhotos ? ' has-photo' : ''}`} onClick={() => setVariant(v)}
                    >
                      {flavourPhotos && (
                        <span className="ps-flavour__img" aria-hidden="true">
                          <ProductImage src={photoOf(v) || images[0]} alt="" name="" category={p.category} />
                        </span>
                      )}
                      {v.name}
                      {!v.in_stock && <small>{t('shop.outOfStock', 'Rupture')}</small>}
                      {v.in_stock && v.low_stock && <small className="is-low">{t('shop.fewLeft', 'Plus que quelques-uns')}</small>}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {canBuy && (
              <div className="ps-detail__buy">
                <Stepper value={qty} onChange={setQty} />
                <button className="ps-btn ps-btn--dark ps-btn--grow" onClick={() => onAdd(p, qty, variant)}>
                  <ShoppingBag size={18} /> {t('shop.add', 'Ajouter')} · <span className="ps-nowrap">{fmt(unitPrice(p) * qty)}</span>
                </button>
              </div>
            )}
            {canBuy && wa && (
              <a className="ps-btn ps-btn--wa ps-btn--block" href={waLink(wa, waText)} target="_blank" rel="noreferrer"><MessageCircle size={18} /> {t('shop.orderWa', 'Commander sur WhatsApp')}</a>
            )}
            <div className="ps-detail__actions">
              <button className={`ps-toggle${fav ? ' is-fav' : ''}`} aria-pressed={fav} onClick={() => onFav(p.id)}><Heart size={16} /> {fav ? t('shop.inFavs', 'Dans vos favoris') : t('shop.fav', 'Ajouter aux favoris')}</button>
              <button className="ps-toggle" onClick={() => onShare(p)}><Share2 size={16} /> {t('shop.share', 'Partager')}</button>
            </div>
            <ul className="ps-detail__info">
              <li><Wallet size={17} /> {t('shop.cod', 'Paiement à la livraison')}</li>
              {info && <li><Truck size={17} /> {t('shop.feeLine', '{{city}} {{local}} · autres villes {{other}}', { city: info.local_city, local: fmt(info.fee_local), other: fmt(info.fee_other) })}</li>}
              {freeShippingFrom(info) && (
                <li className="is-hl"><Gift size={17} /> {unitPrice(p) * qty >= freeShippingFrom(info)
                  ? t('shop.freeWithThis', 'Livraison offerte avec ce produit')
                  : t('shop.freeFrom', 'Livraison offerte dès {{amount}}', { amount: fmt(freeShippingFrom(info)) })}</li>
              )}
              <li><Store size={17} /> {t('shop.factPickup', 'Retrait gratuit à la salle')}</li>
            </ul>
          </div>
        </div>
        {related.length > 0 && (
          <div className="ps-detail__related">
            <h3>{t('shop.related', 'Dans la même catégorie')}</h3>
            <div className="ps-rail ps-rail--small">
              {related.map((r) => (
                <button key={r.id} className="ps-mini" onClick={() => onOpen(r)}>
                  <span className="ps-mini__img"><ProductImage src={r.image_url} alt="" name={r.name} category={r.category} /></span>
                  <b>{r.name}</b>
                  <Price p={r} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DrawerHead({ title, onClose, onBack }) {
  const { t } = useTranslation();
  return (
    <div className="ps-drawer__head">
      {onBack
        ? <button className="ps-iconbtn" onClick={onBack} aria-label={t('shop.back', 'Retour')}><ChevronLeft size={22} className="flip-rtl" /></button>
        : <span className="ps-drawer__spacer" />}
      <h2>{title}</h2>
      {onClose
        ? <button type="button" className="ps-iconbtn" onClick={onClose} aria-label={t('shop.close', 'Fermer')}><X size={22} /></button>
        : <span className="ps-drawer__spacer" />}
    </div>
  );
}

// How far the cart is from free delivery, then a small celebration when it gets there.
function FreeShippingMeter({ subtotal, freeFrom }) {
  const { t } = useTranslation();
  if (!freeFrom) return null;
  const left = Math.max(0, freeFrom - subtotal);
  const pct = Math.min(100, Math.round((subtotal / freeFrom) * 100));
  return (
    <div className={`ps-freeship${left ? '' : ' is-done'}`} role="status">
      <p>
        {left
          ? <><Truck size={17} /><span>{t('shop.freeLeftA', 'Plus que')} <b>{fmt(left)}</b> {t('shop.freeLeftB', 'pour la livraison offerte')}</span></>
          : <><span className="ps-freeship__check"><Check size={14} strokeWidth={3} /></span><span><b>{t('shop.freeDone', 'Livraison offerte !')}</b> {t('shop.freeDoneSub', 'Partout au Maroc')}</span></>}
      </p>
      <div className="ps-freeship__bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

// A protein in the cart and no shaker yet: offer the shakers in stock, cheapest first.
function CartUpsell({ products, lines, left, onAdd, onOpen }) {
  const { t } = useTranslation();
  if (!lines.some((l) => l.product.category === 'supplements') || lines.some((l) => SHAKER.test(l.product.name))) return null;
  const picks = products.filter((p) => SHAKER.test(p.name) && p.in_stock).sort((a, b) => unitPrice(a) - unitPrice(b)).slice(0, 3);
  if (!picks.length) return null;
  return (
    <section className="ps-upsell" aria-labelledby="ps-upsell-title">
      <h3 id="ps-upsell-title">{t('shop.upsellTitle', 'Ajoutez un shaker')}</h3>
      <p>{t('shop.upsellSub', 'Pour mélanger votre protéine sans grumeaux.')}</p>
      <ul className="ps-upsell__list">
        {picks.map((p) => (
          <li key={p.id} className="ps-upsell__item">
            <button className="ps-upsell__img" onClick={() => onOpen(p)} aria-label={`${t('shop.details', 'Détails')} : ${p.name}`}>
              <ProductImage src={p.image_url} alt="" name="" category={p.category} />
            </button>
            <span className="ps-upsell__name">{p.name}</span>
            <span className="ps-upsell__price">{fmt(unitPrice(p))}</span>
            {left > 0 && unitPrice(p) >= left && <span className="ps-upsell__tag">{t('shop.upsellUnlock', 'Livraison offerte avec')}</span>}
            <button className="ps-upsell__add" onClick={() => (hasVariants(p) ? onOpen(p) : onAdd(p))} aria-label={`${t('shop.upsellAdd', 'Ajouter')} : ${p.name}`}>
              <Plus size={16} /> {t('shop.upsellAdd', 'Ajouter')}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CartPanel({ lines, count, subtotal, info, freeFrom, products, wa, waText, setQty, onUpsellAdd, onOpen, onClose, onCheckout }) {
  const { t } = useTranslation();
  useEscape(onClose);
  return (
    <>
      <DrawerHead title={`${t('shop.cart', 'Panier')}${count ? ` (${count})` : ''}`} onClose={onClose} />
      {lines.length === 0 ? (
        <div className="ps-drawer__empty">
          <ShoppingBag size={44} strokeWidth={1.2} />
          <p>{t('shop.emptyCart', 'Votre panier est vide.')}</p>
          {freeFrom && <p className="ps-hint"><Gift size={15} /> {t('shop.freeFrom', 'Livraison offerte dès {{amount}}', { amount: fmt(freeFrom) })}</p>}
          <button className="ps-btn ps-btn--dark" onClick={onClose}>{t('shop.continue', 'Continuer mes achats')}</button>
        </div>
      ) : (
        <>
          {freeFrom && <div className="ps-cart__top"><FreeShippingMeter subtotal={subtotal} freeFrom={freeFrom} /></div>}
          <div className="ps-cart__body">
          <ul className="ps-lines">
            {lines.map(({ key, product: p, variant, qty, photo }) => (
              <li key={key} className="ps-line">
                <div className="ps-line__img"><ProductImage src={photo} alt="" name="" category={p.category} /></div>
                <div className="ps-line__info">
                  <strong>{p.name}</strong>
                  {variant && <span className="ps-line__flavour">{variantText(t, p, 'one')} : {variant.name}</span>}
                  <span>{fmt(unitPrice(p))}</span>
                  <Stepper small value={qty} onChange={(v) => setQty(key, v)} />
                </div>
                <div className="ps-line__end">
                  <strong>{fmt(unitPrice(p) * qty)}</strong>
                  <button className="ps-iconbtn ps-iconbtn--quiet" onClick={() => setQty(key, 0)} aria-label={`${t('shop.remove', 'Retirer')} ${p.name}${variant ? ` ${variant.name}` : ''}`}><Trash2 size={17} /></button>
                </div>
              </li>
            ))}
          </ul>
          <CartUpsell products={products} lines={lines} left={freeFrom ? Math.max(0, freeFrom - subtotal) : 0} onAdd={onUpsellAdd} onOpen={onOpen} />
          </div>
          <div className="ps-drawer__foot">
            <div className="ps-sum"><span>{t('shop.subtotal', 'Sous-total')}</span><strong>{fmt(subtotal)}</strong></div>
            {freeFrom && subtotal >= freeFrom
              ? <p className="ps-hint"><Gift size={15} /> {t('shop.freeDoneHint', 'Livraison offerte partout au Maroc.')}</p>
              : info && <p className="ps-hint"><Truck size={15} /> {t('shop.shippingHint', 'Livraison : {{city}} {{local}}, autres villes {{other}}', { city: info.local_city, local: fmt(info.fee_local), other: fmt(info.fee_other) })}</p>}
            <button className="ps-btn ps-btn--dark ps-btn--block" onClick={onCheckout}>{t('shop.checkout', 'Commander')} <ArrowRight size={17} className="flip-rtl" /></button>
            {wa && <a className="ps-btn ps-btn--wa-line ps-btn--block" href={waLink(wa, waText())} target="_blank" rel="noreferrer"><MessageCircle size={17} /> {t('shop.orderCartWa', 'Commander via WhatsApp')}</a>}
          </div>
        </>
      )}
    </>
  );
}

function CheckoutPanel({ lines, subtotal, info, freeFrom, onBack, onDone, onStockChanged }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => ({
    name: '', phone: '', delivery: 'delivery', city: info?.local_city || 'Tanger', otherCity: '', address: '', notes: '', website: '',
  }));
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState('');
  useEscape(onBack);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })); };
  const city = form.city === '__other' ? form.otherCity.trim() : form.city;
  const isLocal = norm(city) === norm(info?.local_city || 'Tanger');
  const baseFee = form.delivery === 'pickup' ? 0 : (isLocal ? info?.fee_local ?? 20 : info?.fee_other ?? 35);
  // Same rule as the server, which recomputes it when the order arrives.
  const freeReached = form.delivery === 'delivery' && !!freeFrom && subtotal >= freeFrom;
  const fee = freeReached ? 0 : baseFee;
  const total = subtotal + fee;

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 2) e.name = t('shop.errName', 'Indiquez votre nom complet');
    const digits = form.phone.replace(/[\s\-.()]/g, '');
    if (!/^(?:\+212|00212|0)[5-7]\d{8}$/.test(digits)) e.phone = t('shop.errPhone', 'Numéro marocain invalide (ex : 06 12 34 56 78)');
    if (form.delivery === 'delivery') {
      if (!city) e.city = t('shop.errCity', 'Indiquez votre ville');
      if (form.address.trim().length < 5) e.address = t('shop.errAddress', 'Indiquez votre adresse de livraison');
    }
    return e;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      requestAnimationFrame(() => document.querySelector('.ps-form [aria-invalid="true"]')?.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' }));
      return;
    }
    setSending(true);
    setSubmitError('');
    try {
      const res = await createShopOrder({
        customer_name: form.name.trim(),
        customer_phone: form.phone,
        delivery: form.delivery,
        city: form.delivery === 'delivery' ? city : null,
        address: form.delivery === 'delivery' ? form.address.trim() : null,
        notes: form.notes.trim() || null,
        utm_source: safeRead(UTM_KEY, null),
        website: form.website,
        items: lines.map((l) => ({ product_id: l.product.id, quantity: l.qty, ...(l.variant ? { variant_id: l.variant.id } : {}) })),
      });
      onDone(res, form.phone);
    } catch (err) {
      const d = err.response?.data?.detail;
      if (d?.code === 'out_of_stock') {
        setSubmitError(t('shop.errStock', 'Stock insuffisant : {{list}}. Modifiez votre panier.', {
          list: d.products.map((p) => `${p.name} (${p.available} ${t('shop.left', 'dispo')})`).join(', '),
        }));
        onStockChanged();
      } else if (d?.code === 'variant_required') {
        const product = lines.find((l) => l.product.name === d.name)?.product;
        setSubmitError(variantText(t, product, 'required', { name: d.name }));
        onStockChanged();
      } else if (!err.response) {
        // No answer at all: the phone is offline or the server is down, the form itself is fine.
        setSubmitError(t('shop.errNetwork', 'Impossible de joindre la boutique. Vérifiez votre connexion internet et réessayez : vos informations sont gardées.'));
      } else if (err.response?.status === 429) {
        setSubmitError(t('shop.errTooMany', 'Trop de commandes en peu de temps. Réessayez dans quelques minutes.'));
      } else {
        setSubmitError(t('shop.errGeneric', "La commande n'a pas pu être envoyée. Vérifiez vos informations et réessayez."));
      }
      setSending(false);
    }
  };

  const err = (k) => errors[k] && <small className="ps-err" id={`err-${k}`}>{errors[k]}</small>;

  return (
    <form onSubmit={submit} className="ps-checkout" noValidate>
      <DrawerHead title={t('shop.yourInfo', 'Vos informations')} onBack={onBack} />

      <div className="ps-form">
        <label className="ps-field">
          <span>{t('shop.fullName', 'Nom complet')}</span>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" autoCapitalize="words" enterKeyHint="next" aria-invalid={!!errors.name} aria-describedby={errors.name ? 'err-name' : undefined} />
          {err('name')}
        </label>
        <label className="ps-field">
          <span>{t('shop.phone', 'Téléphone')}</span>
          <input type="tel" inputMode="tel" dir="ltr" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="06 12 34 56 78" autoComplete="tel" enterKeyHint="next" aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'err-phone' : undefined} />
          {err('phone')}
        </label>

        <div className="ps-choice" role="radiogroup" aria-label={t('shop.deliveryMode', 'Mode de réception')}>
          <button type="button" role="radio" aria-checked={form.delivery === 'delivery'} onClick={() => set('delivery', 'delivery')}>
            <Truck size={20} />
            <span>{t('shop.homeDelivery', 'Livraison à domicile')}<small>{t('shop.cod', 'Paiement à la livraison')}</small></span>
          </button>
          <button type="button" role="radio" aria-checked={form.delivery === 'pickup'} onClick={() => set('delivery', 'pickup')}>
            <Store size={20} />
            <span>{t('shop.pickup', 'Retrait à la salle')}<small>{t('shop.free', 'Gratuit')}</small></span>
          </button>
        </div>

        {form.delivery === 'delivery' && (
          <>
            <label className="ps-field">
              <span>{t('shop.city', 'Ville')}</span>
              <select value={form.city} onChange={(e) => set('city', e.target.value)}>
                {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="__other">{t('shop.otherCity', 'Autre ville…')}</option>
              </select>
              {form.city === '__other' && <input value={form.otherCity} onChange={(e) => set('otherCity', e.target.value)} placeholder={t('shop.cityName', 'Nom de la ville')} aria-label={t('shop.cityName', 'Nom de la ville')} />}
              {err('city')}
            </label>
            <label className="ps-field">
              <span>{t('shop.address', 'Adresse')}</span>
              <textarea rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} placeholder={t('shop.addressPh', 'Quartier, rue, n°, repère…')} autoComplete="street-address" aria-invalid={!!errors.address} aria-describedby={errors.address ? 'err-address' : undefined} />
              {err('address')}
            </label>
          </>
        )}
        <label className="ps-field">
          <span>{t('shop.notes', 'Remarque (optionnel)')}</span>
          <input value={form.notes} onChange={(e) => set('notes', e.target.value)} maxLength={500} placeholder={t('shop.notesPh', 'Ex : appeler avant de passer')} />
        </label>
        {/* Honeypot: hidden from people, filled by bots */}
        <input className="ps-hp" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set('website', e.target.value)} aria-hidden="true" />
      </div>

      <div className="ps-drawer__foot">
        <div className="ps-sum"><span>{t('shop.subtotal', 'Sous-total')}</span><span>{fmt(subtotal)}</span></div>
        <div className="ps-sum">
          <span>{t('shop.shipping', 'Livraison')}{form.delivery === 'delivery' && city ? ` · ${city}` : ''}</span>
          <span key={`fee-${fee}`} className="is-live">{freeReached
            ? <span className="ps-freetag"><s>{fmt(baseFee)}</s> {t('shop.freeShipping', 'Offerte')}</span>
            : (fee ? fmt(fee) : t('shop.free', 'Gratuit'))}</span>
        </div>
        <div className="ps-sum ps-sum--total">
          <span>{form.delivery === 'pickup' ? t('shop.totalPickup', 'Total à payer au retrait') : t('shop.totalCod', 'Total à payer à la réception')}</span>
          <strong key={`total-${total}`} className="is-live">{fmt(total)}</strong>
        </div>
        {form.delivery === 'delivery' && freeFrom && !freeReached && (
          <p className="ps-hint ps-hint--lime"><Gift size={15} /> {t('shop.checkoutLeft', 'Ajoutez {{amount}} au panier pour la livraison offerte.', { amount: fmt(freeFrom - subtotal) })}</p>
        )}
        {submitError && <p className="ps-err ps-err--block" role="alert">{submitError}</p>}
        <button type="submit" className="ps-btn ps-btn--dark ps-btn--block" disabled={sending}>
          {sending ? t('shop.sending', 'Envoi…') : t('shop.confirmOrder', 'Confirmer la commande')}
        </button>
        <p className="ps-hint"><Phone size={14} /> {t('shop.callHint', 'Nous vous appelons pour confirmer avant l’envoi.')}</p>
      </div>
    </form>
  );
}

function DonePanel({ order, info, onClose, onTrack }) {
  const { t } = useTranslation();
  const wa = waNumber(info?.whatsapp);
  const msg = t('shop.waMsg', 'Bonjour, je viens de passer la commande {{ref}} sur votre boutique.', { ref: order.reference });
  const issued = new Date().toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  const pickup = order.delivery === 'pickup';
  const [qr, setQr] = useState(null);
  useEffect(() => {
    // Only buyers need this library, so it isn't part of the shop's first download.
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(order.reference, { margin: 1, width: 208, color: { dark: '#0e0f0c', light: '#ffffff' } }))
      .then(setQr)
      .catch(() => setQr(null));
  }, [order.reference]);
  return (
    <div className="ps-done">
      <DrawerHead title={t('shop.thanks', 'Merci pour votre commande !')} onClose={onClose} />
      <div className="ps-done__scroll">
        <div className="ps-done__card">
          <span className="ps-done__check"><Check size={30} /></span>
          <p className="ps-muted">{t('shop.orderNumber', 'Numéro de commande')}</p>
          <p className="ps-done__ref" dir="ltr">{order.reference}</p>
          {qr && <img className="ps-done__qr" src={qr} alt={`QR ${order.reference}`} />}
          <ol className="ps-steps">
            <li className="is-done"><span>{t('shop.stampIssued', 'Commande reçue')}</span><small dir="ltr">{issued}</small></li>
            <li><span>{t('shop.stampCall', 'Appel de confirmation')}</span><small>{t('shop.stampSoon', 'À venir')}</small></li>
            <li><span>{pickup ? t('shop.stampReady', 'Prête à la salle') : t('shop.stampShipped', 'Expédiée')}</span><small>{t('shop.stampSoon', 'À venir')}</small></li>
          </ol>
          <div className="ps-done__lines">
            {order.lines.map((l, i) => <div key={i} className="ps-sum"><span>{l.quantity} × {l.name}{l.variant ? ` — ${l.variant}` : ''}</span><span>{fmt(l.price * l.quantity)}</span></div>)}
            <div className="ps-sum"><span>{t('shop.shipping', 'Livraison')}</span><span>{order.shipping_fee ? fmt(order.shipping_fee) : (order.delivery === 'delivery' ? t('shop.freeShipping', 'Offerte') : t('shop.free', 'Gratuit'))}</span></div>
            <div className="ps-sum ps-sum--total">
              <span>{pickup ? t('shop.totalPickup', 'Total à payer au retrait') : t('shop.totalCod', 'Total à payer à la réception')}</span>
              <strong>{fmt(order.total)}</strong>
            </div>
          </div>
        </div>
        <p className="ps-hint"><Phone size={15} /> {pickup
          ? t('shop.nextPickup', 'Nous vous appelons dès que votre commande est prête à la salle.')
          : t('shop.nextDelivery', 'Nous vous appelons très vite pour confirmer, puis nous l’expédions.')}</p>
      </div>
      <div className="ps-drawer__foot">
        {wa && <a className="ps-btn ps-btn--wa ps-btn--block" href={waLink(wa, msg)} target="_blank" rel="noreferrer"><MessageCircle size={18} /> {t('shop.waContact', 'Nous écrire sur WhatsApp')}</a>}
        <button className="ps-btn ps-btn--line ps-btn--block" onClick={onTrack}><Package size={18} /> {t('shop.trackTitle', 'Suivre ma commande')}</button>
        <button className="ps-btn ps-btn--line ps-btn--block" onClick={onClose}>{t('shop.continue', 'Continuer mes achats')}</button>
      </div>
    </div>
  );
}

// The steps of an order, as the staff move it forward in OrdersPanel.
const TRACK_STEPS = {
  delivery: [
    ['pending', 'shop.stampIssued', 'Commande reçue'],
    ['confirmed', 'shop.trackConfirmed', 'Commande confirmée'],
    ['shipped', 'shop.stampShipped', 'Expédiée'],
    ['delivered', 'shop.trackDelivered', 'Livrée'],
  ],
  pickup: [
    ['pending', 'shop.stampIssued', 'Commande reçue'],
    ['confirmed', 'shop.trackConfirmed', 'Commande confirmée'],
    ['collected', 'shop.trackCollected', 'Récupérée à la salle'],
  ],
};

function TrackPanel({ wa, onClose }) {
  const { t, i18n } = useTranslation();
  const [form, setForm] = useState(() => {
    const last = safeRead(LAST_ORDER_KEY, null);
    return { reference: last?.reference || '', phone: last?.phone || '' };
  });
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
    setError('');
    setOrder(null);
    if (!form.reference.trim() || form.phone.replace(/\D/g, '').length < 9) {
      setError(t('shop.trackMissing', 'Entrez votre numéro de commande et votre téléphone.'));
      return;
    }
    setSending(true);
    try {
      setOrder(await trackShopOrder({ reference: form.reference.trim(), phone: form.phone }));
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 422) setError(t('shop.trackNotFound', 'Commande introuvable. Vérifiez le numéro de commande et le téléphone utilisé pour commander.'));
      else if (err.response?.status === 429) setError(t('shop.trackTooMany', 'Trop d’essais. Réessayez dans quelques minutes.'));
      else setError(t('shop.errNetworkShort', 'Impossible de joindre la boutique. Vérifiez votre connexion internet et réessayez.'));
    } finally {
      setSending(false);
    }
  };

  const steps = order ? TRACK_STEPS[order.delivery] : [];
  const reached = order ? steps.findIndex(([status]) => status === order.status) : -1;

  return (
    <form onSubmit={submit} className="ps-checkout" noValidate>
      <DrawerHead title={t('shop.trackTitle', 'Suivre ma commande')} onClose={onClose} />
      <div className="ps-form">
        <label className="ps-field">
          <span>{t('shop.orderNumber', 'Numéro de commande')}</span>
          <input dir="ltr" value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} placeholder="CMD-00012" maxLength={20} autoCapitalize="characters" enterKeyHint="next" />
        </label>
        <label className="ps-field">
          <span>{t('shop.phone', 'Téléphone')}</span>
          <input type="tel" inputMode="tel" dir="ltr" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="06 12 34 56 78" maxLength={30} autoComplete="tel" enterKeyHint="search" />
        </label>
        {error && <p className="ps-err" role="alert">{error}</p>}
        {order && (
          <div className="ps-track" role="status">
            <p className="ps-done__ref" dir="ltr">{order.reference}</p>
            <p className="ps-muted">{new Date(order.created_at).toLocaleDateString(i18n.language === 'ar' ? 'ar-MA' : 'fr-FR', { dateStyle: 'long' })}</p>
            {order.status === 'cancelled'
              ? <p className="ps-track__cancelled">{t('shop.trackCancelled', 'Cette commande a été annulée.')}</p>
              : (
                <ol className="ps-steps">
                  {steps.map(([status, key, fallback], i) => <li key={status} className={i <= reached ? 'is-done' : ''}><span>{t(key, fallback)}</span></li>)}
                </ol>
              )}
            <div className="ps-done__lines">
              {order.lines.map((l, i) => <div key={i} className="ps-sum"><span>{l.quantity} × {l.name}{l.variant ? ` — ${l.variant}` : ''}</span></div>)}
              <div className="ps-sum ps-sum--total"><span>{t('shop.total', 'Total')}</span><strong>{fmt(order.total)}</strong></div>
            </div>
          </div>
        )}
      </div>
      <div className="ps-drawer__foot">
        <button type="submit" className="ps-btn ps-btn--dark ps-btn--block" disabled={sending}>{sending ? t('shop.trackLoading', 'Recherche…') : t('shop.trackAction', 'Voir ma commande')}</button>
        {wa && <a className="ps-btn ps-btn--wa ps-btn--block" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle size={18} /> {t('shop.waContact', 'Nous écrire sur WhatsApp')}</a>}
      </div>
    </form>
  );
}
