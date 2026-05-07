import { useMemo, useState } from 'react';
import { Shield, RotateCcw } from 'lucide-react';
import { usePermissions } from '../context/PermissionContext';
import { useTranslation } from 'react-i18next';

const ROLE_LABELS = {
  superadmin: 'Super Admin',
  admin: 'Admin',
};

export default function Permissions() {
  const {
    allPages,
    roles,
    permissionsByRole,
    togglePagePermission,
    resetRolePermissions,
  } = usePermissions();
  const { t } = useTranslation();

  const editableRoles = useMemo(() => roles.filter((r) => r !== 'superadmin'), [roles]);
  const [selectedRole, setSelectedRole] = useState(editableRoles[0] || 'admin');

  const allowed = permissionsByRole[selectedRole] || [];
  const canEdit = editableRoles.length > 0;

  return (
    <div className="page permissions-page fade-in">
      <section className="permissions-hero card">
        <div>
          <div className="permissions-hero__eyebrow">{t('permissions.security', 'Securite')}</div>
          <h2 className="permissions-hero__title">{t('permissions.management', 'Gestion des permissions')}</h2>
          <p className="permissions-hero__subtitle">
            {t('permissions.subtitle', 'Superadmin possede tous les acces. Configurez ici les permissions des autres roles pour les pages du menu.')}
          </p>
        </div>
        <div className="permissions-badge">
          <Shield size={18} />
          <span>{t('permissions.accessControl', 'Page-level access control')}</span>
        </div>
      </section>

      <section className="card permissions-panel">
        {!canEdit && (
          <div className="permissions-note">
            {t('permissions.noCustomRoles', 'Aucun role personnalisable trouve pour ce compte.')}
          </div>
        )}

        {canEdit && (
          <>
        <div className="permissions-panel__head">
          <label htmlFor="roleSelect">{t('permissions.roleToConfigure', 'Role a configurer')}</label>
          <div className="permissions-panel__controls">
            <select id="roleSelect" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
              {editableRoles.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => resetRolePermissions(selectedRole)}
            >
              <RotateCcw size={14} /> {t('permissions.resetRole', 'Reinitialiser ce role')}
            </button>
          </div>
        </div>

        <div className="permissions-grid">
          {allPages.map((p) => {
            const isPermissionPage = p.path === '/permissions';
            const checked = isPermissionPage ? false : allowed.includes(p.path);
            return (
              <label key={p.path} className={`perm-item${checked ? ' perm-item--on' : ''}${isPermissionPage ? ' perm-item--locked' : ''}`}>
                <div className="perm-item__meta">
                  <span className="perm-item__label">{p.label}</span>
                  <span className="perm-item__path">{p.path}</span>
                </div>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={isPermissionPage}
                  onChange={() => togglePagePermission(selectedRole, p.path)}
                />
              </label>
            );
          })}
        </div>

        <div className="permissions-note">
          {t('permissions.superadminNote', 'Superadmin est toujours autorise sur toutes les pages, y compris cette page de gestion.')}
        </div>
          </>
        )}
      </section>
    </div>
  );
}
