const test = require('node:test');
const assert = require('node:assert/strict');
// Runs the actual component effects/callbacks with deterministic hooks/timers.
// No WebView, payment provider, native bridge, credentials or network is used.
const {component}=require('./helpers/component.cjs');

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

test('map renderer termination offers manual recovery and hidden screens release the WebView', () => {
  let focused = true;
  const c = component('../src/components/maps/StoreMap.tsx', {
    'expo-router': { useIsFocused: () => focused },
    './mapHtml': { mapHtml: () => '<html></html>' }, './vendor/leaflet': { leafletLicense: 'fixture licence' },
  });
  const props = { points: [{ id: 'S', name: 'Store', latitude: 22, longitude: 88 }], selectedId: 'S', onSelect() {} };
  c.render(props);
  c.nodes().find(node => node.type === 'WebView').props.onRenderProcessGone();
  c.render(props); assert(!c.nodes().some(node => node.type === 'WebView'));
  const retry = c.nodes().find(node => node.type === 'Pressable' && c.text(node).includes('Retry map'));
  assert(retry); retry.props.onPress(); c.render(props);
  assert(c.nodes().some(node => node.type === 'WebView'));
  focused = false; c.render(props); assert(!c.nodes().some(node => node.type === 'WebView'));
  focused = true; c.render(props); assert(c.nodes().some(node => node.type === 'WebView'));
});

test('product preview releases hidden images and follows current screen dimensions', () => {
  let width = 390;
  const c = component('../src/components/products/ProductDetailModal.tsx', {
    'react-native': { View:'View', Text:'Text', Image:'Image', Modal:'Modal', Pressable:'Pressable', ScrollView:'ScrollView', useWindowDimensions: () => ({ width, height: 844 }) },
    '@/utils/pricing': { resolveProductPrice: () => 20 }, '@/utils/uom': { unitForCounting: () => 'packets' },
    '@/utils/htmlToText': { htmlToText: () => '' }, '@/utils/image': { sizedImage: (url, points) => `${url}?width=${points}` },
  });
  const props = { visible:false, product:{ _id:'P', name:'Spice', minOrderQty:10, images:{ front:{url:'https://fixture.invalid/photo'} } }, storeType:'RETAILER', onClose(){}, onAdd(){} };
  assert.equal(c.render(props), null);
  c.render({...props,visible:true});
  let image = c.nodes().find(node => node.type === 'Image'); assert.equal(image.props.style.width,390); assert(image.props.source.uri.endsWith('width=390'));
  width=700; c.render({...props,visible:true}); image=c.nodes().find(node=>node.type==='Image'); assert.equal(image.props.style.width,700);
  c.render(props); assert(!c.nodes().some(node=>node.type==='Image'));
});

test('Payments downloads and pull-refreshes only the selected history, without inventing an unloaded completed count', async () => {
  let dueEnabled, completedEnabled, dueReads=0, completedReads=0;
  const c=component('../app/(tabs)/payments/index.tsx', {
    'expo-router':{useRouter:()=>({})},
    '@/hooks/useOrders':{
      useDueOrders:opts=>{dueEnabled=opts?.enabled;return {data:[],refetch:async()=>{dueReads++;}};},
      useMyOrders:opts=>{completedEnabled=opts?.enabled;return {refetch:async()=>{completedReads++;}};},
    },
    '@/hooks/useStores':{useMyStores:()=>({data:[]})},
    '@/hooks/useInvoiceDownload':{useInvoiceDownload:()=>({})},
    '@/hooks/useVisibleClock':{useVisibleClock:()=>100},
    '@/hooks/usePullToRefresh':{usePullToRefresh:(...reads)=>({pulling:false,onPull:()=>Promise.all(reads.map(read=>read()))})},
    '@/utils/date':{},'@/utils/paymentState':{},'@/utils/image':{},
    '@/utils/paymentList':{paymentBuckets:()=>({due:[],overdue:[],completed:[]}),groupPaymentStores:()=>[],paymentListRows:()=>[]},
  });
  c.render({});assert.equal(dueEnabled,true);assert.equal(completedEnabled,false);
  let tabs=c.nodes().find(node=>node.props?.segments);
  assert.equal(tabs.props.segments.find(s=>s.value==='COMPLETED').count,undefined);
  await c.nodes().find(node=>node.type==='FlatList').props.onRefresh();assert.equal(dueReads,1);assert.equal(completedReads,0);
  tabs.props.onChange('COMPLETED');c.render({});assert.equal(dueEnabled,false);assert.equal(completedEnabled,true);
  await c.nodes().find(node=>node.type==='FlatList').props.onRefresh();assert.equal(dueReads,1);assert.equal(completedReads,1);
});

