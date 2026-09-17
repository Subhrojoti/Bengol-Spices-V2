import { useLocation } from "react-router-dom";

/**
 * Which panel the current page is rendered inside: "/admin" or "/employee".
 *
 * Most tab pages are mounted under both. Any of them that links somewhere
 * must build the path from this rather than hardcoding one panel — the
 * product grid linked straight to "/admin/allproducts/:id", so an employee
 * clicking a product was thrown into the admin panel, which does not even
 * read their token.
 */
export const usePanelBasePath = () => {
  const { pathname } = useLocation();
  return pathname.startsWith("/employee") ? "/employee" : "/admin";
};

export default usePanelBasePath;
