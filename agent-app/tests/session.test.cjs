const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const axios = require('axios');

// Exercise the real interceptor code with in-memory storage and an Axios
// adapter. No React Native runtime, credentials or network calls are used.
function sessionClient() {
  const storage = { value: 'old-session', get: async () => storage.value };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(require.resolve('../src/api/client.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports,
    require(name) {
      if (name === 'axios') return axios;
      if (name === '@/utils/tokenStorage') return { tokenStorage: storage };
      if (name === './baseUrl') return { API_URL: 'https://test.invalid' };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return { ...module.exports, storage };
}

test('late unauthorized response cannot sign out a newer session', async () => {
  const { api, storage, setUnauthorizedHandler } = sessionClient();
  let rejectRequest, sent, ready;
  const started = new Promise(resolve => { ready = resolve; });
  let signedOut = 0;
  setUnauthorizedHandler(() => signedOut++);
  api.defaults.adapter = config => new Promise((resolve, reject) => {
    sent = config;
    rejectRequest = () => reject(new axios.AxiosError('Expired', 'ERR_BAD_REQUEST', config, null, { status: 401 }));
    ready();
  });
  const response = api.get('/agent/orders/my-orders');
  await started;
  assert.equal(sent.headers.Authorization, 'Bearer old-session');
  storage.value = 'new-session';
  rejectRequest();
  await assert.rejects(response);
  assert.equal(signedOut, 0);
});

test('current-session unauthorized response still expires the session', async () => {
  const { api, setUnauthorizedHandler } = sessionClient();
  let signedOut = 0;
  setUnauthorizedHandler(() => signedOut++);
  api.defaults.adapter = config => Promise.reject(new axios.AxiosError('Expired', 'ERR_BAD_REQUEST', config, null, { status: 401 }));
  await assert.rejects(api.get('/agent/profile'));
  assert.equal(signedOut, 1);
});

test('logout preserves its explicit old token and cannot expire a new session', async () => {
  const { api, storage, setUnauthorizedHandler } = sessionClient();
  storage.value = 'new-session';
  let signedOut = 0, authorization;
  setUnauthorizedHandler(() => signedOut++);
  api.defaults.adapter = config => {
    authorization = config.headers.Authorization;
    return Promise.reject(new axios.AxiosError('Expired', 'ERR_BAD_REQUEST', config, null, { status: 401 }));
  };
  await assert.rejects(api.post('/auth/logout', undefined, { headers: { Authorization: 'Bearer old-session' } }));
  assert.equal(authorization, 'Bearer old-session');
  assert.equal(signedOut, 0);
});

test('unauthenticated wrong-password responses do not trigger logout', async () => {
  const { api, storage, setUnauthorizedHandler } = sessionClient();
  storage.value = null;
  let signedOut = 0;
  setUnauthorizedHandler(() => signedOut++);
  api.defaults.adapter = config => Promise.reject(new axios.AxiosError('Wrong password', 'ERR_BAD_REQUEST', config, null, { status: 401 }));
  await assert.rejects(api.post('/auth/agent/login'));
  assert.equal(signedOut, 0);
});
