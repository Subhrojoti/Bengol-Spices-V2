export function clearEmployeeSession() {
  localStorage.removeItem("employeeToken");
  localStorage.removeItem("permissions");
  if (localStorage.getItem("role") === "EMPLOYEE") localStorage.removeItem("role");
}
