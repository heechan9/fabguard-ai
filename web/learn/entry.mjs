// The default application is unchanged. Load the optional exercise on request.
const trigger=document.getElementById('open-learning');
let host=null,root=null,pending=false;
trigger?.addEventListener('click',async()=>{
 if(pending)return;
 if(root){host.dataset.theme=document.documentElement.dataset.theme||'dark';root.getElementById('learning-dialog').showModal();return;}
 pending=true;trigger.disabled=true;
 try{
  const [{template},{mountLearning}]=await Promise.all([import('./template.mjs'),import('./app.mjs')]);
  host=document.createElement('div');host.id='fabguard-learning-host';
  host.dataset.theme=document.documentElement.dataset.theme||'dark';
  root=host.attachShadow({mode:'open'});root.innerHTML=template;
  document.body.append(host);
  mountLearning(root,new URLSearchParams(location.search).get('lang'));
  const dialog=root.getElementById('learning-dialog');
  root.getElementById('exit').addEventListener('click',()=>dialog.close());
  root.getElementById('skip-learning').addEventListener('click',()=>root.getElementById('main').focus());
  dialog.addEventListener('close',()=>{const reset=root.getElementById('reset-dialog');if(reset.open)reset.close();trigger.focus();});
  root.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(link?.getAttribute('href').startsWith('/'))dialog.close();});
  window.addEventListener('hashchange',()=>{if(dialog.open)dialog.close();});
  dialog.showModal();
 }catch{
  host?.remove();host=null;root=null;
  trigger.textContent='학습 화면을 열지 못했어요. 다시 시도 / Could not open. Retry';
 }finally{pending=false;trigger.disabled=false;}
});
