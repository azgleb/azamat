(()=>{
'use strict';
const KEY='azamat-admin-draft-v1',BASE='azamat-admin-base-v1';
const {validate,element}=Portfolio,$=s=>document.querySelector(s);
let state,baseSnapshot,connection=null,editing=null,cover='',materials=[],uploading=false,dirty=false,savingProject=false;
const workspace=$('#workspace'),form=$('#settings-form'),editor=$('#project-editor'),projectForm=$('#edit-project');
function message(text,error=false){$('#message').textContent=text;$('#message').classList.toggle('error',error);}
function status(){ $('#draft-status').textContent=dirty?'Есть неопубликованный черновик':'Данные сайта загружены';}
function persist(next){const checked=validate(next);if(new TextEncoder().encode(JSON.stringify(checked,null,2)+'\n').length>900000)throw Error('Весь сайт превышает 900 КБ. Уменьшите материалы.');localStorage.setItem(KEY,JSON.stringify(checked));state=checked;dirty=true;status();render();}
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
function tab(name){document.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==name);document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));if(name==='leads')loadLeads();$('#panel-title').replaceChildren(document.createTextNode({projects:'Ваши проекты',leads:'Новые знакомства',settings:'Личное — главное',publish:'Готово к миру'}[name]),element('span','','.'));}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
function previewCover(){const img=$('#cover-preview');img.hidden=!cover;$('#remove-cover').hidden=!cover;if(cover)img.src=cover;else img.removeAttribute('src');}
function openProject(id){projectForm.reset();editing=id||null;const p=state.projects.find(x=>x.id===id);cover=p?.cover||'';materials=structuredClone(p?.materials||[]);renderMaterials();if(p){for(const k of ['title','category','year','description','url','task','solution','result'])projectForm.elements[k].value=p[k]||'';projectForm.elements.published.checked=p.published;}else projectForm.elements.year.value=new Date().getFullYear();$('#edit-title').textContent=p?'Редактировать проект':'Новый проект';$('#edit-error').textContent='';previewCover();editor.showModal();}
$('#new-project').onclick=()=>openProject();$('#close-editor').onclick=()=>{if(!savingProject&&!uploading)editor.close();};editor.addEventListener('cancel',e=>{if(savingProject||uploading)e.preventDefault();});
$('#remove-cover').onclick=()=>{cover='';projectForm.elements.cover.value='';previewCover();};
async function imageData(file){
 if(file.size>10*1024*1024)throw Error('Обложка должна быть меньше 10 МБ');if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Выберите JPG, PNG или WebP');
 const url=URL.createObjectURL(file);try{const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Не удалось прочитать изображение'));i.src=url;});
 const canvas=document.createElement('canvas'),scale=Math.min(1,1200/Math.max(img.width,img.height));canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#f5f4f0';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/jpeg',.78);if(data.length>450000)throw Error('Слишком детальная обложка. Выберите изображение меньшего размера.');return data;}finally{URL.revokeObjectURL(url);}
}
function renderMaterials(){
 const list=$('#material-list');list.replaceChildren();materials.forEach((m,i)=>{const row=element('div','material-editor');if(m.kind==='image'){const img=element('img');img.src=m.data;img.alt=m.name;row.append(img);}row.append(element('span','',m.name));const input=element('input');input.value=m.caption;input.maxLength=500;input.placeholder='Подпись';input.setAttribute('aria-label','Подпись '+m.name);input.oninput=()=>m.caption=input.value;row.append(input);
 for(const [label,delta] of [['↑',-1],['↓',1],['Удалить',0]]){const b=element('button','',label);b.type='button';b.disabled=uploading||(delta!==0&&(i+delta<0||i+delta>=materials.length));b.setAttribute('aria-label',label+' '+m.name);b.onclick=()=>{if(delta)[materials[i],materials[i+delta]]=[materials[i+delta],materials[i]];else materials.splice(i,1);renderMaterials();};row.append(b);}list.append(row);});
}
$('#material-files').onchange=async e=>{const files=[...e.target.files];uploading=true;projectForm.querySelector('.submit').disabled=true;$('#close-editor').disabled=true;$('#edit-error').textContent='';renderMaterials();try{if(materials.length+files.length>20)throw Error('Не более 20 материалов');const added=[];for(const f of files){if(f.type.startsWith('image/'))added.push({kind:'image',name:f.name.slice(0,150),caption:'',data:await imageData(f)});else{if(!/\.(pdf|txt|docx|xlsx|pptx)$/i.test(f.name)||f.size>250000)throw Error('Документ: PDF, TXT, DOCX, XLSX, PPTX до 250 КБ');const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve('data:application/octet-stream;base64,'+reader.result.split(',')[1]);reader.onerror=()=>reject(Error('Не удалось прочитать файл'));reader.readAsDataURL(f);});added.push({kind:'document',name:f.name.slice(0,150),caption:'',data});}}materials.push(...added);}catch(err){$('#edit-error').textContent=err.message;}finally{uploading=false;e.target.value='';projectForm.querySelector('.submit').disabled=false;$('#close-editor').disabled=false;renderMaterials();}};
projectForm.onsubmit=async e=>{e.preventDefault();if(savingProject||uploading)return;savingProject=true;const button=projectForm.querySelector('.submit');button.disabled=true;$('#edit-error').textContent='';try{
 const data=new FormData(projectForm),file=data.get('cover'),old=state.projects.find(p=>p.id===editing);
 const p={materials,task:data.get('task').trim(),solution:data.get('solution').trim(),result:data.get('result').trim(),id:editing||crypto.randomUUID(),title:data.get('title').trim(),description:data.get('description').trim(),category:data.get('category'),year:Number(data.get('year')),url:data.get('url').trim(),cover:file.size?await imageData(file):cover,visual:old?.visual||'sage',published:data.has('published')};
 persist({...state,projects:editing?state.projects.map(x=>x.id===editing?p:x):[p,...state.projects]});editor.close();message('Проект сохранён в черновик. Опубликуйте изменения, чтобы обновить сайт.');
 }catch(err){$('#edit-error').textContent=err.name==='QuotaExceededError'?'Недостаточно памяти браузера. Экспортируйте копию и уменьшите обложки.':err.message;}finally{button.disabled=false;savingProject=false;}};
