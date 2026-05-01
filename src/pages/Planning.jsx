import { useState } from 'react';
import { Calendar, Clock, User } from 'lucide-react';
import { useGym } from '../context/GymContext';
import { JOURS } from '../context/gymStatic';

const TABS = [
  { key: 'homme',  label: '♂ Hommes',  color: '#3b82f6' },
  { key: 'femme',  label: '♀ Femmes',  color: '#ec4899' },
  { key: 'enfant', label: '👶 Enfants', color: '#22c55e' },
];

export default function Planning() {
  const { planning, activites } = useGym();
  const [tab, setTab] = useState('homme');

  const filtered = planning.filter((s) => s.genre === tab);

  /* build day → sessions map */
  const byDay = JOURS.reduce((acc, jour) => {
    acc[jour] = filtered.filter((s) => s.jours.includes(jour));
    return acc;
  }, {});

  const tabInfo  = TABS.find((t) => t.key === tab);
  const hasSlots = filtered.length > 0;

  return (
    <div className="page fade-in">
      {/* Tab selector */}
      <div className="planning-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`planning-tab${tab === t.key ? ' planning-tab--active' : ''}`}
            style={{ '--tc': t.color }}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!hasSlots ? (
        <div className="empty-msg">Aucune séance planifiée pour cette section.</div>
      ) : (
        <>
          <p className="planning-intro">
            Emploi du temps de la section <strong style={{ color: tabInfo.color }}>{tabInfo.label}</strong> —
            les séances ci-dessous sont récurrentes chaque semaine.
          </p>

          {/* ── Weekly grid ── */}
          <div className="planning-grid">
            {JOURS.map((jour) => {
              const slots = byDay[jour];
              return (
                <div key={jour} className={`planning-day${slots.length === 0 ? ' planning-day--empty' : ''}`}>
                  <div className="planning-day__header">{jour}</div>
                  <div className="planning-day__slots">
                    {slots.length === 0 ? (
                      <div className="planning-slot planning-slot--off">Fermé</div>
                    ) : (
                      slots.map((s) => {
                        const act = activites.find((a) => a.id === s.activite);
                        return (
                          <div key={s.id} className="planning-slot" style={{ '--tc': act.couleur, '--bg': act.bg }}>
                            <div className="planning-slot__act">
                              {act.icon} {act.nom}
                            </div>
                            <div className="planning-slot__label">{s.label}</div>
                            <div className="planning-slot__time">
                              <Clock size={11} /> {s.heureDebut} – {s.heureFin}
                            </div>
                            <div className="planning-slot__coach">
                              <User size={11} /> {act.coachNom}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Summary legend ── */}
          <div className="planning-legend">
            {activites.filter((a) => a.genre === tab || (tab === 'enfant' && a.genre === 'enfant')).map((a) => (
              <div key={a.id} className="legend-item" style={{ '--tc': a.couleur }}>
                <span className="legend-dot" />
                <span>{a.icon} {a.nom}</span>
                <span className="legend-coach">Coach : {a.coachNom}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
