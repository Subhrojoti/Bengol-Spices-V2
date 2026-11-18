const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const { QueryClient, QueryObserver } = require('@tanstack/react-query');
const { component } = require('./helpers/component.cjs');

function load(file, imports = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: name => {
    if (name in imports) return imports[name];
    throw Error('Unexpected import: ' + name);
  }});
  return module.exports;
}
const guards = load('../src/utils/responseData.ts');
const fakeOrder = () => ({ _id:'id', orderId:'ORDER', status:'ASSIGNED', deliveryAddress:{}, products:[{name:'Spice',quantity:10}], statusHistory:[] });

test('hidden delivery, pickup, history, dashboard and notification queries defer invalidation until focus', async () => {
  const cases = [
    ['useOrders','useAssignedOrders','order','orderApi','getMyAssignedOrders',{orders:[],rules:null}],
    ['useReturns','useAssignedReturns','return','returnApi','getAssignedReturns',[]],
    ['useProfile','useDeliveryHistory','deliveryPartner','deliveryPartnerApi','getMyHistory',{deliveredOrders:[],completedReturns:[]}],
    ['useProfile','useDashboard','deliveryPartner','deliveryPartnerApi','getDashboard',{}],
    ['useNotifications','useNotifications','notification','notificationApi','getMyNotifications',[]],
  ];
  for (const [file, hook, apiFile, apiName, method, data] of cases) {
    let focused = true, requests = 0;
    const client = new QueryClient({defaultOptions:{queries:{retry:false,staleTime:30000}}});
    const hooks = load('../src/hooks/'+file+'.ts', {
      'expo-router':{useIsFocused:()=>focused},
      '@tanstack/react-query':{useQuery:options=>options,useQueryClient:()=>client},
      ['@/api/'+apiFile+'.api']:{[apiName]:{[method]:async()=>{requests++;return data;}}},
      '@/api/client':{}, '@/utils/toast':{},
    });
    const options=()=>hooks[hook](),key=options().queryKey;
    client.setQueryData(key,data); const observer=new QueryObserver(client,options()); const unsubscribe=observer.subscribe(()=>{});
    try {
      focused=false;observer.setOptions(options());
      await client.invalidateQueries({queryKey:[key[0]]}); assert.equal(requests,0,hook);
      focused=true;observer.setOptions(options());await new Promise(resolve=>setImmediate(resolve));assert.equal(requests,1,hook);
      await client.invalidateQueries({queryKey:[key[0]]});assert.equal(requests,2,hook+' visible mutation refresh');
    } finally {unsubscribe();client.clear();}
  }
});

test('assigned orders and rules still share one HTTP read, and history can be disabled independently', async()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:30000}}}); let requests=0;
  const imports={'expo-router':{useIsFocused:()=>true},'@tanstack/react-query':{useQuery:opts=>opts},'@/api/order.api':{orderApi:{getMyAssignedOrders:async()=>{requests++;return {orders:[],rules:{radiusMetres:60}};}}}};
  const hooks=load('../src/hooks/useOrders.ts',imports);
  const a=new QueryObserver(client,hooks.useAssignedOrders()),b=new QueryObserver(client,hooks.useDeliveryRules());
  const offA=a.subscribe(()=>{}),offB=b.subscribe(()=>{});
  try {await new Promise(resolve=>setImmediate(resolve));assert.equal(requests,1);assert.equal(b.getCurrentResult().data.radiusMetres,60);}
  finally {offA();offB();client.clear();}
  const history=load('../src/hooks/useProfile.ts',{'expo-router':{useIsFocused:()=>true},'@tanstack/react-query':{useQuery:opts=>opts},'@/api/deliveryPartner.api':{}});
  assert.equal(history.useDeliveryHistory(false).enabled,false);assert.equal(history.useDeliveryHistory(true).enabled,true);
});

