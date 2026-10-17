var S=Object.defineProperty;var B=(o,e,t)=>e in o?S(o,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):o[e]=t;var d=(o,e,t)=>B(o,typeof e!="symbol"?e+"":e,t);import{c}from"./app-nav-D1o25_zt.js";/**
 * @license lucide-react v1.48.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const b={name:"activity",size:24,node:[["path",{d:"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2",key:"169zse"}]]};b.node;const O=c(b);/**
 * @license lucide-react v1.48.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const I={name:"ban",size:24,node:[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M4.929 4.929 19.07 19.071",key:"196cmz"}]]};I.node;const x=c(I);/**
 * @license lucide-react v1.48.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const U={name:"check",size:24,node:[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]]};U.node;const z=c(U);/**
 * @license lucide-react v1.48.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g={name:"circle-x",size:24,node:[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m15 9-6 6",key:"1uzhvr"}],["path",{d:"m9 9 6 6",key:"z0biqf"}]],aliases:["x-circle"]};g.node;const D=c(g);/**
 * @license lucide-react v1.48.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const T={name:"clock",size:24,node:[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 6v6l4 2",key:"mmk7yg"}]]};T.node;const A=c(T);/**
 * @license lucide-react v1.48.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k={name:"refresh-cw",size:24,node:[["path",{d:"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",key:"v9h5vc"}],["path",{d:"M21 3v5h-5",key:"1q7to0"}],["path",{d:"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",key:"3uifl3"}],["path",{d:"M8 16H3v5",key:"1cv678"}]]};k.node;const L=c(k);/**
 * @license lucide-react v1.48.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const E={name:"shopping-cart",size:24,node:[["path",{d:"m2.05 2.05 1.099-.028a1 1 0 0 1 1.008.815l2.69 14.347A1 1 0 0 0 7.83 18H18",key:"uebgi3"}],["path",{d:"M4.563 5h16.435a1 1 0 0 1 .981 1.204l-1.026 6.226A2 2 0 0 1 18.962 14H6.25",key:"1j7c9p"}],["circle",{cx:"18",cy:"20",r:"2",key:"t9985n"}],["circle",{cx:"8",cy:"20",r:"2",key:"ckkr5m"}]]};E.node;const j=c(E);/**
 * @license lucide-react v1.48.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $={name:"triangle-alert",size:24,node:[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",key:"wmoenq"}],["path",{d:"M12 9v4",key:"juzpu7"}],["path",{d:"M12 17h.01",key:"p32p05"}]],aliases:["alert-triangle"]};$.node;const H=c($);/**
 * @license lucide-react v1.48.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const P={name:"x",size:24,node:[["path",{d:"M18 6 6 18",key:"1bl5f8"}],["path",{d:"m6 6 12 12",key:"d8bk6v"}]]};P.node;const q=c(P);class m extends Error{constructor(t,n,i){super(n);d(this,"status");d(this,"body");this.name="HonbaApiError",this.status=t,this.body=i}}function s(o,e,t){const n=typeof location<"u"?location.origin:"http://localhost",i=new URL(`${o.replace(/\/$/,"")}${e}`,n);if(t)for(const[l,r]of Object.entries(t))r!=null&&i.searchParams.set(l,String(r));return i.toString()}async function a(o,e,t,n={}){const i={Accept:"application/json",...n.headers};let l;n.body!==void 0&&(i["Content-Type"]="application/json",l=JSON.stringify(n.body));const r=await o(t,{method:e,headers:i,body:l,signal:n.signal});if(!r.ok){let p;try{p=await r.json()}catch{p=void 0}throw new m(r.status,`${e} ${t} failed with ${r.status}`,p)}return await r.json()}async function*_(o,e,t,n,i){const l=s(e,`/backtests/${encodeURIComponent(t)}/events`,n),r=await o(l,{headers:{Accept:"text/event-stream"},signal:i});if(!r.ok)throw new m(r.status,`GET ${l} failed with ${r.status}`);if(!r.body)throw new m(r.status,"stream response has no body");const p=r.body.getReader(),G=new TextDecoder;let h="";for(;;){const{value:v,done:w}=await p.read();if(w)break;h+=G.decode(v,{stream:!0});let y=h.indexOf(`

`);for(;y>=0;){const C=h.slice(0,y);h=h.slice(y+2);const u=C.split(`
`).filter(f=>f.startsWith("data:")).map(f=>f.slice(5).trim()).join(`
`);u.length>0&&(yield JSON.parse(u)),y=h.indexOf(`

`)}}}class J{constructor(e={}){d(this,"baseUrl");d(this,"fetchImpl");this.baseUrl=e.baseUrl??"/api/v1",this.fetchImpl=e.fetch??globalThis.fetch}async postBacktests(e,t){return a(this.fetchImpl,"POST",s(this.baseUrl,"/backtests"),{body:e,signal:t})}async getBacktestsById(e,t){return a(this.fetchImpl,"GET",s(this.baseUrl,`/backtests/${encodeURIComponent(e)}`),{signal:t})}streamBacktestEvents(e,t,n){return _(this.fetchImpl,this.baseUrl,e,t,n)}async getBacktestsByIdJournal(e,t){return a(this.fetchImpl,"GET",s(this.baseUrl,`/backtests/${encodeURIComponent(e)}/journal`),{signal:t})}async postBars(e,t){return a(this.fetchImpl,"POST",s(this.baseUrl,"/bars"),{body:e,signal:t})}async getBarsById(e,t,n){return a(this.fetchImpl,"GET",s(this.baseUrl,`/bars/${encodeURIComponent(e)}`,t),{signal:n})}async getCapabilities(e){return a(this.fetchImpl,"GET",s(this.baseUrl,"/capabilities"),{signal:e})}async getDepthById(e,t,n){return a(this.fetchImpl,"GET",s(this.baseUrl,`/depth/${encodeURIComponent(e)}`,t),{signal:n})}async getHealth(e){return a(this.fetchImpl,"GET",s(this.baseUrl,"/health"),{signal:e})}async getInstruments(e,t){return a(this.fetchImpl,"GET",s(this.baseUrl,"/instruments",e),{signal:t})}async getInstrumentsById(e,t){return a(this.fetchImpl,"GET",s(this.baseUrl,`/instruments/${encodeURIComponent(e)}`),{signal:t})}async getJournalsById(e,t){return a(this.fetchImpl,"GET",s(this.baseUrl,`/journals/${encodeURIComponent(e)}`),{signal:t})}async getOrders(e,t){return a(this.fetchImpl,"GET",s(this.baseUrl,"/orders",e),{signal:t})}async postOrders(e,t){return a(this.fetchImpl,"POST",s(this.baseUrl,"/orders"),{body:e,signal:t})}async deleteOrdersById(e,t){return a(this.fetchImpl,"DELETE",s(this.baseUrl,`/orders/${encodeURIComponent(e)}`),{signal:t})}async getPortfolio(e){return a(this.fetchImpl,"GET",s(this.baseUrl,"/portfolio"),{signal:e})}async getPortfolioAccounts(e){return a(this.fetchImpl,"GET",s(this.baseUrl,"/portfolio/accounts"),{signal:e})}async getPortfolioHoldings(e){return a(this.fetchImpl,"GET",s(this.baseUrl,"/portfolio/holdings"),{signal:e})}async getPortfolioPositions(e){return a(this.fetchImpl,"GET",s(this.baseUrl,"/portfolio/positions"),{signal:e})}async getPortfolioTrades(e){return a(this.fetchImpl,"GET",s(this.baseUrl,"/portfolio/trades"),{signal:e})}async postPositionsClose(e){return a(this.fetchImpl,"POST",s(this.baseUrl,"/positions/close"),{signal:e})}async getProfile(e){return a(this.fetchImpl,"GET",s(this.baseUrl,"/profile"),{signal:e})}async putProfile(e,t){return a(this.fetchImpl,"PUT",s(this.baseUrl,"/profile"),{body:e,signal:t})}async getProfileLayouts(e){return a(this.fetchImpl,"GET",s(this.baseUrl,"/profile/layouts"),{signal:e})}async deleteProfileLayoutsByName(e,t){return a(this.fetchImpl,"DELETE",s(this.baseUrl,`/profile/layouts/${encodeURIComponent(e)}`),{signal:t})}async putProfileLayoutsByName(e,t,n){return a(this.fetchImpl,"PUT",s(this.baseUrl,`/profile/layouts/${encodeURIComponent(e)}`),{body:t,signal:n})}async getProfileModules(e){return a(this.fetchImpl,"GET",s(this.baseUrl,"/profile/modules"),{signal:e})}async deleteProfileModulesById(e,t){return a(this.fetchImpl,"DELETE",s(this.baseUrl,`/profile/modules/${encodeURIComponent(e)}`),{signal:t})}async putProfileModulesById(e,t,n){return a(this.fetchImpl,"PUT",s(this.baseUrl,`/profile/modules/${encodeURIComponent(e)}`),{body:t,signal:n})}async getQuotes(e,t){return a(this.fetchImpl,"GET",s(this.baseUrl,"/quotes",e),{signal:t})}async getSchema(e){return a(this.fetchImpl,"GET",s(this.baseUrl,"/schema"),{signal:e})}async getScreenerScan(e,t){return a(this.fetchImpl,"GET",s(this.baseUrl,"/screener/scan",e),{signal:t})}async getStrategies(e){return a(this.fetchImpl,"GET",s(this.baseUrl,"/strategies"),{signal:e})}async postStrategies(e,t){return a(this.fetchImpl,"POST",s(this.baseUrl,"/strategies"),{body:e,signal:t})}async postStrategiesVerify(e,t){return a(this.fetchImpl,"POST",s(this.baseUrl,"/strategies/verify"),{body:e,signal:t})}async postSweeps(e,t){return a(this.fetchImpl,"POST",s(this.baseUrl,"/sweeps"),{body:e,signal:t})}async getSweepsById(e,t){return a(this.fetchImpl,"GET",s(this.baseUrl,`/sweeps/${encodeURIComponent(e)}`),{signal:t})}async getTradingState(e){return a(this.fetchImpl,"GET",s(this.baseUrl,"/trading-state"),{signal:e})}async putTradingState(e,t){return a(this.fetchImpl,"PUT",s(this.baseUrl,"/trading-state"),{body:e,signal:t})}}export{O as A,x as B,D as C,J as H,L as R,j as S,H as T,q as X,A as a,z as b};
