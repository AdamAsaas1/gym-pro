import { useEffect, useState } from 'react';
import { KeyRound, Copy, Check, UserCog, ShieldCheck, Terminal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { getStaffUsers, resetStaffPassword } from '../api/client';

const ROLE_LABELS = { superadmin: 'Super Admin', admin: 'Admin' };

function ResetPasswordDialog({ account, onClose }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [temp, setTemp] = useState('');
  const [copied, setCopied] = useState(false);

  const reset = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await resetStaffPassword(account.id);
      setTemp(res.temporary_password);
    } catch (err) {
      console.error(err);
      setError(t('staff.resetError', 'Impossible de réinitialiser ce mot de passe.'));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(temp);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable: the password stays visible to copy by hand */ }
  };

  return (
    <Modal title={t('staff.resetTitle', 'Réinitialiser le mot de passe')} onClose={onClose}>
      <div className="act-delete">
        <strong className="act-delete__name">{account.username}</strong>
        {!temp ? (
          <>
            <p className="act-delete__text">
              {t('staff.resetConfirm', "Un nouveau mot de passe temporaire va être créé. L'ancien ne fonctionnera plus.")}
            </p>
            {error && <div className="form-error form-error--block">{error}</div>}
            <div className="form-actions">
              <button className="btn btn--ghost" onClick={onClose}>{t('settings.modal.cancelBtn', 'Annuler')}</button>
              <button className="btn btn--primary" onClick={reset} disabled={busy}>
                <KeyRound size={16} /> {t('staff.resetBtn', 'Réinitialiser')}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="act-delete__text">{t('staff.tempLabel', 'Nouveau mot de passe temporaire :')}</p>
            <div className="temp-pwd">
              <code>{temp}</code>
              <button type="button" className="btn btn--ghost btn--sm" onClick={copy}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? t('staff.copied', 'Copié') : t('staff.copy', 'Copier')}
              </button>
            </div>
            <p className="act-delete__warn">
              {t('staff.tempWarn', "Notez-le maintenant : il ne sera plus affiché. Transmettez-le à la personne, qui devra le changer avec le bouton 🔑.")}
            </p>
            <div className="form-actions">
              <button className="btn btn--primary" onClick={onClose}>{t('staff.done', "C'est noté")}</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default function StaffAccounts() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(null);

  useEffect(() => {
    getStaffUsers()
      .then(setAccounts)
      .catch((err) => console.error('Error loading staff accounts:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="card permissions-panel staff-accounts">
      <div className="staff-accounts__head">
        <UserCog size={18} />
        <h3>{t('staff.title', 'Comptes du personnel')}</h3>
      </div>
      <p className="staff-accounts__desc">
        {t('staff.desc', 'Si un admin a oublié son mot de passe, donnez-lui un mot de passe temporaire ici.')}
      </p>

      {loading ? (
        <p className="staff-accounts__desc">{t('staff.loading', 'Chargement…')}</p>
      ) : (
        <div className="staff-list">
          {accounts.map((a) => (
            <div key={a.id} className={`staff-row${a.is_active ? '' : ' is-inactive'}`}>
              <div className="staff-row__avatar">{a.username.slice(0, 2).toUpperCase()}</div>
              <div className="staff-row__id">
                <strong>{a.username}{user?.username === a.username && <span className="staff-row__me"> · {t('staff.you', 'vous')}</span>}</strong>
                <span className={`staff-row__role staff-row__role--${a.role}`}>
                  {a.role === 'superadmin' && <ShieldCheck size={12} />} {ROLE_LABELS[a.role] || a.role}
                </span>
              </div>
              {a.role === 'superadmin' ? (
                <span className="staff-row__hint" title={t('staff.superHint', 'Mot de passe oublié : utilisez la commande de secours sur le serveur.')}>
                  <Terminal size={14} /> {t('staff.superShort', 'Commande de secours')}
                </span>
              ) : (
                <button className="btn btn--ghost btn--sm" onClick={() => setResetting(a)}>
                  <KeyRound size={14} /> {t('staff.resetBtnLong', 'Réinitialiser le mot de passe')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="permissions-note staff-accounts__rescue">
        <Terminal size={14} />
        <span>
          {t('staff.rescue', 'Superadmin qui a oublié son mot de passe : sur l’ordinateur du serveur, lancez')}{' '}
          <code>docker compose exec backend python scripts/reset_password.py superadmin</code>
        </span>
      </div>

      {resetting && <ResetPasswordDialog account={resetting} onClose={() => setResetting(null)} />}
    </section>
  );
}
