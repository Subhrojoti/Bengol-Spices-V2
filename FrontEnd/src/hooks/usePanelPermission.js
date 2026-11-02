import usePanelBasePath from "./usePanelBasePath";
import { hasPermission } from "../utils/permissionUtils";

// Visibility only; backend routes independently read current employee rights.
export default function usePanelPermission(permission) {
  return usePanelBasePath() === "/admin" || hasPermission(permission);
}
