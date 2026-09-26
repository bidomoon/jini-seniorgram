import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
export function randomToken(){return randomBytes(32).toString('base64url')}
export function hashToken(value:string){return createHash('sha256').update(value).digest('hex')}
export function same(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length>0&&x.length===y.length&&timingSafeEqual(x,y)}
export function cookieValue(request:Request,name:string){const v=(request.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1)||'';return /^[A-Za-z0-9_-]{43}$/.test(v)?v:''}
export function cookie(name:string,value:string,maxAge:number){return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`}
export function allowedOrigin(request:Request,origin:string){return request.headers.get('origin')===origin}
export function trustedOrigin(value:string|undefined){if(!value)return null;try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash?u.origin:null}catch{return null}}
export function safePaymentURL(value:unknown){if(typeof value!=='string')return null;try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['online-payment.kakaopay.com','mockup-pg-web.kakao.com'].includes(u.hostname)?u.href:null}catch{return null}}
export async function readBody(request:Request){if(!request.headers.get('content-type')?.startsWith('application/json'))throw Error('JSON_REQUIRED');const reader=request.body?.getReader();let text='';if(reader){const decoder=new TextDecoder();let bytes=0;while(true){const r=await reader.read();if(r.done)break;bytes+=r.value.length;if(bytes>8192){await reader.cancel();throw Error('BODY_TOO_LARGE')}text+=decoder.decode(r.value,{stream:true})}text+=decoder.decode()}return JSON.parse(text||'{}')}
