import { Phone, Mail, Award, Calendar } from 'lucide-react';
import { useGym } from '../context/GymContext';

const SCHEDULE = {
  musculation: 'Lundi au Samedi (matin & soir)',
  kickboxing:  'Mardi, Jeudi & Samedi',
  karate:      'Mardi, Jeudi & Samedi',
  aerobic:     'Lundi, Mercredi, Vendredi & Samedi',
};

export default function Coaches() {
  const { coaches, membres, activites } = useGym();

  return (
    <div className="page fade-in">
      <p className="page-desc">
        Notre équipe de coachs qualifiés assure un encadrement professionnel et personnalisé
        pour chaque section de la salle.
      </p>

      <div className="coaches-grid">
        {coaches.map((coach) => {
          const act      = activites.find((a) => a.id === coach.activite);
          const effectif = membres.filter((m) => m.activite === coach.activite && m.statut === 'actif').length;
          return (
            <div key={coach.id} className="coach-card" style={{ '--tc': act?.couleur, '--bg': act?.bg }}>
              <div className="coach-card__top">
                <div className="coach-avatar">{coach.initials}</div>
                <div>
                  <h3 className="coach-name">{coach.prenom} {coach.nom}</h3>
                  <div className="coach-act" style={{ color: act?.couleur }}>
                    {act?.icon} {act?.nom}
                  </div>
                </div>
              </div>

              <div className="coach-badge-row">
                <span className="coach-badge">
                  <Award size={12} /> {coach.experience} d'expérience
                </span>
                <span className="coach-badge">
                  👥 {effectif} membres actifs
                </span>
              </div>

              <div className="coach-diploma">
                🎓 {coach.diplome}
              </div>

              <div className="coach-contacts">
                <div className="coach-contact">
                  <Phone size={13} /> {coach.telephone}
                </div>
                <div className="coach-contact">
                  <Mail size={13} /> {coach.email}
                </div>
                <div className="coach-contact">
                  <Calendar size={13} /> {SCHEDULE[coach.activite]}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
