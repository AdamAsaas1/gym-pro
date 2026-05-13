import { useState, useMemo, useEffect, useRef } from 'react';
import { UserPlus, Search, Pencil, Trash2, ToggleLeft, ToggleRight, Filter, Eye, Download, User } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import Modal from '../components/Modal';
import { useGym } from '../context/GymContext';
import { telechargerRecu } from '../api/client';
import { useTranslation } from 'react-i18next';

// Removing hardcoded ACTIVITES_BY_GENRE as we now use the database

const getPhotoSrc = (base64) => {
  if (!base64) return null;
  return base64.startsWith('data:image') ? base64 : `data:image/jpeg;base64,${base64}`;
};

const EMPTY_FORM = {
  nom: '', prenom: '', genre: 'homme', activite: '',
  abonnement: 'mensuel', statut: 'actif', telephone: '', email: '',
  dateNaissance: '', dateInscription: new Date().toISOString().split('T')[0],
  dateExpiration: '',
  photoBase64: '',
  password: '',
};

function computeExpiration(dateInscription, abonnement, durations) {
  if (!dateInscription || !abonnement) return '';
  const d = new Date(dateInscription);
  const duration = durations?.[abonnement] ?? 0;
  d.setDate(d.getDate() + duration);
  return d.toISOString().split('T')[0];
}

