export type Query = (sql:string, values?:unknown[])=>Promise<{rows:any[]}>;
export type Files = {
 put:(key:string,bytes:Uint8Array,type:string)=>Promise<void>;
 get:(key:string)=>Promise<ArrayBuffer|null>;
 delete:(key:string)=>Promise<void>;
};
export type Dependencies = {
 env:(key:string)=>string|undefined;
 query:Query;
 transaction:<T>(fn:(query:Query)=>Promise<T>)=>Promise<T>;
 fetch:typeof fetch;
 files:Files;
};
export class ProductError extends Error {constructor(message:string,public status=400){super(message)}}
export const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export const koreanDay=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
export function readiness(env:Dependencies['env']){
 const database=!!env('DATABASE_URL')&&env('PRODUCT_SCHEMA_VERSION')==='3';
 const storage=database&&env('MEDIA_STORAGE_ENABLED')==='true';
 const limit=(key:string)=>/^[1-9]\d{0,4}$/.test(env(key)||'')&&Number(env(key))<=10000;
 const imageReady=storage&&!!env('OPENAI_API_KEY')&&env('GENERATION_ENABLED')==='true'&&limit('GENERATION_DAILY_LIMIT');
 return {database,storage,imageReady,videoReady:storage&&!!env('OPENAI_API_KEY')&&!!env('GEMINI_API_KEY')&&env('VIDEO_GENERATION_ENABLED')==='true'&&limit('VIDEO_DAILY_LIMIT'),communityReady:storage&&!!env('OPENAI_API_KEY')&&env('COMMUNITY_ENABLED')==='true',trialAvailable:imageReady&&env('TRIAL_ENABLED')==='true'};
}
