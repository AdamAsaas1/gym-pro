import { CreditCard, AlertTriangle, TrendingUp } from 'lucide-react';
import { useGym } from '../context/GymContext';

const PLANS = [
  { key: 'mensuel',     label: 'Mensuel',     duration: '1 mois',   icon: '📅' },
  { key: 'trimestriel', label: 'Trimestriel', duration: '3 mois',   icon: '📆' },
  { key: 'annuel',      label: 'Annuel',      duration: '12 mois',  icon: '🗓️' },
];

export default function Abonnements() {
  const { membres, activites } = useGym();

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
          <div className="abo-revenue-lbl">Revenus mensuels estimés (membres actifs)</div>
        </div>
      </div>

      {/* Plan cards */}
      <div className="abo-plans">
        {planStats.map((p) => (
          <div key={p.key} className="abo-plan-card">
            <div className="abo-plan-icon">{p.icon}</div>
            <h3 className="abo-plan-name">{p.label}</h3>
            <div className="abo-plan-duration">{p.duration}</div>
            <div className="abo-plan-members">{p.count} membre{p.count !== 1 ? 's' : ''}</div>
            <div className="abo-plan-revenue">{p.revenue.toLocaleString('fr-FR')} DH</div>
            <div className="abo-plan-rev-lbl">revenus / activations</div>

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
          Abonnements expirant dans les 30 prochains jours ({expiring30.length})
        </h3>
        {expiring30.length === 0 ? (
          <p className="empty-msg">Aucun abonnement n'expire dans les 30 prochains jours. ✅</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Membre</th>
                  <th>Section</th>
                  <th>Activité</th>
                  <th>Abonnement</th>
                  <th>Expiration</th>
                  <th>Jours restants</th>
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
                      <td>{m.genre === 'homme' ? '♂ Homme' : m.genre === 'femme' ? '♀ Femme' : '👶 Enfant'}</td>
                      <td>
                        <span className="act-tag" style={{ color: act?.couleur, background: act?.bg }}>
                          {act?.icon} {act?.nom}
                        </span>
                      </td>
                      <td><span className="abo-tag">{m.abonnement}</span></td>
                      <td>{m.dateExpiration}</td>
                      <td>
                        <span className={urgent ? 'expiry--soon' : ''}>
                          {days === 0 ? "Aujourd'hui" : `${days} jours`}
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
