import React, { useState, useEffect, useRef } from 'react';
import { useGym } from '../context/GymContext';
import { useTranslation } from 'react-i18next';
import { Camera, Tv, Play, Save, X, Edit3, ShieldAlert, CheckCircle2, AlertTriangle, Users, Upload } from 'lucide-react';
import './LiveShow.css';

export default function LiveShow() {
  const { activites, updateActivity } = useGym();
  const { t } = useTranslation();

  const [editingActivity, setEditingActivity] = useState(null);
  const [cameraSource, setCameraSource] = useState('');
  const [maxCapacity, setMaxCapacity] = useState('');
  const [selectedActivityForFeed, setSelectedActivityForFeed] = useState(null);

  // Video uploading state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  
  // WebSocket state for preview modal
  const [wsData, setWsData] = useState(null);
  const [wsStatus, setWsStatus] = useState('disconnected'); // 'connecting' | 'connected' | 'disconnected'
  const wsRef = useRef(null);

  // Resolve API/WS URL
  const getApiUrl = () => {
    const configuredUrl = import.meta.env.VITE_API_URL;
    if (configuredUrl) return configuredUrl;
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      const apiHost = host === '127.0.0.1' ? 'localhost' : host;
      return `http://${apiHost}:5000`;
    }
    return 'http://localhost:5000';
  };

  const apiBase = getApiUrl();
  const wsBase = apiBase.replace(/^http/, 'ws');

  // Connect to WebSocket for real-time capacity updates in preview modal
  useEffect(() => {
    if (!selectedActivityForFeed) {
      if (wsRef.current) {
        wsRef.current.close();
      }
      setWsData(null);
      setWsStatus('disconnected');
      return;
    }

    const activityId = selectedActivityForFeed.id;
    setWsStatus('connecting');
    
    const wsUrl = `${wsBase}/live/ws/capacity/${activityId}`;
    console.log(`[WS] Connecting to ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected to capacity updates');
      setWsStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'capacity_update') {
          setWsData(data);
        }
      } catch (err) {
        console.error('[WS] Error parsing websocket message', err);
      }
    };

    ws.onerror = (err) => {
      console.error('[WS] WebSocket error', err);
      setWsStatus('disconnected');
    };

    ws.onclose = () => {
      console.log('[WS] Closed capacity updates');
      setWsStatus('disconnected');
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [selectedActivityForFeed, wsBase]);

  const handleEditClick = (act) => {
    setEditingActivity(act);
    setCameraSource(act.camera_source || '');
    setMaxCapacity(act.max_capacity || '0');
    setUploadError('');
    setUploadSuccess(false);
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.mp4')) {
      setUploadError('Veuillez sélectionner un fichier vidéo MP4 uniquement.');
      setUploadSuccess(false);
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadSuccess(false);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${apiBase}/live/upload-video`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Erreur lors du chargement de la vidéo.');
      }

      const data = await response.json();
      if (data.status === 'success') {
        setCameraSource(data.file_path);
        setUploadSuccess(true);
      } else {
        throw new Error(data.detail || 'Erreur inconnue');
      }
    } catch (err) {
      console.error(err);
      setUploadError(err.message || 'Impossible d\'importer la vidéo sur le serveur.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editingActivity) return;

    try {
      await updateActivity(editingActivity.id, {
        camera_source: cameraSource,
        max_capacity: parseInt(maxCapacity, 10) || 0
      });
      setEditingActivity(null);
    } catch (err) {
      console.error('Failed to update activity camera source', err);
    }
  };

  // Determine status color/tag
  const getCapacityStatus = (current, max) => {
    if (!max || max <= 0) return { label: t('live.status.unknown', 'Inconnu'), color: '#94a3b8', percentage: 0 };
    const ratio = current / max;
    const percentage = Math.round(ratio * 100);
    
    if (ratio >= 0.8) {
      return { label: t('live.status.crowded', 'Surchargé'), color: '#ef4444', percentage };
    } else if (ratio >= 0.5) {
      return { label: t('live.status.moderate', 'Modéré'), color: '#f97316', percentage };
    }
    return { label: t('live.status.calm', 'Calme'), color: '#22c55e', percentage };
  };

  return (
    <div className="live-page fade-in">
      <div className="live-page__header">
        <div>
          <h1 className="live-page__title">
            <Camera size={26} className="live-page__title-icon" />
            {t('live.title', 'Surveillance & Occupation IA en Direct')}
          </h1>
          <p className="live-page__subtitle">
            {t('live.subtitle', 'Gérez la liaison des caméras CCTV et surveillez le taux de fréquentation en temps réel grâce au machine learning (YOLOv8).')}
          </p>
        </div>
      </div>

      <div className="live-grid">
        {/* Left pane: Activities list & configuration */}
        <div className="live-pane main-pane">
          <h2 className="pane-title">{t('live.paneTitle', 'Cartographie des Caméras & Activités')}</h2>
          
          <div className="activities-cards">
            {activites.map((act) => {
              const capStatus = getCapacityStatus(act.current_capacity || 0, act.max_capacity);
              const isConfigured = act.camera_source && act.camera_source.trim() !== '';

              return (
                <div key={act.id} className="live-act-card" style={{ '--accent-color': act.couleur }}>
                  <div className="card-header-row">
                    <div className="activity-info-group">
                      <span className="activity-icon">{act.icon}</span>
                      <div>
                        <h3>{act.nom}</h3>
                        <p>{act.coachNom && act.coachNom !== 'À définir' ? `${t('live.coach', 'Coach')}: ${act.coachNom}` : t('live.noCoach', 'Sans Coach')}</p>
                      </div>
                    </div>
                    <div className="card-actions">
                      <button 
                        onClick={() => handleEditClick(act)} 
                        className="btn-edit" 
                        title={t('live.editCamera', 'Configurer la caméra')}
                      >
                        <Edit3 size={16} />
                      </button>
                      {isConfigured && (
                        <button 
                          onClick={() => setSelectedActivityForFeed(act)} 
                          className="btn-play"
                          title={t('live.startLive', 'Lancer le live')}
                        >
                          <Play size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="card-body-row">
                    <div className="source-info">
                      <span className="info-label">{t('live.cameraSource', 'Source de Caméra :')}</span>
                      <code className={`source-code ${isConfigured ? 'active' : ''}`}>
                        {isConfigured ? act.camera_source : t('live.noCameraLinked', 'Aucune caméra liée')}
                      </code>
                    </div>

                    <div className="capacity-info">
                      <span className="info-label">{t('live.currentOccupancy', 'Affluence Actuelle :')}</span>
                      <div className="capacity-values">
                        <strong>{act.current_capacity || 0}</strong> / {act.max_capacity || '∞'}
                        <span 
                          className="status-pill" 
                          style={{ backgroundColor: `${capStatus.color}20`, color: capStatus.color }}
                        >
                          {capStatus.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {act.max_capacity > 0 && (
                    <div className="progress-bar-container">
                      <div 
                        className="progress-bar-fill" 
                        style={{ 
                          width: `${Math.min(100, capStatus.percentage)}%`,
                          backgroundColor: capStatus.color
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right pane: Side drawer edit form */}
        {editingActivity && (
          <div className="live-pane side-pane fade-in">
            <div className="side-pane__header">
              <h3>{t('live.modal.title', 'Modifier la liaison caméra')}</h3>
              <button onClick={() => setEditingActivity(null)} className="btn-close">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="camera-config-form">
              <div className="form-info-activity">
                <span className="act-avatar">{editingActivity.icon}</span>
                <div>
                  <h4>{editingActivity.nom}</h4>
                  <p>{t('live.modal.title', 'Modifier la liaison caméra')}</p>
                </div>
              </div>

              <div className="form-group">
                <label>{t('live.modal.sourceLabel', 'Source de la caméra (IP RTSP, Fichier de test MP4)')}:</label>
                <div className="input-with-upload">
                  <input 
                    type="text" 
                    value={cameraSource} 
                    onChange={(e) => setCameraSource(e.target.value)}
                    placeholder="Ex: 0 (webcam), rtsp://admin:pass@192.168.1.50:554/ch1, simulation"
                    className="live-input"
                    required
                  />
                  <label className="btn-upload-video">
                    <input 
                      type="file" 
                      accept="video/mp4" 
                      onChange={handleVideoUpload} 
                      style={{ display: 'none' }} 
                    />
                    <Upload size={14} />
                    <span>{uploading ? t('live.modal.uploading', 'Importation...') : 'MP4'}</span>
                  </label>
                </div>
                {uploadError && <span className="upload-error-msg">{uploadError}</span>}
                {uploadSuccess && <span className="upload-success-msg">{t('live.modal.uploadSuccess', 'Fichier importé avec succès sur le serveur !')}</span>}
                <span className="input-hint">
                  Entrez <strong>simulation</strong> pour le mode simulation, ou cliquez sur <strong>MP4</strong> pour charger une vidéo de test en boucle.
                </span>
              </div>

              <div className="form-group">
                <label>{t('live.modal.capacityLabel', 'Capacité Maximale de la zone (Membres)')}:</label>
                <input 
                  type="number" 
                  value={maxCapacity} 
                  onChange={(e) => setMaxCapacity(e.target.value)}
                  placeholder="Ex: 25 (0 pour illimité)"
                  className="live-input"
                  min="0"
                />
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setEditingActivity(null)} className="btn-cancel">
                  {t('live.modal.cancelBtn', 'Annuler')}
                </button>
                <button type="submit" className="btn-save">
                  <Save size={16} />
                  {t('live.modal.saveBtn', 'Enregistrer')}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Live Preview Modal */}
      {selectedActivityForFeed && (
        <div className="live-modal-overlay">
          <div className="live-modal" style={{ '--accent-color': selectedActivityForFeed.couleur }}>
            <div className="live-modal__header">
              <div className="header-title">
                <Tv size={20} className="pulse-icon" />
                <h2>{t('live.preview.title', { activity: selectedActivityForFeed.nom, defaultValue: `Surveillance Actuelle : ${selectedActivityForFeed.nom}` })}</h2>
              </div>
              <button onClick={() => setSelectedActivityForFeed(null)} className="modal-close-btn">
                <X size={20} />
              </button>
            </div>

            <div className="live-modal__content">
              {/* Left Column: Live camera feed */}
              <div className="feed-column">
                <div className="video-stream-container">
                  <img 
                    src={`${apiBase}/live/stream/${selectedActivityForFeed.id}?t=${Date.now()}`} 
                    alt={t('live.preview.title', { activity: selectedActivityForFeed.nom, defaultValue: `Flux caméra ${selectedActivityForFeed.nom}` })}
                    className="mjpeg-stream-img"
                    onError={(e) => {
                      e.target.src = '/offline_screen.jpg'; // fallback
                    }}
                  />
                  <div className="feed-watermark">
                    <span className="live-dot" />
                    {t('live.title', 'Surveillance IA Direct').toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Right Column: AI Analytics & WS Status */}
              <div className="analytics-column">
                <div className="analytics-card status-card">
                  <h3>{t('live.preview.statsTitle', 'État du Flux de Comptage')}</h3>
                  <div className="ws-status-row">
                    <span className={`status-led ${wsStatus}`} />
                    <span className="ws-status-text">
                      {wsStatus === 'connected' ? t('live.preview.connected', 'Flux IA Connecté - Analyse en temps réel') : 
                       wsStatus === 'connecting' ? t('live.preview.connecting', 'Connexion au flux de comptage...') : 
                       t('live.preview.disconnected', 'Déconnecté - Reconnexion en cours...')}
                    </span>
                  </div>
                </div>

                <div className="analytics-card count-card">
                  <h3>{t('live.currentOccupancy', 'Fréquentation Détectée')} ({t('live.refresh_rate', 'Sur 20s')})</h3>
                  <div className="live-count-display">
                    <span className="count-number">
                      {wsData ? wsData.current_capacity : (selectedActivityForFeed.current_capacity || 0)}
                    </span>
                    <span className="count-label">{t('live.members', 'membres')}</span>
                  </div>

                  <div className="progress-info-row">
                    <span>{t('live.preview.maxCapacity', 'Limite')}: {selectedActivityForFeed.max_capacity || '∞'}</span>
                    <span>
                      {getCapacityStatus(
                        wsData ? wsData.current_capacity : (selectedActivityForFeed.current_capacity || 0), 
                        selectedActivityForFeed.max_capacity
                      ).label}
                    </span>
                  </div>

                  <div className="modal-progress-container">
                    <div 
                      className="modal-progress-bar" 
                      style={{ 
                        width: `${Math.min(100, getCapacityStatus(
                          wsData ? wsData.current_capacity : (selectedActivityForFeed.current_capacity || 0), 
                          selectedActivityForFeed.max_capacity
                        ).percentage)}%`,
                        backgroundColor: getCapacityStatus(
                          wsData ? wsData.current_capacity : (selectedActivityForFeed.current_capacity || 0), 
                          selectedActivityForFeed.max_capacity
                        ).color
                      }}
                    />
                  </div>
                </div>

                <div className="analytics-card info-card">
                  <h3>{t('live.preview.statsTitle', 'Spécifications de Sécurité')}</h3>
                  <div className="spec-row">
                    <span>{t('live.paneTitle', 'Zone / Activité')}:</span>
                    <strong>{selectedActivityForFeed.nom}</strong>
                  </div>
                  <div className="spec-row">
                    <span>{t('live.coach', 'Coach')}:</span>
                    <strong>{selectedActivityForFeed.coachNom && selectedActivityForFeed.coachNom !== 'À définir' ? selectedActivityForFeed.coachNom : t('live.noCoach', 'Non assigné')}</strong>
                  </div>
                  <div className="spec-row">
                    <span>Classe Modèle:</span>
                    <strong>YOLOv8 Person Only (Class 0)</strong>
                  </div>
                  <div className="spec-row">
                    <span>Confiance Min:</span>
                    <strong>&gt; 40%</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
