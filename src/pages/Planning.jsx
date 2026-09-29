import { useEffect, useMemo, useState } from 'react';
import { Clock, User, MapPin, Plus, CalendarDays, Timer, Users, Radio, AlertTriangle, CheckCircle2, CalendarClock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useGym } from '../context/GymContext';
import { usePermissions } from '../context/PermissionContext';
import ActivityIcon from '../components/ActivityIcon';
import SeanceFormModal from '../components/SeanceFormModal';

const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const JS_DAY = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const SECTIONS = ['homme', 'femme', 'enfant', 'universel'];

const toMinutes = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const overlaps = (a, b) => a.heure_debut < b.heure_fin && b.heure_debut < a.heure_fin;

export default function Planning() {
  const { seances, activites, coaches, addSeance, updateSeance, deleteSeance } = useGym();
  const { hasPageAccess } = usePermissions();
  const { t } = useTranslation();
  const canManage = hasPageAccess('/planning');

  const [section, setSection] = useState('all');
  const [actFilter, setActFilter] = useState('all');
  const [editing, setEditing] = useState(null); // null | { seance, defaults }
  const [toast, setToast] = useState('');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const actById = useMemo(() => Object.fromEntries(activites.map((a) => [a.id, a])), [activites]);
  const coachById = useMemo(() => Object.fromEntries(coaches.map((c) => [c.id, c])), [coaches]);

  // Sessions of an activity that no longer exists are ignored.
  const all = useMemo(() => seances.filter((s) => actById[s.activity_id]), [seances, actById]);

  const visible = useMemo(() => all.filter((s) => {
    const act = actById[s.activity_id];
    if (section !== 'all' && act.genre !== section) return false;
    if (actFilter !== 'all' && s.activity_id !== actFilter) return false;
    return true;
  }), [all, actById, section, actFilter]);

  const today = JS_DAY[now.getDay()];
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const byDay = useMemo(() => Object.fromEntries(WEEKDAYS.map((d) => [
    d, visible.filter((s) => s.jours.includes(d)).sort((a, b) => a.heure_debut.localeCompare(b.heure_debut)),
  ])), [visible]);

  // A coach booked on two overlapping sessions the same day.
  const conflictIds = useMemo(() => {
    const ids = new Set();
    all.forEach((a) => all.forEach((b) => {
      if (a.id < b.id && a.coach_id && a.coach_id === b.coach_id
        && a.jours.some((d) => b.jours.includes(d)) && overlaps(a, b)) { ids.add(a.id); ids.add(b.id); }
    }));
    return ids;
  }, [all]);

  const live = useMemo(() => {
    const todays = all.filter((s) => s.jours.includes(today)).sort((a, b) => a.heure_debut.localeCompare(b.heure_debut));
    const current = todays.filter((s) => toMinutes(s.heure_debut) <= nowMin && nowMin < toMinutes(s.heure_fin));
    let next = todays.find((s) => toMinutes(s.heure_debut) > nowMin);
    let nextDay = today;
    // Nothing left today: look at the following days.
    for (let i = 1; !next && i <= 7; i += 1) {
      nextDay = JS_DAY[(now.getDay() + i) % 7];
      next = all.filter((s) => s.jours.includes(nextDay)).sort((a, b) => a.heure_debut.localeCompare(b.heure_debut))[0];
    }
    return { current, next, nextDay, todayCount: todays.length };
  }, [all, today, nowMin, now]);

  const kpis = useMemo(() => {
    const slots = all.reduce((n, s) => n + s.jours.length, 0);
    const minutes = all.reduce((n, s) => n + (toMinutes(s.heure_fin) - toMinutes(s.heure_debut)) * s.jours.length, 0);
    return {
      slots,
      hours: Math.round((minutes / 60) * 10) / 10,
      coaches: new Set(all.map((s) => s.coach_id).filter(Boolean)).size,
    };
  }, [all]);

  const presentSections = SECTIONS.filter((s) => activites.some((a) => a.genre === s));
  const SECTION_LABEL = {
    homme: t('settings.modal.sectionMen', 'Hommes'),
    femme: t('settings.modal.sectionWomen', 'Femmes'),
    enfant: t('settings.modal.sectionChildren', 'Enfants'),
    universel: t('settings.modal.sectionUniversal', 'Universel'),
  };
  const activityOptions = activites.filter((a) => section === 'all' || a.genre === section);

  const coachName = (s) => {
    const c = coachById[s.coach_id];
    return c ? `${c.prenom} ${c.nom}` : null;
  };
  const dayLabel = (d) => t(`coaches.days.${d}`, d);

  const handleSave = async (payload) => {
    if (editing.seance) {
      await updateSeance(editing.seance.id, payload);
      setToast(t('planning.toast.updated', 'Séance « {{name}} » mise à jour.', { name: payload.label }));
    } else {
      await addSeance(payload);
      setToast(t('planning.toast.created', 'Séance « {{name}} » ajoutée au planning.', { name: payload.label }));
    }
    setEditing(null);
  };

  const handleDelete = async () => {
    const name = editing.seance.label;
    await deleteSeance(editing.seance.id);
    setEditing(null);
    setToast(t('planning.toast.deleted', 'Séance « {{name}} » supprimée.', { name }));
  };

  const sessionLine = (s, when) => {
    const act = actById[s.activity_id];
    return (
      <div key={s.id} className="plan-live__item" style={{ '--tc': act.couleur }}>
        <ActivityIcon icon={act.icon} color={act.couleur} badge size={16} />
        <div>
          <strong>{s.label}</strong>
          <span>{when} · {act.nom}{coachName(s) ? ` · ${coachName(s)}` : ''}{s.salle ? ` · ${s.salle}` : ''}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="page plan-page fade-in">
      <section className="members-hero">
        <div>
          <span className="members-hero__eyebrow">{t('planning.eyebrow', 'Planning')}</span>
          <h2 className="members-hero__title">{t('planning.heroTitle', 'Emploi du temps')}</h2>
          <p className="members-hero__subtitle">{t('planning.subtitle', 'Les séances sont récurrentes chaque semaine. Cliquez sur une séance pour la modifier.')}</p>
        </div>
        {canManage && (
          <div className="members-hero__actions">
            <button className="btn btn--primary" onClick={() => setEditing({ seance: null, defaults: { jour: today } })}>
              <Plus size={16} /> {t('planning.new', 'Nouvelle séance')}
            </button>
          </div>
        )}
      </section>

      {/* Live: happening now / next */}
      <section className="plan-live">
        <div className={`plan-live__box${live.current.length ? ' is-now' : ''}`}>
          <div className="plan-live__title">
            {live.current.length
              ? <><Radio size={14} className="plan-live__pulse" /> {t('planning.now', 'En ce moment')}</>
              : <><CheckCircle2 size={14} /> {t('planning.nowNone', 'Aucune séance en cours')}</>}
          </div>
          {live.current.map((s) => sessionLine(s, `${s.heure_debut}–${s.heure_fin}`))}
        </div>
        <div className="plan-live__box">
          <div className="plan-live__title"><CalendarClock size={14} /> {t('planning.next', 'Prochaine séance')}</div>
          {live.next
            ? sessionLine(live.next, `${live.nextDay === today ? t('dashboard.v2.todayShort', "Aujourd'hui") : dayLabel(live.nextDay)} ${live.next.heure_debut}`)
            : <p className="plan-live__empty">{t('planning.noneScheduled', 'Aucune séance planifiée')}</p>}
        </div>
      </section>

      <section className="members-kpis">
        <div className="members-kpi">
          <div className="members-kpi__label"><CalendarDays size={13} /> {t('planning.kpiSlots', 'Séances / semaine')}</div>
          <div className="members-kpi__value">{kpis.slots}</div>
        </div>
        <div className="members-kpi">
          <div className="members-kpi__label"><Timer size={13} /> {t('planning.kpiHours', 'Heures de cours / semaine')}</div>
          <div className="members-kpi__value">{kpis.hours} h</div>
        </div>
        <div className="members-kpi">
          <div className="members-kpi__label"><Clock size={13} /> {t('planning.kpiToday', "Séances aujourd'hui")}</div>
          <div className="members-kpi__value">{live.todayCount}</div>
        </div>
        <div className="members-kpi">
          <div className="members-kpi__label"><Users size={13} /> {t('planning.kpiCoaches', 'Coachs mobilisés')}</div>
          <div className="members-kpi__value">{kpis.coaches}</div>
        </div>
      </section>

      <div className="act-filters">
        <button className={`act-filter${section === 'all' ? ' is-active' : ''}`} onClick={() => { setSection('all'); setActFilter('all'); }}>
          {t('activities.filterAll', 'Toutes')}
        </button>
        {presentSections.map((s) => (
          <button key={s} className={`act-filter${section === s ? ' is-active' : ''}`} onClick={() => { setSection(s); setActFilter('all'); }}>
            {SECTION_LABEL[s]}
          </button>
        ))}
        {activityOptions.length > 1 && <span className="plan-filters__sep" />}
        {activityOptions.length > 1 && activityOptions.map((a) => (
          <button key={a.id} className={`act-filter${actFilter === a.id ? ' is-active' : ''}`} onClick={() => setActFilter(actFilter === a.id ? 'all' : a.id)}>
            <ActivityIcon icon={a.icon} size={14} /> {a.nom}
          </button>
        ))}
      </div>

      {conflictIds.size > 0 && (
        <div className="coach-alert">
          <AlertTriangle size={18} />
          <span>{t('planning.conflicts', '{{n}} séance(s) avec un coach réservé deux fois au même moment (marquées ⚠).', { n: conflictIds.size })}</span>
        </div>
      )}

      <div className="plan-week">
        {WEEKDAYS.map((d) => {
          const isToday = d === today;
          const slots = byDay[d];
          return (
            <div key={d} className={`plan-day${isToday ? ' is-today' : ''}`}>
              <div className="plan-day__head">
                <span>{dayLabel(d)}</span>
                {isToday ? <em>{t('dashboard.v2.todayShort', "Aujourd'hui")}</em> : <small>{slots.length || ''}</small>}
              </div>
              <div className="plan-day__slots">
                {slots.length === 0 && <div className="plan-slot plan-slot--off">{t('planning.noSession', 'Aucune séance')}</div>}
                {slots.map((s) => {
                  const act = actById[s.activity_id];
                  const running = isToday && toMinutes(s.heure_debut) <= nowMin && nowMin < toMinutes(s.heure_fin);
                  const done = isToday && nowMin >= toMinutes(s.heure_fin);
                  const Tag = canManage ? 'button' : 'div';
                  return (
                    <Tag
                      key={s.id}
                      type={canManage ? 'button' : undefined}
                      className={`plan-slot${running ? ' is-running' : ''}${done ? ' is-done' : ''}`}
                      style={{ '--tc': act.couleur }}
                      onClick={canManage ? () => setEditing({ seance: s }) : undefined}
                    >
                      <span className="plan-slot__time">
                        {s.heure_debut} – {s.heure_fin}
                        {running && <b className="plan-slot__live">{t('planning.running', 'En cours')}</b>}
                        {conflictIds.has(s.id) && <AlertTriangle size={12} className="plan-slot__warn" />}
                      </span>
                      <span className="plan-slot__label">{s.label}</span>
                      <span className="plan-slot__act"><ActivityIcon icon={act.icon} size={12} /> {act.nom}</span>
                      {(coachName(s) || s.salle) && (
                        <span className="plan-slot__meta">
                          {coachName(s) && <><User size={11} /> {coachName(s)}</>}
                          {s.salle && <><MapPin size={11} /> {s.salle}</>}
                        </span>
                      )}
                    </Tag>
                  );
                })}
                {canManage && (
                  <button className="plan-day__add" onClick={() => setEditing({ seance: null, defaults: { jour: d, activity_id: actFilter !== 'all' ? actFilter : undefined } })} aria-label={t('planning.new', 'Nouvelle séance')}>
                    <Plus size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {all.length === 0 && (
        <div className="act-empty">
          <CalendarDays size={36} />
          <h3>{t('planning.empty', 'Aucune séance planifiée pour le moment.')}</h3>
          {canManage && (
            <button className="btn btn--primary" onClick={() => setEditing({ seance: null, defaults: { jour: today } })}>
              <Plus size={16} /> {t('planning.createFirst', 'Créer la première séance')}
            </button>
          )}
        </div>
      )}

      {editing && (
        <SeanceFormModal
          seance={editing.seance}
          defaults={editing.defaults}
          activites={activites}
          coaches={coaches}
          seances={all}
          onSave={handleSave}
          onDelete={editing.seance ? handleDelete : undefined}
          onClose={() => setEditing(null)}
        />
      )}

      {toast && <div className="act-toast" role="status"><CheckCircle2 size={18} /> {toast}</div>}
    </div>
  );
}
