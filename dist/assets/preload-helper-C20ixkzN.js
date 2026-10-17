import{c as i}from"./app-nav-Dgemll-2.js";/**
 * @license lucide-react v1.48.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u={name:"copy",size:24,node:[["rect",{width:"14",height:"14",x:"8",y:"8",rx:"2",ry:"2",key:"17jyea"}],["path",{d:"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",key:"zix9uf"}]]};u.node;const S=i(u);/**
 * @license lucide-react v1.48.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h={name:"ellipsis",size:24,node:[["circle",{cx:"12",cy:"12",r:"1",key:"41hilf"}],["circle",{cx:"19",cy:"12",r:"1",key:"1wjl8i"}],["circle",{cx:"5",cy:"12",r:"1",key:"1pcz8c"}]],aliases:["more-horizontal"]};h.node;const g=i(h);/**
 * @license lucide-react v1.48.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y={name:"shield-alert",size:24,node:[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}],["path",{d:"M12 8v4",key:"1got3b"}],["path",{d:"M12 16h.01",key:"1drbdi"}]]};y.node;const x=i(y),E="modulepreload",v=function(s){return"/"+s},d={},z=function(m,c,_){let a=Promise.resolve();if(c&&c.length>0){document.getElementsByTagName("link");const e=document.querySelector("meta[property=csp-nonce]"),t=(e==null?void 0:e.nonce)||(e==null?void 0:e.getAttribute("nonce"));a=Promise.allSettled(c.map(n=>{if(n=v(n),n in d)return;d[n]=!0;const o=n.endsWith(".css"),f=o?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${n}"]${f}`))return;const r=document.createElement("link");if(r.rel=o?"stylesheet":E,o||(r.as="script"),r.crossOrigin="",r.href=n,t&&r.setAttribute("nonce",t),document.head.appendChild(r),o)return new Promise((p,k)=>{r.addEventListener("load",p),r.addEventListener("error",()=>k(new Error(`Unable to preload CSS for ${n}`)))})}))}function l(e){const t=new Event("vite:preloadError",{cancelable:!0});if(t.payload=e,window.dispatchEvent(t),!t.defaultPrevented)throw e}return a.then(e=>{for(const t of e||[])t.status==="rejected"&&l(t.reason);return m().catch(l)})};export{S as C,g as E,x as S,z as _};
