import { Users, TrendingUp, UserCheck } from 'lucide-react';
import { useGym } from '../context/GymContext';

const GENRE_LABEL = { 
  homme: 'Section Hommes', 
  femme: 'Section Femmes', 
  enfant: 'Section Enfants',
  universel: 'Section Mixte (Universel)'
};

export default function Activites() {
  const { membres, activites } = useGym();

  return (
    <div className="page fade-in">
      <p className="page-desc">
        Notre salle est <strong>non mixte</strong>. Chaque section dispose de son propre espace,
        ses horaires et son coach spécialisé.
      </p>

      <div className="activites-grid">
        {activites.map((act) => {
          const inscrits = membres.filter((m) => m.activite === act.id);
          const actifs   = inscrits.filter((m) => m.statut === 'actif').length;

          return (
            <div key={act.id} className="act-card" style={{ '--tc': act.couleur, '--bg': act.bg }}>
              {/* Header */}
              <div className="act-card__header">
                <div className="act-card__icon-wrap">
                  <span className="act-card__emoji">{act.icon}</span>
                </div>
                <div>
                  <div className="act-card__genre">{GENRE_LABEL[act.genre]}</div>
                  <h2 className="act-card__name">{act.nom}</h2>
                </div>
              </div>

              <p className="act-card__desc">{act.description}</p>

              {/* Stats row */}
              <div className="act-card__stats">
                <div className="act-stat">
                  <Users size={15} />
                  <div>
                    <div className="act-stat__val">{inscrits.length}</div>
                    <div className="act-stat__lbl">Inscrits</div>
                  </div>
                </div>
                <div className="act-stat">
                  <TrendingUp size={15} />
                  <div>
                    <div className="act-stat__val">{actifs}</div>
                    <div className="act-stat__lbl">Actifs</div>
                  </div>
                </div>
              </div>

              {/* Tarifs */}
              <div className="act-card__tarifs">
                <div className="tarif-title">Tarifs</div>
                <div className="tarif-row">
                  <span>Mensuel</span>     <strong>{act.prix.mensuel} DH</strong>
                </div>
                <div className="tarif-row">
                  <span>Trimestriel</span> <strong>{act.prix.trimestriel} DH</strong>
                </div>
                <div className="tarif-row">
                  <span>Annuel</span>      <strong>{act.prix.annuel} DH</strong>
                </div>
              </div>

              {/* Coach */}
              <div className="act-card__coach">
                <UserCheck size={14} />
                Coach : <strong>{act.coachNom}</strong>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