test('screen recovery never submits anything automatically and a rejected retry remains usable', async () => {
  let attempts=0;
  const c=component('../src/components/AppRecovery.tsx');
  const props={error:new Error('private diagnostic details'),retry:async()=>{attempts++;throw Error('still unavailable');}};
  c.render(props);assert.equal(attempts,0);assert(!c.text().includes('private diagnostic details'));
  await c.nodes().find(node=>node.props?.label==='Reopen screen').props.onPress();c.render(props);
  assert.equal(attempts,1);assert.equal(c.nodes().find(node=>node.props?.label==='Reopen screen').props.loading,false);
});

test('address choices search assigned options and city allows a deliberate custom value', () => {
  const chosen=[];let blurred=0;
  const c=component('../src/components/forms/ChoiceField.tsx',{'@/components/ui/Input':{Input:'Input'}});
  const props={label:'City',value:'',options:['Kolkata','Howrah'],allowCustom:true,onChange:value=>chosen.push(value),onBlur:()=>{blurred++;}};
  c.render(props);c.nodes().find(node=>node.props?.accessibilityLabel==='Select City').props.onPress();c.render(props);
  c.nodes().find(node=>node.type==='Input').props.onChangeText('how');c.render(props);
  let list=c.nodes().find(node=>node.type==='FlatList');assert.equal(list.props.data.length,1);assert.equal(list.props.data[0],'Howrah');
  list.props.renderItem({item:'Howrah'}).props.onPress();c.render(props);assert.deepEqual(chosen,['Howrah']);assert.equal(blurred,1);
  c.nodes().find(node=>node.props?.accessibilityLabel==='Select City').props.onPress();c.render(props);
  c.nodes().find(node=>node.type==='Input').props.onChangeText(' Behala ');c.render(props);
  c.nodes().find(node=>node.props?.label==='Use this city').props.onPress();assert.deepEqual(chosen,['Howrah','Behala']);
  c.render({...props,label:'Pincode',allowCustom:false});assert(!c.nodes().some(node=>node.props?.label==='Use this city'));
});

test('registration state changes clear dependent address fields and failed choice reads retain manual entry', () => {
  const values={state:'WEST BENGAL',city:'Kolkata',pincode:'700001'};
  const coverage={isSuccess:true,data:[{state:'WEST BENGAL',city:'Kolkata',pincodes:['700001']},{state:'BIHAR',city:'Patna',pincodes:['800001']},{state:'BIHAR',city:'Gaya',pincodes:['823001']}]};
  const form={control:{},handleSubmit:fn=>fn,setValue:(key,value)=>{values[key]=value;},getValues:key=>values[key]||'',watch:key=>values[key]||''};
  const c=component('../app/new-store.tsx',{
    'react-hook-form':{useForm:()=>form,Controller:'Controller'},'@hookform/resolvers/zod':{zodResolver:()=>({})},
    'expo-router':{useRouter:()=>({}),useIsFocused:()=>true},
    '@tanstack/react-query':{useQuery:()=>coverage,useQueryClient:()=>({})},
    '@/hooks/useStores':{useCreateStore:()=>({})},'@/api/store.api':{},
    '@/hooks/useLocationCapture':{useLocationCapture:()=>({capturing:false})},
    '@/utils/validators':{createStoreSchema:{}},'@/utils/toast':{},
    '@/utils/coverageChoices':require('../src/utils/coverageChoices.ts'),
  });
  c.render({});
  const state=c.nodes().find(node=>node.type==='Controller'&&node.props.name==='state');
  state.props.render({field:{value:values.state,onBlur(){}},fieldState:{}}).props.onChange('BIHAR');
  assert.deepEqual(values,{state:'BIHAR',city:'',pincode:''});
  values.city='Custom locality';values.pincode='800001';coverage.data=[...coverage.data];c.render({});
  assert.equal(values.city,'Custom locality');assert.equal(values.pincode,'800001');
  coverage.isError=true;coverage.isSuccess=false;c.render({});
  for(const name of ['state','city','pincode'])assert(c.nodes().some(node=>node.type==='FormInput'&&node.props.name===name));
});
