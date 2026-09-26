import type {Config} from '@netlify/functions';
import {product} from '../../server/product/handler';
import {withRuntime} from '../../server/product/runtime';
export default async(request:Request)=>withRuntime(d=>product(request,d));
export const config:Config={path:['/api/sg/*','/api/account/usage','/api/account/trial','/api/account/delete','/api/account/feedback','/api/admin/*']};
