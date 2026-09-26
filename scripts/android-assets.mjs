import {copyFile,mkdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const out=new URL('android/app/src/main/res/drawable/',root);
await mkdir(out,{recursive:true});
await copyFile(new URL('public/studio/assets/icon-512.png',root),new URL('app_icon.png',out));
console.log('Existing Seniorgram app icon copied for the Android build.');
