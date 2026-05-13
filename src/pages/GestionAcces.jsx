import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, CheckCircle, XCircle, AlertCircle, History, UserPlus } from 'lucide-react';
import { checkAccess, getAccessHistory, getMembres, enrollMember } from '../api/client';
import './GestionAcces.css';

const GestionAcces = () => {
  const webcamRef = useRef(null);
  const [accessResult, setAccessResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState([]);
  const [membres, setMembres] = useState([]);
  const [selectedMembre, setSelectedMembre] = useState('');
  const [enrollMode, setEnrollMode] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState('');

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
    const imageSrc = webcamRef.current.getScreenshot();
    return imageSrc;
  }, [webcamRef]);

  const handleVerify = async () => {
    const imageSrc = capture();
    if (!imageSrc) return;

    setIsProcessing(true);
    setAccessResult(null);
    try {
      const result = await checkAccess(imageSrc);
      setAccessResult(result);
      fetchHistory();
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      setAccessResult({ status: 'denied', reason: msg });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEnroll = async () => {
    if (!selectedMembre) {
      setEnrollMsg('Veuillez sélectionner un membre');
      return;
    }
    const imageSrc = capture();
    if (!imageSrc) return;

    setIsProcessing(true);
    setEnrollMsg('');
    try {
      await enrollMember(selectedMembre, imageSrc);
      setEnrollMsg('Membre enrôlé avec succès !');
      setTimeout(() => setEnrollMode(false), 2000);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      setEnrollMsg('Erreur: ' + msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="access-container">
      <div className="access-header">
        <div>
          <h1 className="access-title">Gestion d'Accès</h1>
          <p className="access-subtitle">Contrôle par reconnaissance faciale</p>
        </div>
        <button
          onClick={() => { setEnrollMode(!enrollMode); setAccessResult(null); setEnrollMsg(''); }}
          className="access-btn"
        >
          <UserPlus size={18} />
          {enrollMode ? "Mode Vérification" : "Mode Enrôlement"}
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
                    <option value="">Sélectionner un membre à enrôler...</option>
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
                    Capturer & Enrôler
                  </button>
                  {enrollMsg && (
                    <div className={`access-msg ${enrollMsg.includes('Erreur') ? 'error' : 'success'}`}>
                      {enrollMsg}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleVerify}
                  disabled={isProcessing}
                  className="access-btn-primary"
                >
                  <Camera size={26} />
                  Vérifier l'Accès
                </button>
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
                  {accessResult.status === 'authorized' ? 'Accès Autorisé' : 'Accès Refusé'}
                </h3>
                <p>
                  {accessResult.reason}
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
            <h2>Historique Récent</h2>
          </div>
          <div className="access-history-list">
            {history.length === 0 ? (
              <div className="access-history-empty">
                <AlertCircle size={40} />
                <p>Aucun passage enregistré</p>
              </div>
            ) : (
              history.map(item => (
                <div key={item.id} className="access-history-item">
                  <div className="access-history-info">
                    <div className="access-history-name">
                      <span className={`access-status-dot ${item.status === 'authorized' ? 'authorized' : 'denied'}`}></span>
                      {item.membre ? `${item.membre.prenom} ${item.membre.nom}` : 'Inconnu'}
                    </div>
                    <p className="access-history-reason">{item.reason}</p>
                  </div>
                  <span className="access-history-time">
                    {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
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
