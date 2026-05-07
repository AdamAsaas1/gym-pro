import { createContext, useContext, useMemo, useState, useEffect } from 'react';
import * as apiClient from '../api/client';
import { BASE_ACTIVITES, COACHES, FALLBACK_DURATIONS, FALLBACK_PRIX, PLANNING } from './gymStatic';
import { useAuth } from './AuthContext';

/* ── API converters (snake_case ↔ camelCase) ─────────── */
const fromApi = (m) => ({
  id:              m.id,
  nom:             m.nom,
  prenom:          m.prenom,
  genre:           m.genre,
  activite:        m.activite,
  abonnement:      m.abonnement,
  statut:          m.statut,
  telephone:       m.telephone,
  email:           m.email ?? '',
  dateNaissance:   m.date_naissance,
  dateInscription: m.date_inscription,
  dateExpiration:  m.date_expiration,
  photoBase64:     m.photo_base64 || '',
});
const toApi = (d) => ({
  nom:              d.nom,
  prenom:           d.prenom,
  genre:            d.genre,
  activite:         d.activite,
  abonnement:       d.abonnement,
  statut:           d.statut || 'actif',
  telephone:        d.telephone,
  email:            d.email || '',
  date_naissance:   d.dateNaissance || null,
  date_inscription: d.dateInscription,
  date_expiration:  d.dateExpiration,
  photo_base64:     d.photoBase64 || null,
  password:         d.password || null,
});
const fromApiP = (p) => ({
  id:         p.id,
  membreId:   p.membre_id,
  abonnement: p.abonnement,
  montant:    Number(p.montant),
  mode:       p.mode,
  date:       p.date,
});

/* ── helpers ─────────────────────────────────────────── */
const fmt = (d) => d.toISOString().split('T')[0];

const isNetworkFailure = (result) => {
  if (result.status !== 'rejected') return false;

  const err = result.reason;
  if (!err || err.response) return false;

  const code = String(err.code || '').toUpperCase();
  const message = String(err.message || '');

  return (
    code === 'ERR_NETWORK' ||
    code === 'ECONNABORTED' ||
    /network error|failed to fetch|load failed/i.test(message)
  );
};


/* ── context ─────────────────────────────────────────── */
const GymContext = createContext(null);