test('read API cancellation reaches HTTP without changing endpoint paths', async()=>{
  const signal=new AbortController().signal,calls=[];
  const api={get:async(url,config)=>{calls.push({url,config});return {data:{data: url.endsWith('/history')?{deliveredOrders:[],completedReturns:[]}:url.endsWith('/profile')?{_id:'P',name:'Partner',address:{}}:url.endsWith('/dashboard')?{summary:{totalDelivered:0,totalReturnsHandled:0,totalPendingPickups:0},monthlyDeliveryDistribution:[],yearlyComparison:[]}:[]}};}};
  const imports={'./client':{api},'@/utils/responseData':guards};
  const {orderApi}=load('../src/api/order.api.ts',imports),{returnApi}=load('../src/api/return.api.ts',imports),{deliveryPartnerApi}=load('../src/api/deliveryPartner.api.ts',imports);
  await orderApi.getMyAssignedOrders(signal);await returnApi.getAssignedReturns(signal);
  await deliveryPartnerApi.getProfile(signal);await deliveryPartnerApi.getDashboard(signal);await deliveryPartnerApi.getMyHistory(signal);
  assert.equal(calls.length,5);assert(calls.every(call=>call.config.signal===signal));
  assert.deepEqual(calls.map(call=>call.url),['/delivery-partner/orders','/returns/delivery/assigned','/delivery-partner/profile','/delivery-partner/dashboard','/delivery-partner/history']);
});

test('malformed dashboard, list and payment data becomes a query error without hiding records or inventing totals',()=>{
  const dashboard={summary:{totalDelivered:2,totalReturnsHandled:1,totalPendingPickups:0},monthlyDeliveryDistribution:[{month:'Nov',delivered:2,returns:1}],yearlyComparison:[{year:2026,delivered:2}]};
  assert.equal(guards.dashboardData(dashboard),dashboard);
  for(const patch of [{summary:null},{monthlyDeliveryDistribution:null},{yearlyComparison:[null]},{summary:{...dashboard.summary,totalDelivered:'2'}}])assert.throws(()=>guards.dashboardData({...dashboard,...patch}));
  const order=fakeOrder();assert.equal(guards.orderList([order])[0],order);
  for(const value of [null,{},[null],[order,null],[{...order,products:null}],[{...order,statusHistory:[{}]}]])assert.throws(()=>guards.orderList(value));
  const payments={totalAmount:100,dueAmount:80,recordedAmount:20,verifiedAmount:0,pendingVerificationAmount:20,payments:[{id:'PAY',amount:20,method:'CASH',collector:{id:'P'}}]};
  assert.equal(guards.collectionData(payments),payments);
  assert.throws(()=>guards.collectionData({...payments,dueAmount:null}));assert.throws(()=>guards.collectionData({...payments,payments:[null]}));
  assert.throws(()=>guards.collectionData({...payments,payments:[{...payments.payments[0],collector:null}]}));
  assert.equal(guards.profileData({_id:'P',name:'Partner',address:{}}).name,'Partner'); // Missing optional identity metadata is supported.
});

test('map process loss offers recovery and hiding the screen releases the WebView',()=>{
  let focused=true;
  const c=component('../src/components/maps/StoreMap.tsx',{'expo-router':{useIsFocused:()=>focused},'./mapHtml':{mapHtml:()=>'<html></html>'},'./vendor/leaflet':{leafletLicense:'fixture'}});
  const p={points:[{id:'S',latitude:22,longitude:88}],onSelect(){}};c.render(p);
  c.nodes().find(n=>n.type==='WebView').props.onRenderProcessGone();c.render(p);assert(!c.nodes().some(n=>n.type==='WebView'));
  c.nodes().find(n=>n.type==='Pressable'&&c.text(n).includes('Retry map')).props.onPress();c.render(p);assert(c.nodes().some(n=>n.type==='WebView'));
  focused=false;c.render(p);assert(!c.nodes().some(n=>n.type==='WebView'));focused=true;c.render(p);assert(c.nodes().some(n=>n.type==='WebView'));
});

test('photo preview creates its large image only when opened and uses bounded native decoding',()=>{
  const c=component('../src/components/StorePhotoViewer.tsx',{'@/utils/image':{sizedImage:(url,size)=>url+'?size='+size}});
  const p={url:'https://fixture.invalid/photo',name:'Test store'};c.render(p);
  assert.equal(c.nodes().filter(n=>n.type===c.Image).length,1);
  c.nodes().find(n=>n.type==='Pressable').props.onPress();c.render(p);
  const images=c.nodes().filter(n=>n.type===c.Image);assert.equal(images.length,2);assert(images.every(n=>n.props.resizeMethod==='resize'));
  c.nodes().find(n=>n.props?.label==='Close photo').props.onPress();c.render(p);assert.equal(c.nodes().filter(n=>n.type===c.Image).length,1);
});

