import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, X, AlertTriangle, Clock, UserX, CheckCheck, ChevronRight, ShoppingBag, Globe, KeyRound } from 'lucide-react';
import { useGym } from '../context/GymContext';
import PermissionRender from './PermissionRender';
import { usePermissions } from '../context/PermissionContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import Modal from './Modal';
import ChangePasswordModal from './ChangePasswordModal';

const ROLE_LABELS = {
  superadmin: 'Super Admin',
  admin: 'Admin',
};

const TYPE_CFG = {
  danger:  { color: 'var(--w-stamp)', bg: 'rgba(200,36,59,0.09)',   label: 'Urgent',    Icon: AlertTriangle },
  warning: { color: '#c2410c', bg: 'rgba(249,115,22,0.09)',  label: 'Attention', Icon: Clock         },
  info:    { color: 'var(--w-ink-3)', bg: 'rgba(148,163,184,0.07)', label: 'Inactif',   Icon: UserX         },
  order:   { color: 'var(--w-blue)', bg: 'rgba(59,130,246,0.09)',  label: 'Commande',  Icon: ShoppingBag   },
};

const GENRE_ICONS = { homme: 'H', femme: 'F', enfant: 'E' };

const FILTERS = [
  { key: 'all',     label: 'Tous'      },
  { key: 'danger',  label: 'Urgents'   },
  { key: 'warning', label: 'Proches'   },
  { key: 'order',   label: 'Commandes' },
  { key: 'info',    label: 'Inactifs'  },
];

const SECTION_LABELS = {
  danger:  'Expirations urgentes',
  warning: 'Expirations proches',
  info:    'Membres inactifs',
  order:   'Nouvelles commandes',
};