export function GymProvider({ children }) {
  const { isAuthenticated, loadingAuth } = useAuth();
  const [membres,   setMembres]   = useState([]);
  const [paiements, setPaiements] = useState([]);
  const [activites, setActivites] = useState([]);
  const [gymSettings, setGymSettings] = useState(null);
  const [abonnementDurations, setAbonnementDurations] = useState({});
  const [configFallback, setConfigFallback] = useState(false);
  const [readIds, setReadIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);

  /* ── Charger les données depuis l'API au démarrage ── */
  useEffect(() => {
    let ignore = false;

    async function fetchAll() {
      if (loadingAuth) return;

      if (!isAuthenticated) {
        if (!ignore) {
          setMembres([]);
          setPaiements([]);
          setApiError(false);
          setLoading(false);
        }
        return;
      }

      if (!ignore) setLoading(true);
      try {
        const [msRes, psRes, cfgRes, settingsRes, actsRes] = await Promise.allSettled([
          apiClient.getMembres(),
          apiClient.getPaiements(),
          apiClient.getConfig(),
          apiClient.getSettings(),
          apiClient.getActivities(),
        ]);
        if (ignore) return;

        if (msRes.status === 'fulfilled') setMembres(msRes.value.map(fromApi));
        else setMembres([]);
        if (psRes.status === 'fulfilled') setPaiements(psRes.value.map(fromApiP));
        else setPaiements([]);

        const cfg = cfgRes.status === 'fulfilled' ? cfgRes.value : null;
        setConfigFallback(cfgRes.status !== 'fulfilled');
        const durations = cfg?.abonnement_durations || FALLBACK_DURATIONS;
        setAbonnementDurations(durations);

        if (settingsRes.status === 'fulfilled') setGymSettings(settingsRes.value);
        
        if (actsRes.status === 'fulfilled' && actsRes.value.length > 0) {
          // Map dynamic activities to UI format
          const mapped = actsRes.value.map(a => ({
            id: a.id,
            nom: a.name,
            prix: { 
              mensuel: Number(a.price_month), 
              trimestriel: Number(a.price_month) * 3 * 0.9, // Mock for now or add field
              annuel: Number(a.price_year) 
            },
            inscription_fees: Number(a.inscription_fees),
            assurance_first: Number(a.assurance_first_year),
            assurance_next: Number(a.assurance_next_years),
            max_capacity: a.max_capacity,
            genre: a.genre || 'homme',
            description: a.description || '',
            coachNom: a.coach_name || 'À définir',
            icon: a.icon || '🏋️', 
            bg: a.color ? `${a.color}15` : 'rgba(99, 102, 241, 0.1)', 
            couleur: a.color || '#6366f1'
          }));
          setActivites(mapped);
        } else {
          setActivites([]);
        }

        const hasNetworkFailure = [msRes, psRes].every(isNetworkFailure);
        setApiError(hasNetworkFailure);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    fetchAll();
    return () => { ignore = true; };
  }, [isAuthenticated, loadingAuth]);

  /* ── Actions CRUD via API ─────────────────────────── */
  const addMembre = async (d) => {
    const m = await apiClient.createMembre(toApi(d));
    setMembres(prev => [...prev, fromApi(m)]);
  };

  const updateMembre = async (d) => {
    const m = await apiClient.updateMembre(d.id, toApi(d));
    setMembres(prev => prev.map(mb => mb.id === d.id ? fromApi(m) : mb));
    return m;
  };

  const deleteMembre = async (id) => {
    await apiClient.deleteMembre(id);
    setMembres(prev => prev.filter(m => m.id !== id));
  };

  const toggleStatut = async (id) => {
    const m = await apiClient.toggleStatut(id);
    setMembres(prev => prev.map(mb => mb.id === id ? fromApi(m) : mb));
  };

  const enregistrerPaiement = async ({ membreId, abonnement, montant, mode }) => {
    const p = await apiClient.createPaiement({
      membre_id:  membreId,
      abonnement,
      montant,
      mode,
      date: fmt(new Date()),
    });
    // Refresh members to get updated expiration date
    const ms = await apiClient.getMembres();
    setMembres(ms.map(fromApi));
    setPaiements(prev => [fromApiP(p), ...prev]);
  };

  const enregistrerPaiementWorkflow = async ({ membreId, abonnement, montant, mode, sendReminders, daysBefore }) => {
    const payload = {
      paiement: {
        membre_id: membreId,
        abonnement,
        montant,
        mode,
        date: fmt(new Date()),
      },
      send_reminders: !!sendReminders,
      days_before: daysBefore ?? 3,
      dry_run: false,
    };

    const res = await apiClient.createPaiementWorkflow(payload);
    const ms = await apiClient.getMembres();
    setMembres(ms.map(fromApi));
    setPaiements(prev => [fromApiP(res.paiement), ...prev]);
    return res;
  };

  /* ── Settings & Activities Actions ── */
  const updateSettings = async (data) => {
    const s = await apiClient.updateSettings(data);
    setGymSettings(s);
    return s;
  };

  const addActivity = async (data) => {
    const a = await apiClient.createActivity(data);
    // Refresh activities
    const acts = await apiClient.getActivities();
    setActivites(acts.map(ac => ({
      id: ac.id,
      nom: ac.name,
      prix: { mensuel: Number(ac.price_month), annuel: Number(ac.price_year) },
      inscription_fees: Number(ac.inscription_fees),
      assurance_first: Number(ac.assurance_first_year),
      assurance_next: Number(ac.assurance_next_years),
      max_capacity: ac.max_capacity,
      genre: ac.genre || 'homme',
      description: ac.description || '',
      coachNom: ac.coach_name || '',
      icon: ac.icon || '🏋️', 
      bg: ac.color ? `${ac.color}15` : 'rgba(99, 102, 241, 0.1)', 
      couleur: ac.color || '#6366f1'
    })));
    return a;
  };

  const updateActivity = async (id, data) => {
    await apiClient.updateActivity(id, data);
    const acts = await apiClient.getActivities();
    setActivites(acts.map(ac => ({
      id: ac.id,
      nom: ac.name,
      prix: { mensuel: Number(ac.price_month), annuel: Number(ac.price_year) },
      inscription_fees: Number(ac.inscription_fees),
      assurance_first: Number(ac.assurance_first_year),
      assurance_next: Number(ac.assurance_next_years),
      max_capacity: ac.max_capacity,
      genre: ac.genre || 'homme',
      description: ac.description || '',
      coachNom: ac.coach_name || '',
      icon: ac.icon || '🏋️', 
      bg: ac.color ? `${ac.color}15` : 'rgba(99, 102, 241, 0.1)', 
      couleur: ac.color || '#6366f1'
    })));
  };

  const deleteActivity = async (id) => {
    await apiClient.deleteActivity(id);
    setActivites(prev => prev.filter(a => a.id !== id));
  };
  const stats = useMemo(() => {
    const actifs       = membres.filter((m) => m.statut === 'actif');
    const expiringSoon = membres.filter((m) => {
      const days = (new Date(m.dateExpiration) - new Date()) / 86400000;
      return days >= 0 && days <= 7 && m.statut === 'actif';
    });
    const revenue = actifs.reduce((s, m) => {
      const act = activites.find((a) => a.id === m.activite);
      return s + (act?.prix[m.abonnement] ?? 0);
    }, 0);
    return {
      total: membres.length,
      actifs: actifs.length,
      inactifs: membres.filter((m) => m.statut === 'inactif').length,
      hommes:  membres.filter((m) => m.genre === 'homme').length,
      femmes:  membres.filter((m) => m.genre === 'femme').length,
      enfants: membres.filter((m) => m.genre === 'enfant').length,
      expiringSoon,
      revenue,
    };
  }, [membres, activites]);

  const notifications = useMemo(() => {
    const list = [];
    membres.forEach((m) => {
      const days = Math.ceil((new Date(m.dateExpiration) - new Date()) / 86400000);
      if (m.statut === 'actif') {
        if (days <= 2) {
          list.push({
            id: m.id, type: 'danger', membre: m, days: Math.max(0, days),
            msg: days <= 0 ? 'Abonnement expiré !' : `Expire dans ${days} jour${days > 1 ? 's' : ''}`,
            submsg: `Abonnement ${m.abonnement} — renouvellement requis`,
          });
        } else if (days <= 7) {
          list.push({
            id: m.id, type: 'warning', membre: m, days,
            msg: `Expire dans ${days} jours`,
            submsg: `Abonnement ${m.abonnement} — pensez au renouvellement`,
          });
        }
      } else {
        const daysSince = Math.ceil((new Date() - new Date(m.dateExpiration)) / 86400000);
        if (daysSince >= 0 && daysSince <= 30) {
          list.push({
            id: m.id, type: 'info', membre: m, days: null,
            msg: `Membre inactif`,
            submsg: `Expiré il y a ${daysSince} jour${daysSince > 1 ? 's' : ''} — relancer ?`,
          });
        }
      }
    });
    return list.sort((a, b) => {
      const order = { danger: 0, warning: 1, info: 2 };
      if (order[a.type] !== order[b.type]) return order[a.type] - order[b.type];
      return (a.days ?? 999) - (b.days ?? 999);
    });
  }, [membres]);

  const markRead  = (id) => setReadIds((prev) => new Set([...prev, id]));
  const clearAll  = () => setReadIds(new Set(notifications.map((n) => n.id)));
  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  /* ── stats paiements ── */
  const statsP = useMemo(() => {
    const moisDebut = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const paiementsMois = paiements.filter((p) => new Date(p.date) >= moisDebut);
    const totalMois = paiementsMois.reduce((s, p) => s + p.montant, 0);
    const enRegle  = membres.filter((m) => m.statut === 'actif' && new Date(m.dateExpiration) > new Date()).length;
    const aRegler  = membres.filter((m) => new Date(m.dateExpiration) <= new Date()).length;
    return { totalMois, enRegle, aRegler, paiementsMois: paiementsMois.length };
  }, [membres, paiements]);

  return (
    <GymContext.Provider value={{ membres, paiements, coaches: COACHES, activites, gymSettings, planning: PLANNING, abonnementDurations, configFallback, stats, statsP, notifications, readIds, markRead, clearAll, unreadCount, loading, apiError, addMembre, updateMembre, deleteMembre, toggleStatut, enregistrerPaiement, enregistrerPaiementWorkflow, updateSettings, addActivity, updateActivity, deleteActivity }}>
      {loading && isAuthenticated ? (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0f172a', color:'#94a3b8', fontSize:'1.1rem', gap:'12px' }}>
          <div style={{ width:28, height:28, border:'3px solid #334155', borderTop:'3px solid #6366f1', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
          Connexion à la base de données…
        </div>
      ) : apiError && isAuthenticated ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0f172a', color:'#f87171', fontSize:'1rem', gap:'8px' }}>
          <div style={{ fontSize:'2rem' }}>⚠️</div>
          <strong>Impossible de contacter l'API</strong>
          <span style={{ color:'#64748b' }}>Vérifiez que le serveur backend tourne sur le port 5000</span>
          <button onClick={() => window.location.reload()} style={{ marginTop:12, padding:'8px 20px', background:'#6366f1', color:'white', border:'none', borderRadius:8, cursor:'pointer' }}>Réessayer</button>
        </div>
      ) : children}
    </GymContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useGym = () => {
  const ctx = useContext(GymContext);
  if (!ctx) throw new Error('useGym must be used inside GymProvider');
  return ctx;
};
