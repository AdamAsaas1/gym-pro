import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Bell, Calendar, X, AlertTriangle, Clock, UserX, CheckCheck, ChevronRight } from 'lucide-react';
import { useGym } from '../context/GymContext';
import PermissionRender from './PermissionRender';
import { usePermissions } from '../context/PermissionContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
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
  const { notifications, readIds, markRead, clearAll, unreadCount, configFallback, gymSettings } = useGym();
  const { currentRole, hasPageAccess } = usePermissions();
  const { logout } = useAuth();
  const { t, i18n } = useTranslation();
  
  const title = t(`titles.${pathname.replace('/', '') || 'dashboard'}`, TITLES[pathname] ?? (gymSettings?.name || 'ASAAS GYM'));
  
  const [open, setOpen]     = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const wrapRef = useRef(null);
  const langWrapRef = useRef(null);

  const dateStr = new Date().toLocaleDateString(i18n.language === 'ar' ? 'ar-MA' : 'fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
      if (langWrapRef.current && !langWrapRef.current.contains(e.target)) setLangOpen(false);
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
            placeholder={t('header.searchPlaceholder', 'Rechercher un membre, paiement...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <PermissionRender page="/membres">
          <Link to="/membres" className="header-action header-action--ghost">{t('header.newMember', 'Nouveau membre')}</Link>
        </PermissionRender>
        <PermissionRender page="/paiements">
          <Link to="/paiements" className="header-action header-action--primary">{t('header.cashIn', 'Encaisser')}</Link>
        </PermissionRender>
      </div>

      <div className="app-header__right">
        <div className="header-role">
          <label>{t('header.role', 'Role')}</label>
          <div className="header-role__pill">{ROLE_LABELS[currentRole] || currentRole}</div>
        </div>
        <button className="header-action header-action--ghost" onClick={logout}>{t('header.logout', 'Deconnexion')}</button>

        {/* ── Language Switcher ── */}
        <div className="lang-switcher" ref={langWrapRef}>
          <button
            className="lang-switcher__btn"
            onClick={() => setLangOpen((o) => !o)}
            title="Language"
          >
            {i18n.language === 'en' && <span className="fi fi-gb"></span>}
            {i18n.language === 'fr' && <span className="fi fi-fr"></span>}
            {i18n.language === 'es' && <span className="fi fi-es"></span>}
            {i18n.language === 'ar' && <span className="fi fi-ma"></span>}
            {(!i18n.language || !['en', 'fr', 'es', 'ar'].includes(i18n.language)) && <Globe size={18} />}
          </button>
          
          {langOpen && (
            <div className="lang-switcher__panel">
              <div className="lang-switcher__list">
                <button className={`lang-switcher__item ${i18n.language === 'en' ? 'lang-switcher__item--active' : ''}`} onClick={() => { i18n.changeLanguage('en'); setLangOpen(false); }}>
                  <span className="fi fi-gb"></span> English
                </button>
                <button className={`lang-switcher__item ${i18n.language === 'fr' ? 'lang-switcher__item--active' : ''}`} onClick={() => { i18n.changeLanguage('fr'); setLangOpen(false); }}>
                  <span className="fi fi-fr"></span> Français
                </button>
                <button className={`lang-switcher__item ${i18n.language === 'es' ? 'lang-switcher__item--active' : ''}`} onClick={() => { i18n.changeLanguage('es'); setLangOpen(false); }}>
                  <span className="fi fi-es"></span> Español
                </button>
                <button className={`lang-switcher__item ${i18n.language === 'ar' ? 'lang-switcher__item--active' : ''}`} onClick={() => { i18n.changeLanguage('ar'); setLangOpen(false); }}>
                  <span className="fi fi-ma"></span> العربية
                </button>
              </div>
            </div>
          )}
        </div>

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
            <div className={`notif-panel ${i18n.language === 'ar' ? 'notif-panel--rtl' : ''}`}>

              {/* Header */}
              <div className="notif-panel__head">
                <div className="notif-panel__head-left">
                  <Bell size={15} />
                  <span>{t('header.notifications', 'Notifications')}</span>
                  {notifications.length > 0 && (
                    <span className="notif-panel__total">{notifications.length}</span>
                  )}
                </div>
                <div className="notif-panel__head-right">
                  {unreadCount > 0 && (
                    <button className="notif-markall" onClick={clearAll} title={t('header.markAllRead', 'Tout lire')}>
                      <CheckCheck size={14} /> {t('header.markAllRead', 'Tout lire')}
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
                      {t(`header.filters.${f.key}`, f.label)}
                      {cnt > 0 && <span className="notif-filter__cnt">{cnt}</span>}
                    </button>
                  );
                })}
              </div>

              {/* Body */}
              {filtered.length === 0 ? (
                <div className="notif-empty">
                  <Bell size={32} style={{ opacity: 0.2 }} />
                  <span>{t('header.emptyNotifications', 'Aucune alerte dans cette catégorie')}</span>
                </div>
              ) : (
                <div className="notif-list">
                  {grouped.map(({ type, items }) => (
                    <div key={type} className="notif-group">
                      <div className="notif-group__label">{t(`header.sections.${type}`, SECTION_LABELS[type])}</div>
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
                  <span>{t('header.manageSubscriptions', 'Gérer tous les abonnements')}</span>
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