export default function SidebarUserPanel() {
  const { notifications, readIds, markRead, clearAll, unreadCount } = useGym();
  const { currentRole } = usePermissions();
  const { logout } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [notifPos, setNotifPos] = useState({ top: 0, left: 0 });
  const [langPos, setLangPos] = useState({ top: 0, left: 0 });
  const notifBtnRef = useRef(null);
  const notifPanelRef = useRef(null);
  const langBtnRef = useRef(null);
  const langPanelRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (
        notifBtnRef.current && !notifBtnRef.current.contains(e.target) &&
        notifPanelRef.current && !notifPanelRef.current.contains(e.target)
      ) setOpen(false);
      if (
        langBtnRef.current && !langBtnRef.current.contains(e.target) &&
        langPanelRef.current && !langPanelRef.current.contains(e.target)
      ) setLangOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleNotif = () => {
    if (!open && notifBtnRef.current) {
      const rect = notifBtnRef.current.getBoundingClientRect();
      setNotifPos({ top: rect.bottom + 10, left: rect.left });
    }
    setOpen((o) => !o);
  };

  const toggleLang = () => {
    if (!langOpen && langBtnRef.current) {
      const rect = langBtnRef.current.getBoundingClientRect();
      setLangPos({ top: rect.bottom + 10, left: rect.left });
    }
    setLangOpen((o) => !o);
  };

  const filtered = filter === 'all' ? notifications : notifications.filter((n) => n.type === filter);

  const grouped = ['danger', 'warning', 'order', 'info'].reduce((acc, ty) => {
    const items = filtered.filter((n) => n.type === ty);
    if (items.length) acc.push({ type: ty, items });
    return acc;
  }, []);

  const urgentCount = notifications.filter((n) => n.type === 'danger').length;

  return (
    <div className="sidebar-user">
      <div className="sidebar-user__row">
        <div className="sidebar-user__group">
          <div className="header-avatar">GP</div>
          <div className="header-role">
            <label>{t('header.role', 'Role')}</label>
            <div className="header-role__pill">{ROLE_LABELS[currentRole] || currentRole}</div>
          </div>
        </div>

        <div className="sidebar-user__group">
        {/* ── Language Switcher ── */}
        <div className="lang-switcher">
          <button
            ref={langBtnRef}
            className="lang-switcher__btn"
            onClick={toggleLang}
            title="Language"
          >
            {i18n.language === 'en' && <span className="fi fi-gb"></span>}
            {i18n.language === 'fr' && <span className="fi fi-fr"></span>}
            {i18n.language === 'es' && <span className="fi fi-es"></span>}
            {i18n.language === 'ar' && <span className="fi fi-ma"></span>}
            {(!i18n.language || !['en', 'fr', 'es', 'ar'].includes(i18n.language)) && <Globe size={18} />}
          </button>

          {langOpen && createPortal(
            <div
              ref={langPanelRef}
              className="lang-switcher__panel"
              style={{ position: 'fixed', top: langPos.top, left: langPos.left, right: 'auto' }}
            >
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
            </div>,
            document.body
          )}
        </div>

        {/* ── Notification Bell ── */}
        <div className="notif-wrap">
          <button
            ref={notifBtnRef}
            className={`notif-btn${urgentCount > 0 ? ' notif-btn--urgent' : ''}`}
            onClick={toggleNotif}
            title="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </button>

          {open && createPortal(
            <div
              ref={notifPanelRef}
              className={`notif-panel ${i18n.language === 'ar' ? 'notif-panel--rtl' : ''}`}
              style={{ position: 'fixed', top: notifPos.top, left: notifPos.left, right: 'auto' }}
            >

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
                            onClick={() => {
                              markRead(n.id);
                              if (n.type === 'order') {
                                setSelectedOrder(n.order);
                                setOpen(false);
                              }
                            }}
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

              <PermissionRender page="/abonnements">
                <Link to="/abonnements" className="notif-footer" onClick={() => setOpen(false)}>
                  <span>{t('header.manageSubscriptions', 'Gérer tous les abonnements')}</span>
                  <ChevronRight size={14} />
                </Link>
              </PermissionRender>

            </div>,
            document.body
          )}
        </div>
        </div>
      </div>

      <div className="sidebar-user__actions">
        <button className="header-action header-action--ghost sidebar-user__logout" onClick={logout}>
          {t('header.logout', 'Deconnexion')}
        </button>
        <button
          className="header-action header-action--ghost sidebar-user__pwd"
          onClick={() => setPwdOpen(true)}
          title={t('password.title', 'Changer mon mot de passe')}
          aria-label={t('password.title', 'Changer mon mot de passe')}
        >
          <KeyRound size={16} />
        </button>
      </div>

      {pwdOpen && createPortal(<ChangePasswordModal onClose={() => setPwdOpen(false)} />, document.body)}

      {selectedOrder && createPortal(
        <Modal
          title={t('header.modals.orderDetailsTitle', 'Détails de la Commande')}
          onClose={() => setSelectedOrder(null)}
        >
          <div className="order-details-modal">
            <div className="order-details-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(21,23,26,0.1)', paddingBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--clr-primary)', fontWeight: 'bold' }}>
                  {t('header.orders.number', 'Commande')} #{selectedOrder.id}
                </h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--clr-muted)' }}>
                  {new Date(selectedOrder.created_at).toLocaleString('fr-FR')}
                </span>
              </div>
              <span
                style={{
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  backgroundColor: selectedOrder.status === 'pending' ? 'rgba(168,90,6, 0.15)' :
                                   selectedOrder.status === 'delivered' ? 'rgba(53, 208, 127, 0.15)' :
                                   selectedOrder.status === 'collected' ? 'rgba(59, 130, 246, 0.15)' :
                                   'rgba(200,36,59, 0.15)',
                  color: selectedOrder.status === 'pending' ? '#a85a06' :
                         selectedOrder.status === 'delivered' ? 'var(--w-green)' :
                         selectedOrder.status === 'collected' ? 'var(--w-blue)' :
                         'var(--w-stamp)',
                  border: selectedOrder.status === 'pending' ? '1px solid rgba(168,90,6, 0.3)' :
                          selectedOrder.status === 'delivered' ? '1px solid rgba(53, 208, 127, 0.3)' :
                          selectedOrder.status === 'collected' ? '1px solid rgba(59, 130, 246, 0.3)' :
                          '1px solid rgba(200,36,59, 0.3)'
                }}
              >
                {selectedOrder.status === 'pending' ? t('store.orders.status.pending', 'En attente') :
                 selectedOrder.status === 'delivered' ? t('store.orders.status.delivered', 'Livré') :
                 selectedOrder.status === 'collected' ? t('store.orders.status.collected', 'Récupéré') :
                 t('store.orders.status.cancelled', 'Annulé')}
              </span>
            </div>

            <div className="order-details-client" style={{ marginBottom: '1.5rem', backgroundColor: 'rgba(21,23,26,0.03)', padding: '1rem', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', textTransform: 'uppercase', color: 'var(--clr-muted)', letterSpacing: '0.05em' }}>
                {t('store.orders.client', 'Client')}
              </h4>
              <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1.1rem' }}>
                {selectedOrder.membre_prenom} {selectedOrder.membre_nom}
              </p>
              {selectedOrder.payment_method === 'cash_on_delivery' ? (
                <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                  <strong>{t('store.orders.deliveryAddress', 'Adresse de livraison :')}</strong>
                  <div style={{ color: 'var(--clr-muted)', marginTop: '0.2rem' }}>
                    {selectedOrder.address}, {selectedOrder.postal_code} {selectedOrder.city}
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--clr-primary)', fontStyle: 'italic' }}>
                  {t('store.orders.pickupAtGym', 'Retrait au Club')}
                </div>
              )}
            </div>

            <div className="order-details-items" style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', textTransform: 'uppercase', color: 'var(--clr-muted)', letterSpacing: '0.05em' }}>
                {t('header.orders.items', 'Articles')}
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {selectedOrder.items?.map((item) => (
                  <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(21,23,26,0.05)' }}>
                    <span>
                      {item.product?.name || `Produit #${item.product_id}`} <strong style={{ color: 'var(--clr-primary)' }}>x{item.quantity}</strong>
                    </span>
                    <span style={{ fontWeight: 'bold' }}>
                      {(item.price * item.quantity).toLocaleString('fr-FR')} DH
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="order-details-total" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(21,23,26,0.05)', padding: '1rem', borderRadius: '8px', marginBottom: '2rem' }}>
              <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{t('store.orders.table.total', 'Total')}</span>
              <span style={{ fontWeight: 'bold', fontSize: '1.4rem', color: 'var(--clr-primary)' }}>
                {selectedOrder.total_price.toLocaleString('fr-FR')} DH
              </span>
            </div>

            <div className="form-actions" style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn btn--ghost" onClick={() => setSelectedOrder(null)}>
                {t('store.form.cancel', 'Fermer')}
              </button>
              <button
                className="btn btn--primary"
                onClick={() => {
                  setSelectedOrder(null);
                  navigate('/boutique?tab=commandes', { state: { activeTab: 'commandes' } });
                }}
              >
                <ShoppingBag size={16} style={{ marginRight: '8px', verticalAlign: 'middle', display: 'inline' }} />
                {t('header.orders.goToBoutique', 'Voir dans la Boutique')}
              </button>
            </div>
          </div>
        </Modal>,
        document.body
      )}
    </div>
  );
}
