import type {Dependencies} from '../product/types';

// Opening the OAuth provider is separate from opening membership to the public.
// A malformed or empty beta list must never silently allow everyone to sign up.
export function admission(env:Dependencies['env']){
 if(env('KAKAO_PUBLIC_SIGNUP_ENABLED')==='true')return {mode:'public' as const,allows:(_id:string)=>true};
 const raw=env('KAKAO_BETA_USER_IDS')||'',ids=raw.split(',').map(x=>x.trim());
 const valid=ids.length<=100&&ids.every(id=>/^[1-9]\d{0,15}$/.test(id)&&Number.isSafeInteger(Number(id)));
 const allowed=new Set(valid?ids:[]);
 return {mode:allowed.size?'beta' as const:'closed' as const,allows:(id:string)=>allowed.has(id)};
}
