import { useRef, useState } from 'react';
import { Save, Camera, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import { ActivitySelect } from './ActivityIcon';

const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// Downscales an uploaded photo to a small square JPEG so it stays light in the database.
function resizePhoto(file, size = 256) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        canvas.getContext('2d').drawImage(
          img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size,
        );
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function toForm(coach, defaults) {
  return {
    prenom: coach?.prenom || '',
    nom: coach?.nom || '',
    activity_id: coach?.activity_id ?? defaults?.activity_id ?? null,
    telephone: coach?.telephone || '',
    email: coach?.email || '',
    experience_years: coach?.experience_years ?? '',
    diplome: coach?.diplome || '',
    jours: coach?.jours || [],
    horaires: coach?.horaires || '',
    bio: coach?.bio || '',
    photo_base64: coach?.photo_base64 || '',
    is_active: coach?.is_active ?? true,
  };
}

export default function CoachFormModal({ coach, defaults, activites, onSave, onClose }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => toForm(coach, defaults));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const fileRef = useRef(null);

  const set = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const toggleDay = (day) => {
    set('jours', form.jours.includes(day) ? form.jours.filter((d) => d !== day) : [...form.jours, day]);
  };

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      set('photo_base64', await resizePhoto(file));
    } catch {
      setErrors((x) => ({ ...x, photo: t('coaches.form.errPhoto', 'Image illisible') }));
    }
  };

  const validate = () => {
    const e = {};
    if (!form.prenom.trim()) e.prenom = t('coaches.form.errRequired', 'Champ obligatoire');
    if (!form.nom.trim()) e.nom = t('coaches.form.errRequired', 'Champ obligatoire');
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = t('coaches.form.errEmail', 'Email invalide');
    const exp = form.experience_years === '' ? 0 : Number(form.experience_years);
    if (!Number.isInteger(exp) || exp < 0 || exp > 80) e.experience_years = t('coaches.form.errExperience', 'Entre 0 et 80 ans');
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
        prenom: form.prenom.trim(),
        nom: form.nom.trim().toUpperCase(),
        experience_years: form.experience_years === '' ? 0 : Number(form.experience_years),
        photo_base64: form.photo_base64 || null,
      });
    } catch (err) {
      console.error(err);
      setSubmitError(t('coaches.form.errSave', "Erreur lors de l'enregistrement du coach."));
      setSaving(false);
    }
  };

  const initials = `${form.prenom.trim()[0] || ''}${form.nom.trim()[0] || ''}`.toUpperCase() || '?';
  const act = activites.find((a) => a.id === form.activity_id);

  return (
    <Modal
      title={coach ? t('coaches.form.editTitle', 'Modifier le coach') : t('coaches.form.newTitle', 'Nouveau coach')}
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={submit} className="member-form">
        <div className="coach-form__head">
          <div className="coach-form__photo" style={{ '--tc': act?.couleur || 'var(--clr-primary)' }}>
            {form.photo_base64 ? <img src={form.photo_base64} alt="" /> : <span>{initials}</span>}
          </div>
          <div className="coach-form__photo-actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()}>
              <Camera size={14} /> {form.photo_base64 ? t('coaches.form.changePhoto', 'Changer la photo') : t('coaches.form.addPhoto', 'Ajouter une photo')}
            </button>
            {form.photo_base64 && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => set('photo_base64', '')}>
                <X size={14} /> {t('coaches.form.removePhoto', 'Retirer')}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />
            {errors.photo && <span className="form-error">{errors.photo}</span>}
          </div>
          <label className="coach-form__active">
            <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
            <span className="coach-switch" aria-hidden="true" />
            {form.is_active ? t('coaches.status.active', 'Actif') : t('coaches.status.inactive', 'Absent / en pause')}
          </label>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>{t('members.form.firstName', 'Prénom')} *</label>
            <input value={form.prenom} onChange={(e) => set('prenom', e.target.value)} autoFocus />
            {errors.prenom && <span className="form-error">{errors.prenom}</span>}
          </div>
          <div className="form-group">
            <label>{t('members.form.lastName', 'Nom')} *</label>
            <input value={form.nom} onChange={(e) => set('nom', e.target.value.toUpperCase())} />
            {errors.nom && <span className="form-error">{errors.nom}</span>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>{t('members.form.activity', 'Activité')}</label>
            <ActivitySelect
              value={form.activity_id}
              options={activites}
              onChange={(id) => set('activity_id', id)}
              getLabel={(a) => t(a.nom, a.nom)}
              emptyLabel={t('coaches.form.noActivity', 'Aucune activité')}
            />
            {form.activity_id && (
              <button type="button" className="form-link" onClick={() => set('activity_id', null)}>
                {t('coaches.form.unassign', 'Retirer de cette activité')}
              </button>
            )}
          </div>
          <div className="form-group">
            <label>{t('coaches.form.experience', "Années d'expérience")}</label>
            <input type="number" min="0" max="80" step="1" value={form.experience_years} onChange={(e) => set('experience_years', e.target.value)} />
            {errors.experience_years && <span className="form-error">{errors.experience_years}</span>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>{t('members.form.phone', 'Téléphone')}</label>
            <input type="tel" value={form.telephone} onChange={(e) => set('telephone', e.target.value)} placeholder="0600-000-000" />
          </div>
          <div className="form-group">
            <label>{t('members.form.email', 'Email')}</label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value.trim())} placeholder="coach@gym.ma" />
            {errors.email && <span className="form-error">{errors.email}</span>}
          </div>
        </div>

        <div className="form-group">
          <label>{t('coaches.form.diploma', 'Diplôme / spécialité')}</label>
          <input value={form.diplome} onChange={(e) => set('diplome', e.target.value)} placeholder={t('coaches.form.diplomaPh', 'Ex: Ceinture noire 3e Dan')} />
        </div>

        <div className="form-section-title">{t('coaches.form.availability', 'Disponibilités')}</div>
        <div className="coach-days" role="group">
          {WEEKDAYS.map((d) => (
            <button
              key={d}
              type="button"
              className={`coach-day${form.jours.includes(d) ? ' is-on' : ''}`}
              aria-pressed={form.jours.includes(d)}
              title={t(`coaches.days.${d}`, d)}
              onClick={() => toggleDay(d)}
            >
              {t(`coaches.daysAbbr.${d}`, d.slice(0, 3))}
            </button>
          ))}
        </div>
        <div className="form-group">
          <label>{t('coaches.form.hours', 'Horaires')}</label>
          <input value={form.horaires} onChange={(e) => set('horaires', e.target.value)} placeholder={t('coaches.form.hoursPh', 'Ex: 17:00 – 20:00')} />
        </div>

        <div className="form-group">
          <label>{t('coaches.form.bio', 'Présentation')}</label>
          <textarea rows={2} maxLength={500} value={form.bio} onChange={(e) => set('bio', e.target.value)} placeholder={t('coaches.form.bioPh', 'Quelques mots sur le coach…')} />
        </div>

        {submitError && <div className="form-error form-error--block">{submitError}</div>}

        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>{t('settings.modal.cancelBtn', 'Annuler')}</button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            <Save size={16} /> {saving ? t('settings.identity.saving', 'Enregistrement...') : t('settings.modal.saveBtn', 'Enregistrer')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
