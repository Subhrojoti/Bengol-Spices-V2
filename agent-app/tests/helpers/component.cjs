const fs=require('node:fs'), vm=require('node:vm'), ts=require('typescript'), path=require('node:path');
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
  const native={ KeyboardAvoidingView:'KeyboardAvoidingView', Platform:{OS:'android'}, Image, useWindowDimensions:()=>({width:390,height:844}), FlatList:'FlatList', Modal:'Modal', View:'View',Text:'Text',Pressable:'Pressable',ActivityIndicator:'Spinner',ScrollView:'ScrollView' };
  const source=ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '..', relative),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
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
module.exports={component};
