import type {Config} from '@netlify/functions';
import {commerce} from '../../server/commerce/handler';
import {database} from '../../server/commerce/db';
export default async (request:Request)=>{
 let pool:ReturnType<typeof database>|undefined;
 try{return await commerce(request,{env:key=>Netlify.env.get(key),fetch,query:async(sql,values)=>{
  const url=Netlify.env.get('DATABASE_URL');if(!url)throw Error('DATABASE_NOT_CONFIGURED');
  pool??=database(url);return pool.query(sql,values);
 }})}finally{if(pool)await pool.end()}
};
export const config:Config={path:['/api/account/*','/api/auth/*','/api/billing/*']};
