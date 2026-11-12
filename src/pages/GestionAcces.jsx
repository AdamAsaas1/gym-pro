import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, CheckCircle, XCircle, AlertCircle, History, UserPlus, QrCode, Eye, User, ZoomIn, X } from 'lucide-react';
import { checkAccess, getAccessHistory, getMembres, enrollMember } from '../api/client';
import { useTranslation } from 'react-i18next';
import Modal from '../components/Modal';
import './GestionAcces.css';

const getPhotoSrc = (base64) => {
  if (!base64) return null;
  return base64.startsWith('data:image') ? base64 : `data:image/jpeg;base64,${base64}`;
};

const isExpired = (dateExpiration) => {
  if (!dateExpiration) return false;
  const exp = new Date(dateExpiration);
  if (Number.isNaN(exp.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  exp.setHours(0, 0, 0, 0);
  return exp < today;
};

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
};

const GestionAcces = () => {
  const { t } = useTranslation();
  const webcamRef = useRef(null);
  const [accessResult, setAccessResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState([]);
  const [selectedPassage, setSelectedPassage] = useState(null);
  const [photoZoom, setPhotoZoom] = useState(false);
  const [membres, setMembres] = useState([]);
  const [selectedMembre, setSelectedMembre] = useState('');
  const [enrollMode, setEnrollMode] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState('');
  const [enrollStatus, setEnrollStatus] = useState(''); // 'success' | 'error'
  const [scanPaused, setScanPaused] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [showMemberList, setShowMemberList] = useState(false);
  const memberBoxRef = useRef(null);

  const fetchHistory = async () => {
    try {
      const data = await getAccessHistory(20);
      setHistory(data);
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
  };

  const fetchMembres = async () => {
    try {
      const data = await getMembres();
      setMembres(data);
    } catch (err) {
      console.error("Failed to fetch membres", err);
    }
  };

  useEffect(() => {
    fetchHistory();
    fetchMembres();
    const interval = setInterval(fetchHistory, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (memberBoxRef.current && !memberBoxRef.current.contains(e.target)) {
        setShowMemberList(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Escape closes only the enlarged photo, not the member sheet behind it
  // (capture phase + stopPropagation so the Modal's own Escape handler stays put).
  useEffect(() => {
    if (!photoZoom) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setPhotoZoom(false);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [photoZoom]);

  // Never leave the zoom open once the sheet changes or closes.
  useEffect(() => {
    if (!selectedPassage) setPhotoZoom(false);
  }, [selectedPassage]);

  const selectedMembreObj = membres.find(m => String(m.id) === String(selectedMembre));

  const filteredMembres = membres.filter(m => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return true;
    return `${m.prenom} ${m.nom} ${m.email}`.toLowerCase().includes(q);
  });

  const capture = useCallback(() => {
    if (!webcamRef.current) return null;
    const imageSrc = webcamRef.current.getScreenshot();
    return imageSrc;
  }, [webcamRef]);

  const handleVerify = async (qrOnly = false) => {
    if (isProcessing || scanPaused) return;
    const imageSrc = capture();
    if (!imageSrc) return;

    setIsProcessing(true);
    setAccessResult(null);
    try {
      const result = await checkAccess(imageSrc, qrOnly);
      if (qrOnly && result && result.status === 'no_qr') {
        setAccessResult({ status: 'denied', reason: 'No QR Code detected' });
      } else {
        setAccessResult(result);
      }
      fetchHistory();

      setScanPaused(true);
      setTimeout(() => {
        setScanPaused(false);
        setAccessResult(null);
      }, 5000);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      setAccessResult({ status: 'denied', reason: msg });

      setScanPaused(true);
      setTimeout(() => {
        setScanPaused(false);
        setAccessResult(null);
      }, 4000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualVerify = async () => {
    if (isProcessing || scanPaused || !manualCode.trim()) return;

    setIsProcessing(true);
    setAccessResult(null);
    try {
      const result = await checkAccess(null, false, manualCode.trim());
      setAccessResult(result);
      fetchHistory();
      setManualCode('');

      setScanPaused(true);
      setTimeout(() => {
        setScanPaused(false);
        setAccessResult(null);
      }, 5000);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      setAccessResult({ status: 'denied', reason: msg });

      setScanPaused(true);
      setTimeout(() => {
        setScanPaused(false);
        setAccessResult(null);
      }, 4000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEnroll = async () => {
    if (!selectedMembre) {
      setEnrollStatus('error');
      setEnrollMsg(t('access.errSelectMember', 'Veuillez sélectionner un membre'));
      return;
    }
    const imageSrc = capture();
    if (!imageSrc) return;

    setIsProcessing(true);
    setEnrollMsg('');
    setEnrollStatus('');
    try {
      await enrollMember(selectedMembre, imageSrc);
      setEnrollStatus('success');
      setEnrollMsg(t('access.enrollSuccess', 'Membre enrôlé avec succès !'));
      setTimeout(() => setEnrollMode(false), 2000);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      setEnrollStatus('error');
      setEnrollMsg(t('access.errorPrefix', 'Erreur: ') + msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const passagePhoto = getPhotoSrc(selectedPassage?.membre?.photo_base64);
  const passagePhotoName = selectedPassage?.membre
    ? `${selectedPassage.membre.prenom} ${selectedPassage.membre.nom}`
    : '';

  return (
    <div className="access-container">
      <div className="access-header">
        <div>
          <h1 className="access-title">{t('access.title', "Gestion d'Accès")}</h1>
          <p className="access-subtitle">{t('access.subtitle', 'Contrôle par reconnaissance faciale')}</p>
        </div>
        <button
          onClick={() => { setEnrollMode(!enrollMode); setAccessResult(null); setEnrollMsg(''); setEnrollStatus(''); }}
          className="access-btn"
        >
          <UserPlus size={18} />
          {enrollMode ? t('access.modeVerification', "Mode Vérification") : t('access.modeEnrollment', "Mode Enrôlement")}
        </button>
      </div>

      <div className="access-grid">

        {/* Left Column: Camera */}
        <div className="access-container" style={{ gap: '20px' }}>
          <div className="access-camera-card">
            <div className="access-camera-wrapper">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "user" }}
              />
              {isProcessing && (
                <div className="access-processing">
                  <div className="access-spinner"></div>
                </div>
              )}
            </div>

            <div className="access-actions">
              {enrollMode ? (
                <div className="access-enroll-form">
                  <div className="access-combobox" ref={memberBoxRef}>
                    <input
                      type="text"
                      className="access-select"
                      placeholder={t('access.selectMember', 'Sélectionner un membre à enrôler...')}
                      value={showMemberList ? memberQuery : (selectedMembreObj ? `${selectedMembreObj.prenom} ${selectedMembreObj.nom} - ${selectedMembreObj.email}` : '')}
                      onChange={(e) => { setMemberQuery(e.target.value); setShowMemberList(true); }}
                      onFocus={() => { setMemberQuery(''); setShowMemberList(true); }}
                    />
                    {showMemberList && (
                      <div className="access-combobox-list">
                        {filteredMembres.length === 0 ? (
                          <div className="access-combobox-empty">{t('access.noMemberFound', 'Aucun membre trouvé')}</div>
                        ) : (
                          filteredMembres.map(m => (
                            <div
                              key={m.id}
                              className={`access-combobox-item${String(m.id) === String(selectedMembre) ? ' selected' : ''}`}
                              onClick={() => {
                                setSelectedMembre(m.id);
                                setMemberQuery('');
                                setShowMemberList(false);
                              }}
                            >
                              {m.prenom} {m.nom} - {m.email}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleEnroll}
                    disabled={isProcessing || !selectedMembre}
                    className="access-btn-primary"
                  >
                    <Camera size={22} />
                    {t('access.captureAndEnroll', 'Capturer & Enrôler')}
                  </button>
                  {enrollMsg && (
                    <div className={`access-msg ${enrollStatus === 'error' ? 'error' : 'success'}`}>
                      {enrollMsg}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', alignItems: 'center' }}>
                  <button
                    onClick={() => handleVerify(false)}
                    disabled={isProcessing || scanPaused}
                    className="access-btn-primary"
                    style={{ width: '100%' }}
                  >
                    <Camera size={26} />
                    {t('access.verifyFace', "Verify with Face Recognition")}
                  </button>
                  <button
                    onClick={() => handleVerify(true)}
                    disabled={isProcessing || scanPaused}
                    className="access-btn-primary access-btn-primary--alt"
                    style={{ width: '100%' }}
                  >
                    <QrCode size={26} />
                    {t('access.verifyQr', "Verify with QR Code")}
                  </button>

                  <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '8px' }}>
                    <input
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder={t('access.manualCodePlaceholder', 'Enter card serial manually...')}
                      disabled={isProcessing || scanPaused}
                      className="access-select"
                      style={{ flex: 1, height: '46px', margin: 0 }}
                    />
                    <button
                      onClick={handleManualVerify}
                      disabled={isProcessing || scanPaused || !manualCode.trim()}
                      className="access-btn-primary"
                      style={{ width: 'auto', padding: '0 20px', height: '46px', margin: 0, whiteSpace: 'nowrap' }}
                    >
                      {t('access.submitCode', 'Verify')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Result Banner */}
          {!enrollMode && accessResult && (
            <div className={`access-result ${accessResult.status === 'authorized' ? 'authorized' : 'denied'}`}>
              <div className="access-result-icon">
                {accessResult.status === 'authorized' ? <CheckCircle size={36} /> : <XCircle size={36} />}
              </div>
              <div className="access-result-text">
                <h3>
                  {accessResult.status === 'authorized' ? t('access.accessAuthorized', 'Accès Autorisé') : t('access.accessDenied', 'Accès Refusé')}
                </h3>
                <p>
                  {t(`access.reasons.${accessResult.reason}`, accessResult.reason)}
                </p>
                {accessResult.membre && (
                  <div className="membre-info">
                    <strong>{accessResult.membre.prenom} {accessResult.membre.nom}</strong> • {accessResult.membre.abonnement}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: History */}
        <div className="access-history-card">
          <div className="access-history-header">
            <History size={22} />
            <h2>{t('access.recentHistory', 'Historique Récent')}</h2>
          </div>
          <div className="access-history-list">
            {history.length === 0 ? (
              <div className="access-history-empty">
                <AlertCircle size={40} />
                <p>{t('access.noPassage', 'Aucun passage enregistré')}</p>
              </div>
            ) : (
              history.map(item => (
                <div key={item.id} className="access-history-item">
                  <div className="access-history-info">
                    <div className="access-history-name">
                      <span className={`access-status-dot ${item.status === 'authorized' ? 'authorized' : 'denied'}`}></span>
                      {item.membre ? `${item.membre.prenom} ${item.membre.nom}` : t('access.unknown', 'Inconnu')}
                    </div>
                    <p className="access-history-reason">{t(`access.reasons.${item.reason}`, item.reason)}</p>
                  </div>
                  <div className="access-history-aside">
                    <span className="access-history-time">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                      type="button"
                      className={`access-history-view${item.membre ? '' : ' access-history-view--muted'}`}
                      onClick={() => setSelectedPassage(item)}
                      title={t('access.viewMember', 'Voir la fiche du membre')}
                      aria-label={item.membre
                        ? t('access.passageDetails.viewAria', 'Voir la fiche de {{prenom}} {{nom}}', { prenom: item.membre.prenom, nom: item.membre.nom })
                        : t('access.passageDetails.title', 'Fiche du passage')}
                    >
                      <Eye size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {selectedPassage && (
        <Modal
          title={t('access.passageDetails.title', 'Fiche du passage')}
          onClose={() => setSelectedPassage(null)}
          size="lg"
        >
          <div className="access-passage">
            <div className={`access-passage__banner ${selectedPassage.status === 'authorized' ? 'authorized' : 'denied'}`}>
              {selectedPassage.status === 'authorized' ? <CheckCircle size={18} /> : <XCircle size={18} />}
              <strong>
                {selectedPassage.status === 'authorized'
                  ? t('access.accessAuthorized', 'Accès Autorisé')
                  : t('access.accessDenied', 'Accès Refusé')}
              </strong>
              <span className="access-passage__banner-reason">
                {t(`access.reasons.${selectedPassage.reason}`, selectedPassage.reason)}
              </span>
              <span className="access-passage__banner-time">
                {new Date(selectedPassage.timestamp).toLocaleString()}
              </span>
            </div>

            {selectedPassage.membre ? (
              <>
                <div className="access-passage__top">
                  <div className={`access-passage__photo${passagePhoto ? ' access-passage__photo--zoomable' : ''}`}>
                    {passagePhoto ? (
                      <button
                        type="button"
                        className="access-passage__photo-btn"
                        onClick={() => setPhotoZoom(true)}
                        title={t('access.passageDetails.zoomPhoto', 'Agrandir la photo')}
                        aria-label={t('access.passageDetails.zoomPhoto', 'Agrandir la photo')}
                      >
                        <img src={passagePhoto} alt={t('members.form.photoAlt', 'Photo membre')} />
                        <span className="access-passage__photo-zoom" aria-hidden="true">
                          <ZoomIn size={24} />
                        </span>
                      </button>
                    ) : (
                      <div className="access-passage__photo-empty">
                        <User size={44} />
                        <span>{t('members.form.noPhoto', 'Aucune photo')}</span>
                      </div>
                    )}
                  </div>

                  <div className="access-passage__identity">
                    <h3>{selectedPassage.membre.prenom} {selectedPassage.membre.nom}</h3>
                    <p className="access-passage__id">
                      {t('access.passageDetails.memberId', 'ID membre')} #{selectedPassage.membre.id}
                    </p>
                    <div className="access-passage__tags">
                      <span className={`access-passage__tag ${selectedPassage.membre.statut === 'actif' ? 'ok' : 'danger'}`}>
                        {selectedPassage.membre.statut === 'actif'
                          ? t('members.form.statusActive', 'Actif')
                          : t('members.form.statusInactive', 'Inactif')}
                      </span>
                      <span className={`access-passage__tag ${isExpired(selectedPassage.membre.date_expiration) ? 'danger' : 'ok'}`}>
                        {isExpired(selectedPassage.membre.date_expiration)
                          ? t('access.passageDetails.expired', 'Abonnement expiré')
                          : t('access.passageDetails.valid', 'Abonnement valide')}
                      </span>
                    </div>
                  </div>
                </div>

                <dl className="access-passage__grid">
                  <div className="access-passage__row">
                    <dt>{t('members.form.phone', 'Téléphone')}</dt>
                    <dd>{selectedPassage.membre.telephone || '—'}</dd>
                  </div>
                  <div className="access-passage__row">
                    <dt>{t('members.form.email', 'Email')}</dt>
                    <dd>{selectedPassage.membre.email || '—'}</dd>
                  </div>
                  <div className="access-passage__row">
                    <dt>{t('members.details.gender', 'Genre')}</dt>
                    <dd>{t(`access.passageDetails.genre.${selectedPassage.membre.genre}`, selectedPassage.membre.genre)}</dd>
                  </div>
                  <div className="access-passage__row">
                    <dt>{t('members.form.activity', 'Activité')}</dt>
                    <dd>{selectedPassage.membre.activite_nom || selectedPassage.membre.activite || '—'}</dd>
                  </div>
                  <div className="access-passage__row">
                    <dt>{t('members.form.subscription', 'Abonnement')}</dt>
                    <dd>{t(`access.passageDetails.subscription.${selectedPassage.membre.abonnement}`, selectedPassage.membre.abonnement)}</dd>
                  </div>
                  <div className="access-passage__row">
                    <dt>{t('members.form.birthDate', 'Date de naissance')}</dt>
                    <dd>{formatDate(selectedPassage.membre.date_naissance)}</dd>
                  </div>
                  <div className="access-passage__row">
                    <dt>{t('members.form.registrationDate', "Date d'inscription")}</dt>
                    <dd>{formatDate(selectedPassage.membre.date_inscription)}</dd>
                  </div>
                  <div className="access-passage__row">
                    <dt>{t('members.form.calculatedExpiration', "Date d'expiration")}</dt>
                    <dd className={isExpired(selectedPassage.membre.date_expiration) ? 'is-danger' : undefined}>
                      {formatDate(selectedPassage.membre.date_expiration)}
                    </dd>
                  </div>
                  <div className="access-passage__row">
                    <dt>{t('access.passageDetails.cardSerial', 'N° de carte')}</dt>
                    <dd>{selectedPassage.membre.card_serial || '—'}</dd>
                  </div>
                  <div className="access-passage__row">
                    <dt>{t('access.passageDetails.passageTime', 'Date & heure du passage')}</dt>
                    <dd>{new Date(selectedPassage.timestamp).toLocaleString()}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <div className="access-passage__empty">
                <AlertCircle size={44} />
                <p>{t('access.passageDetails.noMember', 'Aucun membre associé à ce passage')}</p>
                <span>{t('access.passageDetails.noMemberHint', "Le visage ou le code QR n'a pas pu être identifié.")}</span>
              </div>
            )}

            <div className="access-passage__footer">
              <button type="button" className="access-btn" onClick={() => setSelectedPassage(null)}>
                {t('access.passageDetails.close', 'Fermer')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {photoZoom && passagePhoto && (
        <div
          className="access-zoom"
          role="dialog"
          aria-modal="true"
          aria-label={t('access.passageDetails.zoomTitle', 'Photo du membre')}
          onClick={() => setPhotoZoom(false)}
        >
          <button
            type="button"
            className="access-zoom__close"
            onClick={(e) => { e.stopPropagation(); setPhotoZoom(false); }}
            aria-label={t('access.passageDetails.zoomClose', 'Fermer la photo')}
            title={t('access.passageDetails.zoomClose', 'Fermer la photo')}
          >
            <X size={22} />
          </button>

          <figure className="access-zoom__figure" onClick={(e) => e.stopPropagation()}>
            <img src={passagePhoto} alt={t('members.form.photoAlt', 'Photo membre')} />
            <figcaption>
              <span>{passagePhotoName}</span>
              <span className="access-zoom__hint">
                {t('access.passageDetails.zoomHint', "Cliquez à l'extérieur ou appuyez sur Échap pour fermer")}
              </span>
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  );
};

export default GestionAcces;
