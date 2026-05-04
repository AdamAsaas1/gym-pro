import { useState, useEffect } from 'react';
import { Bell, Plus, Send, Info, AlertTriangle, Clock, Users, X, CheckCircle, Eye, Search, Dumbbell, Target, Zap, Shield, Calendar } from 'lucide-react';
import { getNotifications, createNotification, getMembres, getNotificationRecipients } from '../api/client';
import './AdminNotifications.css';

const ACTIVITIES = [
  { id: 'musculation', label: 'Musculation', icon: <Dumbbell size={20} /> },
  { id: 'kickboxing', label: 'Kickboxing', icon: <Target size={20} /> },
  { id: 'karate', label: 'Karate', icon: <Shield size={20} /> },
  { id: 'aerobic', label: 'Aerobic', icon: <Zap size={20} /> },
];

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showRecipientsModal, setShowRecipientsModal] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  
  // Selection states
  const [targetType, setTargetType] = useState('all'); // 'all', 'activity', 'member'
  const [selectedActivities, setSelectedActivities] = useState([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  
  // Reminder states
  const [scheduleDays, setScheduleDays] = useState([]); // [3, 2, 1]

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'normal'
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [notifsData, membersData] = await Promise.all([
        getNotifications(),
        getMembres()
      ]);
      setNotifications(notifsData);
      setMembers(membersData);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      
      let finalMemberIds = null;
      let scheduleStr = null;

      if (formData.type === 'reminder') {
        // Scheduled reminder logic
        scheduleStr = scheduleDays.sort((a,b) => b-a).join(',');
      } else {
        // Direct notification logic
        if (targetType === 'member') {
          finalMemberIds = selectedMemberIds;
        } else if (targetType === 'activity') {
          finalMemberIds = members
            .filter(m => selectedActivities.includes(m.activite))
            .map(m => m.id);
        }
      }

      await createNotification({
        ...formData,
        member_ids: finalMemberIds,
        schedule_days_before: scheduleStr,
        is_active: true
      });

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error creating notification:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ title: '', description: '', type: 'normal' });
    setTargetType('all');
    setSelectedActivities([]);
    setSelectedMemberIds([]);
    setScheduleDays([]);
    setMemberSearch('');
  };

  const toggleDay = (day) => {
    setScheduleDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const toggleMemberSelection = (id) => {
    setSelectedMemberIds(prev => 
      prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
    );
  };

  const toggleActivitySelection = (activityId) => {
    setSelectedActivities(prev => 
      prev.includes(activityId) ? prev.filter(a => a !== activityId) : [...prev, activityId]
    );
  };

  const filteredMembers = members.filter(m => 
    `${m.nom} ${m.prenom}`.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.email.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const getIcon = (type, isScheduled) => {
    if (isScheduled) return <Calendar size={16} className="text-gold" />;
    switch (type) {
      case 'reminder': return <Clock size={16} className="text-yellow" />;
      case 'reclamation': return <AlertTriangle size={16} className="text-red" />;
      default: return <Info size={16} className="text-blue" />;
    }
  };

  const handleShowRecipients = async (notif) => {
    setSelectedNotif(notif);
    setShowRecipientsModal(true);
    setLoadingRecipients(true);
    try {
      const data = await getNotificationRecipients(notif.id);
      setRecipients(data);
    } catch (error) {
      console.error('Error fetching recipients:', error);
    } finally {
      setLoadingRecipients(false);
    }
  };

  return (
    <div className="notifs-page">
      <div className="notifs-header">
        <div className="notifs-title">
          <Bell className="notifs-title-icon" />
          <h1>Notifications Administrateur</h1>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} />
          Créer une notification
        </button>
      </div>

      <div className="notifs-stats">
        <div className="notif-stat-card">
          <div className="notif-stat-icon blue"><Send size={20} /></div>
          <div className="notif-stat-info">
            <span className="notif-stat-label">Total Envoyées</span>
            <span className="notif-stat-value">{notifications.filter(n => !n.schedule_days_before).length}</span>
          </div>
        </div>
        <div className="notif-stat-card">
          <div className="notif-stat-icon yellow"><Calendar size={20} /></div>
          <div className="notif-stat-info">
            <span className="notif-stat-label">Rappels Automatiques</span>
            <span className="notif-stat-value">{notifications.filter(n => n.schedule_days_before).length}</span>
          </div>
        </div>
        <div className="notif-stat-card">
          <div className="notif-stat-icon red"><AlertTriangle size={20} /></div>
          <div className="notif-stat-info">
            <span className="notif-stat-label">Réclamations</span>
            <span className="notif-stat-value">{notifications.filter(n => n.type === 'reclamation').length}</span>
          </div>
        </div>
      </div>

      <div className="notifs-content card">
        <table className="notifs-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Titre</th>
              <th>Message</th>
              <th>Cible / Planning</th>
              <th>Statut Global</th>
              <th>Date Création</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="text-center">Chargement...</td></tr>
            ) : notifications.length === 0 ? (
              <tr><td colSpan="6" className="text-center">Aucune notification trouvée</td></tr>
            ) : (
              notifications.map((notif) => (
                <tr key={notif.id}>
                  <td>
                    <div className={`notif-type-badge ${notif.type}`}>
                      {getIcon(notif.type, !!notif.schedule_days_before)}
                      <span>{notif.type === 'reminder' && notif.schedule_days_before ? 'Automatique' : notif.type}</span>
                    </div>
                  </td>
                  <td className="font-semibold">{notif.title}</td>
                  <td className="notif-desc">{notif.description}</td>
                  <td>
                    <button className="btn-dest" onClick={() => handleShowRecipients(notif)}>
                      {notif.schedule_days_before ? <Clock size={14} /> : <Users size={14} />}
                      <span>{notif.total_recipients} Membre(s)</span>
                    </button>
                    {notif.schedule_days_before && (
                      <div className="text-muted" style={{ fontSize: '0.7rem', marginTop: '4px', paddingLeft: '8px' }}>
                         Automatique (J-{notif.schedule_days_before})
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="statut-summary">
                      <Eye size={14} className="text-gold" />
                      <span>{notif.total_seen} vus</span>
                    </div>
                  </td>
                  <td className="text-muted">
                    {new Date(notif.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Nouvelle Notification</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <div className="modal-form">
                <div className="form-group">
                  <label>Type de notification</label>
                  <select 
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value})}
                  >
                    <option value="normal">Message Direct</option>
                    <option value="reminder">Rappel de Payement (Auto)</option>
                    <option value="reclamation">Réclamation / Urgence</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Titre</label>
                  <input 
                    type="text" 
                    placeholder={formData.type === 'reminder' ? "Ex: Renouvellement de votre abonnement" : "Titre du message"} 
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    required
                  />
                </div>

                {formData.type === 'reminder' ? (
                  <div className="form-group">
                    <label>Programmation (Envoyer combien de jours avant ?)</label>
                    <div className="days-choice-grid">
                      {[3, 2, 1].map(day => (
                        <div 
                          key={day} 
                          className={`day-choice-item ${scheduleDays.includes(day) ? 'selected' : ''}`}
                          onClick={() => toggleDay(day)}
                        >
                          <span className="day-number">{day}</span>
                          <span className="day-label">Jours avant</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-muted" style={{ marginTop: '1rem', fontSize: '0.8rem' }}>
                      Cette notification sera envoyée automatiquement à tout membre dont l'abonnement expire dans les délais choisis.
                    </p>
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Destinataires</label>
                    <div className="target-type-selector">
                      <button type="button" className={`target-type-btn ${targetType === 'all' ? 'active' : ''}`} onClick={() => setTargetType('all')}>
                        <Users size={16} /> Tous
                      </button>
                      <button type="button" className={`target-type-btn ${targetType === 'activity' ? 'active' : ''}`} onClick={() => setTargetType('activity')}>
                        <Dumbbell size={16} /> Activité
                      </button>
                      <button type="button" className={`target-type-btn ${targetType === 'member' ? 'active' : ''}`} onClick={() => setTargetType('member')}>
                        <Users size={16} /> Membre
                      </button>
                    </div>

                    {targetType === 'activity' && (
                      <div className="activities-grid">
                        {ACTIVITIES.map(activity => (
                          <div key={activity.id} className={`activity-item ${selectedActivities.includes(activity.id) ? 'selected' : ''}`} onClick={() => toggleActivitySelection(activity.id)}>
                            <div className="activity-icon-wrapper">{activity.icon}</div>
                            <span className="activity-name">{activity.label}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {targetType === 'member' && (
                      <div className="members-selection-list">
                        {filteredMembers.map(m => (
                          <div key={m.id} className={`member-checkbox-item ${selectedMemberIds.includes(m.id) ? 'selected' : ''}`} onClick={() => toggleMemberSelection(m.id)}>
                            <input type="checkbox" checked={selectedMemberIds.includes(m.id)} onChange={() => {}} />
                            <div className="member-info-row">
                              <span className="member-name-text">{m.nom} {m.prenom}</span>
                              <span className="member-sub-text">{m.email}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="form-group">
                  <label>Message</label>
                  <textarea 
                    rows="4" 
                    placeholder="Contenu de la notification..."
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    required
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Enregistrement...' : formData.type === 'reminder' ? 'Activer le rappel' : 'Envoyer maintenant'}
                  <Send size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recipients Modal */}
      {showRecipientsModal && (
        <div className="modal-overlay">
          <div className="modal-card modal-large">
            <div className="modal-header">
              <div>
                <h2>Suivi des Destinataires</h2>
                <p className="text-muted">{selectedNotif?.title}</p>
              </div>
              <button className="modal-close" onClick={() => setShowRecipientsModal(false)}><X /></button>
            </div>
            <div className="recipients-list">
              {loadingRecipients ? (
                <div className="text-center py-8">Chargement...</div>
              ) : (
                <table className="recipients-table">
                  <thead>
                    <tr><th>Membre</th><th>Statut</th><th>Vu le</th></tr>
                  </thead>
                  <tbody>
                    {recipients.map(r => (
                      <tr key={r.member_id}>
                        <td className="font-medium">{r.nom} {r.prenom}</td>
                        <td>{r.is_read ? <span className="badge-seen">Vu</span> : <span className="badge-sended">Envoyé</span>}</td>
                        <td className="text-muted">{r.read_at ? new Date(r.read_at).toLocaleString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
