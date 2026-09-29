import { createElement, useMemo, useState } from 'react';
import {
  Phone, MessageCircle, Truck, Store, CheckCircle2, XCircle, PackageCheck, RotateCcw, Search,
  Instagram, Globe, Smartphone, Copy, Check, ExternalLink, Hash, StickyNote,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { updateCommande } from '../api/client';

const fmt = (n) => `${Math.round((n || 0) * 100) / 100} DH`;
const ref = (id) => `CMD-${String(id).padStart(5, '0')}`;

const waNumber = (phone) => {
  const d = (phone || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) return d.slice(2);
  if (d.startsWith('0') && d.length === 10) return `212${d.slice(1)}`;
  return d;
};

const TABS = [
  { key: 'pending', statuses: ['pending'] },
  { key: 'confirmed', statuses: ['confirmed'] },
  { key: 'shipped', statuses: ['shipped'] },
  { key: 'done', statuses: ['delivered', 'collected'] },
  { key: 'cancelled', statuses: ['cancelled'] },
  { key: 'all', statuses: null },
];

export default function OrdersPanel({ commandes, setCommandes, gymName }) {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState('pending');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [tracking, setTracking] = useState({});
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [copied, setCopied] = useState(false);

  // In production the shop has its own domain (asaaspro.com), separate from the admin app.
  const shopOrigin = import.meta.env.VITE_SHOP_URL || window.location.origin;
  const shopLink = shopOrigin === window.location.origin ? `${shopOrigin}/shop?utm_source=instagram` : `${shopOrigin}/?utm_source=instagram`;

  const tabLabel = {
    pending: t('orders.tabs.pending', 'À confirmer'),
    confirmed: t('orders.tabs.confirmed', 'À expédier'),
    shipped: t('orders.tabs.shipped', 'En livraison'),
    done: t('orders.tabs.done', 'Terminées'),
    cancelled: t('orders.tabs.cancelled', 'Annulées'),
    all: t('orders.tabs.all', 'Toutes'),
  };
  const statusLabel = {
    pending: t('orders.status.pending', 'À confirmer'),
    confirmed: t('orders.status.confirmed', 'Confirmée'),
    shipped: t('orders.status.shipped', 'Expédiée'),
    delivered: t('orders.status.delivered', 'Livrée'),
    collected: t('orders.status.collected', 'Récupérée'),
    cancelled: t('orders.status.cancelled', 'Annulée'),
  };

  const counts = useMemo(() => Object.fromEntries(TABS.map((x) => [
    x.key, x.statuses ? commandes.filter((c) => x.statuses.includes(c.status)).length : commandes.length,
  ])), [commandes]);

  const kpis = useMemo(() => {
    const now = new Date();
    const month = commandes.filter((c) => {
      const d = new Date(c.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && c.status !== 'cancelled';
    });
    return {
      monthCount: month.length,
      monthRevenue: month.reduce((s, c) => s + c.total_price, 0),
      instagram: month.filter((c) => c.utm_source === 'instagram').length,
      web: month.filter((c) => c.source === 'web').length,
    };
  }, [commandes]);

  const visible = useMemo(() => {
    const statuses = TABS.find((x) => x.key === tab).statuses;
    const q = query.trim().toLowerCase();
    return commandes
      .filter((c) => !statuses || statuses.includes(c.status))
      .filter((c) => !q || `${ref(c.id)} ${c.customer_name || ''} ${c.membre_prenom || ''} ${c.membre_nom || ''} ${c.customer_phone || ''} ${c.city || ''}`
        .toLowerCase().includes(q))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [commandes, tab, query]);

  const change = async (cmd, status, extra = {}) => {
    setBusy(cmd.id);
    setError('');
    try {
      const updated = await updateCommande(cmd.id, { status, ...extra });
      setCommandes((prev) => prev.map((c) => (c.id === cmd.id ? { ...c, ...updated } : c)));
      setConfirmCancel(null);
    } catch (err) {
      const d = err.response?.data?.detail;
      setError(typeof d === 'string' ? d : t('orders.errUpdate', 'La mise à jour a échoué. Réessayez.'));
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shopLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable: the link stays visible */ }
  };

  const customerName = (c) => c.customer_name || `${c.membre_prenom || ''} ${c.membre_nom || ''}`.trim() || t('orders.unknown', 'Client');

  const waMessage = (c) => {
    const items = (c.items || []).map((it) => `• ${it.quantity} × ${it.product?.name || `#${it.product_id}`}`).join('\n');
    const where = c.payment_method === 'cash_on_delivery'
      ? t('orders.waDelivery', 'Livraison : {{address}}, {{city}}', { address: c.address || '', city: c.city || '' })
      : t('orders.waPickup', 'Retrait à la salle');
    return t('orders.waConfirm', 'Bonjour {{name}}, c\'est {{gym}} 👋\nNous avons bien reçu votre commande {{ref}} :\n{{items}}\n{{where}}\nTotal à payer : {{total}}\nPouvez-vous nous confirmer la commande ? Merci !', {
      name: customerName(c).split(' ')[0], gym: gymName || 'ASAAS GYM', ref: ref(c.id), items, where, total: fmt(c.total_price),
    });
  };

  const sourceBadge = (c) => {
    if (c.utm_source === 'instagram') return <span className="ord-src ord-src--ig"><Instagram size={12} /> Instagram</span>;
    if (c.source === 'web') return <span className="ord-src"><Globe size={12} /> {t('orders.srcWeb', 'Site')}</span>;
    return <span className="ord-src"><Smartphone size={12} /> {t('orders.srcApp', 'App membre')}</span>;
  };

  const nextStep = (c) => {
    const delivery = c.payment_method === 'cash_on_delivery';
    switch (c.status) {
      case 'pending': return { status: 'confirmed', label: t('orders.actConfirm', 'Confirmer'), icon: CheckCircle2 };
      case 'confirmed': return delivery
        ? { status: 'shipped', label: t('orders.actShip', 'Marquer expédiée'), icon: Truck, needsTracking: true }
        : { status: 'collected', label: t('orders.actCollected', 'Récupérée par le client'), icon: Store };
      case 'shipped': return { status: 'delivered', label: t('orders.actDelivered', 'Livrée & payée'), icon: PackageCheck };
      default: return null;
    }
  };

  const fmtDate = (s) => new Intl.DateTimeFormat(i18n.language || 'fr', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(s));

  return (
    <div className="ord fade-in">
      <section className="ord-top">
        <div className="ord-kpis">
          <div className="ord-kpi"><span>{t('orders.kpiToConfirm', 'À confirmer')}</span><strong className={counts.pending ? 'is-hot' : ''}>{counts.pending}</strong></div>
          <div className="ord-kpi"><span>{t('orders.kpiToShip', 'À expédier')}</span><strong>{counts.confirmed}</strong></div>
          <div className="ord-kpi"><span>{t('orders.kpiMonth', 'Ventes ce mois')}</span><strong>{fmt(kpis.monthRevenue)}</strong><small>{kpis.monthCount} {t('orders.orders', 'commande(s)')}</small></div>
          <div className="ord-kpi"><span>{t('orders.kpiInstagram', 'Via Instagram ce mois')}</span><strong>{kpis.instagram}</strong><small>{kpis.web} {t('orders.viaSite', 'via le site')}</small></div>
        </div>
        <div className="ord-link">
          <div className="ord-link__title"><Instagram size={15} /> {t('orders.igLink', 'Lien à mettre dans votre bio et vos pubs Instagram')}</div>
          <div className="ord-link__row">
            <code>{shopLink}</code>
            <button className="btn btn--ghost btn--sm" onClick={copyLink}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? t('staff.copied', 'Copié') : t('staff.copy', 'Copier')}</button>
            <a className="btn btn--ghost btn--sm" href={shopLink} target="_blank" rel="noreferrer"><ExternalLink size={14} /> {t('orders.openShop', 'Voir la boutique')}</a>
          </div>
        </div>
      </section>

      <div className="renew-toolbar">
        <div className="renew-tabs" role="tablist">
          {TABS.map((x) => (
            <button key={x.key} role="tab" aria-selected={tab === x.key} className={`renew-tab${tab === x.key ? ' is-active renew-tab--ok' : ''}`} onClick={() => setTab(x.key)}>
              {tabLabel[x.key]} <span className={`renew-tab__count${x.key === 'pending' && counts.pending ? ' is-hot' : ''}`}>{counts[x.key]}</span>
            </button>
          ))}
        </div>
        <label className="coach-search renew-search">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('orders.search', 'N° de commande, nom, téléphone, ville…')} />
        </label>
      </div>

      {error && <div className="form-error form-error--block" style={{ marginTop: 12 }}>{error}</div>}

      {visible.length === 0 ? (
        <div className="act-empty"><PackageCheck size={34} /><h3>{tab === 'pending' ? t('orders.noneToConfirm', 'Aucune commande à confirmer 🎉') : t('orders.none', 'Aucune commande ici.')}</h3></div>
      ) : (
        <div className="ord-list">
          {visible.map((c) => {
            const step = nextStep(c);
            const wa = waNumber(c.customer_phone);
            const delivery = c.payment_method === 'cash_on_delivery';
            const subtotal = (c.items || []).reduce((s, it) => s + it.price * it.quantity, 0);
            return (
              <article key={c.id} className={`ord-card ord-card--${c.status}`}>
                <header className="ord-card__head">
                  <div>
                    <strong className="ord-card__ref">{ref(c.id)}</strong>
                    <span className="ord-card__date">{fmtDate(c.created_at)}</span>
                  </div>
                  <div className="ord-card__badges">
                    {sourceBadge(c)}
                    <span className={`ord-status ord-status--${c.status}`}>{statusLabel[c.status] || c.status}</span>
                  </div>
                </header>

                <div className="ord-card__body">
                  <div className="ord-card__col">
                    <div className="ord-card__label">{t('orders.customer', 'Client')}</div>
                    <strong>{customerName(c)}</strong>
                    {c.customer_phone && <a className="ord-card__phone" href={`tel:${c.customer_phone}`}><Phone size={13} /> {c.customer_phone}</a>}
                    <div className="ord-card__label" style={{ marginTop: 10 }}>{delivery ? t('orders.delivery', 'Livraison') : t('orders.pickup', 'Retrait à la salle')}</div>
                    {delivery ? (
                      <span className="ord-card__addr"><Truck size={13} /> {c.address}{c.city ? `, ${c.city}` : ''}</span>
                    ) : <span className="ord-card__addr"><Store size={13} /> {t('orders.pickupShort', 'À la salle')}</span>}
                    {c.tracking_number && <span className="ord-card__addr"><Hash size={13} /> {t('orders.tracking', 'Suivi')} : <b>{c.tracking_number}</b></span>}
                    {c.notes && <span className="ord-card__note"><StickyNote size={13} /> {c.notes}</span>}
                  </div>
                  <div className="ord-card__col">
                    <div className="ord-card__label">{t('orders.items', 'Articles')}</div>
                    <ul className="ord-items">
                      {(c.items || []).map((it) => (
                        <li key={it.id}><span>{it.quantity} × {it.product?.name || `#${it.product_id}`}</span><span>{fmt(it.price * it.quantity)}</span></li>
                      ))}
                    </ul>
                    <div className="ord-total">
                      {c.shipping_fee > 0 && <div><span>{t('orders.subtotal', 'Sous-total')}</span><span>{fmt(subtotal)}</span></div>}
                      {c.shipping_fee > 0 && <div><span>{t('orders.shippingFee', 'Frais de livraison')}</span><span>{fmt(c.shipping_fee)}</span></div>}
                      <div className="ord-total__main"><span>{t('orders.toCollect', 'À encaisser')}</span><strong>{fmt(c.total_price)}</strong></div>
                    </div>
                  </div>
                </div>

                <footer className="ord-card__foot">
                  <div className="ord-card__contact">
                    {wa && (
                      <a className="btn btn--ghost btn--sm ord-wa" href={`https://wa.me/${wa}?text=${encodeURIComponent(waMessage(c))}`} target="_blank" rel="noreferrer">
                        <MessageCircle size={14} /> {c.status === 'pending' ? t('orders.waConfirmBtn', 'Confirmer sur WhatsApp') : 'WhatsApp'}
                      </a>
                    )}
                    {c.customer_phone && <a className="btn btn--ghost btn--sm" href={`tel:${c.customer_phone}`}><Phone size={14} /> {t('coaches.call', 'Appeler')}</a>}
                  </div>
                  <div className="ord-card__actions">
                    {step?.needsTracking && (
                      <input
                        className="ord-tracking" placeholder={t('orders.trackingPh', 'N° de suivi (optionnel)')}
                        value={tracking[c.id] ?? ''} onChange={(e) => setTracking((x) => ({ ...x, [c.id]: e.target.value }))}
                      />
                    )}
                    {c.status !== 'cancelled' && !['delivered', 'collected'].includes(c.status) && (
                      confirmCancel === c.id ? (
                        <span className="seance-form__confirm">
                          {t('orders.cancelQ', 'Annuler ? (le stock sera remis)')}
                          <button className="btn btn--danger btn--sm" disabled={busy === c.id} onClick={() => change(c, 'cancelled')}>{t('orders.yes', 'Oui')}</button>
                          <button className="btn btn--ghost btn--sm" onClick={() => setConfirmCancel(null)}>{t('orders.no', 'Non')}</button>
                        </span>
                      ) : (
                        <button className="btn btn--ghost btn--sm ord-cancel" onClick={() => setConfirmCancel(c.id)}><XCircle size={14} /> {t('orders.actCancel', 'Annuler')}</button>
                      )
                    )}
                    {c.status === 'cancelled' && (
                      <button className="btn btn--ghost btn--sm" disabled={busy === c.id} onClick={() => change(c, 'pending')}><RotateCcw size={14} /> {t('orders.actReopen', 'Réactiver')}</button>
                    )}
                    {step && (
                      <button
                        className="btn btn--primary btn--sm" disabled={busy === c.id}
                        onClick={() => change(c, step.status, step.needsTracking ? { tracking_number: tracking[c.id] || '' } : {})}
                      >
                        {createElement(step.icon, { size: 14 })} {step.label}
                      </button>
                    )}
                  </div>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
