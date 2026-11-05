const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Runs the actual component effects/callbacks with deterministic hooks/timers.
// No WebView, payment provider, native bridge, credentials or network is used.
function component(relative, extra = {}) {
  let cursor = 0, dirty = false, effects = [], tree;
  const slots = [], intervals = new Map(), timeouts = new Map(), images = [];
  let timer = 0;
  const same = (a,b) => a && b && a.length === b.length && a.every((v,i) => Object.is(v,b[i]));
  const react = {
    useState(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial }; const slot = slots[index]; return [slot.value, value => { const next = typeof value === 'function' ? value(slot.value) : value; if (!Object.is(next,slot.value)) { slot.value=next;dirty=true; } }]; },
    useRef(initial) { const index = cursor++; if (!slots[index]) slots[index] = { current: initial }; return slots[index]; },
    useMemo(factory,deps) { const index=cursor++;const previous=slots[index];if(!previous||!same(previous.deps,deps))slots[index]={deps,value:factory()};return slots[index].value; },
    useCallback(fn,deps) { return react.useMemo(()=>fn,deps); },
    useEffect(effect,deps) { const index=cursor++; const previous=slots[index]; if (!previous || !same(previous.deps,deps)) { slots[index]={deps};effects.push(()=>{previous?.cleanup?.();slots[index].cleanup=effect();}); } },
  };
  const Image = Object.assign(function Image(){}, { getSize(url, success) { images.push({url,success}); } });
  const native={ Image, useWindowDimensions:()=>({width:390,height:844}), FlatList:'FlatList', Modal:'Modal', View:'View',Text:'Text',Pressable:'Pressable',ActivityIndicator:'Spinner',ScrollView:'ScrollView' };
  const source=ts.transpileModule(fs.readFileSync(require.resolve(relative),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const module={exports:{}};
  vm.runInNewContext(source,{
    module,exports:module.exports,Promise,...extra.__globals,
    setInterval(fn){intervals.set(++timer,fn);return timer;},clearInterval(id){intervals.delete(id);},
    setTimeout(fn){timeouts.set(++timer,fn);return timer;},clearTimeout(id){timeouts.delete(id);},
    require(name){
      if (extra[name])return extra[name];
      if(name==='react')return react;
      if(name==='react/jsx-runtime')return require('react/jsx-runtime');
      if(name==='react-native')return native;
      if(name==='react-native-safe-area-context')return {SafeAreaView:'SafeAreaView'};
      if(name==='react-native-webview')return {WebView:'WebView'};
      if(name==='lucide-react-native')return new Proxy({}, {get:(_,key)=>key});
      if(name==='@/components/ui/Button')return {Button:'Button'};
      if(name.startsWith('@/components/'))return new Proxy({}, {get:(_,key)=>key});
      if(name==='@/utils/currency')return {formatCurrency:n=>String(n)};
      if(name==='@/api/client')return {getErrorMessage:e=>e.message};
      if(name==='@/theme/colors')return {colors:new Proxy({}, {get:()=>({})})};
      throw Error('Unexpected import '+name);
    },
  });
  const Component=Object.values(module.exports)[0];
  const render=props=>{let count=0;do{dirty=false;cursor=0;effects=[];tree=Component(props);effects.forEach(fn=>fn());if(++count>10)throw Error('Render loop');}while(dirty);return tree;};
  const nodesOf=node=>!node||typeof node!=='object'?[]:[node,...[node.props?.children,node.props?.ListHeaderComponent,node.props?.ListFooterComponent].flat(Infinity).flatMap(n=>nodesOf(n))];
  const textOf=node=>!node?'':typeof node==='string'?node:typeof node!=='object'?'':[node.props?.children].flat(Infinity).map(n=>textOf(n)).join(' ');
  const nodes=(node=tree)=>nodesOf(node),text=(node=tree)=>textOf(node);
  const settle=()=>new Promise(resolve=>setImmediate(resolve));
  return {render,nodes,text,images,Image,intervals, async tick(){for(const fn of [...intervals.values()])await fn();await settle();},async confirm(){const pending=[...timeouts.values()];timeouts.clear();pending.forEach(fn=>fn());await settle();},settle};
}
const qrProps=(id,onPaid)=>({visible:true,qrCodeId:id,imageUrl:'https://fixture.invalid/'+id,amount:25,onClose(){},onPaid});

test('delayed QR A confirmation keeps its original callback after QR B replaces the screen', async()=>{
  const calls=[];
  const c=component('../src/components/payments/QrPaymentModal.tsx',{'@/api/order.api':{orderApi:{checkQrPaymentStatus:async()=>({paid:true,status:'closed'})}}});
  c.render(qrProps('qr_A',async()=>{calls.push('A');return true;}));
  await c.tick();
  const b=qrProps('qr_B',async()=>{calls.push('B');return true;});c.render(b);
  await c.confirm();c.render(b);
  assert.deepEqual(calls,['A']);assert(!c.text().includes('Payment Received'));
});

for(const method of ['QR','ONLINE'])test(`${method} initial payment verifies the original cart and advance after the form changes`,async()=>{
  const verified=[];
  const api={
    createInitialPaymentQr:async()=>({qrCodeId:'qr_original',imageUrl:'https://fixture.invalid/qr.png',amount:10}),
    createInitialPayment:async()=>({razorpayOrderId:'order_original',key:'test_fixture',amount:1000}),
    verifyQrAndPlaceOrder:async(id,amount,payload)=>{verified.push(payload);return {orderId:'PLACED'};},
    verifyInitialPaymentAndPlaceOrder:async fields=>{verified.push(fields.orderPayload);return {orderId:'PLACED'};},
  };
  const c=component('../app/(tabs)/stores/[consumerId]/create-order.tsx',{
    'expo-router':{useLocalSearchParams:()=>({consumerId:'S',storeType:'RETAILER'}),useRouter:()=>({canGoBack:()=>false,push(){}})},
    '@tanstack/react-query':{useQueryClient:()=>({invalidateQueries(){}})},
    '@/hooks/useCatalog':{},'@/hooks/useOrders':{usePlaceOrder:()=>({}),useRefreshAfterOrderActivity:()=>()=>{}},
    '@/api/order.api':{orderApi:api},'@/utils/paymentAmount':{advancePaymentAmount:t=>Number(t)},
    '@/utils/pricing':{resolveProductPrice:()=>20,isLocationPrice:()=>false},'@/utils/uom':{unitForCounting:()=> 'packets'},
    '@/utils/image':{sizedImage:x=>x},'@/utils/requestId':{newRequestId:()=> 'synthetic_request_reference'},
    '@/api/client':{getErrorMessage:e=>e.message,isRetryableFailure:()=>false,isSettledPaymentFailure:()=>false},
    '@/utils/toast':{toast:{success(){},error(title,message){throw Error(title+message);}}},
  });
  c.render({});
  c.nodes().find(n=>n.type?.name==='ProductPickerModal').props.onSelect({_id:'P',name:'Spice',uom:'packet',minOrderQty:10});c.render({});
  c.nodes().find(n=>n.props?.label==='Advance to Collect Now').props.onChangeText('10');
  c.nodes().find(n=>Array.isArray(n.props?.segments)).props.onChange(method);c.render({});
  await c.nodes().find(n=>n.props?.label===(method==='QR'?'Generate QR Code':'Pay & Place Order')).props.onPress();c.render({});
  const list=c.nodes().find(n=>n.type==='FlatList');const cartLine=list.props.renderItem({item:list.props.data[0],index:0});
  c.nodes(cartLine).find(n=>n.type==='QuantityStepper').props.onChange(11);
  c.nodes().find(n=>n.props?.label==='Advance to Collect Now').props.onChangeText('20');c.render({});
  if(method==='QR')await c.nodes().find(n=>n.type==='QrPaymentModal').props.onPaid();
  else await c.nodes().find(n=>n.type==='RazorpayCheckout').props.onSuccess({razorpay_order_id:'order_original',razorpay_payment_id:'pay_original',razorpay_signature:'signature'});
  assert.equal(verified.length,1);assert.equal(verified[0].products[0].quantity,10);assert.equal(verified[0].paidAmount,10);
});

test('paid QR hide/reopen and rapid retry clicks cannot overlap or switch the recorded callback',async()=>{
  let complete, calls=0, newCalls=0;
  const c=component('../src/components/payments/QrPaymentModal.tsx',{'@/api/order.api':{orderApi:{checkQrPaymentStatus:async()=>({paid:true,status:'closed'})}}});
  const a=qrProps('qr_A',()=>{calls++;return calls===1?new Promise(resolve=>{complete=resolve;}):Promise.resolve(true);});
  c.render(a);await c.tick();await c.confirm();assert.equal(calls,1);
  c.render({...a,visible:false});const reopened={...a,onPaid:async()=>{newCalls++;return true;}};c.render(reopened);
  await c.tick();assert.equal(calls,1);
  complete(false);await c.settle();c.render(reopened);
  const retry=c.nodes().find(n=>n.props?.label==='Try again');assert(retry);
  retry.props.onPress();retry.props.onPress();await c.settle();c.render(reopened);
  assert.equal(calls,2);assert.equal(newCalls,0);
});

test('an unpaid closed QR stops polling and explains expiration instead of waiting forever',async()=>{
  const c=component('../src/components/payments/QrPaymentModal.tsx',{'@/api/order.api':{orderApi:{checkQrPaymentStatus:async()=>({paid:false,status:'closed'})}}});
  const p=qrProps('qr_A',async()=>{throw Error('Unpaid QR must not record a collection');});
  c.render(p);await c.tick();c.render(p);
  assert.equal(c.intervals.size,0);assert.match(c.text(),/expired or closed without payment/);
});

test('a late image-size result from a previous QR cannot distort the current QR',()=>{
  const c=component('../src/components/payments/QrPaymentModal.tsx',{'@/api/order.api':{orderApi:{}}});
  c.render(qrProps('qr_A',async()=>true));const old=c.images[0];
  const next=qrProps('qr_B',async()=>true);c.render(next);old.success(100,10);c.render(next);
  assert.equal(c.nodes().find(n=>n.type===c.Image).props.style.aspectRatio,0.56);
  c.images[1].success(100,200);c.render(next);assert.equal(c.nodes().find(n=>n.type===c.Image).props.style.aspectRatio,0.5);
});

test('checkout rejects malformed/wrong-order messages and handles duplicate success only once per session',()=>{
  const c=component('../src/components/payments/RazorpayCheckout.tsx');let calls=0;
  const p={visible:true,orderId:'order_A',amountInPaise:2500,keyId:'test_fixture',onSuccess(){calls++;},onDismiss(){}};
  const send=value=>c.nodes().find(n=>n.type==='WebView').props.onMessage({nativeEvent:{data:JSON.stringify(value)}});
  c.render(p);
  send({type:'success',razorpay_order_id:'order_B',razorpay_payment_id:'pay_A',razorpay_signature:'signature'});
  send({type:'success',razorpay_order_id:'order_A',razorpay_payment_id:'pay_A'});assert.equal(calls,0);
  const success={type:'success',razorpay_order_id:'order_A',razorpay_payment_id:'pay_A',razorpay_signature:'signature'};
  send(success);send(success);assert.equal(calls,1);
  c.render({...p,orderId:'order_B'});send({...success,razorpay_order_id:'order_B'});assert.equal(calls,2);
});

test('the overdue clock refreshes on resume and releases its timer when Payments loses focus',async()=>{
  let now=100, focus, resume, removed=0;
  const AppState={currentState:'active',addEventListener(event,fn){resume=fn;return {remove(){removed++;}};}};
  const c=component('../src/hooks/useVisibleClock.ts',{'react-native':{AppState},'expo-router':{useFocusEffect(fn){focus=fn;}},__globals:{Date:{now:()=>now}}});
  assert.equal(c.render({}),100);now=200;const cleanup=focus();assert.equal(c.render({}),200);
  AppState.currentState='background';now=300;await c.tick();assert.equal(c.render({}),200);
  AppState.currentState='active';now=400;resume('active');assert.equal(c.render({}),400);
  cleanup();assert.equal(c.intervals.size,0);assert.equal(removed,1);
});
