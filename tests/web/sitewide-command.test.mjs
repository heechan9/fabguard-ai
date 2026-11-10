import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import * as robotCore from '../../web/robot/window-core.mjs';
import {parseCSV} from '../../web/equipment/contract.mjs';
import {normalizePagePath,navigationKey,navigationHref} from '../../web/site-shell.mjs';
const require=createRequire(import.meta.url);
const {documents,hashViews,canonicalPath,renderedAudit,semanticWindowCSV}=require('../../verification/check_sitewide_command.cjs');
const root=new URL('../../web/',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');
function htmlFiles(directory=root,prefix=''){
 return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?htmlFiles(new URL(entry.name+'/',directory),prefix+entry.name+'/'):entry.name.endsWith('.html')?[prefix+entry.name]:[]).sort();
}
test('all-page audit inventories every HTML document and every retained root view',()=>{
 assert.equal(documents.length,12);
 assert.deepEqual(documents.map(d=>d.file).sort(),htmlFiles());
 assert.deepEqual(hashViews.map(d=>d.name),['summary','global','risks','limitations','detail']);
 assert.deepEqual(documents.filter(d=>d.english).map(d=>d.name).sort(),['oht','overview','review']);
 assert.deepEqual(documents.filter(d=>d.nativeTheme).map(d=>d.file),['research/index.html']);
});
test('every HTML document loads the final command stylesheet and one complete shared navigation',()=>{
 for(const {file,nativeTheme} of documents){
  const html=read(file),head=html.split('</head>')[0];
  assert.match(html,/<body[^>]*class="[^"]*\bcommand-shell\b/,file);
  assert.match(html,/<html[^>]*data-default-theme="dark"/,file);
  const styles=[...head.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(styles.slice(-2),['/command-center.css','/sitewide-command.css'],file);
  assert.equal((html.match(/class="topbar"/g)||[]).length,1,file);
  const nav=html.match(/<nav class="cc-navigation"[^>]*>([\s\S]*?)<\/nav>/)?.[1];assert.ok(nav,file);
  const primary=nav.split('<details')[0];assert.equal((primary.match(/<a\b/g)||[]).length,4,file);
  assert.match(nav,/<details class="cc-more"><summary>/,file);
  const links=[...nav.matchAll(/href="([^"]+)"/g)].map(m=>m[1]);
  for(const target of documents)assert.ok(links.some(h=>canonicalPath(h)===canonicalPath(target.route)),`${file} links to ${target.file}`);
  if(nativeTheme){
   assert.doesNotMatch(html,/<script\b|\bscript-src\b/i);
   assert.match(html,/<input[^>]*id="research-theme"[^>]*type="checkbox"/);
   assert.match(html,/<label[^>]*for="research-theme"/);
   assert.match(html,/data-site-nav-owner="static"/);
   assert.doesNotMatch(html,/id="theme-toggle"/);
  }else{
   assert.match(head,/<script src="\/theme.js"><\/script>/,file);
   assert.ok(head.indexOf('/theme.js')<head.indexOf('rel="stylesheet"'),file);
   assert.equal((html.match(/id="theme-toggle"/g)||[]).length,1,file);
   assert.equal((html.match(/src="\/site-shell.mjs"/g)||[]).length,1,file);
  }
 }
});
test('shared route matching handles document aliases, nested views, query strings and external paths',()=>{
 assert.equal(normalizePagePath('/robot/ur3/index.html'),'/robot/ur3');
 assert.equal(normalizePagePath('/'),'/');
 for(const [href,key] of [['/#overview','overview'],['/#detail/secom_1397','risks'],['/?lang=en#summary','summary'],['/secom/index.html','secom'],['/robot/ur3/','ur3'],['/equipment/context-review.html','context'],['/secom/research.html','preprocessing'],['/smt/references.html','references'],['/research/','research'],['/review/?sample=secom_1397','review']])assert.equal(navigationKey(href),key,href);
 assert.equal(navigationKey('/unknown/'),null);
 assert.equal(navigationHref('#risks','en'),'#risks');
 assert.equal(navigationHref('/review/?sample=secom_1397#history','en'),'/review/?sample=secom_1397&lang=en#history');
 assert.equal(navigationHref('/oht/index.html?lang=en','ko'),'/oht/index.html');
 assert.equal(navigationHref('/secom/?lang=en','en'),'/secom/');
 assert.equal(navigationHref('https://example.com/?lang=ko','en'),'https://example.com/?lang=ko');
});
test('dark and silver reader inks meet 4.5:1 against every command surface',()=>{
 const css=read('command-center.css');
 const rules=[...css.matchAll(/(?:html:has\(\.command-shell\)|html\[data-theme="silver"\]:has\(\.command-shell\))\{([^}]+)\}/g)].map(m=>m[1]);
 assert.equal(rules.length,2);
 const luminance=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
 for(const rule of rules){
  const token=name=>rule.match(new RegExp(`--cc-${name}:(#[0-9a-f]{6})`))[1];
  for(const ink of ['ink','muted','accent','warm'])for(const surface of ['bg','panel','raised','active']){
   const a=luminance(token(ink)),b=luminance(token(surface));assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${ink} on ${surface}`);
  }
 }
 const shared=read('sitewide-command.css');
 assert.match(shared,/html:has\(#research-theme:checked\)/);
 assert.doesNotMatch(shared,/(?:filter\s*:\s*(?:invert|hue-rotate)|canvas\s*\{[^}]*filter)/);
});
test('browser audit and workflow retain actual Chrome, every viewport, both themes and failure artifacts',()=>{
 const scanner=readFileSync(new URL('../../verification/check_sitewide_command.cjs',import.meta.url),'utf8');
 for(const check of ['unknownBackgrounds','scrollWidth','renderedAudit','ArrowRight','Escape','context.request.get','fullPage:true','pageerror','report.failures','document.fonts.ready'])assert.ok(scanner.includes(check),check);
 const workflow=readFileSync(new URL('../../.github/workflows/sitewide-command-ui.yml',import.meta.url),'utf8');
 assert.match(workflow,/width: \[1366, 390, 360\]/);assert.match(workflow,/theme: \[dark, silver\]/);
 assert.match(workflow,/google-chrome --version/);assert.match(workflow,/PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD/);
 assert.match(workflow,/if: always\(\)/);assert.match(workflow,/timeout 120s.*apt-get/s);
 assert.doesNotMatch(workflow,/continue-on-error:\s*true|playwright install|apt-get update/);
});

test('rendered contrast audit catches translucent text, gradient risks and unsupported images instead of silently skipping',()=>{
 const scan=overrides=>{
  const defaults={backgroundColor:'rgb(255, 255, 255)',backgroundImage:'none',color:'rgb(0, 0, 0)',fill:'rgb(0, 0, 0)',opacity:'1',display:'block',visibility:'visible',clip:'auto',clipPath:'none',overflowX:'visible',fontSize:'16px',fontWeight:'400',getPropertyValue:()=>''};
  const root={parentElement:null},body={parentElement:root};
  const node={tagName:'P',id:'text',childNodes:[{nodeType:3,textContent:'Meaningful text'}],parentElement:body,scrollWidth:100,clientWidth:100,getClientRects:()=>[{}],getBoundingClientRect:()=>({left:0,right:100,bottom:30,width:100,height:20}),getAttribute:()=>'',closest:()=>null,matches:()=>false};
  const document={documentElement:{...root,scrollWidth:1366},body,querySelectorAll:selector=>selector==='body *'?[node]:[]};
  const output=runInNewContext(`(${renderedAudit.toString()})()`,{document,innerWidth:1366,SVGElement:class {},getComputedStyle:element=>({...defaults,...(element===node?overrides:{})})});
  return output;
 };
 assert.equal(scan({}).tested,1);
 assert.equal(scan({}).issues.length,0);
 assert.equal(scan({color:'rgba(0, 0, 0, 0.5)'}).issues.length,1,'alpha text must be composited against its background');
 assert.equal(scan({color:'rgb(130, 130, 130)'}).issues.length,1);
 assert.equal(scan({color:'rgb(130, 130, 130)',fontSize:'24px'}).issues.length,0,'large text retains the actual 3:1 threshold');
 assert.equal(scan({backgroundImage:'linear-gradient(rgb(255, 255, 255), rgb(0, 0, 0))'}).issues.length,1,'gradient risk cannot disappear from coverage');
 assert.equal(scan({backgroundImage:'url("unverified.png")'}).unknownBackgrounds.length,1,'unsupported backdrop is an explicit failure, not a skipped pass');
});

test('semantic legend fixtures produce real valid, gap, short, nonfinite, range and tail window states',()=>{
 const expected={ok:null,gap:'timestamp_gap',short:'insufficient_samples',nonfinite:'nonfinite_value',range:'value_out_of_range'};
 for(const [kind,reason] of Object.entries(expected)){
  const csv=semanticWindowCSV(kind);
  assert.equal(semanticWindowCSV(kind),csv,'fixture generation is deterministic');
  const input=robotCore.tableToSeries(parseCSV(csv));assert.deepEqual(input.reasons,[]);
  const result=robotCore.windowFile(input.times,input.axes,robotCore.demoConfig({nominal_period_s:'0.001'}));
  assert.equal(result.file_status,'valid',kind);
  assert.ok(result.partial_tail.n_samples>0,kind+' retains partial tail');
  if(reason)assert.ok(result.windows.some(w=>w.reasons.includes(reason)),kind);
  else assert.ok(result.windows.every(w=>w.status==='ok'));
 }
 assert.throws(()=>semanticWindowCSV('fake'));
});
test('semantic browser checks preserve explicit state meaning, warnings and keyboard-only research theme',()=>{
 const scanner=readFileSync(new URL('../../verification/check_sitewide_command.cjs',import.meta.url),'utf8');
 for(const marker of ['#contract-status span.bad','#contract-fields input[aria-invalid="true"]','invalid fields retain red borders','valid fields retain ordinary line borders','#file-table .pill-ok','#file-table .pill-bad','.strip .w-${kind}','#dataset-card p.plain-quality','#dataset-card p.evidence-note.evidence-warning','p.tag.synthetic','research-theme-note',"page.keyboard.press('Shift+Tab')"] )assert.ok(scanner.includes(marker),marker);
 const html=read('research/index.html');assert.match(html,/id="research-theme"[^>]*aria-describedby="research-theme-note"/);
 assert.match(html,/id="research-theme-note"[^>]*>[^<]*저장하지[^<]*다크/);
});
