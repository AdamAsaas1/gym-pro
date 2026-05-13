import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Bell, Calendar, X, AlertTriangle, Clock, UserX, CheckCheck, ChevronRight } from 'lucide-react';
import { useGym } from '../context/GymContext';
import PermissionRender from './PermissionRender';
import { usePermissions } from '../context/PermissionContext';
import { useAuth } from '../context/AuthContext';

const TITLES = {
  '/':            'Tableau de Bord',
  '/acces':       'Gestion d\'Accès',
  '/membres':     'Gestion des Membres',
  '/planning':    'Planning des Séances',
  '/activites':   'Activités & Disciplines',
  '/abonnements': 'Abonnements',
  '/coaches':     'Équipe Encadrante',
  '/permissions': 'Gestion des Permissions',
};

const ROLE_LABELS = {
  superadmin: 'Super Admin',
  admin: 'Admin',
};

const TYPE_CFG = {
  danger:  { color: '#ef4444', bg: 'rgba(239,68,68,0.09)',   label: 'Urgent',    Icon: AlertTriangle },
  warning: { color: '#f97316', bg: 'rgba(249,115,22,0.09)',  label: 'Attention', Icon: Clock         },
  info:    { color: '#94a3b8', bg: 'rgba(148,163,184,0.07)', label: 'Inactif',   Icon: UserX         },
};

const GENRE_ICONS = { homme: 'H', femme: 'F', enfant: 'E' };

const FILTERS = [
  { key: 'all',     label: 'Tous'      },
  { key: 'danger',  label: 'Urgents'   },
  { key: 'warning', label: 'Proches'   },
  { key: 'info',    label: 'Inactifs'  },
];

const SECTION_LABELS = {
  danger:  'Expirations urgentes',
  warning: 'Expirations proches',
  info:    'Membres inactifs',
};

export default function Header() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { notifications, readIds, markRead, clearAll, unreadCount, configFallback } = useGym();
  const { currentRole, hasPageAccess } = usePermissions();
  const { logout } = useAuth();
  const title = TITLES[pathname] ?? 'ASAAS GYM';
  const [open, setOpen]     = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const wrapRef = useRef(null);

  const dateStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = filter === 'all' ? notifications : notifications.filter((n) => n.type === filter);

  /* Group by type */
  const grouped = ['danger', 'warning', 'info'].reduce((acc, t) => {
    const items = filtered.filter((n) => n.type === t);
    if (items.length) acc.push({ type: t, items });
    return acc;
  }, []);

  const urgentCount = notifications.filter((n) => n.type === 'danger').length;

  const runSearch = useCallback((value) => {
    const q = value.trim();
    if (!q) return;
    if (!hasPageAccess('/membres')) return;
    navigate(`/membres?q=${encodeURIComponent(q)}`, { replace: true });
  }, [navigate, hasPageAccess]);

  const didInitSearch = useRef(false);

  useEffect(() => {
    if (!didInitSearch.current) {
      didInitSearch.current = true;
      return;
    }
    const timer = setTimeout(() => runSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search, runSearch]);

  return (
    <header className="app-header">
      <div className="app-header__left">
        <h1 className="app-header__title">{title}</h1>
        <span className="app-header__date">
          <Calendar size={13} />
          {dateStr}
        </span>
        {configFallback && (
          <span className="app-header__config">Config par defaut utilisee</span>
        )}
      </div>

      <div className="app-header__actions">
        <div className="header-search">
          <input
            placeholder="Rechercher un membre, paiement..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <PermissionRender page="/membres">
          <Link to="/membres" className="header-action header-action--ghost">Nouveau membre</Link>
        </PermissionRender>
        <PermissionRender page="/paiements">
          <Link to="/paiements" className="header-action header-action--primary">Encaisser</Link>
        </PermissionRender>
      </div>

      <div className="app-header__right">
        <div className="header-role">
          <label>Role</label>
          <div className="header-role__pill">{ROLE_LABELS[currentRole] || currentRole}</div>
        </div>
        <button className="header-action header-action--ghost" onClick={logout}>Deconnexion</button>

        {/* ── Notification Bell ── */}
        <div className="notif-wrap" ref={wrapRef}>
          <button
            className={`notif-btn${urgentCount > 0 ? ' notif-btn--urgent' : ''}`}
            onClick={() => setOpen((o) => !o)}
            title="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </button>

          {open && (
            <div className="notif-panel">

              {/* Header */}
              <div className="notif-panel__head">
                <div className="notif-panel__head-left">
                  <Bell size={15} />
                  <span>Notifications</span>
                  {notifications.length > 0 && (
                    <span className="notif-panel__total">{notifications.length}</span>
                  )}
                </div>
                <div className="notif-panel__head-right">
                  {unreadCount > 0 && (
                    <button className="notif-markall" onClick={clearAll} title="Tout marquer comme lu">
                      <CheckCheck size={14} /> Tout lire
                    </button>
                  )}
                  <button className="notif-panel__close" onClick={() => setOpen(false)}>
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="notif-filters">
                {FILTERS.map((f) => {
                  const cnt = f.key === 'all'
                    ? notifications.length
                    : notifications.filter((n) => n.type === f.key).length;
                  return (
                    <button
                      key={f.key}
                      className={`notif-filter${filter === f.key ? ' notif-filter--active' : ''}`}
                      onClick={() => setFilter(f.key)}
                    >
                      {f.label}
                      {cnt > 0 && <span className="notif-filter__cnt">{cnt}</span>}
                    </button>
                  );
                })}
              </div>

              {/* Body */}
              {filtered.length === 0 ? (
                <div className="notif-empty">
                  <Bell size={32} style={{ opacity: 0.2 }} />
                  <span>Aucune alerte dans cette catégorie</span>
                </div>
              ) : (
                <div className="notif-list">
                  {grouped.map(({ type, items }) => (
                    <div key={type} className="notif-group">
                      <div className="notif-group__label">{SECTION_LABELS[type]}</div>
                      {items.map((n) => {
                        const cfg  = TYPE_CFG[n.type];
                        const Icon = cfg.Icon;
                        const read = readIds.has(n.id);
                        return (
                          <div
                            key={n.id}
                            className={`notif-item${read ? ' notif-item--read' : ''}`}
                            style={{ '--nc': cfg.color, '--nbg': cfg.bg }}
                            onClick={() => markRead(n.id)}
                          >
                            {!read && <span className="notif-item__unread-dot" />}
                            <div className="notif-item__icon-wrap">
                              <Icon size={14} />
                            </div>
                            <div className="notif-item__body">
                              <div className="notif-item__name">
                                {n.membre.prenom} {n.membre.nom}
                                <span className="notif-item__genre">{GENRE_ICONS[n.membre.genre]}</span>
                              </div>
                              <div className="notif-item__msg">{n.msg}</div>
                              <div className="notif-item__submsg">{n.submsg}</div>
                              <div className="notif-item__meta">
                                <span className="notif-item__pill">{n.membre.activite}</span>
                                <span className="notif-item__pill">{n.membre.telephone}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}

              {/* Footer */}
              <PermissionRender page="/abonnements">
                <Link to="/abonnements" className="notif-footer" onClick={() => setOpen(false)}>
                  <span>Gérer tous les abonnements</span>
                  <ChevronRight size={14} />
                </Link>
              </PermissionRender>

            </div>
          )}
        </div>

        <div className="header-avatar">GP</div>
      </div>
    </header>
  );
}
