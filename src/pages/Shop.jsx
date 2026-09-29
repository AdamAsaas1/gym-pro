import { useEffect, useMemo, useState } from 'react';
import {
  ShoppingBag, Plus, Minus, X, Search, Truck, Store, ShieldCheck, Phone, CheckCircle2,
  MessageCircle, Instagram, Trash2, ChevronLeft, PackageX,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getShopInfo, getShopProducts, getShopProduct, createShopOrder } from '../api/client';
import './Shop.css';

const CART_KEY = 'asaas_shop_cart_v1';
const UTM_KEY = 'asaas_shop_utm_v1';
const CITIES = [
  'Tanger', 'Casablanca', 'Rabat', 'Marrakech', 'Fès', 'Meknès', 'Agadir', 'Tétouan', 'Oujda', 'Kénitra', 'Salé',
  'Témara', 'Mohammedia', 'El Jadida', 'Nador', 'Larache', 'Asilah', 'Al Hoceima', 'Chefchaouen', 'Safi',
  'Béni Mellal', 'Khouribga', 'Settat', 'Taza', 'Essaouira', 'Ouarzazate', 'Errachidia', 'Guelmim', 'Laâyoune', 'Dakhla',
];
const CATEGORY_LABELS = { supplements: 'Compléments', accessories: 'Accessoires', clothing: 'Vêtements' };

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const fmt = (n) => `${Math.round(n * 100) / 100} DH`;
const unitPrice = (p) => (p.promo && p.promo > 0 ? p.promo : p.price);
const safeRead = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const safeWrite = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } };

// "0612..." -> "212612..." for wa.me links.
const waNumber = (phone) => {
  const d = (phone || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) return d.slice(2);
  if (d.startsWith('0') && d.length === 10) return `212${d.slice(1)}`;
  return d;
};

// Product photo with a clean placeholder when there is none or it fails to load.
function ProductImage({ src, alt, size = 36 }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) return <span className="shop-noimg"><ShoppingBag size={size} /></span>;
  return <img src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} />;
}

