import {getStore} from '@netlify/blobs';
import {database} from '../commerce/db';
import {Dependencies,Query} from './types';
export async function withRuntime<T>(fn:(d:Dependencies)=>Promise<T>):Promise<T>{
 let pool:ReturnType<typeof database>|undefined;
 const getPool=()=>{const url=Netlify.env.get('DATABASE_URL');if(!url)throw Error('DATABASE_NOT_CONFIGURED');return pool??=database(url)};
 const store=()=>getStore({name:'seniorgram-media',consistency:'strong'});
 const d:Dependencies={env:key=>Netlify.env.get(key),fetch,
  query:async(sql,values)=>getPool().query(sql,values),
  transaction:async fn=>{const client=await getPool().connect();try{await client.query('BEGIN');const q:Query=(sql,values)=>client.query(sql,values);const value=await fn(q);await client.query('COMMIT');return value}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}},
  playCredentials:async()=>{
   // Fixed server-only key in a separate store; no route accepts or serves its name.
   const bytes=await getStore({name:'seniorgram-private',consistency:'strong'}).get('play-service-account',{type:'arrayBuffer'});
   if(!bytes||bytes.byteLength>16384)throw Error('PLAY_CREDENTIALS_UNAVAILABLE');
   const value=JSON.parse(new TextDecoder().decode(bytes));
   if(value.type!=='service_account'||typeof value.client_email!=='string'||!value.client_email.endsWith('.iam.gserviceaccount.com')||typeof value.private_key!=='string'||!value.private_key.startsWith('-----BEGIN PRIVATE KEY-----')||value.private_key.length>8192)throw Error('PLAY_CREDENTIALS_UNAVAILABLE');
   return {email:value.client_email,privateKey:value.private_key};
  },
  files:{put:async(key,bytes,type)=>{await store().set(key,new Blob([new Uint8Array(bytes)]),{metadata:{contentType:type}})},get:key=>store().get(key,{type:'arrayBuffer'}),delete:async key=>{await store().delete(key)}}};
 try{return await fn(d)}finally{if(pool)await pool.end()}
}
