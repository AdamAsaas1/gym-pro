import { useState } from 'react';
import { Eye, EyeOff, Save, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import { changePassword } from '../api/client';

function PasswordInput({ value, onChange, autoFocus, autoComplete }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="pwd-input">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
      />
      <button type="button" className="pwd-input__toggle" onClick={() => setVisible(!visible)} tabIndex={-1} aria-label={visible ? 'Masquer' : 'Afficher'}>
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

// 0-4 score used only for the strength bar.
function strength(pwd) {
  let s = 0;
  if (pwd.length >= 8) s += 1;
  if (pwd.length >= 12) s += 1;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) s += 1;
  if (/\d/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) s += 1;
  return s;
}

export default function ChangePasswordModal({ onClose }) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const score = strength(next);
  const levels = [
    t('password.weak', 'Faible'), t('password.weak', 'Faible'), t('password.medium', 'Moyen'),
    t('password.good', 'Bon'), t('password.strong', 'Fort'),
  ];

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (next.length < 8) { setError(t('password.errLength', 'Le nouveau mot de passe doit contenir au moins 8 caractères.')); return; }
    if (next !== confirm) { setError(t('password.errMatch', 'Les deux mots de passe ne correspondent pas.')); return; }
    setSaving(true);
    try {
      await changePassword({ current_password: current, new_password: next });
      setDone(true);
    } catch (err) {
      const code = err.response?.data?.detail?.code;
      setError(
        code === 'invalid_password' ? t('password.errCurrent', 'Mot de passe actuel incorrect.')
          : code === 'same_password' ? t('password.errSame', "Le nouveau mot de passe doit être différent de l'ancien.")
            : t('password.errGeneric', 'Impossible de changer le mot de passe. Réessayez.'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={t('password.title', 'Changer mon mot de passe')} onClose={onClose}>
      {done ? (
        <div className="act-delete">
          <CheckCircle2 size={44} color="var(--clr-primary)" />
          <strong className="act-delete__name">{t('password.success', 'Mot de passe modifié !')}</strong>
          <p className="act-delete__text">{t('password.successHint', 'Utilisez votre nouveau mot de passe à la prochaine connexion.')}</p>
          <div className="form-actions">
            <button className="btn btn--primary" onClick={onClose}>{t('settings.success.continue', 'Continuer')}</button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="member-form">
          <div className="form-group">
            <label>{t('password.current', 'Mot de passe actuel')}</label>
            <PasswordInput value={current} onChange={setCurrent} autoFocus autoComplete="current-password" />
          </div>
          <div className="form-group">
            <label>{t('password.new', 'Nouveau mot de passe')}</label>
            <PasswordInput value={next} onChange={setNext} autoComplete="new-password" />
            {next && (
              <div className={`pwd-strength pwd-strength--${score}`}>
                <div className="pwd-strength__bar">{[1, 2, 3, 4].map((i) => <span key={i} className={i <= score ? 'is-on' : ''} />)}</div>
                <span>{levels[score]}</span>
              </div>
            )}
            <span className="form-hint">{t('password.hint', 'Au moins 8 caractères. Mélangez lettres, chiffres et symboles.')}</span>
          </div>
          <div className="form-group">
            <label>{t('password.confirm', 'Confirmer le nouveau mot de passe')}</label>
            <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" />
          </div>

          {error && <div className="form-error form-error--block">{error}</div>}

          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>{t('settings.modal.cancelBtn', 'Annuler')}</button>
            <button type="submit" className="btn btn--primary" disabled={saving || !current || !next || !confirm}>
              <Save size={16} /> {saving ? t('settings.identity.saving', 'Enregistrement...') : t('settings.modal.saveBtn', 'Enregistrer')}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
