import { useState } from 'react';
import { Save, UserCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import ActivityIcon from './ActivityIcon';

const ICONS = ['🏋️', '🥋', '🥊', '🧘', '🚴', '🏊', '🏃', '💃', '⚽', '🎾', '🥇', '🥤'];
const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', 'var(--w-stamp)', '#c2410c', '#a85a06', 'var(--w-green)', '#14b8a6', '#06b6d4'];

function toForm(act) {
  if (!act) {
    return {
      name: '', price_month: '', price_year: '',
      assurance_first_year: '', assurance_next_years: '', inscription_fees: '',
      max_capacity: '', genre: 'homme', description: '',
      icon: ICONS[0], color: COLORS[0],
    };
  }
  return {
    name: act.nom,
    price_month: act.prix.mensuel,
    price_year: act.prix.annuel,
    assurance_first_year: act.assurance_first || 0,
    assurance_next_years: act.assurance_next || 0,
    inscription_fees: act.inscription_fees || 0,
    max_capacity: act.max_capacity || 0,
    genre: act.genre || 'homme',
    description: act.description || '',
    icon: act.icon || ICONS[0],
    color: act.couleur || COLORS[0],
  };
}

// Converts the form's string inputs to the numbers the API expects.
function toPayload(form) {
  const num = (v) => (v === '' || v == null ? 0 : Number(v));
  return {
    ...form,
    name: form.name.trim(),
    description: form.description.trim(),
    price_month: num(form.price_month),
    price_year: num(form.price_year),
    assurance_first_year: num(form.assurance_first_year),
    assurance_next_years: num(form.assurance_next_years),
    inscription_fees: num(form.inscription_fees),
    max_capacity: Math.max(0, Math.round(num(form.max_capacity))),
  };
}

export default function ActivityFormModal({ activity, onSave, onClose }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => toForm(activity));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const set = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = t('activities.form.errName', 'Nom obligatoire');
    if (!(Number(form.price_month) > 0)) e.price_month = t('activities.form.errPrice', 'Prix invalide');
    if (!(Number(form.price_year) > 0)) e.price_year = t('activities.form.errPrice', 'Prix invalide');
    return e;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    setSubmitError('');
    try {
      await onSave(toPayload(form));
    } catch (err) {
      console.error(err);
      setSubmitError(t('settings.error.activitySave', "Erreur lors de l'enregistrement de l'activité."));
      setSaving(false);
    }
  };

  const quarterly = Number(form.price_month) > 0 ? Math.round(Number(form.price_month) * 3 * 0.9) : null;
  const numberInput = (key, extra = {}) => (
    <input type="number" min="0" step="any" inputMode="decimal" value={form[key]} onChange={(e) => set(key, e.target.value)} {...extra} />
  );

  return (
    <Modal
      title={activity ? t('settings.modal.editActivity', "Modifier l'activité") : t('settings.modal.newActivity', 'Nouvelle activité')}
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={submit} className="member-form">
        {/* Live preview */}
        <div className="act-preview" style={{ '--tc': form.color }}>
          <ActivityIcon icon={form.icon} color={form.color} badge size={20} className="act-preview__icon" />
          <div className="act-preview__text">
            <span className="act-preview__name">{form.name.trim() || t('activities.form.previewName', 'Nom de l’activité')}</span>
            <span className="act-preview__meta">
              {form.price_month ? `${form.price_month} DH / ${t('activities.form.perMonth', 'mois')}` : t('activities.form.previewHint', 'Aperçu de la carte')}
            </span>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>{t('settings.modal.activityName', "Nom de l'activité")} *</label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder={t('settings.modal.activityNamePlaceholder', 'Ex: Musculation, Karaté...')}
              autoFocus
            />
            {errors.name && <span className="form-error">{errors.name}</span>}
          </div>
          <div className="form-group">
            <label>{t('settings.modal.coachName', 'Nom du Coach')}</label>
            <div className="form-static">
              <UserCheck size={15} />
              <span>{activity && activity.coachNom !== 'À définir' ? activity.coachNom : t('activities.form.noCoach', 'Aucun coach')}</span>
              <Link to="/coaches" className="form-link" onClick={onClose}>{t('activities.form.manageCoaches', 'Gérer les coachs')}</Link>
            </div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>{t('settings.modal.section', 'Section (Genre)')}</label>
            <select value={form.genre} onChange={(e) => set('genre', e.target.value)}>
              <option value="homme">{t('settings.modal.sectionMen', 'Hommes')}</option>
              <option value="femme">{t('settings.modal.sectionWomen', 'Femmes')}</option>
              <option value="enfant">{t('settings.modal.sectionChildren', 'Enfants')}</option>
              <option value="universel">{t('settings.modal.sectionUniversal', 'Universel')}</option>
            </select>
          </div>
          <div className="form-group">
            <label>{t('settings.modal.maxCapacity', 'Capacité Max')}</label>
            {numberInput('max_capacity', { step: 1, placeholder: t('activities.form.unlimited', '0 = illimitée') })}
          </div>
        </div>

        <div className="form-section-title">{t('activities.rates', 'Tarifs')}</div>
        <div className="form-row">
          <div className="form-group">
            <label>{t('settings.modal.priceMonth', 'Prix Mensuel (DH)')} *</label>
            {numberInput('price_month')}
            {errors.price_month
              ? <span className="form-error">{errors.price_month}</span>
              : quarterly && <span className="form-hint">{t('activities.form.quarterlyHint', 'Trimestriel calculé : {{price}} DH (−10 %)', { price: quarterly })}</span>}
          </div>
          <div className="form-group">
            <label>{t('settings.modal.priceYear', 'Prix Annuel (DH)')} *</label>
            {numberInput('price_year')}
            {errors.price_year && <span className="form-error">{errors.price_year}</span>}
          </div>
        </div>
        <div className="form-row form-row--3">
          <div className="form-group">
            <label>{t('settings.modal.inscriptionFees', "Frais d'inscription (DH)")}</label>
            {numberInput('inscription_fees')}
          </div>
          <div className="form-group">
            <label>{t('settings.modal.assuranceFirst', 'Assurance (1ère année)')}</label>
            {numberInput('assurance_first_year')}
          </div>
          <div className="form-group">
            <label>{t('settings.modal.assuranceNext', 'Assurance (Renouvellement)')}</label>
            {numberInput('assurance_next_years')}
          </div>
        </div>

        <div className="form-group">
          <label>{t('settings.modal.description', 'Description')}</label>
          <textarea
            rows={2}
            maxLength={255}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder={t('settings.modal.descriptionPlaceholder', "Bref descriptif de l'activité...")}
          />
        </div>

        <div className="form-section-title">{t('settings.modal.iconColor', 'Icone & Couleur')}</div>
        <div className="act-picker">
          <div className="act-picker__icons">
            {ICONS.map((i) => (
              <button
                key={i}
                type="button"
                className={`act-picker__icon${form.icon === i ? ' is-active' : ''}`}
                style={{ '--tc': form.color }}
                onClick={() => set('icon', i)}
              >
                <ActivityIcon icon={i} size={18} />
              </button>
            ))}
          </div>
          <div className="act-picker__colors">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                className={`act-picker__color${form.color === c ? ' is-active' : ''}`}
                style={{ background: c }}
                onClick={() => set('color', c)}
              />
            ))}
          </div>
        </div>

        {submitError && <div className="form-error form-error--block">{submitError}</div>}

        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {t('settings.modal.cancelBtn', 'Annuler')}
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            <Save size={16} /> {saving ? t('settings.identity.saving', 'Enregistrement...') : t('settings.modal.saveBtn', 'Enregistrer')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