form.onsubmit=e=>{e.preventDefault();try{const data=new FormData(form),settings={available:data.has('available')};for(const key of Object.keys(Portfolio.limits))settings[key]=data.get(key).trim();persist({...state,settings});message('Тексты и контакты сохранены в черновик.');}catch(err){message(err.message,true);}};
$('#export-site').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'})),a=element('a');a.href=url;a.download='portfolio-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('#import-site').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>4*1024*1024)throw Error('Максимальный размер копии — 4 МБ');const next=validate(JSON.parse(await f.text()));if(!confirm('Заменить весь черновик данными из копии? Опубликованный сайт пока не изменится.'))return;persist(next);settingsToForm();message('Копия загружена в черновик.');}catch(err){message(err.message,true);}finally{e.target.value='';}};
$('#restore-draft').onclick=()=>{try{const raw=localStorage.getItem(KEY);if(!raw)throw Error('Сохранённого черновика нет');const next=validate(JSON.parse(raw));if(!confirm('Загрузить сохранённый черновик? Несохранённые поля будут заменены.'))return;state=next;dirty=true;render();settingsToForm();status();message('Черновик восстановлен.');}catch(e){message(e.message,true);}};
$('#recover-old').onclick=()=>{try{const raw=localStorage.getItem('azamat-projects-v1');if(!raw)throw Error('В этом браузере и на этом адресе нет проектов из старой версии');const old=JSON.parse(raw);if(!Array.isArray(old))throw Error('Неверный формат старых проектов');const projects=old.map(p=>({...p,id:crypto.randomUUID(),published:true}));const next=validate({...state,projects});if(!confirm('Заменить проекты черновика '+projects.length+' работами из старой версии?'))return;persist(next);message('Старые проекты перенесены в черновик.');}catch(e){message(e.message,true);}};
async function remote(){const result=await PortfolioAPI.call('readSite');return {sha:result.sha,data:validate(result.data)};}
function busy(value){workspace.disabled=value;}
function locked(text=''){
 connection=null;state=null;$('#authenticated-panel').hidden=true;$('#login-screen').hidden=false;workspace.disabled=true;
 $('#admin-password').value='';$('#lead-list').replaceChildren();$('#login-error').textContent=text;
 if(editor.open)editor.close();
}
window.addEventListener('portfolio-session-expired',()=>locked('Сеанс завершён. Войдите снова.'));
$('#login-form').onsubmit=async e=>{e.preventDefault();const button=$('#login-form button');button.disabled=true;$('#login-error').textContent='';try{
 await PortfolioAPI.login($('#admin-username').value.trim(),$('#admin-password').value);$('#admin-password').value='';
 const current=await remote();baseSnapshot=structuredClone(current.data);state=current.data;let draft=null,previousBase=null;
 try{const raw=localStorage.getItem(KEY);if(raw)draft=validate(JSON.parse(raw));previousBase=JSON.parse(localStorage.getItem(BASE)||'null');}catch{}
 dirty=Boolean(draft&&JSON.stringify(draft)!==JSON.stringify(state));if(draft)state=draft;
 connection={sha:current.sha,stale:dirty&&(!previousBase||previousBase.sha!==current.sha)};
 if(!connection.stale){try{localStorage.setItem(BASE,JSON.stringify({sha:current.sha}));}catch{}}
 try{localStorage.setItem(KEY,JSON.stringify(state));}catch{}
 render();settingsToForm();status();tab('projects');workspace.disabled=false;$('#login-screen').hidden=true;$('#authenticated-panel').hidden=false;
 message(connection.stale?'Сохранённый черновик основан на старой версии. Экспортируйте копию и загрузите актуальную версию перед публикацией.':dirty?'Восстановлен неопубликованный черновик.':'Вы вошли. Можно управлять сайтом и заявками.',connection.stale);
 }catch(err){try{await PortfolioAPI.logout();}catch{}locked(err.message);}finally{button.disabled=false;}};
