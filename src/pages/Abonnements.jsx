import { createElement, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet, MessageCircle, Phone, Search, AlertTriangle, CalendarClock, CheckCircle2, UserX,
  TrendingUp, HandCoins, ArrowUpRight, Check,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useGym } from '../context/GymContext';
import { usePermissions } from '../context/PermissionContext';
import ActivityIcon from '../components/ActivityIcon';

const DAY = 86400000;
const PLAN_MONTHS = { mensuel: 1, trimestriel: 3, annuel: 12 };
const PLANS = ['mensuel', 'trimestriel', 'annuel'];
const CONTACT_KEY = 'gym_relances_v1';

const parseDay = (s) => {
  if (!s) return null;
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return y ? new Date(y, m - 1, d) : null;
};
const startOfToday = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
const fmtDH = (n) => `${Math.round(n).toLocaleString('fr-FR')} DH`;

// "0612-111-111" -> "212612111111" (Moroccan numbers), for wa.me links.
function whatsappNumber(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0') && digits.length === 10) return `212${digits.slice(1)}`;
  return digits;
}

// Last follow-up per member, remembered in this browser only (reception computer).
function readContacts() {
  try { return JSON.parse(localStorage.getItem(CONTACT_KEY)) || {}; } catch { return {}; }
}

export default function Abonnements() {
  const { membres, activites, gymSettings } = useGym();
  const { hasPageAccess } = usePermissions();
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'fr';
  const canPay = hasPageAccess('/paiements');

  const [tab, setTab] = useState('late');
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState(readContacts);

  const actById = useMemo(() => Object.fromEntries(activites.map((a) => [a.id, a])), [activites]);

  const rows = useMemo(() => {
    const today = startOfToday();
    return membres.map((m) => {
      const exp = parseDay(m.dateExpiration);
      const days = exp ? Math.round((exp - today) / DAY) : null;
      let group = 'ok';
      if (m.statut !== 'actif') group = 'inactive';
      else if (days == null || days < 0) group = 'late';
      else if (days <= 30) group = 'soon';
      return { m, days, group, price: actById[m.activite]?.prix?.[m.abonnement] ?? 0 };
    });
  }, [membres, actById]);

  const groups = useMemo(() => {
    const g = { late: [], soon: [], ok: [], inactive: [] };
    rows.forEach((r) => g[r.group].push(r));
    g.late.sort((a, b) => a.days - b.days);      // most overdue first
    g.soon.sort((a, b) => a.days - b.days);      // closest expiry first
    g.ok.sort((a, b) => a.days - b.days);
    g.inactive.sort((a, b) => (b.days ?? 0) - (a.days ?? 0));
    return g;
  }, [rows]);

  const kpis = useMemo(() => {
    const upToDate = [...groups.ok, ...groups.soon];
    return {
      // Monthly recurring revenue: each paid-up subscription spread over its length.
      mrr: upToDate.reduce((s, r) => s + r.price / (PLAN_MONTHS[r.m.abonnement] || 1), 0),
      toRecover: groups.late.reduce((s, r) => s + r.price, 0),
      soon7: groups.soon.filter((r) => r.days <= 7).length,
      plans: PLANS.map((p) => {
        const list = upToDate.filter((r) => r.m.abonnement === p);
        return { key: p, count: list.length, mrr: list.reduce((s, r) => s + r.price / PLAN_MONTHS[p], 0) };
      }),
      activeTotal: upToDate.length,
    };
  }, [groups]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups[tab].filter(({ m }) => !q
      || `${m.prenom} ${m.nom} ${m.telephone} ${actById[m.activite]?.nom || ''}`.toLowerCase().includes(q));
  }, [groups, tab, query, actById]);

  const planLabel = (p) => t(`subscriptions.${p === 'mensuel' ? 'monthly' : p === 'trimestriel' ? 'quarterly' : 'yearly'}`, p);
  const fmtDate = (s) => { const d = parseDay(s); return d ? new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric' }).format(d) : '—'; };

  const reminderText = ({ m, days, price }) => {
    const vars = {
      prenom: m.prenom,
      gym: gymSettings?.name?.trim() || 'la salle',
      formule: planLabel(m.abonnement).toLowerCase(),
      activite: actById[m.activite]?.nom || '',
      date: fmtDate(m.dateExpiration),
      n: days,
      montant: fmtDH(price),
    };
    return days < 0
      ? t('renewals.msgLate', "Bonjour {{prenom}}, c'est {{gym}} 👋 Votre abonnement {{formule}} {{activite}} a expiré le {{date}}. Passez à l'accueil pour le renouveler ({{montant}}). À très vite !", vars)
      : t('renewals.msgSoon', "Bonjour {{prenom}}, c'est {{gym}} 👋 Votre abonnement {{formule}} {{activite}} expire le {{date}}. Pensez à le renouveler ({{montant}}) pour continuer à vous entraîner sans interruption. À bientôt !", vars);
  };

  const markContacted = (id) => {
    const next = { ...contacts, [id]: new Date().toISOString() };
    setContacts(next);
    try { localStorage.setItem(CONTACT_KEY, JSON.stringify(next)); } catch { /* storage unavailable: keep in memory */ }
  };

  const contactedLabel = (id) => {
    const iso = contacts[id];
    if (!iso) return null;
    const d = new Date(iso);
    const ago = Math.round((startOfToday() - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / DAY);
    return ago === 0 ? t('renewals.contactedToday', "Relancé aujourd'hui") : t('renewals.contactedAgo', 'Relancé il y a {{n}} j', { n: ago });
  };

  const TABS = [
    { key: 'late', icon: AlertTriangle, label: t('renewals.tabLate', 'En retard'), tone: 'late' },
    { key: 'soon', icon: CalendarClock, label: t('renewals.tabSoon', 'Expire sous 30 j'), tone: 'soon' },
    { key: 'ok', icon: CheckCircle2, label: t('renewals.tabOk', 'À jour'), tone: 'ok' },
    { key: 'inactive', icon: UserX, label: t('renewals.tabInactive', 'Inactifs'), tone: 'muted' },
  ];

  return (
    <div className="page renew-page fade-in">
      <section className="members-hero">
        <div>
          <span className="members-hero__eyebrow">{t('titles.subscriptions', 'Abonnements')}</span>
          <h2 className="members-hero__title">{t('renewals.title', 'Renouvellements')}</h2>
          <p className="members-hero__subtitle">{t('renewals.subtitle', 'Relancez les membres en retard ou bientôt expirés, et encaissez leur renouvellement en un clic.')}</p>
        </div>
        <div className="members-hero__actions">
          <Link className="btn btn--ghost" to="/activites">{t('renewals.prices', 'Voir les tarifs')} <ArrowUpRight size={15} /></Link>
        </div>
      </section>

      <section className="members-kpis">
        <div className="members-kpi renew-kpi renew-kpi--late">
          <div className="members-kpi__label"><HandCoins size={13} /> {t('renewals.kpiRecover', 'À récupérer')}</div>
          <div className="members-kpi__value">{fmtDH(kpis.toRecover)}</div>
          <div className="renew-kpi__sub">{groups.late.length} {t('renewals.membersLate', 'membre(s) en retard')}</div>
        </div>
        <div className="members-kpi renew-kpi renew-kpi--soon">
          <div className="members-kpi__label"><CalendarClock size={13} /> {t('renewals.kpiSoon', 'Expirent sous 7 jours')}</div>
          <div className="members-kpi__value">{kpis.soon7}</div>
          <div className="renew-kpi__sub">{groups.soon.length} {t('renewals.within30', 'sous 30 jours')}</div>
        </div>
        <div className="members-kpi renew-kpi">
          <div className="members-kpi__label"><TrendingUp size={13} /> {t('renewals.kpiMrr', 'Revenu mensuel récurrent')}</div>
          <div className="members-kpi__value">{fmtDH(kpis.mrr)}</div>
          <div className="renew-kpi__sub">{t('renewals.mrrHint', 'abonnements à jour, ramenés au mois')}</div>
        </div>
        <div className="members-kpi renew-kpi">
          <div className="members-kpi__label">{t('renewals.kpiPlans', 'Formules (membres à jour)')}</div>
          <div className="renew-plans">
            {kpis.plans.map((p) => (
              <div key={p.key} className="renew-plans__row" title={`${fmtDH(p.mrr)} / ${t('activities.form.perMonth', 'mois')}`}>
                <span>{planLabel(p.key)}</span>
                <span className="renew-plans__track"><span style={{ width: `${kpis.activeTotal ? (p.count / kpis.activeTotal) * 100 : 0}%` }} /></span>
                <strong>{p.count}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="renew-toolbar">
        <div className="renew-tabs" role="tablist">
          {TABS.map(({ key, icon, label, tone }) => (
            <button key={key} role="tab" aria-selected={tab === key} className={`renew-tab renew-tab--${tone}${tab === key ? ' is-active' : ''}`} onClick={() => setTab(key)}>
              {createElement(icon, { size: 15 })} {label} <span className="renew-tab__count">{groups[key].length}</span>
            </button>
          ))}
        </div>
        <label className="coach-search renew-search">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('renewals.search', 'Rechercher un membre…')} />
        </label>
      </div>

      <section className="card renew-list">
        {list.length === 0 ? (
          <div className="dash2-empty">
            <CheckCircle2 size={30} />
            {query ? t('renewals.noResult', 'Aucun membre ne correspond.') : tab === 'late'
              ? t('renewals.noneLate', 'Aucun membre en retard 🎉')
              : t('renewals.noneHere', 'Aucun membre dans cette catégorie.')}
          </div>
        ) : list.map((r) => {
          const { m, days, price } = r;
          const act = actById[m.activite];
          const wa = whatsappNumber(m.telephone);
          const contacted = contactedLabel(m.id);
          const status = days == null ? null : days < 0
            ? { cls: 'is-late', text: t('dashboard.v2.lateBy', '{{n}} j de retard', { n: -days }) }
            : days === 0 ? { cls: 'is-late', text: t('dashboard.v2.todayShort', "Aujourd'hui") }
              : { cls: days <= 7 ? 'is-soon' : 'is-ok', text: t('dashboard.v2.inDays', 'dans {{n}} j', { n: days }) };
          return (
            <div key={m.id} className="renew-row">
              <div className="renew-row__who">
                {m.photoBase64
                  ? <img className="dash2-avatar dash2-avatar--img" src={m.photoBase64} alt="" style={{ '--tc': act?.couleur || 'var(--w-ink-2)' }} />
                  : <span className="dash2-avatar" style={{ '--tc': act?.couleur || 'var(--w-ink-2)' }}>{m.prenom?.[0]}{m.nom?.[0]}</span>}
                <span className="renew-row__name">
                  {m.prenom} {m.nom}
                  <small>{m.telephone || '—'}{contacted && <em className="renew-row__contacted"><Check size={11} /> {contacted}</em>}</small>
                </span>
              </div>
              <div className="renew-row__plan">
                <span className="renew-row__act" style={{ '--tc': act?.couleur || 'var(--w-ink-2)' }}><ActivityIcon icon={act?.icon} size={13} /> {act?.nom || '—'}</span>
                <small>{planLabel(m.abonnement)} · {fmtDH(price)}</small>
              </div>
              <div className="renew-row__exp">
                <span>{fmtDate(m.dateExpiration)}</span>
                {status && <span className={`dash2-pill ${status.cls}`}>{status.text}</span>}
              </div>
              <div className="renew-row__actions">
                {canPay && (
                  <Link className="btn btn--primary btn--sm" to={`/paiements?membre=${m.id}`}>
                    <Wallet size={14} /> {t('renewals.renew', 'Encaisser')}
                  </Link>
                )}
                {wa && (
                  <a
                    className="renew-icon renew-icon--wa" href={`https://wa.me/${wa}?text=${encodeURIComponent(reminderText(r))}`}
                    target="_blank" rel="noreferrer" title={t('renewals.whatsapp', 'Relancer sur WhatsApp')}
                    onClick={() => markContacted(m.id)}
                  >
                    <MessageCircle size={16} />
                  </a>
                )}
                {m.telephone && (
                  <a className="renew-icon" href={`tel:${m.telephone.replace(/[^\d+]/g, '')}`} title={t('coaches.call', 'Appeler')} onClick={() => markContacted(m.id)}>
                    <Phone size={16} />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
