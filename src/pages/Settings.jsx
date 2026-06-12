import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Plus, Edit2, Trash2, Save, Upload, X, Dumbbell, ShieldCheck, DollarSign, Users } from 'lucide-react';
import { useGym } from '../context/GymContext';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { getKioskPinStatus, updateKioskPin } from '../api/client';
import './Settings.jsx.css';

export default function Settings() {
  const { t } = useTranslation();
  const { gymSettings, updateSettings, activites, addActivity, updateActivity, deleteActivity } = useGym();
  
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
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [activityForm, setActivityForm] = useState({
    name: '',
    price_month: '',
    price_year: '',
    assurance_first_year: '',
    assurance_next_years: '',
    inscription_fees: '',
    max_capacity: '',
    genre: 'homme',
    description: '',
    coach_name: '',
    icon: '🏋️',
    color: '#6366f1'
  });

  const ICONS = ['🏋️', '🥋', '🥊', '🧘', '🚴', '🏊', '🏃', '💃', '⚽', '🎾', '🥇', '🥤'];
  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

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

  const openActivityModal = (act = null) => {
    if (act) {
      setEditingActivity(act);
      setActivityForm({
        name: act.nom,
        price_month: act.prix.mensuel,
        price_year: act.prix.annuel,
        assurance_first_year: act.assurance_first || 0,
        assurance_next_years: act.assurance_next || 0,
        inscription_fees: act.inscription_fees || 0,
        max_capacity: act.max_capacity || 0,
        genre: act.genre || 'homme',
        description: act.description || '',
        coach_name: act.coachNom || '',
        icon: act.icon || '🏋️',
        color: act.couleur || '#6366f1'
      });
    } else {
      setEditingActivity(null);
      setActivityForm({
        name: '',
        price_month: '',
        price_year: '',
        assurance_first_year: '',
        assurance_next_years: '',
        inscription_fees: '',
        max_capacity: '',
        genre: 'homme',
        description: '',
        coach_name: '',
        icon: '🏋️',
        color: '#6366f1'
      });
    }
    setIsModalOpen(true);
  };

  const handleActivitySubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingActivity) {
        await updateActivity(editingActivity.id, activityForm);
        setSuccessMsg(t('settings.success.activityUpdated', "L'activité \"{{name}}\" a été mise à jour.", { name: activityForm.name }));
      } else {
        await addActivity(activityForm);
        setSuccessMsg(t('settings.success.activityCreated', "L'activité \"{{name}}\" a été créée avec succès.", { name: activityForm.name }));
      }
      setIsModalOpen(false);
      setShowSuccess(true);
    } catch (err) {
      console.error(err);
      alert(t('settings.error.activitySave', "Erreur lors de l'enregistrement de l'activité."));
    }
  };

  const handleDeleteActivity = async (id) => {
    if (window.confirm(t('settings.confirm.deleteActivity', 'Êtes-vous sûr de vouloir supprimer cette activité ?'))) {
      try {
        await deleteActivity(id);
      } catch (err) {
        console.error(err);
        alert(t('settings.error.deleteActivity', 'Erreur lors de la suppression.'));
      }
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
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              {t('settings.kioskPin.desc', 'Configurez le code PIN à 6 chiffres pour déverrouiller le panneau de maintenance de la tablette kiosque.')}
            </p>

            {pinStatus.loading ? (
              <p style={{ color: '#94a3b8' }}>Chargement...</p>
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
                  <p style={{ color: '#f87171', fontSize: '0.85rem', margin: 0 }}>{pinError}</p>
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

        {/* Activities Management */}
        <section className="settings-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ marginBottom: 0 }}><Dumbbell size={20} /> {t('settings.activities.title', 'Activités & Tarifs')}</h2>
            <button className="btn-primary" style={{ padding: '0.5rem 1rem' }} onClick={() => openActivityModal()}>
              <Plus size={18} /> {t('settings.activities.new', 'Nouveau')}
            </button>
          </div>

          <div className="activities-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', alignItems: 'stretch', textAlign: 'left' }}>
            {activites.length > 0 ? (
              activites.map(act => (
                <div 
                  key={act.id} 
                  className="activity-item" 
                  style={{ 
                    '--tc': act.couleur, 
                    '--bg': act.bg,
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: '1rem',
                    padding: '1rem',
                    width: '100%',
                    borderLeft: `6px solid ${act.couleur}`,
                    textAlign: 'left'
                  }}
                >
                  <div className="activity-item-main" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, textAlign: 'left' }}>
                    <div className="activity-item-icon" style={{ backgroundColor: act.bg, color: act.couleur, width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                      {act.icon}
                    </div>
                    <div className="activity-info" style={{ textAlign: 'left' }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>{act.nom}</h3>
                      <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>{act.prix.mensuel} DH / mois • {act.prix.annuel} DH / an</p>
                    </div>
                  </div>
                  <div className="activity-actions" style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                    <button className="action-btn" onClick={() => openActivityModal(act)} title={t('settings.activities.edit', 'Modifier')}><Edit2 size={16} /></button>
                    <button className="action-btn delete" onClick={() => handleDeleteActivity(act.id)} title={t('settings.activities.delete', 'Supprimer')}><Trash2 size={16} /></button>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>
                {t('settings.activities.noActivities', 'Aucune activité configurée.')}
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Activity Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="settings-modal scale-in">
            <div className="modal-header">
              <h2>{editingActivity ? t('settings.modal.editActivity', "Modifier l'activité") : t('settings.modal.newActivity', "Nouvelle activité")}</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}><X size={24} /></button>
            </div>

            <form onSubmit={handleActivitySubmit}>
              <div className="form-group">
                <label>{t('settings.modal.activityName', "Nom de l'activité")}</label>
                <input 
                  type="text" 
                  className="form-control" 
                  required
                  value={activityForm.name}
                  onChange={e => setActivityForm({...activityForm, name: e.target.value})}
                  placeholder={t('settings.modal.activityNamePlaceholder', "Ex: Musculation, Karaté...")}
                />
              </div>

              <div className="price-row">
                <div className="form-group">
                  <label><DollarSign size={14} style={{ marginRight: 4 }}/> {t('settings.modal.priceMonth', 'Prix Mensuel (DH)')}</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    required
                    value={activityForm.price_month}
                    onChange={e => setActivityForm({...activityForm, price_month: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label><DollarSign size={14} style={{ marginRight: 4 }}/> {t('settings.modal.priceYear', 'Prix Annuel (DH)')}</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    required
                    value={activityForm.price_year}
                    onChange={e => setActivityForm({...activityForm, price_year: e.target.value})}
                  />
                </div>
              </div>

              <div className="price-row">
                <div className="form-group">
                  <label><ShieldCheck size={14} style={{ marginRight: 4 }}/> {t('settings.modal.assuranceFirst', 'Assurance (1ère année)')}</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={activityForm.assurance_first_year}
                    onChange={e => setActivityForm({...activityForm, assurance_first_year: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label><ShieldCheck size={14} style={{ marginRight: 4 }}/> {t('settings.modal.assuranceNext', 'Assurance (Renouvellement)')}</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={activityForm.assurance_next_years}
                    onChange={e => setActivityForm({...activityForm, assurance_next_years: e.target.value})}
                  />
                </div>
              </div>

              <div className="price-row">
                <div className="form-group">
                  <label>{t('settings.modal.inscriptionFees', "Frais d'inscription (DH)")}</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={activityForm.inscription_fees}
                    onChange={e => setActivityForm({...activityForm, inscription_fees: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label><Users size={14} style={{ marginRight: 4 }}/> {t('settings.modal.maxCapacity', 'Capacité Max')}</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={activityForm.max_capacity}
                    onChange={e => setActivityForm({...activityForm, max_capacity: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>{t('settings.modal.description', 'Description')}</label>
                <textarea 
                  className="form-control" 
                  rows="2"
                  value={activityForm.description}
                  onChange={e => setActivityForm({...activityForm, description: e.target.value})}
                  placeholder={t('settings.modal.descriptionPlaceholder', "Bref descriptif de l'activité...")}
                />
              </div>

              <div className="price-row">
                <div className="form-group">
                  <label>{t('settings.modal.section', 'Section (Genre)')}</label>
                  <select 
                    className="form-control"
                    value={activityForm.genre}
                    onChange={e => setActivityForm({...activityForm, genre: e.target.value})}
                  >
                    <option value="homme">{t('settings.modal.sectionMen', 'Hommes')}</option>
                    <option value="femme">{t('settings.modal.sectionWomen', 'Femmes')}</option>
                    <option value="enfant">{t('settings.modal.sectionChildren', 'Enfants')}</option>
                    <option value="universel">{t('settings.modal.sectionUniversal', 'Universel')}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('settings.modal.coachName', 'Nom du Coach')}</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={activityForm.coach_name}
                    onChange={e => setActivityForm({...activityForm, coach_name: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>{t('settings.modal.iconColor', 'Icone & Couleur')}</label>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div className="icon-selector">
                    {ICONS.map(i => (
                      <button 
                        key={i} 
                        type="button"
                        className={`icon-choice ${activityForm.icon === i ? 'active' : ''}`}
                        onClick={() => setActivityForm({...activityForm, icon: i})}
                      >
                        {i}
                      </button>
                    ))}
                  </div>
                  <div className="color-selector">
                    {COLORS.map(c => (
                      <button 
                        key={c} 
                        type="button"
                        className={`color-choice ${activityForm.color === c ? 'active' : ''}`}
                        style={{ backgroundColor: c }}
                        onClick={() => setActivityForm({...activityForm, color: c})}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                  <Save size={18} /> {t('settings.modal.saveBtn', 'Enregistrer')}
                </button>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>
                  {t('settings.modal.cancelBtn', 'Annuler')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Success Modal */}
      {showSuccess && (
        <div className="modal-overlay" onClick={() => setShowSuccess(false)}>
          <div className="settings-modal scale-in success-modal" onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <div className="success-icon">
                <ShieldCheck size={48} color="#ffd700" />
              </div>
              <h2 style={{ color: '#ffd700', marginBottom: '1rem' }}>{t('settings.success.title', 'Succès !')}</h2>
              <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>{successMsg}</p>
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
