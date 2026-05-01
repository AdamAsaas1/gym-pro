/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ALL_PAGES,
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_ORDER,
  canAccessPage,
  normalizePermissionsMap,
} from '../auth/permissions';
import {
  getPermissionPages,
  getPermissionRoles,
  getRolePages,
  updateRolePages,
} from '../api/client';
import { useAuth } from './AuthContext';

const PermissionContext = createContext(null);

export function PermissionProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [permissionsByRole, setPermissionsByRole] = useState(() => normalizePermissionsMap(null));
  const [allPages, setAllPages] = useState(ALL_PAGES);
  const [currentRole, setCurrentRoleState] = useState('superadmin');

  useEffect(() => {
    let ignore = false;

    async function fetchPermissions() {
      if (!isAuthenticated || !user) {
        if (!ignore) {
          setCurrentRoleState('superadmin');
          setPermissionsByRole(normalizePermissionsMap(null));
          setAllPages(ALL_PAGES);
        }
        return;
      }

      if (!ignore) {
        setCurrentRoleState(user.role || 'superadmin');
        setPermissionsByRole((prev) => normalizePermissionsMap({
          ...prev,
          [user.role || 'superadmin']: user.permissions || ['/'],
        }));
      }

      if (user.role !== 'superadmin') return;

      try {
        const [pagesRes, rolesRes] = await Promise.all([getPermissionPages(), getPermissionRoles()]);
        if (ignore) return;

        const apiPages = (pagesRes.pages || []).map((p) => ({
          path: p,
          label: p === '/' ? 'Tableau de Bord' : p.replace('/', '').replace(/(^.|-.?)/g, (m) => m.toUpperCase()),
        }));
        if (apiPages.length) {
          setAllPages(apiPages);
        }

        const next = {};
        const roles = rolesRes.roles || [];
        for (const role of roles) {
          if (role === 'superadmin') {
            next[role] = ['*'];
            continue;
          }
          const rolePages = await getRolePages(role);
          next[role] = rolePages.pages || ['/'];
        }
        
        if (!ignore) {
          setPermissionsByRole(normalizePermissionsMap(next));
        }
      } catch {
        // Keep local defaults if permissions endpoints are unavailable.
      }
    }

    fetchPermissions();
    return () => { ignore = true; };
  }, [isAuthenticated, user]);

  const roles = useMemo(() => {
    const all = new Set([...ROLE_ORDER, ...Object.keys(permissionsByRole)]);
    return [...all];
  }, [permissionsByRole]);

  const setCurrentRole = useCallback((role) => {
    setCurrentRoleState(role);
  }, []);

  const hasPageAccess = useCallback((pagePath, roleOverride) => {
    const role = roleOverride || currentRole;
    if (!isAuthenticated) return false;
    if (role === (user?.role || 'superadmin')) {
      const allowed = user?.permissions || [];
      if (allowed.includes('*')) return true;
      return allowed.includes(pagePath);
    }
    return canAccessPage(role, permissionsByRole, pagePath);
  }, [currentRole, isAuthenticated, permissionsByRole, user]);

  const togglePagePermission = useCallback((role, pagePath) => {
    if (user?.role !== 'superadmin') return;
    if (role === 'superadmin' || pagePath === '/permissions') return;

    setPermissionsByRole((prev) => {
      const current = prev[role] || ['/'];
      const has = current.includes(pagePath);
      const next = has ? current.filter((p) => p !== pagePath) : [...current, pagePath];
      const safe = next.length ? next : ['/'];

      updateRolePages(role, safe)
        .then((res) => {
          setPermissionsByRole((curr) => ({ ...curr, [role]: res.pages || safe }));
        })
        .catch(() => {
          setPermissionsByRole((curr) => ({ ...curr, [role]: current }));
        });

      return { ...prev, [role]: safe };
    });
  }, [user]);

  const resetRolePermissions = useCallback((role) => {
    if (user?.role !== 'superadmin') return;
    if (role === 'superadmin') return;
    const defaults = normalizePermissionsMap({ [role]: DEFAULT_ROLE_PERMISSIONS[role] || ['/'] })[role];
    updateRolePages(role, defaults)
      .then((res) => {
        setPermissionsByRole((prev) => ({ ...prev, [role]: res.pages || defaults }));
      })
      .catch(() => {
        setPermissionsByRole((prev) => ({ ...prev, [role]: defaults }));
      });
  }, [user]);

  const firstAllowedPage = useMemo(() => {
    const appPages = allPages.filter((p) => p.path !== '/permissions').map((p) => p.path);
    const first = appPages.find((p) => hasPageAccess(p));
    return first || '/';
  }, [allPages, hasPageAccess]);

  const value = useMemo(() => ({
    allPages,
    roles,
    currentRole,
    setCurrentRole,
    permissionsByRole,
    hasPageAccess,
    togglePagePermission,
    resetRolePermissions,
    firstAllowedPage,
  }), [allPages, roles, currentRole, setCurrentRole, permissionsByRole, hasPageAccess, togglePagePermission, resetRolePermissions, firstAllowedPage]);

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

export function usePermissions() {
  const ctx = useContext(PermissionContext);
  if (!ctx) {
    throw new Error('usePermissions must be used inside PermissionProvider');
  }
  return ctx;
}
