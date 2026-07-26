import NoAccess from "./NoAccess";
import { hasPermission } from "../../utils/permissionUtils";

const PermissionGuard = ({ permission, children }) => {
  const allowed = hasPermission(permission);

  if (!allowed) {
    return <NoAccess />;
  }

  return children;
};

export default PermissionGuard;