function MemberForm({ initial, onSave, onClose, activites, abonnementDurations, variant = 'default' }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    ...initial,
    activite: initial?.activite || activites.find(a => a.genre === (initial?.genre || 'homme') || a.genre === 'universel')?.id || '',
    dateExpiration: initial?.dateExpiration || computeExpiration(
      initial?.dateInscription || EMPTY_FORM.dateInscription,
      initial?.abonnement || EMPTY_FORM.abonnement,
      abonnementDurations,
    ),
  }));
  const [errors, setErrors] = useState({});
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!cameraOn || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => {});
  }, [cameraOn]);

  const set = (key, val) => {
    setForm((prev) => {
      const next = { ...prev, [key]: val };
      if (key === 'genre') {
        const firstAct = activites.find(a => a.genre === val || a.genre === 'universel');
        next.activite = firstAct ? firstAct.id : '';
      }
      if (key === 'dateInscription' || key === 'abonnement') {
        next.dateExpiration = computeExpiration(
          key === 'dateInscription' ? val : next.dateInscription,
          key === 'abonnement'      ? val : next.abonnement,
          abonnementDurations,
        );
      }
      return next;
    });
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.nom.trim())       e.nom = t('members.form.errNom', 'Nom obligatoire');
    if (!form.prenom.trim())    e.prenom = t('members.form.errPrenom', 'Prénom obligatoire');
    if (!form.telephone.trim()) e.telephone = t('members.form.errTel', 'Téléphone obligatoire');
    if (!form.dateNaissance)    e.dateNaissance = t('members.form.errDateNaissance', 'Date de naissance obligatoire');
    if (!initial?.id && !form.password) e.password = t('members.form.errPassword', 'Mot de passe obligatoire pour les nouveaux membres');
    return e;
  };

  const submit = (ev) => {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onSave(form);
  };

  const activiteOpts = activites.filter((a) => a.genre === form.genre || a.genre === 'universel');

  const startCamera = async () => {
    setCameraError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera non disponible sur ce navigateur");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      streamRef.current = stream;
      setCameraOn(true);
    } catch {
      setCameraError("Autorisation camera refusee");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOn(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setForm((prev) => ({ ...prev, photoBase64: dataUrl }));
    stopCamera();
  };

  return (
    <form onSubmit={submit} className={`member-form${variant === 'wide' ? ' member-form--wide' : ''}`}>
      <div className="form-row">
        <div className="form-group">
          <label>{t('members.form.lastName', 'Nom')} *</label>
          <input value={form.nom} onChange={(e) => set('nom', e.target.value.toUpperCase())} placeholder={t('members.form.phLastName', 'NOM')} />
          {errors.nom && <span className="form-error">{errors.nom}</span>}
        </div>
        <div className="form-group">
          <label>{t('members.form.firstName', 'Prénom')} *</label>
          <input value={form.prenom} onChange={(e) => set('prenom', e.target.value)} placeholder={t('members.form.phFirstName', 'Prénom')} />
          {errors.prenom && <span className="form-error">{errors.prenom}</span>}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>{t('members.form.section', 'Section')} *</label>
          <select value={form.genre} onChange={(e) => set('genre', e.target.value)}>
            <option value="homme">{t('members.form.secMen', 'Hommes (Adultes)')}</option>
            <option value="femme">{t('members.form.secWomen', 'Femmes (Adultes)')}</option>
            <option value="enfant">{t('members.form.secChildren', 'Enfants (6–14 ans)')}</option>
          </select>
        </div>
        <div className="form-group">
          <label>{t('members.form.activity', 'Activité')} *</label>
          <select value={form.activite} onChange={(e) => set('activite', e.target.value)}>
            {activiteOpts.length > 0 ? (
              activiteOpts.map((a) => (
                <option key={a.id} value={a.id}>{a.icon} {t(a.nom, a.nom)}</option>
              ))
            ) : (
              <option value="">{t('members.form.noActivity', 'Aucune activité disponible')}</option>
            )}
          </select>
          {activiteOpts.length === 0 && (
            <span className="form-error" style={{ fontSize: '0.7rem' }}>
              {t('members.form.createActivityWarning', 'Veuillez créer une activité pour cette section dans les paramètres.')}
            </span>
          )}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>{t('members.form.subscription', 'Abonnement')} *</label>
          <select value={form.abonnement} onChange={(e) => set('abonnement', e.target.value)}>
            <option value="mensuel">{t('members.form.subMonthly', 'Mensuel (1 mois)')}</option>
            <option value="trimestriel">{t('members.form.subQuarterly', 'Trimestriel (3 mois)')}</option>
            <option value="annuel">{t('members.form.subYearly', 'Annuel (12 mois)')}</option>
          </select>
        </div>
        <div className="form-group">
          <label>{t('members.form.status', 'Statut')}</label>
          <select value={form.statut} onChange={(e) => set('statut', e.target.value)}>
            <option value="actif">{t('members.form.statusActive', 'Actif')}</option>
            <option value="inactif">{t('members.form.statusInactive', 'Inactif')}</option>
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>{t('members.form.phone', 'Téléphone')} *</label>
          <input value={form.telephone} onChange={(e) => set('telephone', e.target.value)} placeholder="0600-000-000" />
          {errors.telephone && <span className="form-error">{errors.telephone}</span>}
        </div>
        <div className="form-group">
          <label>{t('members.form.email', 'Email')}</label>
          <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="email@exemple.com" />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>{t('members.form.birthDate', 'Date de naissance')} *</label>
          <input type="date" value={form.dateNaissance} onChange={(e) => set('dateNaissance', e.target.value)} />
          {errors.dateNaissance && <span className="form-error">{errors.dateNaissance}</span>}
        </div>
        <div className="form-group">
          <label>{t('members.form.registrationDate', "Date d'inscription")}</label>
          <input type="date" value={form.dateInscription} onChange={(e) => set('dateInscription', e.target.value)} />
        </div>
      </div>

      <div className="form-group">
        <label>{t('members.form.calculatedExpiration', "Date d'expiration (calculée)")}</label>
        <input type="date" value={form.dateExpiration} readOnly className="input--readonly" />
      </div>
      
      <div className="form-group">
        <label>{initial?.id ? t('members.form.newPassword', 'Nouveau mot de passe (laisser vide pour ne pas changer)') : t('members.form.initialPassword', 'Mot de passe initial *')}</label>
        <input 
          type="password" 
          value={form.password} 
          onChange={(e) => set('password', e.target.value)} 
          placeholder="••••••••" 
          autoComplete="new-password"
        />
        {errors.password && <span className="form-error">{errors.password}</span>}
      </div>

      <div className="form-group">
        <label>{t('members.form.photo', 'Photo du membre')}</label>
        <div className="photo-capture">
          <div className="photo-preview">
            {form.photoBase64 ? (
              <img src={form.photoBase64} alt={t('members.form.photoAlt', 'Photo membre')} />
            ) : (
              <div className="photo-placeholder">{t('members.form.noPhoto', 'Aucune photo')}</div>
            )}
          </div>
          <div className="photo-actions">
            {!cameraOn ? (
              <button type="button" className="btn btn--ghost btn--sm" onClick={startCamera}>
                {t('members.form.openCamera', 'Ouvrir la camera')}
              </button>
            ) : (
              <>
                <button type="button" className="btn btn--primary btn--sm" onClick={capturePhoto}>
                  {t('members.form.takePhoto', 'Prendre la photo')}
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={stopCamera}>
                  {t('members.form.closeCamera', 'Fermer')}
                </button>
              </>
            )}
            {form.photoBase64 && !cameraOn && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setForm((prev) => ({ ...prev, photoBase64: '' }))}
              >
                {t('members.form.removePhoto', 'Retirer la photo')}
              </button>
            )}
          </div>
          {cameraError && <div className="form-error">{cameraError}</div>}
          {cameraOn && (
            <div className="photo-camera">
              <video ref={videoRef} playsInline />
            </div>
          )}
        </div>
      </div>

      {/* Price preview */}
      {(() => {
        const act = activites.find((a) => a.id === form.activite);
        const price = act?.prix[form.abonnement];
        return act ? (
          <div className="price-preview">
            <span>{t('members.form.amountToCollect', 'Montant a encaisser :')}</span>
            <strong style={{ color: act.couleur }}>{price?.toLocaleString('fr-FR')} DH</strong>
          </div>
        ) : null;
      })()}

      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onClose}>{t('members.form.cancel', 'Annuler')}</button>
        <button type="submit" className="btn btn--primary">
          {initial?.id ? t('members.form.save', 'Enregistrer') : t('members.form.registerMember', 'Inscrire le Membre')}
        </button>
      </div>
    </form>
  );
}

