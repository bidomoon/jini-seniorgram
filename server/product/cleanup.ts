import {Dependencies,readiness} from './types';

export async function cleanupPrivateData(d:Dependencies){
 const result={removedFiles:0,failedFiles:0};
 if(!readiness(d.env).database)return result;
 // Erasing private media must work even when AI generation, polling or media
 // creation is disabled. Entries are removed only after storage confirms deletion.
 const files=(await d.query('SELECT object_key FROM sg_file_deletions ORDER BY created_at LIMIT 10')).rows;
 for(const file of files){
  try{
   await d.files.delete(file.object_key);
   await d.query('DELETE FROM sg_file_deletions WHERE object_key=$1',[file.object_key]);
   result.removedFiles++;
  }catch{result.failedFiles++} // Keep the durable retry entry; never log private keys.
 }
 await d.query('DELETE FROM sg_sessions WHERE expires_at<=now()');
 await d.query('DELETE FROM sg_oauth_states WHERE expires_at<=now()');
 return result;
}
