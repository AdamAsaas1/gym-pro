import { CreditCard, AlertTriangle, TrendingUp } from 'lucide-react';
import { useGym } from '../context/GymContext';
import { useTranslation } from 'react-i18next';

export default function Abonnements() {
  const { membres, activites } = useGym();
  const { t } = useTranslation();

  const PLANS = [
    { key: 'mensuel',     label: t('subscriptions.monthly', 'Mensuel'),     duration: t('subscriptions.1month', '1 mois'),   icon: '📅' },
    { key: 'trimestriel', label: t('subscriptions.quarterly', 'Trimestriel'), duration: t('subscriptions.3months', '3 mois'),   icon: '📆' },
    { key: 'annuel',      label: t('subscriptions.yearly', 'Annuel'),      duration: t('subscriptions.12months', '12 mois'),  icon: '🗓️' },
  ];

  /* stats per plan */
  const planStats = PLANS.map((p) => ({
    ...p,
    count:   membres.filter((m) => m.abonnement === p.key && m.statut === 'actif').length,
    revenue: membres
      .filter((m) => m.abonnement === p.key && m.statut === 'actif')
      .reduce((s, m) => s + (activites.find((a) => a.id === m.activite)?.prix[p.key] ?? 0), 0),
  }));

  /* expiring within 30 days */
  const expiring30 = membres
    .filter((m) => {
      const days = (new Date(m.dateExpiration) - new Date()) / 86400000;
      return days >= 0 && days <= 30 && m.statut === 'actif';
    })
    .sort((a, b) => new Date(a.dateExpiration) - new Date(b.dateExpiration));

  /* total estimated monthly revenue */
  const totalRevenue = membres
    .filter((m) => m.statut === 'actif')
    .reduce((s, m) => s + (activites.find((a) => a.id === m.activite)?.prix[m.abonnement] ?? 0), 0);

  return (
    <div className="page fade-in">
      {/* Revenue summary */}
      <div className="abo-revenue-banner">
        <TrendingUp size={28} />
        <div>
          <div className="abo-revenue-val">{totalRevenue.toLocaleString('fr-FR')} DH</div>
          <div className="abo-revenue-lbl">{t('subscriptions.estimatedRevenue', 'Revenus mensuels estimés (membres actifs)')}</div>
        </div>
      </div>

      {/* Plan cards */}
      <div className="abo-plans">
        {planStats.map((p) => (
          <div key={p.key} className="abo-plan-card">
            <div className="abo-plan-icon">{p.icon}</div>
            <h3 className="abo-plan-name">{p.label}</h3>
            <div className="abo-plan-duration">{p.duration}</div>
            <div className="abo-plan-members">{p.count} {t('subscriptions.memberCount', 'membre')}{p.count !== 1 ? 's' : ''}</div>
            <div className="abo-plan-revenue">{p.revenue.toLocaleString('fr-FR')} DH</div>
            <div className="abo-plan-rev-lbl">{t('subscriptions.revActivations', 'revenus / activations')}</div>

            {/* Per-activity prices */}
            <div className="abo-plan-tarifs">
              {activites.map((a) => (
                <div key={a.id} className="abo-tarif-row" style={{ '--tc': a.couleur }}>
                  <span>{a.icon} {a.nom}</span>
                  <strong>{a.prix[p.key]} DH</strong>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Expiring ≤30 days */}
      <div className="card" style={{ marginTop: '32px' }}>
        <h3 className="card__title">
          <AlertTriangle size={16} style={{ color: '#f97316' }} />
          {t('subscriptions.expiring30Days', 'Abonnements expirant dans les 30 prochains jours')} ({expiring30.length})
        </h3>
        {expiring30.length === 0 ? (
          <p className="empty-msg">{t('subscriptions.noExpiring', "Aucun abonnement n'expire dans les 30 prochains jours. ✅")}</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('subscriptions.table.member', 'Membre')}</th>
                  <th>{t('subscriptions.table.section', 'Section')}</th>
                  <th>{t('subscriptions.table.activity', 'Activité')}</th>
                  <th>{t('subscriptions.table.subscription', 'Abonnement')}</th>
                  <th>{t('subscriptions.table.expiration', 'Expiration')}</th>
                  <th>{t('subscriptions.table.daysLeft', 'Jours restants')}</th>
                </tr>
              </thead>
              <tbody>
                {expiring30.map((m) => {
                  const act   = activites.find((a) => a.id === m.activite);
                  const days  = Math.ceil((new Date(m.dateExpiration) - new Date()) / 86400000);
                  const urgent = days <= 7;
                  return (
                    <tr key={m.id}>
                      <td>
                        <div className="td-member">
                          <div className="td-avatar" style={{ background: act?.couleur + '22', color: act?.couleur }}>
                            {m.prenom[0]}{m.nom[0]}
                          </div>
                          <div>
                            <div className="td-name">{m.prenom} {m.nom}</div>
                            <div className="td-phone">{m.telephone}</div>
                          </div>
                        </div>
                      </td>
                      <td>{m.genre === 'homme' ? t('planning.men', '♂ Hommes') : m.genre === 'femme' ? t('planning.women', '♀ Femmes') : t('planning.children', '👶 Enfants')}</td>
                      <td>
                        <span className="act-tag" style={{ color: act?.couleur, background: act?.bg }}>
                          {act?.icon} {act?.nom}
                        </span>
                      </td>
                      <td><span className="abo-tag">{t(`subscriptions.${m.abonnement}`, m.abonnement)}</span></td>
                      <td>{m.dateExpiration}</td>
                      <td>
                        <span className={urgent ? 'expiry--soon' : ''}>
                          {days === 0 ? t('dashboard.cards.today', "Aujourd'hui") : `${days} ${t('subscriptions.days', 'jours')}`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
