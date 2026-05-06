import { createElement, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, Dumbbell, CreditCard, UserCheck, ChevronLeft, ChevronRight, Banknote, ShieldCheck, Bell, Settings } from 'lucide-react';
import { useGym } from '../context/GymContext';
import PermissionRender from './PermissionRender';

const NAV = [
  { to: '/',            icon: LayoutDashboard, label: 'Tableau de Bord', end: true },
  { to: '/membres',     icon: Users,           label: 'Membres'                   },
  { to: '/paiements',  icon: Banknote,        label: 'Paiements'                 },
  { to: '/planning',    icon: Calendar,        label: 'Planning'                  },
  { to: '/activites',   icon: Dumbbell,        label: 'Activités'                 },
  { to: '/abonnements', icon: CreditCard,      label: 'Abonnements'               },
  { to: '/coaches',     icon: UserCheck,       label: 'Coachs'                    },
  { to: '/notifications', icon: Bell,          label: 'Notifications'             },
  { to: '/permissions', icon: ShieldCheck,     label: 'Permissions'               },
  { to: '/settings',    icon: Settings,        label: 'Paramètres'                },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { stats, statsP, gymSettings } = useGym();

  return (
    <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar__brand">
        <div className="sidebar__logo">
          {gymSettings?.logo_base64 ? (
            <img src={gymSettings.logo_base64} alt={gymSettings.name} className="sidebar__logo-img" />
          ) : (
            <img src="/logo_asaas.jpg" alt="ASAAS GYM" className="sidebar__logo-img" />
          )}
          {!collapsed && <span>{gymSettings?.name || 'ASAAS GYM'}</span>}
        </div>
        <button className="sidebar__collapse-btn" onClick={() => setCollapsed((v) => !v)} title="Réduire">
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {!collapsed && (
        <div className="sidebar__gym-label">Votre salle, votre performance</div>
      )}

      {!collapsed && <div className="sidebar__section">Pilotage</div>}

      {/* Nav */}
      <nav className="sidebar__nav">
        {NAV.map(({ to, icon: NavIcon, label, end }) => (
          <PermissionRender key={to} page={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) => `sidebar__link${isActive ? ' sidebar__link--active' : ''}`}
              title={collapsed ? label : undefined}
            >
              {createElement(NavIcon, { size: 19, className: 'sidebar__link-icon' })}
              {!collapsed && <span>{label}</span>}
              {!collapsed && to === '/paiements' && statsP?.aRegler > 0 && (
                <span className="sidebar__badge">{statsP.aRegler}</span>
              )}
            </NavLink>
          </PermissionRender>
        ))}
      </nav>

      {/* Footer live status */}
      {!collapsed && (
        <div className="sidebar__bottom">
          <div className="sidebar__status">
            <span className="sidebar__status-dot" />
            <span>{stats.actifs} membres actifs</span>
          </div>
          <div className="sidebar__insight">
            <div className="sidebar__insight-title">Performance</div>
            <div className="sidebar__insight-row">
              <span>Actifs</span>
              <strong>{stats.actifs}</strong>
            </div>
            <div className="sidebar__insight-row">
              <span>A regler</span>
              <strong>{statsP?.aRegler ?? 0}</strong>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