test('offline State choices support search and preserve a typed custom value',()=>{
  const {INDIA_STATES}=load('../src/utils/indiaStates.ts');assert.equal(INDIA_STATES.length,36);assert.equal(new Set(INDIA_STATES).size,36);
  let selected='';const c=component('../src/components/forms/ChoiceField.tsx');
  const p={label:'State',value:'',options:INDIA_STATES,allowCustom:true,onChange:v=>{selected=v;}};
  c.render(p);c.nodes().find(n=>n.props?.accessibilityLabel==='Select State').props.onPress();c.render(p);
  c.nodes().find(n=>n.props?.accessibilityLabel==='Search State').props.onChangeText('west');c.render(p);
  const list=c.nodes().find(n=>n.type==='FlatList');assert.deepEqual(Array.from(list.props.data),['West Bengal']);
  const row=list.props.renderItem({item:'West Bengal'});row.props.onPress();assert.equal(selected,'West Bengal');
  c.render(p);c.nodes().find(n=>n.props?.accessibilityLabel==='Select State').props.onPress();c.render(p);
  c.nodes().find(n=>n.props?.accessibilityLabel==='Search State').props.onChangeText('Custom region');c.render(p);
  c.nodes().find(n=>n.props?.label==='Use this state').props.onPress();assert.equal(selected,'Custom region');
});

test('return retries survive reopening and cannot create a second request after a lost response',async()=>{
  const storage=new Map(),calls=[],keyParser=load('../src/utils/returnAttempt.ts');let fail=true;
  const imports={
    '@tanstack/react-query':{useQuery:()=>({data:[{lineIndex:0,name:'Spice',uom:'packet',remainingQuantity:10,orderedQuantity:10}]}),useQueryClient:()=>({invalidateQueries(){}})},
    'expo-secure-store':{getItemAsync:async k=>storage.get(k)||null,setItemAsync:async(k,v)=>{storage.set(k,v);},deleteItemAsync:async k=>{storage.delete(k);}},
    'axios':{isAxiosError:e=>Boolean(e.isAxiosError)},
    '@/hooks/useProfile':{useProfile:()=>({data:{_id:'PARTNER'}})},
    '@/utils/requestId':{newRequestId:()=> 'fixture_original_return_123'},'@/utils/returnAttempt':keyParser,
    '@/api/return.api':{returnApi:{initiateItemsReturn:async(id,input)=>{calls.push(input);if(fail)throw Object.assign(Error('Lost response'),{isAxiosError:true});return {returnId:'RETURN'};}}},
    '@/utils/toast':{toast:{success(){}}},
  };
  const p={orderId:'ORDER',visible:true,atDelivery:true,onClose(){}};
  const c=component('../src/components/ReturnItemsModal.tsx',imports);c.render(p);await c.settle();c.render(p);
  c.nodes().find(n=>n.props?.label==='Select').props.onPress();c.render(p);
  c.nodes().find(n=>n.props?.accessibilityLabel==='Reason for return').props.onChangeText('Damaged packaging');c.render(p);
  await c.nodes().find(n=>n.props?.label==='Record Items Taken Back').props.onPress();c.render(p);
  assert.equal(storage.size,1);assert.match(c.text(),/reply was uncertain/);
  const reopened=component('../src/components/ReturnItemsModal.tsx',imports);reopened.render(p);await reopened.settle();reopened.render(p);
  assert(reopened.nodes().some(n=>n.props?.label==='Retry Same Return'));fail=false;
  await reopened.nodes().find(n=>n.props?.label==='Retry Same Return').props.onPress();reopened.render(p);
  assert.equal(calls.length,2);assert.equal(calls[0].requestId,calls[1].requestId);assert.equal(calls[1].items[0].quantity,1);assert.equal(storage.size,0);
});

