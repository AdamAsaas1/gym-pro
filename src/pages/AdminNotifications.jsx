import { useState, useEffect } from 'react';
import { Bell, Plus, Send, Info, AlertTriangle, Clock, Users, User, X } from 'lucide-react';
import { getNotifications, createNotification, getMembres } from '../api/client';
import './AdminNotifications.css';

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'normal',
    member_id: null
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
      await createNotification(formData);
      setShowModal(false);
      setFormData({ title: '', description: '', type: 'normal', member_id: null });
      fetchData();
    } catch (error) {
      console.error('Error creating notification:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'reminder': return <Clock size={16} className="text-blue" />;
      case 'reclamation': return <AlertTriangle size={16} className="text-red" />;
      default: return <Info size={16} className="text-gold" />;
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
          <div className="notif-stat-icon gold"><Send size={20} /></div>
          <div className="notif-stat-info">
            <span className="notif-stat-label">Total Envoyées</span>
            <span className="notif-stat-value">{notifications.length}</span>
          </div>
        </div>
        <div className="notif-stat-card">
          <div className="notif-stat-icon blue"><Clock size={20} /></div>
          <div className="notif-stat-info">
            <span className="notif-stat-label">Rappels Auto</span>
            <span className="notif-stat-value">{notifications.filter(n => n.type === 'reminder').length}</span>
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
              <th>Destinataire</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="text-center">Chargement...</td></tr>
            ) : notifications.length === 0 ? (
              <tr><td colSpan="5" className="text-center">Aucune notification trouvée</td></tr>
            ) : (
              notifications.map((notif) => (
                <tr key={notif.id}>
                  <td>
                    <div className={`notif-type-badge ${notif.type}`}>
                      {getIcon(notif.type)}
                      <span>{notif.type}</span>
                    </div>
                  </td>
                  <td className="font-semibold">{notif.title}</td>
                  <td className="notif-desc">{notif.description}</td>
                  <td>
                    {notif.member_id ? (
                      <div className="dest-info">
                        <User size={14} />
                        <span>Membre #{notif.member_id}</span>
                      </div>
                    ) : (
                      <div className="dest-info">
                        <Users size={14} />
                        <span>Tous les membres</span>
                      </div>
                    )}
                  </td>
                  <td className="text-muted">
                    {new Date(notif.created_at).toLocaleDateString()} {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Titre</label>
                <input 
                  type="text" 
                  placeholder="Ex: Mise à jour des horaires" 
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Type de notification</label>
                <select 
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value})}
                >
                  <option value="normal">Message Normal</option>
                  <option value="reminder">Rappel de Paiement</option>
                  <option value="reclamation">Réclamation / Urgence</option>
                </select>
              </div>
              <div className="form-group">
                <label>Destinataire</label>
                <select 
                  value={formData.member_id || ''}
                  onChange={e => setFormData({...formData, member_id: e.target.value ? parseInt(e.target.value) : null})}
                >
                  <option value="">Tous les membres</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.nom} {m.prenom}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Message</label>
                <textarea 
                  rows="4" 
                  placeholder="Écrivez votre message ici..."
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  required
                ></textarea>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Envoi en cours...' : 'Envoyer maintenant'}
                  <Send size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
