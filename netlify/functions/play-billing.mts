import type {Config} from '@netlify/functions';
import {withRuntime} from '../../server/product/runtime';
import {playBilling} from '../../server/billing/handler';
import {googlePlayProvider} from '../../server/billing/google';
export default async(request:Request)=>withRuntime(d=>playBilling(request,d,googlePlayProvider(d)));
export const config:Config={path:'/api/billing/play/*',rateLimit:{action:'rate_limit',aggregateBy:['ip','domain'],windowLimit:120,windowSize:60}};