test('offline collection rapid taps and reopening replay the saved receipt instead of charging twice',async()=>{
  let saved=null,first=true;const calls=[];
  const data={dueAmount:100,totalAmount:100,recordedAmount:0,verifiedAmount:0,pendingVerificationAmount:0,payments:[]};
  const imports={
    'expo-router':{useIsFocused:()=>true},
    '@tanstack/react-query':{useQuery:()=>({data,refetch:async()=>{}}),useQueryClient:()=>({invalidateQueries:async()=>{}})},
    '@/utils/responseData':guards,
    '@/hooks/useProfile':{useProfile:()=>({data:{_id:'PARTNER'}})},
    '@/utils/offlineCollection':{readOfflineCollection:async()=>saved,saveOfflineCollection:async(a,o,v)=>{saved=v;},clearOfflineCollection:async()=>{saved=null;}},
    '@/utils/deliveryView':{collectionAmount:(text,due)=>Number(text)>0&&Number(text)<=due?Number(text):null},
    '@/utils/date':{formatDateTime:()=>''},'./DeliveryQrCollection':{DeliveryQrCollection:'QR'},
    '@/utils/toast':{toast:{success(){}}},
    '@/api/client':{getErrorMessage:e=>e.message,api:{post:async(url,body)=>{calls.push(body);if(first)throw Error('Lost response');return {data:{success:true}};}}},
  };
  const p={orderId:'ORDER'},c=component('../src/components/payments/OrderCollections.tsx',imports);
  c.render(p);await c.settle();c.render(p);c.nodes().find(n=>n.type==='QR').props.onBlocked(false);c.render(p);
  c.nodes().find(n=>n.props?.accessibilityLabel==='Collection amount').props.onChangeText('25.50');c.render(p);
  const record=c.nodes().find(n=>n.props?.label==='Record Collection');
  await Promise.all([record.props.onPress(),record.props.onPress()]);c.render(p);
  assert.equal(calls.length,1);assert.equal(saved.amount,25.5);
  const reopened=component('../src/components/payments/OrderCollections.tsx',imports);reopened.render(p);await reopened.settle();reopened.render(p);
  reopened.nodes().find(n=>n.type==='QR').props.onBlocked(false);reopened.render(p);first=false;
  await reopened.nodes().find(n=>n.props?.label==='Retry Same Collection').props.onPress();reopened.render(p);
  assert.equal(calls.length,2);assert.equal(calls[0].clientRequestId,calls[1].clientRequestId);assert.equal(calls[1].amount,25.5);assert.equal(saved,null);
});

test('QR create with a lost reply reconciles recovery before any other collection, and hidden screens stop polling',async()=>{
  let focused=true,blocked=true,reads=0,statusReads=0,posts=0;const storage=new Map();
  const qr={qrCodeId:'qr_Fixture123',imageUrl:'https://fixture.invalid/qr.png',amount:25};
  const c=component('../src/components/payments/DeliveryQrCollection.tsx',{
    'expo-router':{useIsFocused:()=>focused},'react-native':{ActivityIndicator:'Spinner',AppState:{currentState:'active'},Image:Object.assign(function Image(){},{getSize(){}}),Modal:'Modal',ScrollView:'ScrollView',Text:'Text',View:'View',useWindowDimensions:()=>({width:390,height:844})},
    'expo-secure-store':{getItemAsync:async k=>storage.get(k)||null,setItemAsync:async(k,v)=>{storage.set(k,v);},deleteItemAsync:async k=>storage.delete(k)},
    '@tanstack/react-query':{useQueryClient:()=>({invalidateQueries:async()=>{}})},
    '@/api/client':{getErrorMessage:e=>e.message,api:{get:async url=>{if(url.endsWith('/payment-qr')){reads++;return {data:{qr:posts?qr:null}};}statusReads++;return {data:{paid:false,closed:false}};},post:async()=>{posts++;throw Error('Lost create reply');}}},
    '@/utils/qrPayment':load('../src/utils/qrPayment.ts'),'@/utils/toast':{toast:{success(){}}},
  });
  const p={actorId:'PARTNER',orderId:'ORDER',amountText:'25',dueAmount:100,disabled:false,onBlocked:v=>{blocked=v;},onRecorded(){}};
  c.render(p);await c.settle();c.render(p);assert.equal(blocked,false);
  c.nodes().find(n=>n.props?.label==='Collect using UPI QR').props.onPress();await c.settle();c.render(p);assert.equal(blocked,true);
  await c.settle();c.render(p);assert(reads>=2);assert.equal(posts,1);assert.equal(blocked,true);
  c.nodes().find(n=>String(n.props?.label).startsWith('Resume UPI QR')).props.onPress();await c.settle();c.render(p);assert.equal(posts,1);
  assert.equal(c.intervals.size,1);await c.tick();assert.equal(statusReads,1);
  focused=false;c.render(p);assert.equal(c.intervals.size,0);await c.tick();assert.equal(statusReads,1);
});


test('render recovery exposes a manual retry without leaking diagnostics or auto-submitting actions',async()=>{
 let retries=0;const c=component('../src/components/AppRecovery.tsx');
 const p={error:Error('private diagnostics'),retry:async()=>{retries++;throw Error('still unavailable');}};
 c.render(p);assert.equal(retries,0);assert(!c.text().includes('private diagnostics'));
 await c.nodes().find(n=>n.props?.label==='Reopen screen').props.onPress();c.render(p);
 assert.equal(retries,1);assert.equal(c.nodes().find(n=>n.props?.label==='Reopen screen').props.loading,false);
});
