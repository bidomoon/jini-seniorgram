import type {Config} from '@netlify/functions';
import {withRuntime} from '../../server/product/runtime';
import {readiness} from '../../server/product/types';
import {refresh} from '../../server/product/provider';
export default async()=>withRuntime(async d=>{
 if(d.env('JOB_SWEEPER_ENABLED')!=='true'||!readiness(d.env).storage)return;
 // Only checks already-submitted work; never creates or retries a paid generation.
 const jobs=(await d.query("SELECT * FROM sg_jobs WHERE state='processing' AND deleted_at IS NULL AND (checked_at IS NULL OR checked_at<now()-interval '90 seconds') ORDER BY checked_at NULLS FIRST LIMIT 3")).rows;
 await Promise.allSettled(jobs.map(j=>refresh(d,j,true)));
 const files=(await d.query('SELECT object_key FROM sg_file_deletions ORDER BY created_at LIMIT 10')).rows;
 for(const file of files){try{await d.files.delete(file.object_key);await d.query('DELETE FROM sg_file_deletions WHERE object_key=$1',[file.object_key])}catch{/* durable retry queue; never log file keys or member details */}}
 await d.query('DELETE FROM sg_sessions WHERE expires_at<now()');await d.query('DELETE FROM sg_oauth_states WHERE expires_at<now()');
});
export const config:Config={schedule:'* * * * *'};
