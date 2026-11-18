import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import axios from "axios";

function client() {
  const values = new Map([["employeeToken", "old-session"], ["permissions", "keep-permissions"], ["role", "EMPLOYEE"]]);
  const localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), clear: () => values.clear() };
  const redirects = [], window = { location: { pathname: "/employee/dashboard", replace: path => redirects.push(path) } };
  const source = fs.readFileSync(new URL("../src/api/axiosInstance.js", import.meta.url), "utf8")
    .replace(/^import .*;\r?\n/gm, "").replace("import.meta.env.VITE_API_URL", "'https://fixture.invalid'").replace("export const SIGNED_OUT_NOTICE", "const SIGNED_OUT_NOTICE").replace("export default axiosInstance;", "globalThis.result = axiosInstance;");
  const globals = { axios, window, localStorage, sessionStorage: localStorage, FormData, console, storedAdminToken: () => "", storedAdminCookieSession: () => null, adminRequestSession: () => ({ _adminSessionToken: "", _adminCookieId: "" }), clearAdminSession() {}, invalidateAdminReads() {} };
  vm.runInNewContext(source, globals);
  return { api: globals.result, values, redirects, window };
}

for (const mode of ["new employee login", "switch to admin", "current session"]) test(`employee 401 respects ${mode}`, async () => {
  const { api, values, redirects, window } = client(); let rejectOld, started;
  const ready = new Promise(resolve => { started = resolve; });
  api.defaults.adapter = config => new Promise((resolve, reject) => { rejectOld = () => reject(new axios.AxiosError("Expired old request", "ERR_BAD_REQUEST", config, null, { status: 401 })); started(); });
  const response = api.get("/admin/dashboard-summary"); await ready;
  if (mode === "new employee login") values.set("employeeToken", "new-session");
  if (mode === "switch to admin") { window.location.pathname = "/admin/dashboard"; values.set("adminToken", "new-admin"); }
  rejectOld(); await assert.rejects(response);
  if (mode === "current session") { assert.deepEqual(redirects, ["/employee/login"]); assert.equal(values.has("employeeToken"), false); }
  else { assert.deepEqual(redirects, []); assert.equal(values.get("employeeToken"), mode === "new employee login" ? "new-session" : "old-session"); assert.equal(values.get("permissions"), "keep-permissions"); }
});