$('#logout').onclick=async()=>{busy(true);try{await PortfolioAPI.logout();}catch{}finally{locked('Вы вышли из панели.');}};
async function loadLeads(){
 const list=$('#lead-list');list.textContent='Загружаем заявки…';$('#refresh-leads').disabled=true;
 try{const result=await PortfolioAPI.call('listLeads');list.replaceChildren();if(!result.leads.length){list.textContent='Пока нет заявок. Новые обращения появятся здесь.';return;}
 for(const lead of result.leads){const row=element('article','lead-card'),main=element('div');main.append(element('small','',new Date(lead.date).toLocaleString('ru-RU')),element('h3','',lead.name),element('p','',lead.contact),element('p','lead-status',lead.service+' · '+lead.budget),element('p','',lead.message));
 const select=element('select');select.setAttribute('aria-label','Статус заявки от '+lead.name);for(const value of ['Новая','В работе','Завершена']){const option=element('option','',value);option.value=value;select.append(option);}select.value=lead.status;
 select.onchange=async()=>{select.disabled=true;try{await PortfolioAPI.call('updateLead',{id:lead.id,status:select.value});lead.status=select.value;message('Статус заявки обновлён.');}catch(e){select.value=lead.status;message(e.message,true);}finally{select.disabled=false;}};
 row.append(main,select);list.append(row);}
 }catch(err){list.textContent=err.message;}finally{$('#refresh-leads').disabled=false;}
}
$('#refresh-leads').onclick=loadLeads;
$('#pull').onclick=async()=>{if(!connection)return;if(!confirm('Загрузить версию с GitHub и заменить черновик? Сначала экспортируйте нужные изменения.'))return;busy(true);try{const current=await remote(connection);localStorage.setItem(KEY,JSON.stringify(current.data));localStorage.setItem(BASE,JSON.stringify({sha:current.sha}));connection.sha=current.sha;connection.stale=false;baseSnapshot=current.data;state=current.data;dirty=false;render();settingsToForm();status();message('Актуальная версия с GitHub загружена.');}catch(e){message(e.message,true);}finally{busy(false);}};
$('#publish').onclick=async()=>{if(!connection)return;if(connection.stale){message('Черновик основан на устаревшей версии. Экспортируйте копию и загрузите версию с GitHub.',true);return;}
 // Unsubmitted settings must not silently disappear from a publication.
 const values=new FormData(form);const changed=Object.keys(Portfolio.limits).some(k=>values.get(k).trim()!==state.settings[k])||values.has('available')!==state.settings.available;
 if(changed){message('Сначала сохраните изменения в разделе «Обо мне и контакты».',true);tab('settings');return;}
 if(!confirm('Опубликовать этот черновик для всех посетителей сайта?'))return;
 busy(true);message('Публикую изменения…');try{
 const next=validate(state),text=JSON.stringify(next,null,2)+'\n';if(new TextEncoder().encode(text).length>900000)throw Error('Общий объём данных превышает 900 КБ. Уменьшите количество или размер обложек.');
 const current=await remote(connection);if(current.sha!==connection.sha)throw Error('На GitHub уже есть новые изменения. Экспортируйте черновик и загрузите актуальную версию, чтобы не перезаписать чужую работу.');
 if(JSON.stringify(current.data)===JSON.stringify(next)){dirty=false;status();message('Этот черновик уже опубликован. Новых изменений нет.');return;}
 const result=await PortfolioAPI.call('publishSite',{data:next,sha:current.sha});connection.sha=result.sha;state=next;dirty=false;status();
 try{localStorage.setItem(KEY,JSON.stringify(next));localStorage.setItem(BASE,JSON.stringify({sha:connection.sha}));}catch{}
 message('Изменения сохранены в GitHub. Дождитесь обновления GitHub Pages, затем откройте сайт. Обычно это занимает несколько минут.');
 }catch(e){message(e.message,true);}finally{busy(false);}};
window.addEventListener('beforeunload',e=>{if(!state)return;const d=new FormData(form),changed=Object.keys(Portfolio.limits).some(k=>d.get(k).trim()!==state.settings[k])||d.has('available')!==state.settings.available;if(changed||editor.open){e.preventDefault();e.returnValue='';}});
$('#setup-hint').hidden=PortfolioAPI.configured();
if(!PortfolioAPI.configured()){$('#login-error').textContent='Вход пока не настроен. Подключите сервер по инструкции ниже.';$('#login-form button').disabled=true;}
})();
