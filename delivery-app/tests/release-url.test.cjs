const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync(require.resolve('../src/api/baseUrl.ts'), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const resolve = (dev, value) => {const module={exports:{}};vm.runInNewContext(source,{module,exports:module.exports,__DEV__:dev,process:{env:{EXPO_PUBLIC_API_URL:value}},console:{warn(){}}});return module.exports.API_URL;};
test('release bundles cannot target the loopback fixture API or a plaintext office address', () => {
  for(const value of [undefined,'','http://127.0.0.1:8768','http://192.168.1.10:8000']) assert.equal(resolve(false,value),'https://api.bengolspices.com');
  assert.equal(resolve(false,' https://api.bengolspices.com/ '),'https://api.bengolspices.com');
  assert.equal(resolve(true,'http://127.0.0.1:8768'),'http://127.0.0.1:8768');
});