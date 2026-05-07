import { useState, createElement } from 'react';
import { Users, UserCheck, TrendingUp, AlertTriangle, ArrowUpRight, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGym } from '../context/GymContext';
import { exportMembresPDF } from '../api/client';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useTranslation } from 'react-i18next';

const GENRE_COLORS = { homme: '#39ff14', femme: '#1fdf8f', enfant: '#15c47e' };
const GENRE_LABELS = { homme: 'Hommes', femme: 'Femmes', enfant: 'Enfants' };

function getSubscriptionBadge(m, t) {
  if (m.statut === 'inactif') return { key: 'inactive', label: t('dashboard.status.inactive', 'Inactif') };
  const days = Math.ceil((new Date(m.dateExpiration) - new Date()) / 86400000);
  if (days < 0) return { key: 'late', label: t('dashboard.status.late', 'En retard') };
  if (days <= 7) return { key: 'soon', label: t('dashboard.status.soon', 'Bientot expire') };
  return { key: 'ok', label: t('dashboard.status.active', 'Actif') };
}

function StatCard({ icon: StatIcon, label, value, sub, color, to, variant }) {
  const inner = (
    <div className={`stat-card${variant ? ` stat-card--${variant}` : ''}`} style={{ '--accent': color }}>
      <div className="stat-card__icon">{createElement(StatIcon, { size: 22 })}</div>
      <div className="stat-card__body">
        <div className="stat-card__value">{value}</div>
        <div className="stat-card__label">{label}</div>
        {sub && <div className="stat-card__sub">{sub}</div>}
      </div>
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: 'none' }}>{inner}</Link> : inner;
}

