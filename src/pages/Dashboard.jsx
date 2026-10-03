import { createElement, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet, UserPlus, UserCheck, DoorOpen, AlertTriangle, ArrowUpRight, ArrowDownRight, Download,
  CheckCircle2, XCircle, Radio, Table2, BarChart3, Clock, Minus, CalendarClock,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, AreaChart, Area,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { useGym } from '../context/GymContext';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionContext';
import { exportMembresPDF, getAccessFeed } from '../api/client';
import ActivityIcon from '../components/ActivityIcon';

/* Chart tokens: series green validated for the dark surface (L band + 3:1); neon only for the one highlighted mark. */
const SERIES = 'var(--w-green)';
const HIGHLIGHT = 'var(--w-blue)';
const GRID = 'var(--w-card-2)';
const AXIS = 'var(--w-ink-3)';
const DAY = 86400000;

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
// "YYYY-MM-DD" parsed as a local date (not UTC) so buckets match the calendar day.
const parseDay = (s) => {
  if (!s) return null;
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return y ? new Date(y, m - 1, d) : null;
};
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const fmtDH = (n) => `${Math.round(n).toLocaleString('fr-FR')} DH`;

/* Period -> ordered buckets [{ key, label, from, to }] plus the equal-length previous window. */
function buildBuckets(period, lang) {
  const today = startOfDay(new Date());
  if (period === '12m') {
    const fmt = new Intl.DateTimeFormat(lang, { month: 'short' });
    const buckets = Array.from({ length: 12 }, (_, i) => {
      const from = new Date(today.getFullYear(), today.getMonth() - 11 + i, 1);
      const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
      return { key: monthKey(from), label: fmt.format(from), from, to };
    });
    const from = buckets[0].from;
    return { buckets, from, to: buckets[11].to, prevFrom: new Date(from.getFullYear() - 1, from.getMonth(), 1), unit: 'month' };
  }
  const n = period === '7d' ? 7 : 30;
  const fmt = new Intl.DateTimeFormat(lang, n === 7 ? { weekday: 'short' } : { day: 'numeric', month: 'short' });
  const buckets = Array.from({ length: n }, (_, i) => {
    const from = new Date(today.getTime() - (n - 1 - i) * DAY);
    return { key: dayKey(from), label: fmt.format(from), from, to: new Date(from.getTime() + DAY) };
  });
  const from = buckets[0].from;
  return { buckets, from, to: buckets[n - 1].to, prevFrom: new Date(from.getTime() - n * DAY), unit: 'day' };
}

function Delta({ current, previous, t }) {
  if (!previous && !current) return <span className="dash2-delta is-flat"><Minus size={12} /> 0%</span>;
  if (!previous) return <span className="dash2-delta is-up"><ArrowUpRight size={12} /> {t('dashboard.v2.new', 'nouveau')}</span>;
  const pct = Math.round(((current - previous) / previous) * 100);
  const cls = pct > 0 ? 'is-up' : pct < 0 ? 'is-down' : 'is-flat';
  const icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus;
  return <span className={`dash2-delta ${cls}`}>{createElement(icon, { size: 12 })} {pct > 0 ? '+' : ''}{pct}%</span>;
}

function Sparkline({ data }) {
  if (!data || data.length < 2) return null;
  return (
    <div className="dash2-spark" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES} stopOpacity={0.35} />
              <stop offset="100%" stopColor={SERIES} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={SERIES} strokeWidth={2} fill="url(#sparkFill)" isAnimationActive={false} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function KpiTile({ icon, label, value, delta, hint, spark, to, tone }) {
  const body = (
    <div className={`dash2-kpi${tone ? ` dash2-kpi--${tone}` : ''}`}>
      <div className="dash2-kpi__top">
        <span className="dash2-kpi__icon">{createElement(icon, { size: 18 })}</span>
        <span className="dash2-kpi__label">{label}</span>
      </div>
      <div className="dash2-kpi__value">{value}</div>
      <div className="dash2-kpi__foot">
        {delta}
        {hint && <span className="dash2-kpi__hint">{hint}</span>}
      </div>
      <Sparkline data={spark} />
    </div>
  );
  return to ? <Link to={to} className="dash2-kpi-link">{body}</Link> : body;
}

function ChartTooltip({ active, payload, label, format }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="dash2-tooltip">
      <div className="dash2-tooltip__label">{label}</div>
      <div className="dash2-tooltip__value">{format(payload[0].value)}</div>
    </div>
  );
}

// Backend refusal reasons are English codes; show them in the UI language.
const REASONS = {
  'Face not recognized': ['dashboard.v2.reasons.face', 'Visage non reconnu'],
  'No face detected in the frame': ['dashboard.v2.reasons.noFace', 'Aucun visage détecté'],
  'Multiple faces detected': ['dashboard.v2.reasons.multiple', 'Plusieurs visages détectés'],
  'Subscription has expired': ['dashboard.v2.reasons.expired', 'Abonnement expiré'],
  'Member status is inactive': ['dashboard.v2.reasons.inactive', 'Membre inactif'],
  'Invalid QR Code': ['dashboard.v2.reasons.qr', 'QR code invalide'],
  'Face recognition unavailable': ['dashboard.v2.reasons.unavailable', 'Reconnaissance indisponible'],
};

export default function Dashboard() {
  const { membres, paiements, activites, stats } = useGym();
  const { user } = useAuth();
  const { hasPageAccess } = usePermissions();
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'fr';
  const canSeeAccess = hasPageAccess('/acces');
  const canSeePayments = hasPageAccess('/paiements');

  const [period, setPeriod] = useState('12m');
  const [metric, setMetric] = useState(canSeePayments ? 'revenue' : 'signups');
  const [showTable, setShowTable] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [access, setAccess] = useState({ rows: [], loadedAt: null });

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  /* Live access feed: refreshed every 15 s while the dashboard is open. */
  useEffect(() => {
    if (!canSeeAccess) return undefined;
    let alive = true;
    // Yesterday 00:00 onwards is enough for "today" and the same-time-yesterday comparison.
    const load = () => {
      const d = new Date();
      const since = `${dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1))}T00:00:00`;
      return getAccessFeed(since)
        .then((rows) => { if (alive) setAccess({ rows: rows || [], loadedAt: new Date() }); })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 15000);
    return () => { alive = false; clearInterval(id); };
  }, [canSeeAccess]);

  const { buckets, from, to, prevFrom, unit } = useMemo(() => buildBuckets(period, lang), [period, lang]);

  /* Per-bucket revenue and sign-ups, plus current vs previous window totals. */
  const series = useMemo(() => {
    const keyOf = (d) => (unit === 'month' ? monthKey(d) : dayKey(d));
    const rev = {}; const sign = {};
    let revNow = 0; let revPrev = 0; let signNow = 0; let signPrev = 0;
    paiements.forEach((p) => {
      const d = parseDay(p.date);
      if (!d) return;
      if (d >= from && d < to) { rev[keyOf(d)] = (rev[keyOf(d)] || 0) + p.montant; revNow += p.montant; }
      else if (d >= prevFrom && d < from) revPrev += p.montant;
    });
    membres.forEach((m) => {
      const d = parseDay(m.dateInscription);
      if (!d) return;
      if (d >= from && d < to) { sign[keyOf(d)] = (sign[keyOf(d)] || 0) + 1; signNow += 1; }
      else if (d >= prevFrom && d < from) signPrev += 1;
    });
    const rows = buckets.map((b) => ({ key: b.key, label: b.label, revenue: rev[b.key] || 0, signups: sign[b.key] || 0 }));
    return { rows, revNow, revPrev, signNow, signPrev };
  }, [paiements, membres, buckets, from, to, prevFrom, unit]);

  /* Today's entrances: hourly histogram (6h–23h) and the latest events. */
  const today = useMemo(() => {
    const start = startOfDay(now);
    const rows = access.rows.filter((r) => new Date(r.timestamp) >= start);
    const authorized = rows.filter((r) => r.status === 'authorized');
    const hours = Array.from({ length: 18 }, (_, i) => ({ h: i + 6, label: `${i + 6}h`, count: 0 }));
    authorized.forEach((r) => {
      const h = new Date(r.timestamp).getHours();
      const slot = hours.find((x) => x.h === h);
      if (slot) slot.count += 1;
    });
    const yesterdayStart = new Date(start.getTime() - DAY);
    const yesterdaySameTime = new Date(now.getTime() - DAY);
    const yesterday = access.rows.filter((r) => {
      const d = new Date(r.timestamp);
      return r.status === 'authorized' && d >= yesterdayStart && d <= yesterdaySameTime;
    }).length;
    return {
      entries: authorized.length,
      denied: rows.length - authorized.length,
      yesterday,
      hours,
      peak: hours.reduce((best, x) => (x.count > best.count ? x : best), hours[0]),
      latest: [...access.rows].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 6),
    };
  }, [access.rows, now]);

  /* Members to follow up: overdue first, then expiring within 7 days. */
  const todo = useMemo(() => {
    const t0 = startOfDay(now);
    return membres
      .filter((m) => m.statut === 'actif' && m.dateExpiration)
      .map((m) => ({ m, days: Math.round((parseDay(m.dateExpiration) - t0) / DAY) }))
      .filter((x) => x.days <= 7)
      .sort((a, b) => a.days - b.days);
  }, [membres, now]);
  const overdue = todo.filter((x) => x.days < 0).length;

  const activityRows = useMemo(() => {
    const active = membres.filter((m) => m.statut === 'actif');
    return activites
      .map((a) => ({ a, count: active.filter((m) => m.activite === a.id).length }))
      .sort((x, y) => y.count - x.count);
  }, [membres, activites]);
  const activityMax = Math.max(1, ...activityRows.map((r) => r.count));
  const activeTotal = activityRows.reduce((s, r) => s + r.count, 0);

  const recent = useMemo(() => [...membres]
    .sort((a, b) => (parseDay(b.dateInscription) || 0) - (parseDay(a.dateInscription) || 0))
    .slice(0, 5), [membres]);

  const memberById = useMemo(() => Object.fromEntries(membres.map((m) => [m.id, m])), [membres]);
  const actById = useMemo(() => Object.fromEntries(activites.map((a) => [a.id, a])), [activites]);

  const hour = now.getHours();
  const greeting = hour < 12 ? t('dashboard.v2.morning', 'Bonjour') : hour < 18 ? t('dashboard.v2.afternoon', 'Bon après-midi') : t('dashboard.v2.evening', 'Bonsoir');
  const pctActive = stats.total ? Math.round((stats.actifs / stats.total) * 100) : 0;
  const periodLabel = { '7d': t('dashboard.v2.p7', '7 jours'), '30d': t('dashboard.v2.p30', '30 jours'), '12m': t('dashboard.v2.p12', '12 mois') }[period];
  const vsLabel = t('dashboard.v2.vsPrev', 'vs période précédente');
  const metricFormat = metric === 'revenue' ? fmtDH : (v) => `${v} ${t('dashboard.v2.signupsUnit', 'inscription(s)')}`;
  const lastKey = series.rows[series.rows.length - 1]?.key;

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportMembresPDF();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport_membres_${dayKey(new Date())}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert(t('dashboard.v2.exportError', "Erreur lors de l'export"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page dash2 fade-in">
      {/* Header: greeting, live clock, actions */}
      <section className="dash2-head">
        <div>
          <h2 className="dash2-head__title">{greeting}{user?.username ? `, ${user.username}` : ''} 👋</h2>
          <p className="dash2-head__sub">
            <Clock size={14} />
            {new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(now)}
            {canSeeAccess && access.loadedAt && (
              <span className="dash2-live"><Radio size={13} /> {t('dashboard.v2.live', 'En direct')}</span>
            )}
          </p>
        </div>
        <div className="dash2-head__actions">
          {canSeePayments && <Link className="btn btn--primary" to="/paiements"><Wallet size={16} /> {t('dashboard.cashIn', 'Encaisser un paiement')}</Link>}
          <Link className="btn btn--ghost" to="/membres"><UserPlus size={16} /> {t('dashboard.viewMembers', 'Voir les membres')}</Link>
          <button className="btn btn--ghost" onClick={handleExport} disabled={exporting}>
            <Download size={16} /> {exporting ? t('dashboard.generating', 'Génération...') : t('dashboard.exportPDF', 'Exporter PDF')}
          </button>
        </div>
      </section>

      {/* One filter row scopes every period-based figure below */}
      <div className="dash2-filters" role="tablist" aria-label={t('dashboard.v2.period', 'Période')}>
        {['7d', '30d', '12m'].map((p) => (
          <button key={p} role="tab" aria-selected={period === p} className={`act-filter${period === p ? ' is-active' : ''}`} onClick={() => setPeriod(p)}>
            {{ '7d': t('dashboard.v2.p7', '7 jours'), '30d': t('dashboard.v2.p30', '30 jours'), '12m': t('dashboard.v2.p12', '12 mois') }[p]}
          </button>
        ))}
      </div>

      {/* KPI tiles */}
      <section className="dash2-kpis">
        {canSeePayments && (
          <KpiTile
            icon={Wallet}
            label={t('dashboard.v2.revenue', 'Encaissements')}
            value={fmtDH(series.revNow)}
            delta={<Delta current={series.revNow} previous={series.revPrev} t={t} />}
            hint={vsLabel}
            spark={series.rows.map((r) => ({ v: r.revenue }))}
            to="/paiements"
          />
        )}
        <KpiTile
          icon={UserPlus}
          label={t('dashboard.v2.signups', 'Nouvelles inscriptions')}
          value={series.signNow}
          delta={<Delta current={series.signNow} previous={series.signPrev} t={t} />}
          hint={vsLabel}
          spark={series.rows.map((r) => ({ v: r.signups }))}
          to="/membres"
        />
        <KpiTile
          icon={UserCheck}
          label={t('dashboard.stats.activeMembers', 'Membres actifs')}
          value={stats.actifs}
          delta={<span className="dash2-delta is-flat">{pctActive}% {t('dashboard.v2.ofTotal', 'du total')}</span>}
          hint={`${stats.total} ${t('dashboard.v2.members', 'membres')}`}
          to="/membres"
        />
        {canSeeAccess ? (
          <KpiTile
            icon={DoorOpen}
            label={t('dashboard.v2.entriesToday', "Entrées aujourd'hui")}
            value={today.entries}
            delta={<Delta current={today.entries} previous={today.yesterday} t={t} />}
            hint={t('dashboard.v2.vsYesterday', 'vs hier à la même heure')}
            to="/acces"
          />
        ) : (
          <KpiTile
            icon={AlertTriangle}
            label={t('dashboard.v2.toRenew', 'À renouveler')}
            value={todo.length}
            delta={<span className={`dash2-delta ${overdue ? 'is-down' : 'is-flat'}`}>{overdue} {t('dashboard.v2.overdue', 'en retard')}</span>}
            hint={t('dashboard.v2.within7', 'sous 7 jours')}
            tone={overdue ? 'warn' : undefined}
            to="/abonnements"
          />
        )}
      </section>

      {/* Main trend chart + today's attendance */}
      <section className={`dash2-grid${canSeeAccess ? '' : ' dash2-grid--single'}`}>
        <div className="card dash2-card">
          <div className="dash2-card__head">
            <div>
              <h3 className="dash2-card__title">
                {metric === 'revenue' ? t('dashboard.v2.revenueTrend', 'Évolution des encaissements') : t('dashboard.v2.signupTrend', 'Évolution des inscriptions')}
              </h3>
              <p className="dash2-card__sub">
                {periodLabel} · {t('dashboard.v2.total', 'total')} <strong>{metric === 'revenue' ? fmtDH(series.revNow) : series.signNow}</strong>
              </p>
            </div>
            <div className="dash2-card__tools">
              {canSeePayments && (
                <div className="dash2-seg" role="tablist">
                  <button role="tab" aria-selected={metric === 'revenue'} className={metric === 'revenue' ? 'is-on' : ''} onClick={() => setMetric('revenue')}>{t('dashboard.v2.revenue', 'Encaissements')}</button>
                  <button role="tab" aria-selected={metric === 'signups'} className={metric === 'signups' ? 'is-on' : ''} onClick={() => setMetric('signups')}>{t('dashboard.v2.signupsShort', 'Inscriptions')}</button>
                </div>
              )}
              <button
                className="dash2-icon-btn"
                onClick={() => setShowTable(!showTable)}
                title={showTable ? t('dashboard.v2.showChart', 'Voir le graphique') : t('dashboard.v2.showTable', 'Voir les données')}
                aria-label={showTable ? t('dashboard.v2.showChart', 'Voir le graphique') : t('dashboard.v2.showTable', 'Voir les données')}
              >
                {showTable ? <BarChart3 size={16} /> : <Table2 size={16} />}
              </button>
            </div>
          </div>

          {showTable ? (
            <div className="dash2-table-wrap">
              <table className="dash2-table">
                <thead><tr><th>{unit === 'month' ? t('dashboard.v2.month', 'Mois') : t('dashboard.v2.day', 'Jour')}</th><th>{t('dashboard.v2.revenue', 'Encaissements')}</th><th>{t('dashboard.v2.signupsShort', 'Inscriptions')}</th></tr></thead>
                <tbody>
                  {[...series.rows].reverse().map((r) => (
                    <tr key={r.key}><td>{r.label}</td><td>{fmtDH(r.revenue)}</td><td>{r.signups}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="dash2-chart dash2-chart--grow">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series.rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={period === '30d' ? 2 : '22%'}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis
                    dataKey="label" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: AXIS, fontSize: 11 }}
                    interval={period === '30d' ? 4 : 0} minTickGap={4}
                  />
                  <YAxis
                    tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} width={metric === 'revenue' ? 56 : 28}
                    allowDecimals={false}
                    tickFormatter={(v) => (metric === 'revenue' && v >= 1000 ? `${Math.round(v / 100) / 10}k` : v)}
                  />
                  <Tooltip cursor={{ fill: 'rgba(21,23,26,0.04)' }} content={<ChartTooltip format={metricFormat} />} />
                  <Bar dataKey={metric} radius={[4, 4, 0, 0]} maxBarSize={36}>
                    {series.rows.map((r) => <Cell key={r.key} fill={r.key === lastKey ? HIGHLIGHT : SERIES} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="dash2-card__note">
            <span className="dash2-swatch" style={{ background: HIGHLIGHT }} /> {unit === 'month' ? t('dashboard.v2.currentMonth', 'Mois en cours') : t('dashboard.v2.todayLbl', "Aujourd'hui")}
          </p>
        </div>

        {canSeeAccess && (
          <div className="card dash2-card">
            <div className="dash2-card__head">
              <div>
                <h3 className="dash2-card__title">{t('dashboard.v2.attendance', "Fréquentation aujourd'hui")}</h3>
                <p className="dash2-card__sub">
                  {today.entries > 0
                    ? t('dashboard.v2.peak', 'Pic à {{h}} · {{n}} entrée(s)', { h: today.peak.label, n: today.peak.count })
                    : t('dashboard.v2.noEntries', "Aucune entrée pour l'instant")}
                </p>
              </div>
              <Link className="dash-link" to="/acces">{t('dashboard.cards.detail', 'Détail')} <ArrowUpRight size={14} /></Link>
            </div>
            <div className="dash2-chart dash2-chart--sm">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={today.hours} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barCategoryGap={2}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: AXIS, fontSize: 10 }} interval={2} />
                  <YAxis hide allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'rgba(21,23,26,0.04)' }} content={<ChartTooltip format={(v) => `${v} ${t('dashboard.v2.entriesUnit', 'entrée(s)')}`} />} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {today.hours.map((x) => <Cell key={x.h} fill={x.h === hour ? HIGHLIGHT : SERIES} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="dash2-feed">
              <div className="dash2-feed__title">
                {t('dashboard.v2.latest', 'Derniers passages')}
                {today.denied > 0 && <span className="dash2-feed__denied">{today.denied} {t('dashboard.v2.deniedToday', "refus aujourd'hui")}</span>}
              </div>
              {today.latest.length === 0 ? (
                <p className="empty-msg">{t('dashboard.v2.noEntries', "Aucune entrée pour l'instant")}</p>
              ) : today.latest.map((r) => {
                const m = memberById[r.membre_id];
                const ok = r.status === 'authorized';
                return (
                  <div key={r.id} className="dash2-feed__row">
                    <span className={`dash2-feed__status ${ok ? 'is-ok' : 'is-ko'}`}>
                      {ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                    </span>
                    <span className="dash2-feed__who">
                      {m ? `${m.prenom} ${m.nom}` : t('dashboard.v2.unknown', 'Inconnu')}
                      <small>{ok ? t('dashboard.v2.granted', 'Entrée autorisée') : (REASONS[r.reason] ? t(...REASONS[r.reason]) : r.reason)}</small>
                    </span>
                    <time className="dash2-feed__time">
                      {new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(new Date(r.timestamp))}
                    </time>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Follow-ups, activity mix, recent sign-ups */}
      <section className="dash2-grid dash2-grid--3">
        <div className="card dash2-card">
          <div className="dash2-card__head">
            <div>
              <h3 className="dash2-card__title">{t('dashboard.v2.todo', 'À relancer')}</h3>
              <p className="dash2-card__sub">
                {todo.length === 0
                  ? t('dashboard.v2.todoNone', 'Tout est à jour 🎉')
                  : t('dashboard.v2.todoSub', '{{o}} en retard · {{s}} expirent sous 7 jours', { o: overdue, s: todo.length - overdue })}
              </p>
            </div>
            <Link className="dash-link" to="/abonnements">{t('dashboard.cards.detail', 'Détail')} <ArrowUpRight size={14} /></Link>
          </div>
          {todo.length === 0 ? (
            <div className="dash2-empty"><CheckCircle2 size={28} /> {t('dashboard.cards.risk.empty', 'Aucun abonnement critique pour le moment.')}</div>
          ) : (
            <div className="dash2-list">
              {todo.slice(0, 6).map(({ m, days }) => {
                const act = actById[m.activite];
                const late = days < 0;
                return (
                  <div key={m.id} className="dash2-list__row">
                    <span className="dash2-avatar" style={{ '--tc': act?.couleur || 'var(--w-ink-2)' }}>{m.prenom?.[0]}{m.nom?.[0]}</span>
                    <span className="dash2-list__who">
                      {m.prenom} {m.nom}
                      <small>{act?.nom || '—'}</small>
                    </span>
                    <span className={`dash2-pill ${late ? 'is-late' : days <= 2 ? 'is-soon' : 'is-ok'}`}>
                      {late ? <AlertTriangle size={12} /> : <CalendarClock size={12} />}
                      {late
                        ? t('dashboard.v2.lateBy', '{{n}} j de retard', { n: -days })
                        : days === 0 ? t('dashboard.v2.todayShort', "Aujourd'hui") : t('dashboard.v2.inDays', 'dans {{n}} j', { n: days })}
                    </span>
                    {canSeePayments && (
                      <Link className="dash2-list__action" to="/paiements" title={t('dashboard.cashIn', 'Encaisser un paiement')}><Wallet size={15} /></Link>
                    )}
                  </div>
                );
              })}
              {todo.length > 6 && (
                <Link className="dash2-more" to="/abonnements">+ {todo.length - 6} {t('dashboard.v2.others', 'autres')}</Link>
              )}
            </div>
          )}
        </div>

        <div className="card dash2-card">
          <div className="dash2-card__head">
            <div>
              <h3 className="dash2-card__title">{t('dashboard.v2.byActivity', 'Membres actifs par activité')}</h3>
              <p className="dash2-card__sub">{activeTotal} {t('dashboard.v2.activeMembersLc', 'membres actifs')}</p>
            </div>
            <Link className="dash-link" to="/activites">{t('dashboard.cards.detail', 'Détail')} <ArrowUpRight size={14} /></Link>
          </div>
          <div className="dash2-bars">
            {activityRows.map(({ a, count }) => (
              <Link key={a.id} to={`/membres?activite=${a.id}`} className="dash2-bars__row" style={{ '--tc': a.couleur }}>
                <span className="dash2-bars__name"><ActivityIcon icon={a.icon} size={14} color={a.couleur} /> {a.nom}</span>
                <span className="dash2-bars__track"><span style={{ width: `${(count / activityMax) * 100}%` }} /></span>
                <span className="dash2-bars__val">{count}<small>{activeTotal ? ` · ${Math.round((count / activeTotal) * 100)}%` : ''}</small></span>
              </Link>
            ))}
          </div>
          <div className="dash2-genre">
            {[
              ['homme', t('dashboard.chart.men', 'Hommes'), stats.hommes],
              ['femme', t('dashboard.chart.women', 'Femmes'), stats.femmes],
              ['enfant', t('dashboard.chart.children', 'Enfants'), stats.enfants],
            ].map(([k, label, v]) => (
              <span key={k} className="dash2-genre__item"><strong>{v}</strong> {label}</span>
            ))}
          </div>
        </div>

        <div className="card dash2-card">
          <div className="dash2-card__head">
            <div>
              <h3 className="dash2-card__title">{t('dashboard.cards.recent.title', 'Dernières inscriptions')}</h3>
              <p className="dash2-card__sub">{t('dashboard.cards.recent.subtitle', 'Nouveaux membres enregistrés.')}</p>
            </div>
            <Link className="dash-link" to="/membres">{t('dashboard.cards.detail', 'Détail')} <ArrowUpRight size={14} /></Link>
          </div>
          <div className="dash2-list">
            {recent.map((m) => {
              const act = actById[m.activite];
              const d = parseDay(m.dateInscription);
              const ago = d ? Math.round((startOfDay(now) - d) / DAY) : null;
              return (
                <div key={m.id} className="dash2-list__row">
                  {m.photoBase64
                    ? <img className="dash2-avatar dash2-avatar--img" src={m.photoBase64} alt="" style={{ '--tc': act?.couleur || 'var(--w-ink-2)' }} />
                    : <span className="dash2-avatar" style={{ '--tc': act?.couleur || 'var(--w-ink-2)' }}>{m.prenom?.[0]}{m.nom?.[0]}</span>}
                  <span className="dash2-list__who">
                    {m.prenom} {m.nom}
                    <small><ActivityIcon icon={act?.icon} size={12} color={act?.couleur} /> {act?.nom || '—'}</small>
                  </span>
                  <span className="dash2-list__when">
                    {ago === 0 ? t('dashboard.v2.todayShort', "Aujourd'hui") : ago === 1 ? t('dashboard.v2.yesterday', 'Hier') : ago != null ? t('dashboard.v2.daysAgo', 'il y a {{n}} j', { n: ago }) : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
