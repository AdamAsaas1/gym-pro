import { usePermissions } from '../context/PermissionContext';

export default function PermissionRender({ page, fallback = null, children }) {
  const { hasPageAccess } = usePermissions();
  if (!hasPageAccess(page)) return fallback;
  return children;
}
