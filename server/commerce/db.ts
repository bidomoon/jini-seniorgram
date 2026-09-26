import {Pool} from 'pg';
export function database(url:string){return new Pool({connectionString:url,max:2,connectionTimeoutMillis:5000,idleTimeoutMillis:1000,query_timeout:10000})}
