import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Settings as SettingsIcon, Save, Upload, Dumbbell, ShieldCheck, ArrowRight } from 'lucide-react';
import { useGym } from '../context/GymContext';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { getKioskPinStatus, updateKioskPin } from '../api/client';
import './Settings.jsx.css';
import ActivityIcon from '../components/ActivityIcon';

export default function Settings() {
  const { t } = useTranslation();
  const { gymSettings, updateSettings, activites } = useGym();
  
  const [gymName, setGymName] = useState('');
  const [logoBase64, setLogoBase64] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';

  const [pinStatus, setPinStatus] = useState({ is_set: false, loading: true });
  const [pinForm, setPinForm] = useState({ old_pin: '', new_pin: '', confirm_pin: '' });
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [pinError, setPinError] = useState('');

  const fetchPinStatus = async () => {
    if (!isSuperAdmin) return;
    try {
      const res = await getKioskPinStatus();
      setPinStatus({ is_set: res.is_set, loading: false });
    } catch (err) {
      console.error("Failed to load kiosk PIN status", err);
      setPinStatus({ is_set: false, loading: false });
    }
  };

  useEffect(() => {
    fetchPinStatus();
  }, [isSuperAdmin]);

  const handlePinSubmit = async (e) => {
    e.preventDefault();
    setPinError('');
    
    const newPin = pinForm.new_pin.trim();
    const confirmPin = pinForm.confirm_pin.trim();
    const oldPin = pinForm.old_pin.trim();

    if (!/^\d{6}$/.test(newPin)) {
      setPinError(t('settings.pin.errorDigits', 'Le code PIN doit être composé de 6 chiffres exactement.'));
      return;
    }
    if (newPin !== confirmPin) {
      setPinError(t('settings.pin.errorMatch', 'Le nouveau PIN et la confirmation ne correspondent pas.'));
      return;
    }
    if (pinStatus.is_set && !oldPin) {
      setPinError(t('settings.pin.errorOldRequired', 'Veuillez saisir votre code PIN actuel.'));
      return;
    }

    setIsSavingPin(true);
    try {
      await updateKioskPin({
        old_pin: pinStatus.is_set ? oldPin : null,
        new_pin: newPin,
        confirm_pin: confirmPin
      });
      setSuccessMsg(t('settings.pin.successSaved', 'Code PIN du Kiosque mis à jour avec succès !'));
      setPinForm({ old_pin: '', new_pin: '', confirm_pin: '' });
      setShowSuccess(true);
      fetchPinStatus();
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      setPinError(msg);
    } finally {
      setIsSavingPin(false);
    }
  };
  
  useEffect(() => {
    if (gymSettings) {
      setGymName(gymSettings.name || '');
      setLogoBase64(gymSettings.logo_base64 || '');
    }
  }, [gymSettings]);

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogoBase64(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const saveGeneralSettings = async () => {
    setIsSavingSettings(true);
    try {
      await updateSettings({ name: gymName, logo_base64: logoBase64 });
      setSuccessMsg(t('settings.success.gymSaved', 'Paramètres du Gym enregistrés avec succès !'));
      setShowSuccess(true);
    } catch (err) {
      console.error(err);
      alert(t('settings.error.gymSave', "Erreur lors de l'enregistrement."));
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="settings-container fade-in">
      <header className="settings-header">
        <h1>{t('settings.title', 'Paramètres du Gym')}</h1>
        <p>{t('settings.subtitle', "Configurez l'identité visuelle et la grille tarifaire de votre salle.")}</p>
      </header>

      <div className="settings-grid">
        {/* Column 1: Gym Identity & Kiosk Security */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* General Identity */}
          <section className="settings-card">
          <h2><SettingsIcon size={20} /> {t('settings.identity.title', 'Identité du Gym')}</h2>
          
          <div className="form-group">
            <label>{t('settings.identity.logo', 'Logo de la salle')}</label>
            <div className="logo-preview">
              {logoBase64 ? (
                <img src={logoBase64} alt="Gym Logo" />
              ) : (
                <div className="logo-placeholder">{t('settings.identity.logoPlaceholder', 'Logo')}</div>
              )}
            </div>
            <label className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <Upload size={16} />
              {t('settings.identity.chooseFile', 'Choisir un fichier')}
              <input type="file" hidden onChange={handleLogoUpload} accept="image/*" />
            </label>
          </div>

          <div className="form-group">
            <label>{t('settings.identity.gymName', 'Nom du Gym')}</label>
            <input 
              type="text" 
              className="form-control" 
              value={gymName}
              onChange={(e) => setGymName(e.target.value)}
              placeholder="Ex: ASAAS GYM"
            />
          </div>

          <button className="btn-primary" onClick={saveGeneralSettings} disabled={isSavingSettings}>
            <Save size={18} />
            {isSavingSettings ? t('settings.identity.saving', 'Enregistrement...') : t('settings.identity.save', 'Enregistrer')}
          </button>
        </section>

        {/* Kiosk PIN Configuration */}
        {isSuperAdmin && (
          <section className="settings-card">
            <h2><ShieldCheck size={20} /> {t('settings.kioskPin.title', 'Sécurité Kiosque')}</h2>
            <p style={{ color: 'var(--clr-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              {t('settings.kioskPin.desc', 'Configurez le code PIN à 6 chiffres pour déverrouiller le panneau de maintenance de la tablette kiosque.')}
            </p>

            {pinStatus.loading ? (
              <p style={{ color: 'var(--clr-muted)' }}>Chargement...</p>
            ) : (
              <form onSubmit={handlePinSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {pinStatus.is_set ? (
                  <>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>{t('settings.kioskPin.oldPin', 'Code PIN Actuel')}</label>
                      <input 
                        type="password" 
                        maxLength={6}
                        className="form-control" 
                        required
                        value={pinForm.old_pin}
                        onChange={e => setPinForm({...pinForm, old_pin: e.target.value.replace(/\D/g, '')})}
                        placeholder="••••••"
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>{t('settings.kioskPin.newPin', 'Nouveau Code PIN (6 chiffres)')}</label>
                      <input 
                        type="password" 
                        maxLength={6}
                        className="form-control" 
                        required
                        value={pinForm.new_pin}
                        onChange={e => setPinForm({...pinForm, new_pin: e.target.value.replace(/\D/g, '')})}
                        placeholder="••••••"
                      />
                    </div>
                  </>
                ) : (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>{t('settings.kioskPin.createPin', 'Définir un Code PIN (6 chiffres)')}</label>
                    <input 
                      type="password" 
                      maxLength={6}
                      className="form-control" 
                      required
                      value={pinForm.new_pin}
                      onChange={e => setPinForm({...pinForm, new_pin: e.target.value.replace(/\D/g, '')})}
                      placeholder="••••••"
                    />
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>{t('settings.kioskPin.confirmPin', 'Confirmer le Nouveau Code PIN')}</label>
                  <input 
                    type="password" 
                    maxLength={6}
                    className="form-control" 
                    required
                    value={pinForm.confirm_pin}
                    onChange={e => setPinForm({...pinForm, confirm_pin: e.target.value.replace(/\D/g, '')})}
                    placeholder="••••••"
                  />
                </div>

                {pinError && (
                  <p style={{ color: 'var(--w-stamp)', fontSize: '0.85rem', margin: 0 }}>{pinError}</p>
                )}

                <button type="submit" className="btn-primary" disabled={isSavingPin} style={{ alignSelf: 'flex-start', marginTop: '0.5rem' }}>
                  <Save size={18} />
                  {isSavingPin ? t('settings.kioskPin.saving', 'Enregistrement...') : t('settings.kioskPin.save', 'Enregistrer')}
                </button>
              </form>
            )}
          </section>
        )}
        </div>

        {/* Activities are managed on the Activités page */}
        <section className="settings-card">
          <h2><Dumbbell size={20} /> {t('settings.activities.title', 'Activités & Tarifs')}</h2>
          <p style={{ color: 'var(--clr-muted)', fontSize: '0.9rem', margin: '0 0 1.25rem' }}>
            {t('settings.activities.movedDesc', 'Les activités, leurs tarifs et leurs coachs se gèrent maintenant depuis la page Activités.')}
          </p>
          <div className="settings-act-summary">
            {activites.map((act) => (
              <span key={act.id} className="settings-act-chip" style={{ '--tc': act.couleur }}>
                <ActivityIcon icon={act.icon} size={14} /> {act.nom}
              </span>
            ))}
          </div>
          <Link to="/activites" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none', marginTop: '1.25rem' }}>
            {t('settings.activities.manage', 'Gérer les activités')} <ArrowRight size={18} />
          </Link>
        </section>
      </div>

      {/* Success Modal */}
      {showSuccess && (
        <div className="modal-overlay" onClick={() => setShowSuccess(false)}>
          <div className="settings-modal scale-in success-modal" onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <div className="success-icon">
                <ShieldCheck size={48} color="var(--w-blue)" />
              </div>
              <h2 style={{ color: 'var(--clr-primary-h)', marginBottom: '1rem' }}>{t('settings.success.title', 'Succès !')}</h2>
              <p style={{ color: 'var(--clr-muted)', marginBottom: '2rem' }}>{successMsg}</p>
              <button className="btn-primary" style={{ width: '100%' }} onClick={() => setShowSuccess(false)}>
                {t('settings.success.continue', 'Continuer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
