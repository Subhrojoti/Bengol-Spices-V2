const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const { QueryClient, QueryObserver } = require('@tanstack/react-query');

function load(file, imports) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: name => {
    if (name in imports) return imports[name];
    throw Error('Unexpected import: ' + name);
  }});
  return module.exports;
}

test('hidden order history stays cached without mutation refetches; returning fetches the invalidated data once', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30000 } } });
  let focused = true, requests = 0;
  const hooks = load('../src/hooks/useOrders.ts', {
    'expo-router': { useIsFocused: () => focused },
    'axios': { isAxiosError: () => false },
    '@tanstack/react-query': { useQuery: options => options, useQueryClient: () => client },
    '@/api/order.api': { orderApi: { getOrdersByStore: async () => { requests++; return [{ orderId: 'SAVED', dueAmount: 10 }]; } } },
  });
  const key = ['orders', 'store', 'STORE'];
  client.setQueryData(key, [{ orderId: 'SAVED', dueAmount: 20 }]);
  const observer = new QueryObserver(client, hooks.useOrdersByStore('STORE'));
  const unsubscribe = observer.subscribe(() => {});
  try {
    focused = false; observer.setOptions(hooks.useOrdersByStore('STORE'));
    await client.invalidateQueries({ queryKey: ['orders'] });
    assert.equal(requests, 0);
    assert.equal(client.getQueryData(key)[0].dueAmount, 20);
    focused = true; observer.setOptions(hooks.useOrdersByStore('STORE'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests, 1); assert.equal(client.getQueryData(key)[0].dueAmount, 10);
    observer.setOptions(hooks.useOrdersByStore('STORE'));
    await client.invalidateQueries({ queryKey: ['orders'] });
    assert.equal(requests, 2); // Visible payment/order updates still refresh.
  } finally { unsubscribe(); client.clear(); }
});

test('all order reads forward the cancellation signal to HTTP without changing paths', async () => {
  const calls = [], signal = new AbortController().signal;
  const { orderApi } = load('../src/api/order.api.ts', {
    './client': { api: { get: async (url, config) => { calls.push({ url, config }); return { data: { order: { orderId: 'O' }, data: [] } }; } } },
    './unwrap': { unwrapList: body => body.data },
  });
  await orderApi.getMyOrders(signal); await orderApi.getDueOrders(signal);
  await orderApi.getOrdersByStore('S/1', signal); await orderApi.getOrder('O/1', signal);
  assert.equal(calls.length, 4); assert(calls.every(call => call.config?.signal === signal));
  assert.equal(calls[2].url, '/agent/orders/store/S%2F1');
  assert.equal(calls[3].url, '/agent/orders/mine/O%2F1');
});

test('store, catalogue, overview, leaderboard, wallet and return reads defer hidden invalidation until focus', async () => {
  const cases=[
    ['../src/hooks/useStores.ts','useMyStores',[],'@/api/store.api','storeApi','getMyStores'],
    ['../src/hooks/useCatalog.ts','useCatalog',['S'],'@/api/product.api','productApi','getStoreCatalog'],
    ['../src/hooks/useAgent.ts','useDashboard',[],'@/api/agent.api','agentApi','getDashboard'],
    ['../src/hooks/useAgent.ts','useLeaderboard',[],'@/api/agent.api','agentApi','getLeaderboard'],
    ['../src/hooks/useIncentive.ts','useIncentiveHistory',[],'@/api/incentive.api','incentiveApi','getHistory'],
    ['../src/hooks/useReturns.ts','useMyReturns',[],'@/api/return.api','returnApi','getMyReturns'],
  ];
  for(const [file,hook,args,moduleName,apiName,method] of cases){
    const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:30000}}});
    let focused=false,requests=0;
    const module=load(file,{
      'expo-router':{useIsFocused:()=>focused},
      '@tanstack/react-query':{useQuery:opts=>opts,useQueryClient:()=>client},
      [moduleName]:{[apiName]:{[method]:async()=>{requests++;return [];}}},
    });
    const options=()=>module[hook](...args),key=options().queryKey;
    client.setQueryData(key,[]);const observer=new QueryObserver(client,options());const unsubscribe=observer.subscribe(()=>{});
    try{
      await client.invalidateQueries({queryKey:[key[0]]});assert.equal(requests,0,hook+' must not fetch hidden data');
      focused=true;observer.setOptions(options());await new Promise(resolve=>setImmediate(resolve));assert.equal(requests,1,hook+' must refresh when visible');
    }finally{unsubscribe();client.clear();}
  }
});

test('image sizing bounds high-density avatars and preserves signed, transformed and private URLs', () => {
  const {sizedImage}=load('../src/utils/image.ts',{'react-native':{PixelRatio:{get:()=>3}}});
  const base='https://res.cloudinary.com/fixture/image/upload/';
  assert.equal(sizedImage(base+'v123/photo.jpg',40),base+'f_auto,q_auto,c_limit,w_160/v123/photo.jpg');
  assert.equal(sizedImage(base+'v123/photo.jpg',84),base+'f_auto,q_auto,c_limit,w_400/v123/photo.jpg');
  assert.equal(sizedImage(base+'v123/photo.jpg',10000),base+'f_auto,q_auto,c_limit,w_1280/v123/photo.jpg');
  for(const url of [base+'s--fixture--/v123/photo.jpg',base+'v123/photo.jpg?__cld_token__=fixture',base+'c_fill,w_200/v123/photo.jpg','file:///local/photo.jpg','https://api.fixture.invalid/private/photo'])assert.equal(sizedImage(url,40),url);
});
