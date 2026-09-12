import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import PermissionRender from './PermissionRender';
import { usePermissions } from '../context/PermissionContext';
import { useGym } from '../context/GymContext';
import { useTranslation } from 'react-i18next';

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

export default function Header() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { configFallback, gymSettings } = useGym();
  const { hasPageAccess } = usePermissions();
  const { t, i18n } = useTranslation();

  const title = t(`titles.${pathname.replace('/', '') || 'dashboard'}`, TITLES[pathname] ?? (gymSettings?.name || 'ASAAS GYM'));

  const [search, setSearch] = useState('');

  const dateStr = new Date().toLocaleDateString(i18n.language === 'ar' ? 'ar-MA' : 'fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

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
    </header>
  );
}