export default function Dashboard() {
  const { membres, stats, activites } = useGym();
  const { t } = useTranslation();
  const [exporting, setExporting] = useState(false);
  const pctActifs = stats.total ? Math.round((stats.actifs / stats.total) * 100) : 0;
  const expSoon = stats.expiringSoon.length;
  const healthScore = stats.total ? Math.max(0, Math.round(((stats.actifs - expSoon) / stats.total) * 100)) : 0;

  /* last 5 inscriptions */
  const recent = [...membres]
    .sort((a, b) => new Date(b.dateInscription) - new Date(a.dateInscription))
    .slice(0, 5);

  /* activity member counts */
  const actCount = activites.map((a) => ({
    ...a,
    count: membres.filter((m) => m.activite === a.id).length,
  }));
  const topActivities = [...actCount].sort((a, b) => b.count - a.count).slice(0, 4);

  const genreData = [
    { name: t('dashboard.chart.men', 'Hommes'), value: stats.hommes, color: '#39ff14' },
    { name: t('dashboard.chart.women', 'Femmes'), value: stats.femmes, color: '#1fdf8f' },
    { name: t('dashboard.chart.children', 'Enfants'), value: stats.enfants, color: '#15c47e' },
  ].filter(d => d.value > 0);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportMembresPDF();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport_membres_${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert(`Erreur lors de l'export`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page dashboard fade-in">
      <section className="dash-hero">
        <div className="dash-hero__left">
          <span className="dash-hero__eyebrow">{t('dashboard.performance', 'Performance')}</span>
          <h2 className="dash-hero__title">{t('dashboard.title', 'Pilotage ASAAS GYM')}</h2>
          <p className="dash-hero__subtitle">
            {t('dashboard.subtitle', 'Vue d\'ensemble des membres actifs, revenus et alertes a traiter. Analyse rapide et actions immediates.')}
          </p>
          <div className="dash-hero__meta">
            <div className="dash-meta">
              <span className="dash-meta__label">{t('dashboard.activityRate', 'Taux d\'activite')}</span>
              <strong className="dash-meta__value">{pctActifs}%</strong>
            </div>
            <div className="dash-meta">
              <span className="dash-meta__label">{t('dashboard.healthScore', 'Indice de sante')}</span>
              <strong className="dash-meta__value">{healthScore}%</strong>
            </div>
            <div className="dash-meta">
              <span className="dash-meta__label">{t('dashboard.alerts7Days', 'Alertes 7 jours')}</span>
              <strong className="dash-meta__value">{expSoon}</strong>
            </div>
          </div>
          <div className="dash-hero__actions">
            <Link className="btn btn--primary" to="/membres">{t('dashboard.viewMembers', 'Voir les membres')}</Link>
            <Link className="btn btn--ghost" to="/paiements">{t('dashboard.cashIn', 'Encaisser un paiement')}</Link>
            <button className="btn btn--ghost" onClick={handleExport} disabled={exporting}>
              <Download size={16} style={{ marginRight: 8 }} /> {exporting ? t('dashboard.generating', 'Génération...') : t('dashboard.exportPDF', 'Exporter PDF')}
            </button>
          </div>
        </div>

        <div className="dash-hero__right">
          <div className="kpi-grid kpi-grid--hero">
            <StatCard icon={Users} label={t('dashboard.stats.totalMembers', 'Total membres')} value={stats.total} color="#39ff14" to="/membres" variant="hero" />
            <StatCard icon={UserCheck} label={t('dashboard.stats.activeMembers', 'Membres actifs')} value={stats.actifs} sub={`${stats.inactifs} ${t('dashboard.stats.inactive', 'inactifs')}`} color="#22c55e" to="/membres" variant="hero" />
            <StatCard icon={TrendingUp} label={t('dashboard.stats.monthlyRevenue', 'Revenus mensuels')} value={`${stats.revenue.toLocaleString('fr-FR')} DH`} color="#10b981" variant="hero" />
            <StatCard icon={AlertTriangle} label={t('dashboard.stats.alert7Days', 'Alerte 7 jours')} value={expSoon} color="#16a34a" to="/abonnements" variant="hero" />
          </div>
          <div className="dash-hero__panel">
            <div className="dash-hero__panel-title">{t('dashboard.panel.priorities', 'Priorites immediates')}</div>
            <div className="dash-hero__panel-row">
              <span>{t('dashboard.panel.expirations7days', 'Expirations 7 jours')}</span>
              <strong>{expSoon}</strong>
            </div>
            <div className="dash-hero__panel-row">
              <span>{t('dashboard.panel.inactiveMembers', 'Membres inactifs')}</span>
              <strong>{stats.inactifs}</strong>
            </div>
            <div className="dash-hero__panel-row">
              <span>{t('dashboard.panel.estimatedRevenue', 'Revenus estimes')}</span>
              <strong>{stats.revenue.toLocaleString('fr-FR')} DH</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="dash-columns">
        <div className="dash-column">
          <div className="card dash-card">
            <div className="dash-card__head">
              <div>
                <h3 className="dash-card__title">{t('dashboard.cards.distribution.title', 'Repartition par section')}</h3>
                <p className="dash-card__sub">{t('dashboard.cards.distribution.subtitle', 'Distribution des membres actifs par categorie.')}</p>
              </div>
              <Link className="dash-link" to="/membres">
                {t('dashboard.cards.detail', 'Detail')} <ArrowUpRight size={14} />
              </Link>
            </div>
            <div style={{ height: 220, width: '100%', marginTop: '16px' }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={genreData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} stroke="none">
                    {genreData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card dash-card">
            <div className="dash-card__head">
              <div>
                <h3 className="dash-card__title">{t('dashboard.cards.activities.title', 'Activites prioritaires')}</h3>
                <p className="dash-card__sub">{t('dashboard.cards.activities.subtitle', "Top 4 par volume d'adhesion.")}</p>
              </div>
              <Link className="dash-link" to="/activites">
                {t('dashboard.cards.detail', 'Detail')} <ArrowUpRight size={14} />
              </Link>
            </div>
            <div style={{ height: 220, width: '100%', marginTop: '16px' }}>
              <ResponsiveContainer>
                <BarChart data={topActivities} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" />
                  <XAxis type="number" stroke="#94a3b8" />
                  <YAxis type="category" dataKey="nom" stroke="#94a3b8" width={80} tick={{ fontSize: 12 }} />
                  <RechartsTooltip cursor={{ fill: '#334155' }} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {topActivities.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.couleur} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="dash-column">
          <div className="card dash-card">
            <div className="dash-card__head">
              <div>
                <h3 className="dash-card__title">{t('dashboard.cards.risk.title', 'Abonnements a risque')}</h3>
                <p className="dash-card__sub">{t('dashboard.cards.risk.subtitle', 'Expire dans les 7 prochains jours.')}</p>
              </div>
              <Link className="dash-link" to="/abonnements">
                {t('dashboard.cards.detail', 'Detail')} <ArrowUpRight size={14} />
              </Link>
            </div>
            {stats.expiringSoon.length === 0 ? (
              <p className="empty-msg">{t('dashboard.cards.risk.empty', 'Aucun abonnement critique pour le moment.')}</p>
            ) : (
              <div className="expire-list">
                {stats.expiringSoon.slice(0, 5).map((m) => {
                  const days = Math.ceil((new Date(m.dateExpiration) - new Date()) / 86400000);
                  const act = activites.find((a) => a.id === m.activite);
                  return (
                    <div key={m.id} className="expire-item">
                      <div className="expire-item__avatar" style={{ background: act?.couleur + '22', color: act?.couleur }}>
                        {m.prenom[0]}{m.nom[0]}
                      </div>
                      <div className="expire-item__info">
                        <div className="expire-item__name">{m.prenom} {m.nom}</div>
                        <div className="expire-item__act">{t(act?.nom, act?.nom)}</div>
                      </div>
                      <div className={`expire-badge${days <= 2 ? ' expire-badge--urgent' : ''}`}>
                        {days === 0 ? t('dashboard.cards.today', 'Auj.') : `${days}${t('dashboard.cards.daysAbbr', 'j')}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card dash-card">
            <div className="dash-card__head">
              <div>
                <h3 className="dash-card__title">{t('dashboard.cards.recent.title', 'Dernieres inscriptions')}</h3>
                <p className="dash-card__sub">{t('dashboard.cards.recent.subtitle', 'Nouveaux membres enregistres.')}</p>
              </div>
              <Link className="dash-link" to="/membres">
                {t('dashboard.cards.detail', 'Detail')} <ArrowUpRight size={14} />
              </Link>
            </div>
            <div className="recent-list">
              {recent.map((m) => {
                const act = activites.find((a) => a.id === m.activite);
                const badge = getSubscriptionBadge(m, t);
                return (
                  <div key={m.id} className="recent-item">
                    <div className="recent-item__avatar" style={{ background: act?.couleur + '22', color: act?.couleur }}>
                      {m.prenom[0]}{m.nom[0]}
                    </div>
                    <div className="recent-item__info">
                      <div className="recent-item__name">{m.prenom} {m.nom}</div>
                      <div className="recent-item__meta">
                        <span className="dash-chip" style={{ '--chip': act?.couleur }}>{act?.icon}</span>
                        <span className="dash-chip__label">{t(act?.nom, act?.nom)}</span>
                        <span className="dash-chip__date">{m.dateInscription}</span>
                      </div>
                    </div>
                    <span className={`status-badge status-badge--${badge.key}`}>{badge.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
