import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,realpathSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import browserCheck from '../../verification/check_context_review.cjs';

test('browser runner reports checkout HEAD separately from unpacked source provenance', t=>{
 const {sourceProvenance}=browserCheck;
 const folder=realpathSync(mkdtempSync(join(tmpdir(),'context-browser-')));
 t.after(()=>rmSync(folder,{recursive:true,force:true}));
 const unknown={commit:'UNKNOWN',source_provenance:'unknown'};
 const head='a'.repeat(40);
 assert.deepEqual(sourceProvenance(folder),unknown);
 assert.deepEqual(sourceProvenance(folder,()=>({status:null})),unknown);
 assert.deepEqual(sourceProvenance(folder,()=>({status:0,stdout:`${tmpdir()}\n${head}\n`})),unknown);
 assert.deepEqual(sourceProvenance(folder,()=>({status:0,stdout:`${folder}\n${head}\n`})),{commit:head,source_provenance:'git_head_only'});
});
