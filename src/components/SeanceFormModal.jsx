import { useMemo, useState } from 'react';
import { Save, Trash2, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import { ActivitySelect } from './ActivityIcon';

const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const overlaps = (a, b) => a.heure_debut < b.heure_fin && b.heure_debut < a.heure_fin;

function toForm(seance, defaults, coaches) {
  if (seance) {
    return {
      activity_id: seance.activity_id, coach_id: seance.coach_id ?? '', label: seance.label,
      jours: seance.jours, heure_debut: seance.heure_debut, heure_fin: seance.heure_fin, salle: seance.salle || '',
    };
  }
  const activityId = defaults?.activity_id ?? null;
  const coach = coaches.find((c) => c.is_active && c.activity_id === activityId);
  return {
    activity_id: activityId, coach_id: coach?.id ?? '', label: '',
    jours: defaults?.jour ? [defaults.jour] : [], heure_debut: '18:00', heure_fin: '19:00', salle: '',
  };
}

export default function SeanceFormModal({ seance, defaults, activites, coaches, seances, onSave, onDelete, onClose }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => toForm(seance, defaults, coaches));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (key, val) => {
    setForm((prev) => {
      const next = { ...prev, [key]: val };
      // Picking an activity pre-selects its coach when none is chosen yet.
      if (key === 'activity_id' && !prev.coach_id) {
        const coach = coaches.find((c) => c.is_active && c.activity_id === val);
        if (coach) next.coach_id = coach.id;
      }
      return next;
    });
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const toggleDay = (d) => set('jours', form.jours.includes(d) ? form.jours.filter((x) => x !== d) : [...form.jours, d]);

  // Coaches of the chosen activity first, then everyone else.
  const coachOptions = useMemo(() => [...coaches].sort((a, b) =>
    (b.activity_id === form.activity_id) - (a.activity_id === form.activity_id) || a.nom.localeCompare(b.nom),
  ), [coaches, form.activity_id]);

  // Non-blocking warning: the coach already teaches another session at an overlapping time.
  const conflicts = useMemo(() => {
    if (!form.coach_id || form.heure_fin <= form.heure_debut) return [];
    return seances.filter((s) => s.id !== seance?.id && s.coach_id === Number(form.coach_id)
      && s.jours.some((d) => form.jours.includes(d)) && overlaps(s, form));
  }, [seances, seance, form]);

  const validate = () => {
    const e = {};
    if (!form.activity_id) e.activity_id = t('planning.form.errActivity', 'Choisissez une activité');
    if (!form.label.trim()) e.label = t('planning.form.errLabel', 'Donnez un nom à la séance');
    if (!form.jours.length) e.jours = t('planning.form.errDays', 'Choisissez au moins un jour');
    if (!form.heure_debut || !form.heure_fin || form.heure_fin <= form.heure_debut) e.heure_fin = t('planning.form.errTime', "L'heure de fin doit être après le début");
    return e;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    setSubmitError('');
    try {
      await onSave({
        ...form,
        label: form.label.trim(),
        salle: form.salle.trim() || null,
        coach_id: form.coach_id === '' ? null : Number(form.coach_id),
      });
    } catch (err) {
      console.error(err);
      setSubmitError(t('planning.form.errSave', "Erreur lors de l'enregistrement de la séance."));
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await onDelete();
    } catch (err) {
      console.error(err);
      setSubmitError(t('planning.form.errDelete', 'Erreur lors de la suppression.'));
      setSaving(false);
    }
  };

  const actName = (id) => activites.find((a) => a.id === id)?.nom;

  return (
    <Modal title={seance ? t('planning.form.editTitle', 'Modifier la séance') : t('planning.form.newTitle', 'Nouvelle séance')} onClose={onClose} size="lg">
      <form onSubmit={submit} className="member-form">
        <div className="form-row">
          <div className="form-group">
            <label>{t('members.form.activity', 'Activité')} *</label>
            <ActivitySelect
              value={form.activity_id}
              options={activites}
              onChange={(id) => set('activity_id', id)}
              getLabel={(a) => t(a.nom, a.nom)}
              emptyLabel={t('planning.form.pickActivity', 'Choisir une activité')}
            />
            {errors.activity_id && <span className="form-error">{errors.activity_id}</span>}
          </div>
          <div className="form-group">
            <label>{t('planning.form.label', 'Nom de la séance')} *</label>
            <input value={form.label} onChange={(e) => set('label', e.target.value)} maxLength={100} placeholder={t('planning.form.labelPh', 'Ex: Cardio Matin')} />
            {errors.label && <span className="form-error">{errors.label}</span>}
          </div>
        </div>

        <div className="form-section-title">{t('planning.form.days', 'Jours')}</div>
        <div className="coach-days" role="group">
          {WEEKDAYS.map((d) => (
            <button
              key={d} type="button"
              className={`coach-day${form.jours.includes(d) ? ' is-on' : ''}`}
              aria-pressed={form.jours.includes(d)}
              title={t(`coaches.days.${d}`, d)}
              onClick={() => toggleDay(d)}
            >
              {t(`coaches.daysAbbr.${d}`, d.slice(0, 3))}
            </button>
          ))}
        </div>
        {errors.jours && <span className="form-error">{errors.jours}</span>}

        <div className="form-row form-row--3">
          <div className="form-group">
            <label>{t('planning.form.start', 'Début')} *</label>
            <input type="time" value={form.heure_debut} onChange={(e) => set('heure_debut', e.target.value)} />
          </div>
          <div className="form-group">
            <label>{t('planning.form.end', 'Fin')} *</label>
            <input type="time" value={form.heure_fin} onChange={(e) => set('heure_fin', e.target.value)} />
          </div>
          <div className="form-group">
            <label>{t('planning.form.room', 'Salle')}</label>
            <input value={form.salle} onChange={(e) => set('salle', e.target.value)} maxLength={80} placeholder={t('planning.form.roomPh', 'Ex: Salle 1')} />
          </div>
        </div>
        {errors.heure_fin && <span className="form-error">{errors.heure_fin}</span>}

        <div className="form-group">
          <label>{t('planning.form.coach', 'Coach')}</label>
          <select value={form.coach_id} onChange={(e) => set('coach_id', e.target.value === '' ? '' : Number(e.target.value))}>
            <option value="">{t('planning.form.noCoach', 'Aucun coach')}</option>
            {coachOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.prenom} {c.nom}{actName(c.activity_id) ? ` — ${actName(c.activity_id)}` : ''}{c.is_active ? '' : ` (${t('coaches.status.inactive', 'Absent / en pause')})`}
              </option>
            ))}
          </select>
        </div>

        {conflicts.length > 0 && (
          <div className="seance-conflict">
            <AlertTriangle size={16} />
            <span>
              {t('planning.form.conflict', 'Ce coach a déjà une séance au même moment :')}{' '}
              {conflicts.map((c) => `${c.label} (${c.jours.filter((d) => form.jours.includes(d)).join(', ')} ${c.heure_debut}–${c.heure_fin})`).join(' · ')}
            </span>
          </div>
        )}

        {submitError && <div className="form-error form-error--block">{submitError}</div>}

        <div className="form-actions seance-form__actions">
          {seance && onDelete && (
            confirmDelete ? (
              <span className="seance-form__confirm">
                {t('planning.form.confirmDelete', 'Supprimer cette séance ?')}
                <button type="button" className="btn btn--danger btn--sm" onClick={remove} disabled={saving}>{t('settings.activities.delete', 'Supprimer')}</button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmDelete(false)}>{t('settings.modal.cancelBtn', 'Annuler')}</button>
              </span>
            ) : (
              <button type="button" className="btn btn--danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={16} /> {t('settings.activities.delete', 'Supprimer')}
              </button>
            )
          )}
          <span className="seance-form__spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>{t('settings.modal.cancelBtn', 'Annuler')}</button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            <Save size={16} /> {saving ? t('settings.identity.saving', 'Enregistrement...') : t('settings.modal.saveBtn', 'Enregistrer')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