export default function Shop() {
  const { t } = useTranslation();
  const [info, setInfo] = useState(null);
  const [products, setProducts] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState(() => safeRead(CART_KEY, {})); // { productId: qty }
  const [detail, setDetail] = useState(null);
  const [panel, setPanel] = useState(null); // null | 'cart' | 'checkout' | 'done'
  const [order, setOrder] = useState(null);

  const loadProducts = () => getShopProducts().then(setProducts).catch(() => setLoadError(true));

  useEffect(() => {
    getShopInfo().then(setInfo).catch(() => setLoadError(true));
    loadProducts();
    // Remember where the visitor came from (e.g. ?utm_source=instagram on the ad link).
    const src = new URLSearchParams(window.location.search).get('utm_source');
    if (src) safeWrite(UTM_KEY, src.slice(0, 50));
  }, []);

  useEffect(() => { safeWrite(CART_KEY, cart); }, [cart]);
  useEffect(() => { if (info?.name) document.title = `${info.name} — ${t('shop.title', 'Boutique en ligne')}`; }, [info, t]);

  const byId = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))], [products]);
  const visible = useMemo(() => {
    const q = norm(query);
    return products.filter((p) => (category === 'all' || p.category === category) && (!q || norm(`${p.name} ${p.description}`).includes(q)));
  }, [products, category, query]);

  const lines = useMemo(() => Object.entries(cart)
    .map(([id, qty]) => ({ product: byId[id], qty }))
    .filter((l) => l.product && l.qty > 0), [cart, byId]);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + unitPrice(l.product) * l.qty, 0);

  const setQty = (id, qty) => setCart((c) => {
    const next = { ...c };
    if (qty <= 0) delete next[id]; else next[id] = Math.min(qty, 20);
    return next;
  });
  const add = (p, qty = 1) => { setQty(p.id, (cart[p.id] || 0) + qty); setDetail(null); setPanel('cart'); };
  const catLabel = (c) => t(`shop.categories.${c}`, CATEGORY_LABELS[c] || c);

  return (
    <div className="shop">
      <header className="shop-top">
        <div className="shop-top__brand">
          {info?.logo_base64 ? <img src={info.logo_base64} alt="" /> : <span className="shop-top__logo">{(info?.name || 'A')[0]}</span>}
          <strong>{info?.name || 'ASAAS GYM'}</strong>
        </div>
        <div className="shop-top__actions">
          {info?.instagram_url && (
            <a className="shop-icon-btn" href={info.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>
          )}
          <button className="shop-cart-btn" onClick={() => setPanel('cart')} aria-label={t('shop.cart', 'Panier')}>
            <ShoppingBag size={18} />
            {count > 0 && <span>{count}</span>}
          </button>
        </div>
      </header>

      <section className="shop-hero">
        <h1>{t('shop.heroTitle', 'Boostez vos performances 💪')}</h1>
        <p>{t('shop.heroSub', 'Compléments et accessoires sélectionnés par nos coachs.')}</p>
        <div className="shop-perks">
          <span><Truck size={15} /> {t('shop.perkDelivery', 'Livraison partout au Maroc')}</span>
          <span><ShieldCheck size={15} /> {t('shop.perkCod', 'Paiement à la livraison')}</span>
          {info && <span><Store size={15} /> {info.local_city} {fmt(info.fee_local)} · {t('shop.otherCities', 'autres villes')} {fmt(info.fee_other)}</span>}
        </div>
      </section>

      <div className="shop-filters">
        <label className="shop-search">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('shop.search', 'Rechercher un produit…')} />
        </label>
        <div className="shop-chips">
          <button className={category === 'all' ? 'is-on' : ''} onClick={() => setCategory('all')}>{t('shop.all', 'Tout')}</button>
          {categories.map((c) => (
            <button key={c} className={category === c ? 'is-on' : ''} onClick={() => setCategory(c)}>{catLabel(c)}</button>
          ))}
        </div>
      </div>

      {loadError && <p className="shop-empty">{t('shop.loadError', 'La boutique est momentanément indisponible. Réessayez dans un instant.')}</p>}

      <main className="shop-grid">
        {visible.map((p) => {
          const pct = p.promo && p.promo > 0 ? Math.round((1 - p.promo / p.price) * 100) : 0;
          return (
            <article key={p.id} className={`shop-card${p.in_stock ? '' : ' is-out'}`}>
              <button className="shop-card__img" onClick={() => setDetail(p)} aria-label={p.name}>
                <ProductImage src={p.image_url} alt={p.name} />
                {pct > 0 && <span className="shop-badge shop-badge--promo">-{pct}%</span>}
                {!p.in_stock && <span className="shop-badge shop-badge--out">{t('shop.outOfStock', 'Rupture')}</span>}
                {p.in_stock && p.low_stock && <span className="shop-badge shop-badge--low">{t('shop.lowStock', 'Dernières pièces')}</span>}
              </button>
              <div className="shop-card__body">
                {p.category && <span className="shop-card__cat">{catLabel(p.category)}</span>}
                <h3 onClick={() => setDetail(p)}>{p.name}</h3>
                <div className="shop-price">
                  <strong>{fmt(unitPrice(p))}</strong>
                  {pct > 0 && <s>{fmt(p.price)}</s>}
                </div>
                <button className="shop-btn shop-btn--add" disabled={!p.in_stock} onClick={() => add(p)}>
                  {p.in_stock ? <><Plus size={16} /> {t('shop.add', 'Ajouter')}</> : <><PackageX size={16} /> {t('shop.outOfStock', 'Rupture')}</>}
                </button>
              </div>
            </article>
          );
        })}
        {!loadError && products.length > 0 && visible.length === 0 && <p className="shop-empty">{t('shop.noResult', 'Aucun produit ne correspond.')}</p>}
      </main>

      <footer className="shop-footer">
        <span>© {new Date().getFullYear()} {info?.name || 'ASAAS GYM'}</span>
        {info?.whatsapp && <a href={`https://wa.me/${waNumber(info.whatsapp)}`} target="_blank" rel="noreferrer"><MessageCircle size={14} /> {t('shop.contactUs', 'Une question ? Écrivez-nous')}</a>}
      </footer>

      {count > 0 && !panel && (
        <button className="shop-floating" onClick={() => setPanel('cart')}>
          <ShoppingBag size={18} /> {t('shop.viewCart', 'Voir le panier')} · {count} · {fmt(subtotal)}
        </button>
      )}

      {detail && <ProductDetail p={detail} onClose={() => setDetail(null)} onAdd={add} catLabel={catLabel} />}

      {panel && (
        <div className="shop-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && panel !== 'done') setPanel(null); }}>
          <aside className="shop-drawer" role="dialog" aria-modal="true">
            {panel === 'cart' && (
              <CartPanel lines={lines} subtotal={subtotal} info={info} setQty={setQty} onClose={() => setPanel(null)} onCheckout={() => setPanel('checkout')} />
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

function ProductDetail({ p, onClose, onAdd, catLabel }) {
  const { t } = useTranslation();
  const [qty, setQty] = useState(1);
  const [images, setImages] = useState(p.image_url ? [p.image_url] : []);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    getShopProduct(p.id).then((d) => { if (d.images?.length) setImages(d.images); }).catch(() => {});
  }, [p.id]);
  return (
    <div className="shop-overlay shop-overlay--center" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="shop-detail" role="dialog" aria-modal="true">
        <button className="shop-icon-btn shop-detail__close" onClick={onClose} aria-label={t('shop.close', 'Fermer')}><X size={18} /></button>
        <div className="shop-detail__gallery">
          <div className="shop-detail__img"><ProductImage src={images[current]} alt={p.name} size={48} /></div>
          {images.length > 1 && (
            <div className="shop-detail__thumbs">
              {images.map((src, i) => (
                <button key={i} className={i === current ? 'is-on' : ''} onClick={() => setCurrent(i)} aria-label={`${i + 1}`}>
                  <ProductImage src={src} alt="" size={16} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="shop-detail__body">
          {p.category && <span className="shop-card__cat">{catLabel(p.category)}</span>}
          <h2>{p.name}</h2>
          <div className="shop-price shop-price--lg">
            <strong>{fmt(unitPrice(p))}</strong>
            {p.promo > 0 && <s>{fmt(p.price)}</s>}
          </div>
          {p.description && <p className="shop-detail__desc">{p.description}</p>}
          {p.in_stock ? (
            <div className="shop-detail__buy">
              <Stepper value={qty} onChange={setQty} />
              <button className="shop-btn" onClick={() => onAdd(p, qty)}><ShoppingBag size={16} /> {t('shop.addToCart', 'Ajouter au panier')}</button>
            </div>
          ) : <p className="shop-out-msg"><PackageX size={16} /> {t('shop.outOfStockLong', 'Ce produit est en rupture de stock pour le moment.')}</p>}
        </div>
      </div>
    </div>
  );
}

function Stepper({ value, onChange, min = 1 }) {
  return (
    <div className="shop-stepper">
      <button onClick={() => onChange(Math.max(min, value - 1))} aria-label="-"><Minus size={14} /></button>
      <span>{value}</span>
      <button onClick={() => onChange(Math.min(20, value + 1))} aria-label="+"><Plus size={14} /></button>
    </div>
  );
}

function CartPanel({ lines, subtotal, info, setQty, onClose, onCheckout }) {
  const { t } = useTranslation();
  return (
    <>
      <div className="shop-drawer__head">
        <h2>{t('shop.cart', 'Panier')}</h2>
        <button className="shop-icon-btn" onClick={onClose} aria-label={t('shop.close', 'Fermer')}><X size={18} /></button>
      </div>
      {lines.length === 0 ? (
        <div className="shop-drawer__empty"><ShoppingBag size={40} /> {t('shop.emptyCart', 'Votre panier est vide.')}</div>
      ) : (
        <>
          <div className="shop-lines">
            {lines.map(({ product: p, qty }) => (
              <div key={p.id} className="shop-line">
                <div className="shop-line__img"><ProductImage src={p.image_url} alt="" size={20} /></div>
                <div className="shop-line__info">
                  <strong>{p.name}</strong>
                  <span>{fmt(unitPrice(p))}</span>
                  <Stepper value={qty} onChange={(v) => setQty(p.id, v)} />
                </div>
                <div className="shop-line__end">
                  <strong>{fmt(unitPrice(p) * qty)}</strong>
                  <button className="shop-icon-btn" onClick={() => setQty(p.id, 0)} aria-label={t('shop.remove', 'Retirer')}><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="shop-drawer__foot">
            <div className="shop-sum"><span>{t('shop.subtotal', 'Sous-total')}</span><strong>{fmt(subtotal)}</strong></div>
            {info && <p className="shop-hint"><Truck size={14} /> {t('shop.shippingHint', 'Livraison : {{city}} {{local}}, autres villes {{other}}', { city: info.local_city, local: fmt(info.fee_local), other: fmt(info.fee_other) })}</p>}
            <button className="shop-btn shop-btn--block" onClick={onCheckout}>{t('shop.checkout', 'Commander')}</button>
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
    if (Object.keys(e).length) { setErrors(e); return; }
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
        items: lines.map((l) => ({ product_id: l.product.id, quantity: l.qty })),
      });
      onDone(res);
    } catch (err) {
      const d = err.response?.data?.detail;
      if (d?.code === 'out_of_stock') {
        setSubmitError(t('shop.errStock', 'Stock insuffisant : {{list}}. Modifiez votre panier.', {
          list: d.products.map((p) => `${p.name} (${p.available} ${t('shop.left', 'dispo')})`).join(', '),
        }));
        onStockChanged();
      } else if (err.response?.status === 429) {
        setSubmitError(t('shop.errTooMany', 'Trop de commandes en peu de temps. Réessayez dans quelques minutes.'));
      } else {
        setSubmitError(t('shop.errGeneric', "La commande n'a pas pu être envoyée. Vérifiez vos informations et réessayez."));
      }
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="shop-checkout">
      <div className="shop-drawer__head">
        <button type="button" className="shop-icon-btn" onClick={onBack} aria-label={t('shop.back', 'Retour')}><ChevronLeft size={18} /></button>
        <h2>{t('shop.yourInfo', 'Vos informations')}</h2>
        <span />
      </div>

      <div className="shop-form">
        <label>{t('shop.fullName', 'Nom complet')}
          <input value={form.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" />
          {errors.name && <small className="shop-err">{errors.name}</small>}
        </label>
        <label>{t('shop.phone', 'Téléphone')}
          <input type="tel" inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="06 12 34 56 78" autoComplete="tel" />
          {errors.phone && <small className="shop-err">{errors.phone}</small>}
        </label>

        <div className="shop-choice" role="radiogroup">
          <button type="button" role="radio" aria-checked={form.delivery === 'delivery'} className={form.delivery === 'delivery' ? 'is-on' : ''} onClick={() => set('delivery', 'delivery')}>
            <Truck size={18} /> <span>{t('shop.homeDelivery', 'Livraison à domicile')}<small>{t('shop.cod', 'Paiement à la livraison')}</small></span>
          </button>
          <button type="button" role="radio" aria-checked={form.delivery === 'pickup'} className={form.delivery === 'pickup' ? 'is-on' : ''} onClick={() => set('delivery', 'pickup')}>
            <Store size={18} /> <span>{t('shop.pickup', 'Retrait à la salle')}<small>{t('shop.free', 'Gratuit')}</small></span>
          </button>
        </div>

        {form.delivery === 'delivery' && (
          <>
            <label>{t('shop.city', 'Ville')}
              <select value={form.city} onChange={(e) => set('city', e.target.value)}>
                {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="__other">{t('shop.otherCity', 'Autre ville…')}</option>
              </select>
              {form.city === '__other' && <input value={form.otherCity} onChange={(e) => set('otherCity', e.target.value)} placeholder={t('shop.cityName', 'Nom de la ville')} />}
              {errors.city && <small className="shop-err">{errors.city}</small>}
            </label>
            <label>{t('shop.address', 'Adresse')}
              <textarea rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} placeholder={t('shop.addressPh', 'Quartier, rue, n°, repère…')} autoComplete="street-address" />
              {errors.address && <small className="shop-err">{errors.address}</small>}
            </label>
          </>
        )}
        <label>{t('shop.notes', 'Remarque (optionnel)')}
          <input value={form.notes} onChange={(e) => set('notes', e.target.value)} maxLength={500} placeholder={t('shop.notesPh', 'Ex : appeler avant de passer')} />
        </label>
        {/* Honeypot: hidden from people, filled by bots */}
        <input className="shop-hp" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set('website', e.target.value)} aria-hidden="true" />
      </div>

      <div className="shop-drawer__foot">
        <div className="shop-sum"><span>{t('shop.subtotal', 'Sous-total')}</span><span>{fmt(subtotal)}</span></div>
        <div className="shop-sum"><span>{t('shop.shipping', 'Livraison')}{form.delivery === 'delivery' && city ? ` (${city})` : ''}</span><span>{fee ? fmt(fee) : t('shop.free', 'Gratuit')}</span></div>
        <div className="shop-sum shop-sum--total"><span>{t('shop.total', 'Total')}</span><strong>{fmt(total)}</strong></div>
        {submitError && <p className="shop-err shop-err--block">{submitError}</p>}
        <button type="submit" className="shop-btn shop-btn--block" disabled={sending}>
          {sending ? t('shop.sending', 'Envoi…') : t('shop.confirmOrder', 'Confirmer la commande')}
        </button>
        <p className="shop-hint"><Phone size={13} /> {t('shop.callHint', 'Nous vous appelons pour confirmer avant l’envoi.')}</p>
      </div>
    </form>
  );
}

function DonePanel({ order, info, onClose }) {
  const { t } = useTranslation();
  const wa = waNumber(info?.whatsapp);
  const msg = t('shop.waMsg', 'Bonjour, je viens de passer la commande {{ref}} sur votre boutique.', { ref: order.reference });
  return (
    <div className="shop-done">
      <CheckCircle2 size={54} />
      <h2>{t('shop.thanks', 'Merci pour votre commande !')}</h2>
      <p>{t('shop.orderNumber', 'Numéro de commande')} <strong>{order.reference}</strong></p>
      <div className="shop-done__box">
        {order.lines.map((l, i) => <div key={i} className="shop-sum"><span>{l.quantity} × {l.name}</span><span>{fmt(l.price * l.quantity)}</span></div>)}
        <div className="shop-sum"><span>{t('shop.shipping', 'Livraison')}</span><span>{order.shipping_fee ? fmt(order.shipping_fee) : t('shop.free', 'Gratuit')}</span></div>
        <div className="shop-sum shop-sum--total"><span>{t('shop.totalCod', 'Total à payer à la réception')}</span><strong>{fmt(order.total)}</strong></div>
      </div>
      <p className="shop-hint"><Phone size={14} /> {order.delivery === 'pickup'
        ? t('shop.nextPickup', 'Nous vous appelons dès que votre commande est prête à la salle.')
        : t('shop.nextDelivery', 'Nous vous appelons très vite pour confirmer, puis nous l’expédions.')}</p>
      {wa && <a className="shop-btn shop-btn--wa shop-btn--block" href={`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"><MessageCircle size={16} /> {t('shop.waContact', 'Nous écrire sur WhatsApp')}</a>}
      <button className="shop-btn shop-btn--ghost shop-btn--block" onClick={onClose}>{t('shop.continue', 'Continuer mes achats')}</button>
    </div>
  );
}
