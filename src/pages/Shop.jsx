import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ShoppingBag, Plus, Minus, X, Search, Truck, Store, Phone, MessageCircle, Instagram, Trash2, ChevronLeft, ArrowRight,
  Menu, MapPin, Heart, Share2, Check, Wallet, Dumbbell, Shirt, FlaskConical, LayoutGrid, Package, SlidersHorizontal, Clock3,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { getShopInfo, getShopProducts, getShopProduct, createShopOrder, getActivities } from '../api/client';
import './Shop.css';

const CART_KEY = 'asaas_shop_cart_v1';
const UTM_KEY = 'asaas_shop_utm_v1';
const FAV_KEY = 'asaas_shop_favs_v1';
const RECENT_KEY = 'asaas_shop_recent_v1';
const LANG_KEY = 'asaas_shop_lang_v1';
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
const productLink = (id) => `${window.location.origin}/shop?p=${id}`;
const cartKey = (productId, variantId) => (variantId ? `${productId}:${variantId}` : String(productId));
const hasVariants = (p) => (p?.variants?.length || 0) > 0;

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
          <button className="ps-quickadd" onClick={(e) => (hasVariants(p) ? onOpen(p) : onAdd(p, e.currentTarget))} aria-label={hasVariants(p) ? `${t('shop.chooseFlavour', 'Choisir le goût')} : ${p.name}` : `${t('shop.addToCart', 'Ajouter au panier')} : ${p.name}`}>
            <Plus size={20} />
          </button>
        )}
      </div>
      <div className="ps-card__body">
        {p.category && <span className="ps-card__cat">{catLabel(p.category)}</span>}
        <button className="ps-card__name" onClick={() => onOpen(p)}>{p.name}</button>
        {hasVariants(p) && <span className="ps-card__flavours">{t('shop.nFlavours', '{{count}} goûts', { count: p.variants.length })}</span>}
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
  const [activities, setActivities] = useState([]);
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
  const [detail, setDetail] = useState(null);
  const [panel, setPanel] = useState(null); // null | 'cart' | 'checkout' | 'done'
  const [order, setOrder] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const cartBtn = useRef(null);

  const loadProducts = () => getShopProducts()
    .then(setProducts)
    .catch(() => setLoadError(true))
    .finally(() => setLoaded(true));

  useEffect(() => {
    const saved = safeRead(LANG_KEY, 'fr');
    if (saved && saved !== i18n.language) i18n.changeLanguage(saved);
    getShopInfo().then(setInfo).catch(() => setLoadError(true));
    loadProducts();
    // Only public facts are shown: name, description, monthly price, coach.
    getActivities()
      .then((list) => setActivities((list || []).map(({ id, name, description, price_month, coach_name, color }) => ({ id, name, description, price_month, coach_name, color }))))
      .catch(() => {});
    // Remember where the visitor came from (e.g. ?utm_source=instagram on the ad link).
    const src = new URLSearchParams(window.location.search).get('utm_source');
    if (src) safeWrite(UTM_KEY, src.slice(0, 50));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { safeWrite(CART_KEY, cart); }, [cart]);
  useEffect(() => { safeWrite(FAV_KEY, favs); }, [favs]);
  useEffect(() => { safeWrite(RECENT_KEY, recent); }, [recent]);
  useEffect(() => { if (info?.name) document.title = `${info.name.trim()} — ${t('shop.title', 'Boutique en ligne')}`; }, [info, t]);

  // A shared link (/shop?p=12) opens that product directly.
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current || !products.length) return;
    deepLinked.current = true;
    const id = Number(new URLSearchParams(window.location.search).get('p'));
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

  const byId = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))]
    .sort((a, b) => (b === 'supplements') - (a === 'supplements')), [products]);
  const catLabel = useCallback((c) => t(`shop.categories.${c}`, CATEGORY_LABELS[c] || c), [t]);
  const matches = useCallback((p, q) => !q || norm(`${p.name} ${p.description || ''} ${catLabel(p.category)}`).includes(q), [catLabel]);

  const visible = useMemo(() => {
    const q = norm(query);
    const list = products.filter((p) => (category === 'all' || p.category === category)
      && matches(p, q)
      && (!onlyStock || p.in_stock)
      && (!onlyPromo || discount(p) > 0)
      && (!onlyFav || favs.includes(p.id)));
    const sorted = [...list];
    if (sort === 'price-asc') sorted.sort((a, b) => unitPrice(a) - unitPrice(b));
    if (sort === 'price-desc') sorted.sort((a, b) => unitPrice(b) - unitPrice(a));
    if (sort === 'discount') sorted.sort((a, b) => discount(b) - discount(a));
    if (sort === 'featured') sorted.sort((a, b) => (b.in_stock - a.in_stock) || (discount(b) > 0) - (discount(a) > 0));
    return sorted;
  }, [products, category, query, matches, onlyStock, onlyPromo, onlyFav, favs, sort]);

  const onSale = useMemo(() => products.filter((p) => p.in_stock && discount(p) > 0).sort((a, b) => discount(b) - discount(a)), [products]);
  const bestPct = onSale.length ? discount(onSale[0]) : 0;
  const hero = useMemo(() => onSale.find((p) => p.image_url) || products.find((p) => p.image_url && p.in_stock) || onSale[0] || products[0], [onSale, products]);
  const recentProducts = useMemo(() => recent.map((id) => byId[id]).filter(Boolean), [recent, byId]);
  const coaches = useMemo(() => activities.filter((a) => a.coach_name), [activities]);

  const lines = useMemo(() => Object.entries(cart)
    .map(([key, qty]) => {
      const [pid, vid] = key.split(':').map(Number);
      const product = byId[pid];
      const variant = vid ? product?.variants?.find((v) => v.id === vid) : null;
      // A line whose flavour no longer exists, or a flavoured product saved without a flavour, is dropped.
      if (!product || (hasVariants(product) ? !variant : vid)) return { product: null, qty };
      return { key, product, variant, qty };
    })
    .filter((l) => l.product && l.qty > 0), [cart, byId]);
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
  const toggleFav = (id) => setFavs((f) => (f.includes(id) ? f.filter((x) => x !== id) : [id, ...f]));
  const openProduct = (p) => {
    setDetail(p);
    setRecent((r) => [p.id, ...r.filter((x) => x !== p.id)].slice(0, 10));
  };
  const share = async (p) => {
    const url = productLink(p.id);
    try {
      if (navigator.share) { await navigator.share({ title: p.name, text: `${p.name} — ${fmt(unitPrice(p))}`, url }); return; }
      await navigator.clipboard.writeText(url);
      showToast('copied');
    } catch { /* share sheet dismissed */ }
  };

  const shopName = (info?.name || 'ASAAS Pro').trim();
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
        <Truck size={15} /> {t('shop.barLine', 'Paiement à la livraison partout au Maroc · Retrait gratuit à la salle à {{city}}', { city })}
      </p>

      <header className="ps-header">
        <div className="ps-header__row">
          <button className="ps-logo" onClick={() => window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' })} aria-label={shopName}>
            <img src={info?.logo_base64 || '/logo_asaas.jpg'} alt="" />
            <span>{shopName}</span>
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
            <p>{t('shop.heroSub', 'La boutique de la salle {{name}} à {{city}}. Commandez en deux minutes, sans compte, et payez à la livraison.', { name: shopName, city })}</p>
            <div className="ps-hero__ctas">
              <button className="ps-btn ps-btn--dark" onClick={() => goTo('catalogue')}>{t('shop.shopNow', 'Découvrir la boutique')} <ArrowRight size={17} className="flip-rtl" /></button>
              {onSale.length > 0 && <button className="ps-btn ps-btn--line" onClick={() => goTo('promos')}>{t('shop.seePromos', 'Voir les promotions')}</button>}
            </div>
            <ul className="ps-hero__facts">
              <li><Wallet size={18} /> {t('shop.factCod', 'Paiement à la livraison')}</li>
              <li><Truck size={18} /> {info ? t('shop.factDelivery', '{{city}} {{local}} · Maroc {{other}}', { city, local: fmt(info.fee_local), other: fmt(info.fee_other) }) : t('shop.perkDelivery', 'Livraison partout au Maroc')}</li>
              <li><Store size={18} /> {t('shop.factPickup', 'Retrait gratuit à la salle')}</li>
            </ul>
          </div>
          {hero && (
            <div className="ps-hero__visual">
              <span className="ps-hero__disc" aria-hidden="true" />
              <button className="ps-hero__img" onClick={() => openProduct(hero)} aria-label={hero.name}>
                <ProductImage src={hero.image_url} alt={hero.name} name={hero.name} category={hero.category} />
              </button>
              <div className="ps-hero__tag">
                {discount(hero) > 0 && <span className="ps-badge ps-badge--inline">-{discount(hero)}%</span>}
                <strong>{hero.name}</strong>
                <Price p={hero} />
                {hero.in_stock && <button className="ps-btn ps-btn--dark ps-btn--sm" onClick={(e) => add(hero, 1, e.currentTarget)}><Plus size={16} /> {t('shop.add', 'Ajouter')}</button>}
              </div>
            </div>
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
            <p>{t('shop.aboutP1', '{{name}} est une salle de sport à {{city}}. Les compléments et accessoires de cette boutique sont choisis par les coachs de la salle.', { name: shopName, city })}</p>
            <p>{t('shop.aboutP2', 'Vous vous entraînez chez nous ? Retirez votre commande gratuitement à l’accueil. Ailleurs au Maroc ? Nous livrons chez vous.')}</p>
            {wa && <a className="ps-btn ps-btn--wa" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle size={18} /> {t('shop.aboutCta', 'Écrire aux coachs')}</a>}
          </div>
          {coaches.length > 0 && (
            <ul className="ps-coaches">
              {coaches.map((a) => (
                <li key={a.id} style={{ '--c': a.color || '#0e0f0c' }}>
                  <span className="ps-coaches__avatar" aria-hidden="true">{a.coach_name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
                  <span className="ps-coaches__who"><b>{a.coach_name}</b><small>{a.name}</small></span>
                  {Number(a.price_month) > 0 && <span className="ps-coaches__price">{fmt(Number(a.price_month))}<small>{t('shop.perMonth', '/ mois')}</small></span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer id="contact" className="ps-footer">
        <div className="ps-footer__inner">
          <div className="ps-footer__brand">
            <span className="ps-logo ps-logo--static"><img src={info?.logo_base64 || '/logo_asaas.jpg'} alt="" /><span>{shopName}</span></span>
            <p>{t('shop.footerLine', 'Salle de sport et boutique de nutrition sportive à {{city}}.', { city })}</p>
            <button className="ps-lang ps-lang--wide" onClick={switchLang}>{isAr ? 'Français' : 'العربية'}</button>
          </div>
          <div className="ps-footer__col">
            <h3>{t('shop.navShop', 'Boutique')}</h3>
            {categories.map((c) => <button key={c} onClick={() => openCategory(c)}>{catLabel(c)}</button>)}
            {onSale.length > 0 && <button onClick={() => goTo('promos')}>{t('shop.navPromos', 'Promotions')}</button>}
            <button onClick={showFavs}>{t('shop.favorites', 'Favoris')}</button>
          </div>
          <div className="ps-footer__col">
            <h3>{t('shop.infoTitle', 'Livraison et paiement')}</h3>
            {info && <p>{city} : {fmt(info.fee_local)}</p>}
            {info && <p>{t('shop.otherCities', 'Autres villes')} : {fmt(info.fee_other)}</p>}
            <p>{t('shop.cod', 'Paiement à la livraison')}</p>
            <p>{t('shop.pickup', 'Retrait à la salle')} : {t('shop.free', 'Gratuit')}</p>
          </div>
          <div className="ps-footer__col">
            <h3>{t('shop.navContact', 'Contact')}</h3>
            {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle size={17} /> <span dir="ltr">{info.whatsapp}</span></a>}
            {info?.instagram_url && <a href={info.instagram_url} target="_blank" rel="noreferrer"><Instagram size={17} /> Instagram</a>}
            <p><MapPin size={17} /> {shopName}, {city}</p>
          </div>
        </div>
        <p className="ps-footer__legal">© {new Date().getFullYear()} {shopName}</p>
      </footer>

      {wa && !overlayOpen && (
        <a className={`ps-wafab${toast ? ' is-raised' : ''}`} href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={26} /></a>
      )}
      {toast && (
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
              <span className="ps-logo ps-logo--static"><img src={info?.logo_base64 || '/logo_asaas.jpg'} alt="" /><span>{shopName}</span></span>
              <button className="ps-iconbtn" onClick={() => setMenuOpen(false)} aria-label={t('shop.close', 'Fermer')}><X size={22} /></button>
            </div>
            <button className="ps-menu__search" onClick={() => { setMenuOpen(false); setSearchOpen(true); }}><Search size={18} /> {t('shop.searchPh', 'Rechercher un produit')}</button>
            <p className="ps-menu__label">{t('shop.navCategories', 'Catégories')}</p>
            {categories.map((c) => {
              const Icon = CATEGORY_ICONS[c] || Package;
              return <button key={c} onClick={() => openCategory(c)}><Icon size={20} strokeWidth={1.6} /> {catLabel(c)}</button>;
            })}
            {onSale.length > 0 && <button className="is-promo" onClick={() => goTo('promos')}><span className="ps-badge ps-badge--inline">%</span> {t('shop.navPromos', 'Promotions')}</button>}
            <p className="ps-menu__label">{shopName}</p>
            <button onClick={showFavs}><Heart size={20} strokeWidth={1.6} /> {t('shop.favorites', 'Favoris')} ({favs.length})</button>
            <button onClick={() => { setMenuOpen(false); setPanel('cart'); }}><ShoppingBag size={20} strokeWidth={1.6} /> {t('shop.cart', 'Panier')} ({count})</button>
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
          products={products} catLabel={catLabel} matches={matches} categories={categories} onSale={onSale}
          initial={query}
          onClose={() => setSearchOpen(false)}
          onPick={(p) => { setSearchOpen(false); openProduct(p); }}
          onSubmit={(q) => { setQuery(q); setCategory('all'); setOnlyFav(false); goTo('catalogue'); }}
          onCategory={openCategory}
        />
      )}

      {detail && (
        <ProductDetail
          p={detail} fav={favs.includes(detail.id)} onFav={toggleFav} onShare={share} wa={wa} catLabel={catLabel} info={info}
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
              <CartPanel lines={lines} count={count} subtotal={subtotal} info={info} wa={wa} waText={cartWaText} setQty={setQty} onClose={() => setPanel(null)} onCheckout={() => setPanel('checkout')} />
            )}
            {panel === 'checkout' && (
              <CheckoutPanel
                lines={lines} subtotal={subtotal} info={info}
                onBack={() => setPanel('cart')}
                onDone={(o) => { setOrder(o); setCart({}); setPanel('done'); loadProducts(); }}
                onStockChanged={loadProducts}
              />
            )}
            {panel === 'done' && order && <DonePanel order={order} info={info} onClose={() => setPanel(null)} />}
          </aside>
        </div>
      )}
    </div>
  );
}

function SearchOverlay({ products, catLabel, matches, categories, onSale, initial, onClose, onPick, onSubmit, onCategory }) {
  const { t } = useTranslation();
  const [q, setQ] = useState(initial || '');
  const input = useRef(null);
  useEscape(onClose);
  useEffect(() => { input.current?.focus(); }, []);
  const nq = norm(q);
  const found = nq ? products.filter((p) => matches(p, nq)) : [];
  return (
    <div className="ps-overlay ps-overlay--top" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ps-search" role="dialog" aria-modal="true" aria-label={t('shop.search', 'Rechercher')}>
        <form className="ps-search__bar" role="search" onSubmit={(e) => { e.preventDefault(); onSubmit(q.trim()); }}>
          <Search size={20} />
          <input ref={input} type="search" enterKeyHint="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('shop.searchPh', 'Rechercher un produit')} aria-label={t('shop.searchPh', 'Rechercher un produit')} />
          {q && <button type="button" className="ps-iconbtn" onClick={() => { setQ(''); input.current?.focus(); }} aria-label={t('shop.clear', 'Effacer')}><X size={18} /></button>}
          <button type="button" className="ps-search__close" onClick={onClose}>{t('shop.cancel', 'Annuler')}</button>
        </form>
        <div className="ps-search__body">
          {!nq && (
            <>
              <p className="ps-menu__label">{t('shop.navCategories', 'Catégories')}</p>
              <div className="ps-search__quick">
                {categories.map((c) => <button key={c} onClick={() => onCategory(c)}>{catLabel(c)}</button>)}
              </div>
              {onSale.length > 0 && <p className="ps-menu__label">{t('shop.navPromos', 'Promotions')}</p>}
              {onSale.slice(0, 4).map((p) => <SearchRow key={p.id} p={p} onPick={onPick} catLabel={catLabel} />)}
            </>
          )}
          {nq && found.length === 0 && <p className="ps-search__none">{t('shop.noResultFor', 'Aucun produit pour « {{q}} ».', { q })}</p>}
          {found.slice(0, 6).map((p) => <SearchRow key={p.id} p={p} onPick={onPick} catLabel={catLabel} />)}
          {found.length > 0 && (
            <button className="ps-btn ps-btn--dark ps-btn--block" onClick={() => onSubmit(q.trim())}>{t('shop.seeResults', 'Voir les {{count}} résultats', { count: found.length })} <ArrowRight size={17} className="flip-rtl" /></button>
          )}
        </div>
      </div>
    </div>
  );
}

function SearchRow({ p, onPick, catLabel }) {
  return (
    <button className="ps-searchrow" onClick={() => onPick(p)}>
      <span className="ps-searchrow__img"><ProductImage src={p.image_url} alt="" name="" category={p.category} /></span>
      <span className="ps-searchrow__txt"><b>{p.name}</b><small>{catLabel(p.category)}</small></span>
      <Price p={p} />
    </button>
  );
}

function ProductDetail({ p, fav, onFav, onShare, wa, info, catLabel, related, onOpen, onClose, onAdd }) {
  const { t } = useTranslation();
  const [qty, setQty] = useState(1);
  const [images, setImages] = useState(p.image_url ? [p.image_url] : []);
  const [current, setCurrent] = useState(0);
  const pct = discount(p);
  const firstInStock = () => p.variants?.find((v) => v.in_stock) || null;
  const [variant, setVariant] = useState(firstInStock);
  const canBuy = p.in_stock && (!hasVariants(p) || variant?.in_stock);
  useEscape(onClose);

  useEffect(() => {
    setQty(1); setCurrent(0); setImages(p.image_url ? [p.image_url] : []); setVariant(firstInStock());
    getShopProduct(p.id).then((d) => { if (d.images?.length) setImages(d.images); }).catch(() => {});
  }, [p.id, p.image_url]);

  const waText = t('shop.waProduct', 'Bonjour, je voudrais commander : {{qty}} × {{name}} ({{price}}). {{link}}', { qty, name: variant ? `${p.name} — ${variant.name}` : p.name, price: fmt(unitPrice(p) * qty), link: productLink(p.id) });

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
                <legend>{t('shop.flavour', 'Goût')}{variant ? <> : <b>{variant.name}</b></> : ''}</legend>
                <div className="ps-flavours__list" role="radiogroup" aria-label={t('shop.flavour', 'Goût')}>
                  {p.variants.map((v) => (
                    <button
                      key={v.id} type="button" role="radio" aria-checked={variant?.id === v.id} disabled={!v.in_stock}
                      className={`ps-flavour${v.in_stock ? '' : ' is-out'}`} onClick={() => setVariant(v)}
                    >
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

function CartPanel({ lines, count, subtotal, info, wa, waText, setQty, onClose, onCheckout }) {
  const { t } = useTranslation();
  useEscape(onClose);
  return (
    <>
      <DrawerHead title={`${t('shop.cart', 'Panier')}${count ? ` (${count})` : ''}`} onClose={onClose} />
      {lines.length === 0 ? (
        <div className="ps-drawer__empty">
          <ShoppingBag size={44} strokeWidth={1.2} />
          <p>{t('shop.emptyCart', 'Votre panier est vide.')}</p>
          <button className="ps-btn ps-btn--dark" onClick={onClose}>{t('shop.continue', 'Continuer mes achats')}</button>
        </div>
      ) : (
        <>
          <ul className="ps-lines">
            {lines.map(({ key, product: p, variant, qty }) => (
              <li key={key} className="ps-line">
                <div className="ps-line__img"><ProductImage src={p.image_url} alt="" name="" category={p.category} /></div>
                <div className="ps-line__info">
                  <strong>{p.name}</strong>
                  {variant && <span className="ps-line__flavour">{t('shop.flavour', 'Goût')} : {variant.name}</span>}
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
          <div className="ps-drawer__foot">
            <div className="ps-sum"><span>{t('shop.subtotal', 'Sous-total')}</span><strong>{fmt(subtotal)}</strong></div>
            {info && <p className="ps-hint"><Truck size={15} /> {t('shop.shippingHint', 'Livraison : {{city}} {{local}}, autres villes {{other}}', { city: info.local_city, local: fmt(info.fee_local), other: fmt(info.fee_other) })}</p>}
            <button className="ps-btn ps-btn--dark ps-btn--block" onClick={onCheckout}>{t('shop.checkout', 'Commander')} <ArrowRight size={17} className="flip-rtl" /></button>
            {wa && <a className="ps-btn ps-btn--wa-line ps-btn--block" href={waLink(wa, waText())} target="_blank" rel="noreferrer"><MessageCircle size={17} /> {t('shop.orderCartWa', 'Commander via WhatsApp')}</a>}
          </div>
        </>
      )}
    </>
  );
}

function CheckoutPanel({ lines, subtotal, info, onBack, onDone, onStockChanged }) {
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
  const fee = form.delivery === 'pickup' ? 0 : (isLocal ? info?.fee_local ?? 20 : info?.fee_other ?? 35);
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
      onDone(res);
    } catch (err) {
      const d = err.response?.data?.detail;
      if (d?.code === 'out_of_stock') {
        setSubmitError(t('shop.errStock', 'Stock insuffisant : {{list}}. Modifiez votre panier.', {
          list: d.products.map((p) => `${p.name} (${p.available} ${t('shop.left', 'dispo')})`).join(', '),
        }));
        onStockChanged();
      } else if (d?.code === 'variant_required') {
        setSubmitError(t('shop.errFlavour', 'Choisissez un goût pour {{name}} : retirez-le du panier puis ajoutez-le depuis sa page.', { name: d.name }));
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
          <span key={`fee-${fee}`} className="is-live">{fee ? fmt(fee) : t('shop.free', 'Gratuit')}</span>
        </div>
        <div className="ps-sum ps-sum--total">
          <span>{form.delivery === 'pickup' ? t('shop.totalPickup', 'Total à payer au retrait') : t('shop.totalCod', 'Total à payer à la réception')}</span>
          <strong key={`total-${total}`} className="is-live">{fmt(total)}</strong>
        </div>
        {submitError && <p className="ps-err ps-err--block" role="alert">{submitError}</p>}
        <button type="submit" className="ps-btn ps-btn--dark ps-btn--block" disabled={sending}>
          {sending ? t('shop.sending', 'Envoi…') : t('shop.confirmOrder', 'Confirmer la commande')}
        </button>
        <p className="ps-hint"><Phone size={14} /> {t('shop.callHint', 'Nous vous appelons pour confirmer avant l’envoi.')}</p>
      </div>
    </form>
  );
}

function DonePanel({ order, info, onClose }) {
  const { t } = useTranslation();
  const wa = waNumber(info?.whatsapp);
  const msg = t('shop.waMsg', 'Bonjour, je viens de passer la commande {{ref}} sur votre boutique.', { ref: order.reference });
  const issued = new Date().toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  const pickup = order.delivery === 'pickup';
  const [qr, setQr] = useState(null);
  useEffect(() => {
    QRCode.toDataURL(order.reference, { margin: 1, width: 208, color: { dark: '#0e0f0c', light: '#ffffff' } }).then(setQr).catch(() => setQr(null));
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
            <div className="ps-sum"><span>{t('shop.shipping', 'Livraison')}</span><span>{order.shipping_fee ? fmt(order.shipping_fee) : t('shop.free', 'Gratuit')}</span></div>
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
        <button className="ps-btn ps-btn--line ps-btn--block" onClick={onClose}>{t('shop.continue', 'Continuer mes achats')}</button>
      </div>
    </div>
  );
}
