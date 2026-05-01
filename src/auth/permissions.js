export const ALL_PAGES = [
  { path: '/', label: 'Tableau de Bord' },
  { path: '/membres', label: 'Membres' },
  { path: '/paiements', label: 'Paiements' },
  { path: '/planning', label: 'Planning' },
  { path: '/activites', label: 'Activites' },
  { path: '/abonnements', label: 'Abonnements' },
  { path: '/coaches', label: 'Coachs' },
  { path: '/permissions', label: 'Gestion des permissions' },
];

export const ROLE_ORDER = ['superadmin', 'admin'];

export const DEFAULT_ROLE_PERMISSIONS = {
  superadmin: ['*'],
  admin: ['/', '/membres', '/paiements', '/planning', '/activites', '/abonnements', '/coaches'],
};

export const PAGE_PATHS = new Set(ALL_PAGES.map((p) => p.path));

export function normalizeRolePermissions(role, pages) {
  if (role === 'superadmin') return ['*'];
  if (!Array.isArray(pages)) return ['/'];

  const unique = [...new Set(pages)].filter((page) => PAGE_PATHS.has(page) && page !== '/permissions');
  return unique.length ? unique : ['/'];
}

export function normalizePermissionsMap(raw) {
  const merged = { ...DEFAULT_ROLE_PERMISSIONS, ...(raw || {}) };
  const out = {};
  Object.keys(merged).forEach((role) => {
    out[role] = normalizeRolePermissions(role, merged[role]);
  });
  return out;
}

export function canAccessPage(role, permissionsMap, path) {
  const roleName = role || 'superadmin';
  if (roleName === 'superadmin') return true;

  const allowed = permissionsMap?.[roleName] || [];
  return allowed.includes(path);
}