function DeleteConfirm({ membre, onConfirm, onClose }) {
  const { t } = useTranslation();
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ marginBottom: '8px' }}>{t('members.delete.confirmMessage', 'Voulez-vous supprimer definitivement :')}</p>
      <strong style={{ fontSize: '1.1rem' }}>{membre.prenom} {membre.nom}</strong>?
      <div className="form-actions" style={{ marginTop: '24px' }}>
        <button className="btn btn--ghost" onClick={onClose}>{t('members.delete.cancel', 'Annuler')}</button>
        <button className="btn btn--danger" onClick={() => { onConfirm(membre.id); onClose(); }}>{t('members.delete.confirm', 'Supprimer')}</button>
      </div>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getSubscriptionBadge(m) {
  if (m.statut === 'inactif') return { key: 'inactive', label: 'Inactif' };
  const days = Math.ceil((new Date(m.dateExpiration) - new Date()) / 86400000);
  if (days < 0) return { key: 'late', label: 'En retard' };
  if (days <= 7) return { key: 'soon', label: 'Bientot expire' };
  return { key: 'ok', label: 'Actif' };
}

function clampDay(val) {
  const num = Number(val);
  if (Number.isNaN(num)) return 15;
  return Math.min(28, Math.max(1, Math.floor(num)));
}

function getNextPaymentDate(day) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  const targetDay = clampDay(day);
  if (now.getDate() > targetDay) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  const d = new Date(year, month, targetDay);
  return d.toISOString().split('T')[0];
}

