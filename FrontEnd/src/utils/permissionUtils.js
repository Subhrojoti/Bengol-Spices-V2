export const getPermissions = () => {
  const permissions = localStorage.getItem("permissions");
  return permissions ? JSON.parse(permissions) : {};
};

export const hasPermission = (key) => {
  const permissions = getPermissions();
  return permissions?.[key] === true;
};
