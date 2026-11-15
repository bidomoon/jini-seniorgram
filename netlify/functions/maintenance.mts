import type {Config} from '@netlify/functions';
import {withRuntime} from '../../server/product/runtime';
import {readiness} from '../../server/product/types';
import {refresh} from '../../server/product/provider';
import {reconcilePlay} from '../../server/billing/play';
import {googlePlayProvider} from '../../server/billing/google';
import {cleanupPrivateData} from '../../server/product/cleanup';
export default async()=>withRuntime(async d=>{
 await cleanupPrivateData(d);
 await reconcilePlay(d,googlePlayProvider(d));
 if(d.env('JOB_SWEEPER_ENABLED')!=='true'||!readiness(d.env).storage)return;
 // Only checks already-submitted work; never creates or retries a paid generation.
 const jobs=(await d.query("SELECT * FROM sg_jobs WHERE state='processing' AND deleted_at IS NULL AND (checked_at IS NULL OR checked_at<now()-interval '90 seconds') ORDER BY checked_at NULLS FIRST LIMIT 3")).rows;
 await Promise.allSettled(jobs.map(j=>refresh(d,j,true)));
});
export const config:Config={schedule:'* * * * *'};