function MemberDetails({ membre, activites, paiements, onClose, onSetEcheanceDay }) {
  const { t } = useTranslation();
  const initialDay = membre?.dateExpiration ? Number(membre.dateExpiration.split('-')[2]) : 15;
  const [payDay, setPayDay] = useState(clampDay(initialDay));
  const act = activites.find((a) => a.id === membre.activite);
  const badge = getSubscriptionBadge(membre);
  const items = [...paiements]
    .filter((p) => p.membreId === membre.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const total = items.reduce((s, p) => s + p.montant, 0);

  const handleDownloadRecu = async (paiementId) => {
    const blob = await telechargerRecu(paiementId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recu_${String(paiementId).padStart(4, '0')}_${membre.nom}_${membre.prenom}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="member-details">
      <div className="member-details__info">
        <div className="member-profile">
          <div className="member-profile__avatar" style={{ background: act?.couleur ? `${act.couleur}22` : 'rgba(255, 255, 255, 0.1)', color: act?.couleur || 'var(--clr-muted)' }}>
<<<<<<< HEAD
            {membre.photoBase64 ? (
              <img src={getPhotoSrc(membre.photoBase64)} alt="Photo membre" />
=======
            {membre.photoBase64 && membre.photoBase64.startsWith('data:image') ? (
              <img src={membre.photoBase64} alt="Photo membre" />
>>>>>>> 6f1292589edbeb8b77fbaf7e4467b9a1c89fb61c
            ) : (
              <User size={32} />
            )}
          </div>
          <div>
            <div className="member-profile__name">{membre.prenom} {membre.nom}</div>
            <div className="member-profile__meta">{membre.telephone} · {membre.email || '—'}</div>
            <div className={`status-badge status-badge--${badge.key}`}>{badge.label}</div>
          </div>
        </div>

        <div className="member-info-grid">
          <div className="member-info-card">
            <div className="member-info-label">{t('members.details.activity', 'Activite')}</div>
            <div className="member-info-value">{t(act?.nom || membre.activite, act?.nom || membre.activite)}</div>
          </div>
          <div className="member-info-card">
            <div className="member-info-label">{t('members.details.subscription', 'Abonnement')}</div>
            <div className="member-info-value">{membre.abonnement}</div>
          </div>
          <div className="member-info-card">
            <div className="member-info-label">{t('members.details.registration', 'Inscription')}</div>
            <div className="member-info-value">{formatDate(membre.dateInscription)}</div>
          </div>
          <div className="member-info-card">
            <div className="member-info-label">{t('members.details.expiration', 'Expiration')}</div>
            <div className="member-info-value">{formatDate(membre.dateExpiration)}</div>
          </div>
        </div>

        <div className="member-info-grid">
          <div className="member-info-card">
            <div className="member-info-label">{t('members.details.gender', 'Genre')}</div>
            <div className="member-info-value">{membre.genre}</div>
          </div>
          <div className="member-info-card">
            <div className="member-info-label">{t('members.details.birthDate', 'Date de naissance')}</div>
            <div className="member-info-value">{formatDate(membre.dateNaissance)}</div>
          </div>
          <div className="member-info-card">
            <div className="member-info-label">{t('members.details.manualStatus', 'Statut manuel')}</div>
            <div className="member-info-value">{membre.statut}</div>
          </div>
          <div className="member-info-card">
            <div className="member-info-label">{t('members.details.totalPaid', 'Total paye')}</div>
            <div className="member-info-value">{total.toLocaleString('fr-FR')} DH</div>
          </div>
        </div>

        <div className="member-actions">
          <div className="member-actions__input">
            <label>{t('members.details.paymentDay', 'Jour de paiement')}</label>
            <input
              type="number"
              min={1}
              max={28}
              value={payDay}
              onChange={(e) => setPayDay(clampDay(e.target.value))}
            />
          </div>
          <button className="btn btn--primary btn--sm" onClick={() => onSetEcheanceDay(membre, payDay)}>
            {t('members.details.setPaymentDate', 'Fixer la date de paiement (ce membre)')}
          </button>
          <span className="member-actions__hint">{t('members.details.nextPaymentDate', 'Prochaine date de paiement:')} {formatDate(getNextPaymentDate(payDay))}</span>
        </div>
      </div>

      <div className="member-details__timeline">
        <div className="member-timeline__head">
          <div>
            <div className="member-timeline__title">{t('members.details.paymentHistory', 'Historique paiements')}</div>
            <div className="member-timeline__sub">{items.length} {t('members.details.paymentItem', 'paiement')}{items.length > 1 ? 's' : ''}</div>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>{t('members.details.close', 'Fermer')}</button>
        </div>

        {items.length === 0 ? (
          <div className="member-timeline__empty">{t('members.details.noPaymentRecorded', 'Aucun paiement enregistre.')}</div>
        ) : (
          <div className="member-timeline">
            {items.map((p) => (
              <div key={p.id} className="timeline-item">
                <div className="timeline-item__dot" />
                <div className="timeline-item__body">
                  <div className="timeline-item__row">
                    <div className="timeline-item__title">
                      {formatDate(p.date)} · {p.abonnement}
                    </div>
                    <div className="timeline-item__amount">{p.montant.toLocaleString('fr-FR')} DH</div>
                  </div>
                  <div className="timeline-item__meta">{t('members.details.paymentMode', 'Mode:')} {p.mode}</div>
                  <button className="timeline-item__btn" onClick={() => handleDownloadRecu(p.id)}>
                    <Download size={14} /> {t('members.details.downloadReceipt', 'Telecharger recu')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const PAGE_SIZE = 10;

export default function Membres() {
  const { membres, paiements, activites, abonnementDurations, addMembre, updateMembre, deleteMembre, toggleStatut } = useGym();
  const [searchParams] = useSearchParams();
  const [query,    setQuery]    = useState(searchParams.get('q') ?? '');
  const [fGenre,   setFGenre]   = useState('');
  const [fAct,     setFAct]     = useState('');
  const [fStatut,  setFStatut]  = useState('');
  const [page,     setPage]     = useState(1);
  const [modal,    setModal]    = useState(null); // null | 'add' | 'edit' | 'delete' | 'view'
  const [selected, setSelected] = useState(null);
  const { t } = useTranslation();

  useEffect(() => {
    const nextQuery = searchParams.get('q') ?? '';
    setQuery(nextQuery);
    setPage(1);
  }, [searchParams]);

  const filtered = useMemo(() => {
    return membres.filter((m) => {
      const q = query.toLowerCase();
      const hay = `${m.nom} ${m.prenom} ${m.telephone} ${m.email} ${m.activite} ${m.abonnement} ${m.statut}`.toLowerCase();
      const matchQ = !q || hay.includes(q);
      const matchG = !fGenre  || m.genre    === fGenre;
      const matchA = !fAct    || m.activite === fAct;
      const matchS = !fStatut || m.statut   === fStatut;
      return matchQ && matchG && matchA && matchS;
    });
  }, [membres, query, fGenre, fAct, fStatut]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const resetFilters = () => { setQuery(''); setFGenre(''); setFAct(''); setFStatut(''); setPage(1); };

  const openEdit   = (m) => { setSelected(m); setModal('edit');   };
  const openDelete = (m) => { setSelected(m); setModal('delete'); };
  const openView   = (m) => { setSelected(m); setModal('view');   };
  const openPhoto  = (m) => {
    if (!m?.photoBase64 || !m.photoBase64.startsWith('data:image')) return;
    setSelected(m);
    setModal('photo');
  };

  const setEcheanceDay = async (membre, day) => {
    const nextDate = getNextPaymentDate(day);
    await updateMembre({ ...membre, dateExpiration: nextDate });
    setSelected((prev) => (prev && prev.id === membre.id ? { ...prev, dateExpiration: nextDate } : prev));
  };

  const handleSave = async (data) => {
    if (data.id) await updateMembre(data);
    else          await addMembre(data);
    setModal(null);
  };

  const GENRE_INFO = {
    homme: { label: 'Homme', color: '#39ff14' },
    femme: { label: 'Femme', color: '#1fdf8f' },
    enfant: { label: 'Enfant', color: '#15c47e' },
  };

  const stats = useMemo(() => {
    const actifs = membres.filter((m) => m.statut === 'actif');
    const expSoon = membres.filter((m) => {
      const days = Math.ceil((new Date(m.dateExpiration) - new Date()) / 86400000);
      return days >= 0 && days <= 7 && m.statut === 'actif';
    });
    return {
      total: membres.length,
      actifs: actifs.length,
      inactifs: membres.filter((m) => m.statut === 'inactif').length,
      expSoon: expSoon.length,
    };
  }, [membres]);

  return (
    <div className="page membres-page fade-in">
      <section className="members-hero">
        <div>
          <span className="members-hero__eyebrow">{t('members.title', 'Membres')}</span>
          <h2 className="members-hero__title">{t('members.management', 'Gestion des membres')}</h2>
          <p className="members-hero__subtitle">
            {t('members.subtitle', 'Controlez les inscriptions, statuts et activites depuis un panneau clair et rapide.')}
          </p>
        </div>
        <div className="members-hero__actions">
          <button className="btn btn--primary" onClick={() => { setSelected(null); setModal('add'); }}>
            <UserPlus size={16} /> {t('members.newMember', 'Nouveau membre')}
          </button>
        </div>
      </section>

      <section className="members-kpis">
        <div className="members-kpi">
          <div className="members-kpi__label">{t('members.totalMembers', 'Total membres')}</div>
          <div className="members-kpi__value">{stats.total}</div>
        </div>
        <div className="members-kpi">
          <div className="members-kpi__label">{t('members.activeMembers', 'Membres actifs')}</div>
          <div className="members-kpi__value">{stats.actifs}</div>
        </div>
        <div className="members-kpi">
          <div className="members-kpi__label">{t('members.inactiveMembers', 'Membres inactifs')}</div>
          <div className="members-kpi__value">{stats.inactifs}</div>
        </div>
        <div className="members-kpi">
          <div className="members-kpi__label">{t('members.expirations7Days', 'Expirations 7 jours')}</div>
          <div className="members-kpi__value">{stats.expSoon}</div>
        </div>
      </section>

      <div className="card members-filters">
        <div className="members-filters__row">
          <div className="toolbar__search members-search">
            <Search size={16} className="toolbar__search-icon" />
            <input
              placeholder={t('members.filters.searchPlaceholder', 'Rechercher par nom, prenom, telephone, email, activite...')}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            />
          </div>
          <div className="members-filters__meta">
            {filtered.length} membre{filtered.length > 1 ? 's' : ''}
          </div>
        </div>
        <div className="members-filters__row">
          <div className="toolbar__filters">
            <Filter size={15} />
            <select value={fGenre} onChange={(e) => { setFGenre(e.target.value); setPage(1); }}>
              <option value="">{t('members.filters.allSections', 'Toutes sections')}</option>
              <option value="homme">{t('members.filters.men', 'Hommes')}</option>
              <option value="femme">{t('members.filters.women', 'Femmes')}</option>
              <option value="enfant">{t('members.filters.children', 'Enfants')}</option>
            </select>
            <select value={fAct} onChange={(e) => { setFAct(e.target.value); setPage(1); }}>
              <option value="">{t('members.filters.allActivities', 'Toutes activites')}</option>
              {activites.map((a) => <option key={a.id} value={a.id}>{t(a.nom, a.nom)}</option>)}
            </select>
            <select value={fStatut} onChange={(e) => { setFStatut(e.target.value); setPage(1); }}>
              <option value="">{t('members.filters.allStatuses', 'Tous statuts')}</option>
              <option value="actif">{t('members.filters.active', 'Actif')}</option>
              <option value="inactif">{t('members.filters.inactive', 'Inactif')}</option>
            </select>
            {(query || fGenre || fAct || fStatut) && (
              <button className="btn btn--ghost btn--sm" onClick={resetFilters}>{t('members.filters.reset', 'Reinitialiser')}</button>
            )}
          </div>
        </div>
      </div>

      <div className="card members-table">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>{t('members.tableMember', 'Membre')}</th>
              <th>{t('members.tableSection', 'Section')}</th>
              <th>{t('members.tableActivity', 'Activité')}</th>
              <th>{t('members.tableSubscription', 'Abonnement')}</th>
              <th>{t('members.tableExpiration', 'Expiration')}</th>
              <th>{t('members.tableStatus', 'Statut')}</th>
              <th>{t('members.tableActions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: 'var(--clr-muted)' }}>
                  {t('members.list.noMembersFound', 'Aucun membre trouvé.')}
                </td>
              </tr>
            ) : paginated.map((m) => {
              const act   = activites.find((a) => a.id === m.activite);
              const gi    = GENRE_INFO[m.genre];
              const days  = Math.ceil((new Date(m.dateExpiration) - new Date()) / 86400000);
              const expiringSoon = days >= 0 && days <= 7 && m.statut === 'actif';
              const badge = getSubscriptionBadge(m);
              return (
                <tr key={m.id} className={m.statut === 'inactif' ? 'tr--inactive' : ''}>
                  <td className="td--id">{m.id}</td>
                  <td>
                    <div className="td-member">
                      <button
                        type="button"
                        className={`td-avatar${m.photoBase64 ? ' td-avatar--clickable' : ''}`}
                        style={{ background: act?.couleur ? `${act.couleur}22` : 'rgba(255, 255, 255, 0.1)', color: act?.couleur || 'var(--clr-muted)' }}
                        onClick={() => openPhoto(m)}
                        aria-label={t('members.list.viewPhotoAria', 'Voir la photo de {{prenom}} {{nom}}', { prenom: m.prenom, nom: m.nom })}
                        disabled={!m.photoBase64}
                      >
                        {m.photoBase64 ? (
                          <img src={getPhotoSrc(m.photoBase64)} alt="Photo membre" />
                        ) : (
                          <User size={20} />
                        )}
                      </button>
                      <div>
                        <div className="td-name">{m.prenom} {m.nom}</div>
                        <div className="td-phone">{m.telephone}</div>
                        <div className={`status-badge status-badge--${badge.key}`}>{badge.label}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="genre-tag" style={{ color: gi.color, background: gi.color + '18' }}>{gi.label}</span></td>
                  <td>
                    <span className="act-tag" style={{ color: act?.couleur, background: act?.bg }}>
                      {act?.icon} {act?.nom}
                    </span>
                  </td>
                  <td><span className="abo-tag">{m.abonnement}</span></td>
                  <td>
                    <span className={expiringSoon ? 'expiry--soon' : days < 0 ? 'expiry--expired' : ''}>
                      {m.dateExpiration}
                      {expiringSoon && ` (${days}j)`}
                    </span>
                  </td>
                  <td>
                    <button
                      className={`status-toggle${m.statut === 'actif' ? ' status-toggle--on' : ''}`}
                      onClick={() => toggleStatut(m.id)}
                      title={t('members.list.toggleStatus', 'Basculer statut')}
                    >
                      {m.statut === 'actif' ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                      {m.statut === 'actif' ? t('members.form.statusActive', 'Actif') : t('members.form.statusInactive', 'Inactif')}
                    </button>
                  </td>
                  <td>
                    <div className="action-btns">
                      <button className="icon-btn" onClick={() => openView(m)} title={t('members.list.viewProfile', 'Voir fiche')}><Eye size={15} /></button>
                      <button className="icon-btn icon-btn--edit"   onClick={() => openEdit(m)}   title={t('members.list.edit', 'Modifier')}><Pencil size={15} /></button>
                      <button className="icon-btn icon-btn--delete" onClick={() => openDelete(m)} title={t('members.list.delete', 'Supprimer')}><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn--ghost btn--sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← {t('members.pagination.prev', 'Préc.')}</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} className={`pagination__btn${p === page ? ' pagination__btn--active' : ''}`} onClick={() => setPage(p)}>{p}</button>
          ))}
          <button className="btn btn--ghost btn--sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>{t('members.pagination.next', 'Suiv.')} →</button>
        </div>
      )}

      {/* Modals */}
      {(modal === 'add' || modal === 'edit') && (
        <Modal
          title={modal === 'add' ? t('members.modals.addMember', 'Inscrire un nouveau membre') : t('members.modals.editMember', 'Modifier le membre')}
          onClose={() => setModal(null)}
          size={modal === 'add' ? 'xl' : 'lg'}
        >
          <MemberForm
            initial={modal === 'edit' ? selected : null}
            onSave={handleSave}
            onClose={() => setModal(null)}
            activites={activites}
            abonnementDurations={abonnementDurations}
            variant={modal === 'add' ? 'wide' : 'default'}
          />
        </Modal>
      )}
      {modal === 'delete' && selected && (
        <Modal title={t('members.modals.confirmDeleteTitle', 'Confirmer la Suppression')} onClose={() => setModal(null)}>
          <DeleteConfirm membre={selected} onConfirm={deleteMembre} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal === 'view' && selected && (
        <Modal title={t('members.modals.viewMemberTitle', 'Fiche membre')} onClose={() => setModal(null)} size="lg">
          <MemberDetails
            membre={selected}
            activites={activites}
            paiements={paiements}
            onClose={() => setModal(null)}
            onSetEcheanceDay={setEcheanceDay}
          />
        </Modal>
      )}
      {modal === 'photo' && selected && (
        <Modal title={t('members.modals.photoTitle', 'Photo du membre')} onClose={() => setModal(null)} size="lg">
          <div className="photo-viewer">
            {selected.photoBase64 ? (
              <img src={getPhotoSrc(selected.photoBase64)} alt={t('members.list.viewPhotoAria', 'Photo de {{prenom}} {{nom}}', { prenom: selected.prenom, nom: selected.nom })} />
            ) : (
              <div className="photo-placeholder">{t('members.form.noPhoto', 'Aucune photo')}</div>
            )}
            <div className="photo-viewer__name">{selected.prenom} {selected.nom}</div>
          </div>
        </Modal>
      )}
    </div>
  );
}
