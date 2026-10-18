(()=>{
'use strict';
const KEY='azamat-admin-draft-v1',BASE='azamat-admin-base-v1';
const {validate,element}=Portfolio,$=s=>document.querySelector(s);
let state,baseSnapshot,connection=null,editing=null,cover='',dirty=false,savingProject=false;
const workspace=$('#workspace'),form=$('#settings-form'),editor=$('#project-editor'),projectForm=$('#edit-project');
const inferred=location.hostname.endsWith('.github.io')&&location.pathname.split('/')[1] ? location.hostname.split('.')[0]+'/'+location.pathname.split('/')[1] : 'azgleb/azamat';
$('#repository').value=inferred;
function message(text,error=false){$('#message').textContent=text;$('#message').classList.toggle('error',error);}
function status(){ $('#draft-status').textContent=dirty?'Есть неопубликованный черновик':'Данные сайта загружены';}
function persist(next){const checked=validate(next);localStorage.setItem(KEY,JSON.stringify(checked));state=checked;dirty=true;status();render();}
function settingsToForm(){for(const key of Object.keys(Portfolio.limits))form.elements[key].value=state.settings[key];form.elements.available.checked=state.settings.available;}
function render(){
 const list=$('#admin-projects');list.replaceChildren();$('#admin-count').textContent=state.projects.length;$('#no-projects').hidden=state.projects.length>0;
 state.projects.forEach((p,i)=>{
 const row=element('article','admin-card');let thumb;if(p.cover){thumb=element('img','admin-thumb');thumb.src=p.cover;thumb.alt='';}else thumb=element('div','admin-thumb',String(i+1).padStart(2,'0'));
 const main=element('div','admin-card-main');main.append(element('h3','',p.title),element('p','',p.category+' · '+p.year),element('span','visibility'+(p.published?'':' is-hidden'),p.published?'На сайте':'Скрыт'));
 const buttons=element('div','card-buttons');
 function action(label,fn,cls){const b=element('button',cls||'',label);b.type='button';b.onclick=()=>{try{fn();}catch(e){message(e.message,true);}};buttons.append(b);return b;}
 action('Изменить',()=>openProject(p.id));action(p.published?'Скрыть':'Показать',()=>persist({...state,projects:state.projects.map(x=>x.id===p.id?{...x,published:!x.published}:x)}));
 const up=action('↑',()=>move(i,-1));up.disabled=i===0;up.setAttribute('aria-label','Поднять '+p.title);
 const down=action('↓',()=>move(i,1));down.disabled=i===state.projects.length-1;down.setAttribute('aria-label','Опустить '+p.title);
 action('Удалить',()=>{if(confirm('Удалить «'+p.title+'» из черновика?'))persist({...state,projects:state.projects.filter(x=>x.id!==p.id)});},'danger');row.append(thumb,main,buttons);list.append(row);
 });
}
function move(i,delta){const arr=[...state.projects];[arr[i],arr[i+delta]]=[arr[i+delta],arr[i]];persist({...state,projects:arr});}
function tab(name){document.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==name);document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));$('#panel-title').replaceChildren(document.createTextNode({projects:'Ваши проекты',settings:'Личное — главное',publish:'Готово к миру'}[name]),element('span','','.'));}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
function previewCover(){const img=$('#cover-preview');img.hidden=!cover;$('#remove-cover').hidden=!cover;if(cover)img.src=cover;else img.removeAttribute('src');}
function openProject(id){projectForm.reset();editing=id||null;const p=state.projects.find(x=>x.id===id);cover=p?.cover||'';if(p){for(const k of ['title','category','year','description','url'])projectForm.elements[k].value=p[k]||'';projectForm.elements.published.checked=p.published;}else projectForm.elements.year.value=new Date().getFullYear();$('#edit-title').textContent=p?'Редактировать проект':'Новый проект';$('#edit-error').textContent='';previewCover();editor.showModal();}
$('#new-project').onclick=()=>openProject();$('#close-editor').onclick=()=>{if(!savingProject)editor.close();};editor.addEventListener('cancel',e=>{if(savingProject)e.preventDefault();});
$('#remove-cover').onclick=()=>{cover='';projectForm.elements.cover.value='';previewCover();};
async function imageData(file){
 if(file.size>10*1024*1024)throw Error('Обложка должна быть меньше 10 МБ');if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Выберите JPG, PNG или WebP');
 const url=URL.createObjectURL(file);try{const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Не удалось прочитать изображение'));i.src=url;});
 const canvas=document.createElement('canvas'),scale=Math.min(1,1200/Math.max(img.width,img.height));canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#f5f4f0';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/jpeg',.78);if(data.length>450000)throw Error('Слишком детальная обложка. Выберите изображение меньшего размера.');return data;}finally{URL.revokeObjectURL(url);}
}
projectForm.onsubmit=async e=>{e.preventDefault();if(savingProject)return;savingProject=true;const button=projectForm.querySelector('.submit');button.disabled=true;$('#edit-error').textContent='';try{
 const data=new FormData(projectForm),file=data.get('cover'),old=state.projects.find(p=>p.id===editing);
 const p={id:editing||crypto.randomUUID(),title:data.get('title').trim(),description:data.get('description').trim(),category:data.get('category'),year:Number(data.get('year')),url:data.get('url').trim(),cover:file.size?await imageData(file):cover,visual:old?.visual||'sage',published:data.has('published')};
 persist({...state,projects:editing?state.projects.map(x=>x.id===editing?p:x):[p,...state.projects]});editor.close();message('Проект сохранён в черновик. Опубликуйте изменения, чтобы обновить сайт.');
 }catch(err){$('#edit-error').textContent=err.name==='QuotaExceededError'?'Недостаточно памяти браузера. Экспортируйте копию и уменьшите обложки.':err.message;}finally{button.disabled=false;savingProject=false;}};
form.onsubmit=e=>{e.preventDefault();try{const data=new FormData(form),settings={available:data.has('available')};for(const key of Object.keys(Portfolio.limits))settings[key]=data.get(key).trim();persist({...state,settings});message('Тексты и контакты сохранены в черновик.');}catch(err){message(err.message,true);}};
$('#export-site').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'})),a=element('a');a.href=url;a.download='portfolio-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('#import-site').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>4*1024*1024)throw Error('Максимальный размер копии — 4 МБ');const next=validate(JSON.parse(await f.text()));if(!confirm('Заменить весь черновик данными из копии? Опубликованный сайт пока не изменится.'))return;persist(next);settingsToForm();message('Копия загружена в черновик.');}catch(err){message(err.message,true);}finally{e.target.value='';}};
$('#restore-draft').onclick=()=>{try{const raw=localStorage.getItem(KEY);if(!raw)throw Error('Сохранённого черновика нет');const next=validate(JSON.parse(raw));if(!confirm('Загрузить сохранённый черновик? Несохранённые поля будут заменены.'))return;state=next;dirty=true;render();settingsToForm();status();message('Черновик восстановлен.');}catch(e){message(e.message,true);}};
$('#recover-old').onclick=()=>{try{const raw=localStorage.getItem('azamat-projects-v1');if(!raw)throw Error('В этом браузере и на этом адресе нет проектов из старой версии');const old=JSON.parse(raw);if(!Array.isArray(old))throw Error('Неверный формат старых проектов');const projects=old.map(p=>({...p,id:crypto.randomUUID(),published:true}));const next=validate({...state,projects});if(!confirm('Заменить проекты черновика '+projects.length+' работами из старой версии?'))return;persist(next);message('Старые проекты перенесены в черновик.');}catch(e){message(e.message,true);}};
function decode(content){return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(content.replace(/\s/g,'')),c=>c.charCodeAt(0)));}
function encode(content){let binary='';for(const b of new TextEncoder().encode(content))binary+=String.fromCharCode(b);return btoa(binary);}
function endpoint(c){return 'https://api.github.com/repos/'+c.repo+'/contents/site.json';}
async function api(c,method='GET',body){
 let response;try{response=await fetch(endpoint(c)+(method==='GET'?'?ref='+encodeURIComponent(c.branch):''),{method,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+c.token,'X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000),credentials:'omit',redirect:'error'});}catch{throw Error('Не удалось связаться с GitHub. Проверьте сеть и попробуйте снова.');}
 if(!response.ok){const messages={401:'Токен недействителен или истёк.',403:'Нет разрешения на операцию. Проверьте Contents: Read and write и доступ к репозиторию.',404:'Не найден репозиторий, ветка или site.json. Проверьте адрес и доступ токена.',409:'Файл изменился на GitHub. Загрузите актуальную версию перед публикацией.',422:'GitHub отклонил изменения. Проверьте ветку, права и правила защиты репозитория.'};throw Error(messages[response.status]||'GitHub вернул ошибку '+response.status);}
 return response.json();
}
async function remote(c){const result=await api(c);if(!result.sha||result.encoding!=='base64'||!result.content)throw Error('Не удалось прочитать site.json. Файл может быть слишком большим.');return {sha:result.sha,data:validate(JSON.parse(decode(result.content)))};}
function busy(value){workspace.disabled=value;}
function connectionUI(){const yes=Boolean(connection);$('#publish').disabled=!yes;$('#pull').disabled=!yes;$('#disconnect').hidden=!yes;$('#connection-status').textContent=yes?'Подключено: '+connection.repo+' · '+connection.branch+'. Токен исчезнет после перезагрузки страницы.':'Не подключено. Токен не хранится в браузере и не попадает в репозиторий.';}
$('#connect-form').onsubmit=async e=>{e.preventDefault();const repo=$('#repository').value.trim(),branch=$('#branch').value.trim(),token=$('#github-token').value.trim();if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)||!branch||!token)return;
 busy(true);message('Проверяю доступ к GitHub…');try{const c={repo,branch,token},current=await remote(c);c.sha=current.sha;
 let previousBase=null;try{previousBase=JSON.parse(localStorage.getItem(BASE)||'null');}catch{}
 c.stale=dirty&&(previousBase ? previousBase.repo!==repo||previousBase.branch!==branch||previousBase.sha!==current.sha : JSON.stringify(baseSnapshot)!==JSON.stringify(current.data));
 if(!dirty){state=current.data;render();settingsToForm();}
 connection=c;if(!c.stale){try{localStorage.setItem(BASE,JSON.stringify({repo,branch,sha:c.sha}));}catch{}}$('#github-token').value='';connectionUI();message(c.stale?'GitHub подключён, но исходная версия черновика устарела. Экспортируйте копию и нажмите «Загрузить версию с GitHub» перед публикацией.':'GitHub подключён. Проверьте черновик перед публикацией.',c.stale);
 }catch(err){connection=null;connectionUI();message(err.message,true);}finally{busy(false);}};
$('#disconnect').onclick=()=>{connection=null;$('#github-token').value='';connectionUI();message('GitHub отключён. Черновик сохранён.');};
$('#pull').onclick=async()=>{if(!connection)return;if(!confirm('Загрузить версию с GitHub и заменить черновик? Сначала экспортируйте нужные изменения.'))return;busy(true);try{const current=await remote(connection);localStorage.setItem(KEY,JSON.stringify(current.data));localStorage.setItem(BASE,JSON.stringify({repo:connection.repo,branch:connection.branch,sha:current.sha}));connection.sha=current.sha;connection.stale=false;baseSnapshot=current.data;state=current.data;dirty=false;render();settingsToForm();status();message('Актуальная версия с GitHub загружена.');}catch(e){message(e.message,true);}finally{busy(false);}};
$('#publish').onclick=async()=>{if(!connection)return;if(connection.stale){message('Черновик основан на устаревшей версии. Экспортируйте копию и загрузите версию с GitHub.',true);return;}
 // Unsubmitted settings must not silently disappear from a publication.
 const values=new FormData(form);const changed=Object.keys(Portfolio.limits).some(k=>values.get(k).trim()!==state.settings[k])||values.has('available')!==state.settings.available;
 if(changed){message('Сначала сохраните изменения в разделе «Обо мне и контакты».',true);tab('settings');return;}
 if(!confirm('Опубликовать этот черновик для всех посетителей сайта?'))return;
 busy(true);message('Публикую изменения…');try{
 const next=validate(state),text=JSON.stringify(next,null,2)+'\n';if(new TextEncoder().encode(text).length>900000)throw Error('Общий объём данных превышает 900 КБ. Уменьшите количество или размер обложек.');
 const current=await remote(connection);if(current.sha!==connection.sha)throw Error('На GitHub уже есть новые изменения. Экспортируйте черновик и загрузите актуальную версию, чтобы не перезаписать чужую работу.');
 if(JSON.stringify(current.data)===JSON.stringify(next)){dirty=false;status();message('Этот черновик уже опубликован. Новых изменений нет.');return;}
 const result=await api(connection,'PUT',{message:'Update portfolio content from admin',content:encode(text),sha:current.sha,branch:connection.branch});connection.sha=result.content.sha;state=next;dirty=false;status();
 try{localStorage.setItem(KEY,JSON.stringify(next));localStorage.setItem(BASE,JSON.stringify({repo:connection.repo,branch:connection.branch,sha:connection.sha}));}catch{}
 message('Изменения сохранены в GitHub. Дождитесь обновления GitHub Pages, затем откройте сайт. Обычно это занимает несколько минут.');
 }catch(e){message(e.message,true);}finally{busy(false);}};
window.addEventListener('beforeunload',e=>{if(!state)return;const d=new FormData(form),changed=Object.keys(Portfolio.limits).some(k=>d.get(k).trim()!==state.settings[k])||d.has('available')!==state.settings.available;if(changed||editor.open){e.preventDefault();e.returnValue='';}});
(async()=>{try{const response=await fetch('./site.json',{cache:'no-store'});if(!response.ok)throw Error('Не удалось загрузить site.json');state=validate(await response.json());baseSnapshot=structuredClone(state);let draft=null;try{const raw=localStorage.getItem(KEY);if(raw)draft=validate(JSON.parse(raw));}catch{message('Не удалось прочитать локальный черновик. Можно импортировать резервную копию.',true);}
 if(draft){dirty=JSON.stringify(draft)!==JSON.stringify(state);state=draft;if(dirty)message('Восстановлен локальный черновик. Посетители увидят его после публикации.');}
 // Create a previewable copy without discarding a valid existing draft.
 try{localStorage.setItem(KEY,JSON.stringify(state));}catch{message('Браузер не разрешает сохранять черновик. Разрешите хранилище для этого сайта.',true);}
 render();settingsToForm();status();workspace.disabled=false;
 }catch(e){message(e.message+'. Обновите страницу, чтобы повторить загрузку.',true);}})();
})();
