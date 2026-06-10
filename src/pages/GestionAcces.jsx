import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, CheckCircle, XCircle, AlertCircle, History, UserPlus, QrCode } from 'lucide-react';
import { checkAccess, getAccessHistory, getMembres, enrollMember } from '../api/client';
import { useTranslation } from 'react-i18next';
import './GestionAcces.css';

const GestionAcces = () => {
  const { t } = useTranslation();
  const webcamRef = useRef(null);
  const [accessResult, setAccessResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState([]);
  const [membres, setMembres] = useState([]);
  const [selectedMembre, setSelectedMembre] = useState('');
  const [enrollMode, setEnrollMode] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState('');
  const [enrollStatus, setEnrollStatus] = useState(''); // 'success' | 'error'
  const [scanPaused, setScanPaused] = useState(false);
  const [manualCode, setManualCode] = useState('');

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
                  <select
                    value={selectedMembre}
                    onChange={(e) => setSelectedMembre(e.target.value)}
                    className="access-select"
                  >
                    <option value="">{t('access.selectMember', 'Sélectionner un membre à enrôler...')}</option>
                    {membres.map(m => (
                      <option key={m.id} value={m.id}>{m.prenom} {m.nom} - {m.email}</option>
                    ))}
                  </select>
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
                    className="access-btn-primary"
                    style={{ width: '100%', backgroundColor: '#d4af37', color: '#000' }}
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
                  <span className="access-history-time">
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default GestionAcces;
