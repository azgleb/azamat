function caseFields(p){
 const fields={};for(const key of ['task','solution','result']){const v=p[key]===undefined?'':p[key];if(typeof v!=='string'||v.length>3000)throw Error('Слишком длинный текст кейса');fields[key]=v;}
 const list=p.materials===undefined?[]:p.materials;if(!Array.isArray(list)||list.length>20)throw Error('Не более 20 материалов в кейсе');
 fields.materials=list.map(m=>{
 if(!m||!['image','document'].includes(m.kind)||typeof m.name!=='string'||!m.name.trim()||m.name.length>150||typeof m.caption!=='string'||m.caption.length>500||typeof m.data!=='string')throw Error('Некорректный материал');
 if(m.kind==='image'){if(m.data.length>450000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(m.data))throw Error('Некорректное изображение');}
 else if(!/\.(pdf|txt|docx|xlsx|pptx)$/i.test(m.name)||m.data.length>350000||!/^data:application\/octet-stream;base64,[A-Za-z0-9+/]+={0,2}$/.test(m.data))throw Error('Документ: PDF, TXT, DOCX, XLSX, PPTX, до 250 КБ');
 return {kind:m.kind,name:m.name.trim(),caption:m.caption,data:m.data};});return fields;
}
/** Run setup() ONCE from the Google Apps Script editor, never from a browser request. */
function setup() {
  var p = PropertiesService.getScriptProperties();
  if (p.getProperty('ADMIN_PASSWORD_HASH')) throw new Error('Уже настроено. Для смены пароля запустите resetAdminPassword().');
  if (!p.getProperty('SHEET_ID')) {
    var book = SpreadsheetApp.create('Azamat Works — заявки');
    p.setProperty('SHEET_ID', book.getId());
  }
  var sheet = leadSheet_();
  if (sheet.getLastRow() === 0) sheet.appendRow(['Дата UTC', 'ID', 'Имя', 'Контакт', 'Услуга', 'Бюджет', 'Описание', 'Статус', 'Уведомления']);
  sheet.setFrozenRows(1);
  resetAdminPassword();
  console.log('Таблица: https://docs.google.com/spreadsheets/d/' + p.getProperty('SHEET_ID') + '/edit');
}
/** Owner-only editor function. Password is random (64 hex characters), never embedded in public files. */
function resetAdminPassword() {
  var p = PropertiesService.getScriptProperties();
  var password = random_(), salt = random_();
  if (!p.getProperty('ADMIN_USERNAME')) p.setProperty('ADMIN_USERNAME', 'azamat');
  p.setProperties({ADMIN_SALT:salt, ADMIN_PASSWORD_HASH:hash_(salt+':'+password), SESSION_EPOCH:random_()});
  console.log('Логин: ' + p.getProperty('ADMIN_USERNAME'));
  console.log('Новый пароль (сохраните в менеджер паролей): ' + password);
}
function doGet() { return json_({ok:true,data:{service:'Azamat Works API'}}); }
function doPost(e) {
  try {
    if (!e || !e.postData || e.postData.contents.length > 1200000) fail_('Неверный размер запроса.');
    var b; try { b = JSON.parse(e.postData.contents); } catch (_) { fail_('Неверный формат запроса.'); }
    if (!b || typeof b !== 'object' || Array.isArray(b)) fail_('Неверный запрос.');
    var data;
    if (b.action === 'submitLead') data = submitLead_(b);
    else if (b.action === 'login') data = login_(b);
    else {
      var session = requireSession_(b.session);
      switch (b.action) {
        case 'logout': CacheService.getScriptCache().remove('session:'+hash_(b.session)); data={}; break;
        case 'readSite': data=readSite_(); break;
        case 'publishSite': data=publishSite_(b); break;
        case 'listLeads': data=listLeads_(); break;
        case 'updateLead': data=updateLead_(b); break;
        default: fail_('Неизвестное действие.');
      }
    }
    return json_({ok:true,data:data});
  } catch (error) {
    // Never return upstream responses, tokens, passwords, stack traces or raw exceptions.
    return json_({ok:false,error:error.publicMessage||'Сервис временно недоступен. Повторите попытку позже.',code:error.publicCode||'SERVER'});
  }
}
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function fail_(message,code) { var error=new Error('Request rejected');error.publicMessage=message;error.publicCode=code||'VALIDATION';throw error; }
function random_() { return Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,''); }
function hash_(text) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,text,Utilities.Charset.UTF_8).map(function(n){return ('0'+((n+256)%256).toString(16)).slice(-2);}).join(''); }
function equal_(a,b) { if(typeof a!=='string'||typeof b!=='string')return false;var diff=a.length^b.length;for(var i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0; }
function text_(value,max,label) { if(typeof value!=='string'||!value.trim()||value.length>max)fail_('Проверьте поле «'+label+'».');return value.trim(); }
function withLock_(fn) { var lock=LockService.getScriptLock();if(!lock.tryLock(8000))fail_('Сервис занят. Попробуйте через несколько секунд.','BUSY');try{return fn();}finally{lock.releaseLock();} }
function login_(b) {
  var username=text_(b.username,80,'Логин'),password=text_(b.password,200,'Пароль');
  return withLock_(function(){
    var p=PropertiesService.getScriptProperties(),cache=CacheService.getScriptCache();
    if(!p.getProperty('ADMIN_PASSWORD_HASH'))fail_('Владелец ещё не настроил вход.','SETUP');
    var key='login:'+hash_(username.toLowerCase()),tries=Number(cache.get(key)||0),global=Number(cache.get('login-global')||0);
    if(tries>=8||global>=60)fail_('Слишком много попыток входа. Попробуйте через 15 минут.','RATE_LIMIT');
    // Only a generated, high-entropy 64-character password is supported; no weak user-selected passwords.
    var validUser=equal_(username,p.getProperty('ADMIN_USERNAME'));
    var validPassword=equal_(hash_(p.getProperty('ADMIN_SALT')+':'+password),p.getProperty('ADMIN_PASSWORD_HASH'));
    if(!validUser||!validPassword){cache.put(key,String(tries+1),900);cache.put('login-global',String(global+1),900);fail_('Неверный логин или пароль.','LOGIN');}
    cache.remove(key);var session=random_(),expires=Date.now()+60*60*1000;
    cache.put('session:'+hash_(session),JSON.stringify({expires:expires,epoch:p.getProperty('SESSION_EPOCH')}),3600);
    return {session:session,expires:expires};
  });
}
function requireSession_(token) {
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))fail_('Войдите в панель.','AUTH');
  var raw=CacheService.getScriptCache().get('session:'+hash_(token));if(!raw)fail_('Сеанс завершён. Войдите снова.','AUTH');
  var data=JSON.parse(raw);if(data.expires<Date.now()||data.epoch!==PropertiesService.getScriptProperties().getProperty('SESSION_EPOCH'))fail_('Сеанс завершён. Войдите снова.','AUTH');return data;
}
function leadSheet_() {
  var id=PropertiesService.getScriptProperties().getProperty('SHEET_ID');if(!id)fail_('Приём заявок ещё не настроен.','SETUP');
  var book=SpreadsheetApp.openById(id);return book.getSheetByName('Заявки')||book.insertSheet('Заявки');
}
function cell_(s) { return "'"+s; } // Force text, including =, +, -, @; never execute visitor-supplied formulas.
function uncell_(s) { return String(s).replace(/^'/,''); }
function submitLead_(b) {
  if(b.website)fail_('Не удалось отправить заявку.');
  if(b.consent!==true)fail_('Подтвердите согласие на обработку данных.');
  if(typeof b.elapsedMs!=='number'||b.elapsedMs<1800)fail_('Проверьте заявку и повторите отправку.');
  if(typeof b.requestId!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(b.requestId))fail_('Обновите страницу и попробуйте снова.');
  var name=text_(b.name,100,'Имя'),contact=text_(b.contact,200,'Контакт'),message=text_(b.message,3000,'Описание');
  if(message.length<10)fail_('Расскажите о проекте чуть подробнее (от 10 символов).');
  if(['Сайт / разработка','Дизайн интерфейса','Брендинг','Другое'].indexOf(b.service)<0||['Обсудим','До 30 000 ₽','30 000–100 000 ₽','От 100 000 ₽'].indexOf(b.budget)<0)fail_('Проверьте услугу и бюджет.');
  var result=withLock_(function(){
    var sheet=leadSheet_();
    // Durable idempotency: retrying after a lost response cannot append a duplicate, even after cache eviction.
    if(sheet.getLastRow()>1&&sheet.getRange(2,2,sheet.getLastRow()-1,1).createTextFinder(b.requestId).matchEntireCell(true).findNext())return {saved:true,id:b.requestId};
    var cache=CacheService.getScriptCache(),minute='leads:'+Math.floor(Date.now()/60000),count=Number(cache.get(minute)||0),contactKey='contact:'+hash_(contact.toLowerCase());
    if(count>=20||cache.get(contactKey))fail_('Заявка уже отправлялась недавно. Подождите минуту перед новой заявкой.','RATE_LIMIT');
    sheet.appendRow([new Date().toISOString(),b.requestId,cell_(name),cell_(contact),cell_(b.service),cell_(b.budget),cell_(message),'Новая']);
    cache.put(minute,String(count+1),120);cache.put(contactKey,'1',60);return {saved:true,id:b.requestId,isNew:true};
  });
  if(result.isNew){
    // The lead is already durable. Notification errors must never turn a saved request into a failure.
    try {
      var delivery=notifyLead_({name:name,contact:contact,message:message,service:b.service,budget:b.budget});
      withLock_(function(){var sheet=leadSheet_();sheet.getRange(1,9).setValue('Уведомления');var found=sheet.getRange(2,2,sheet.getLastRow()-1,1).createTextFinder(b.requestId).matchEntireCell(true).findNext();if(found)sheet.getRange(found.getRow(),9).setValue(delivery);});
    } catch (_) { console.log('Не удалось обновить статус уведомлений. Заявка сохранена.'); }
  }
  return {saved:true,id:b.requestId};
}
/** Optional owner-only editor function: request Gmail sending permission without sending a message. */
function authorizeEmailNotifications() { console.log('Доступный дневной лимит писем: '+MailApp.getRemainingDailyQuota()); }
/** Owner-only helper. Start your bot in Telegram before running this from the editor. */
function showTelegramChatIds() {
  var token=(PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN')||'').trim();
  if(!/^[0-9]+:[A-Za-z0-9_-]+$/.test(token))throw new Error('Добавьте TELEGRAM_BOT_TOKEN в свойства скрипта.');
  try{
    var response=UrlFetchApp.fetch('https://api.telegram.org/bot'+token+'/getUpdates',{muteHttpExceptions:true});
    if(response.getResponseCode()!==200)throw new Error('Telegram failed');var data=JSON.parse(response.getContentText());if(!data.ok)throw new Error('Telegram failed');
    var ids={};(data.result||[]).forEach(function(update){var message=update.message||update.channel_post;if(message&&message.chat)ids[String(message.chat.id)]=true;});
    if(!Object.keys(ids).length)console.log('Откройте вашего бота, нажмите Start и отправьте сообщение, затем повторите запуск.');
    Object.keys(ids).forEach(function(id){console.log('TELEGRAM_CHAT_ID: '+id);});
  }catch(_){throw new Error('Не удалось получить chat_id. Проверьте токен и доступ к Telegram.');}
}
function notifyLead_(lead) {
  var p=PropertiesService.getScriptProperties(),email=(p.getProperty('NOTIFY_EMAIL')||'').trim(),token=(p.getProperty('TELEGRAM_BOT_TOKEN')||'').trim(),chat=(p.getProperty('TELEGRAM_CHAT_ID')||'').trim();
  var body='Новая заявка — Azamat Works\n\nИмя: '+lead.name+'\nКонтакт: '+lead.contact+'\nУслуга: '+lead.service+'\nБюджет: '+lead.budget+'\n\n'+lead.message+'\n\nТаблица: https://docs.google.com/spreadsheets/d/'+p.getProperty('SHEET_ID')+'/edit';
  var statuses=[];
  if(email){
    try{if(!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email))throw new Error('Invalid destination');if(MailApp.getRemainingDailyQuota()<1)throw new Error('Quota');MailApp.sendEmail({to:email,subject:'Новая заявка с сайта Azamat Works',body:body,name:'Azamat Works'});statuses.push('Email: отправлено');}
    catch(_){statuses.push('Email: ошибка — проверьте адрес, разрешения и квоту');}
  }
  if(token||chat){
    try{
      if(!/^[0-9]+:[A-Za-z0-9_-]+$/.test(token)||!/^(-?[0-9]+|@[A-Za-z0-9_]+)$/.test(chat))throw new Error('Invalid Telegram configuration');
      var response=UrlFetchApp.fetch('https://api.telegram.org/bot'+token+'/sendMessage',{method:'post',contentType:'application/json',payload:JSON.stringify({chat_id:chat,text:body,disable_web_page_preview:true}),muteHttpExceptions:true});
      if(response.getResponseCode()!==200||JSON.parse(response.getContentText()).ok!==true)throw new Error('Telegram failed');statuses.push('Telegram: отправлено');
    }catch(_){statuses.push('Telegram: ошибка — проверьте бота и chat_id');}
  }
  return statuses.length?statuses.join('; '):'Уведомления не настроены';
}
function listLeads_() {
  var sheet=leadSheet_(),last=sheet.getLastRow();if(last<2)return {leads:[]};var first=Math.max(2,last-99);
  return {leads:sheet.getRange(first,1,last-first+1,8).getValues().reverse().map(function(r){return {date:String(r[0]),id:String(r[1]),name:uncell_(r[2]),contact:uncell_(r[3]),service:uncell_(r[4]),budget:uncell_(r[5]),message:uncell_(r[6]),status:String(r[7])};})};
}
function updateLead_(b) {
  if(typeof b.id!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(b.id)||['Новая','В работе','Завершена'].indexOf(b.status)<0)fail_('Проверьте статус заявки.');
  return withLock_(function(){var sheet=leadSheet_(),last=sheet.getLastRow(),found=last>1?sheet.getRange(2,2,last-1,1).createTextFinder(b.id).matchEntireCell(true).findNext():null;if(!found)fail_('Заявка не найдена.');sheet.getRange(found.getRow(),8).setValue(b.status);return {saved:true};});
}
function github_(method,body) {
  var p=PropertiesService.getScriptProperties(),repo=p.getProperty('GITHUB_REPOSITORY'),token=p.getProperty('GITHUB_TOKEN'),branch=p.getProperty('GITHUB_BRANCH')||'main';
  if(!repo||!token||!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo))fail_('Владелец должен настроить GITHUB_REPOSITORY и GITHUB_TOKEN в свойствах скрипта.','SETUP');
  var url='https://api.github.com/repos/'+repo+'/contents/site.json'+(method==='get'?'?ref='+encodeURIComponent(branch):'');
  var options={method:method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},muteHttpExceptions:true};
  if(body){body.branch=branch;options.contentType='application/json';options.payload=JSON.stringify(body);}
  var response=UrlFetchApp.fetch(url,options),status=response.getResponseCode();
  if(status===409||status===422)fail_('Версия сайта изменилась или ветка защищена. Загрузите актуальную версию перед публикацией.','CONFLICT');
  if(status<200||status>=300)fail_('Нет доступа к файлу сайта в GitHub. Проверьте репозиторий, ветку и разрешение Contents: Read and write.','GITHUB');
  return JSON.parse(response.getContentText());
}
function readSite_() {
  var file=github_('get');if(file.encoding!=='base64'||!file.content)fail_('Не удалось прочитать файл сайта.');
  return {sha:file.sha,data:validateSite_(JSON.parse(Utilities.newBlob(Utilities.base64Decode(file.content.replace(/\s/g,''))).getDataAsString('UTF-8')))};
}
function publishSite_(b) {
  if(typeof b.sha!=='string'||!b.sha)fail_('Сначала загрузите актуальную версию.');
  var data=validateSite_(b.data),text=JSON.stringify(data,null,2)+'\n';if(Utilities.newBlob(text).getBytes().length>900000)fail_('Данные превышают 900 КБ. Уменьшите обложки.');
  // GitHub atomically compares sha during PUT, so concurrent editors cannot silently overwrite one another.
  var result=github_('put',{message:'Update portfolio from authenticated admin',sha:b.sha,content:Utilities.base64Encode(text,Utilities.Charset.UTF_8)});return {sha:result.content.sha};
}

const limits={name:80,logo:40,title:160,intro:500,aboutTitle:160,about:2000,skills:500,contactTitle:160,email:254,telegram:200};

function safeURL(value){return typeof value==='string'&&/^https?:\/\/[^\s<>"']+$/i.test(value);}
function validateSite_(data){
 if(!data||data.version!==1||!data.settings||!Array.isArray(data.projects)||data.projects.length>200)throw Error('Неверный формат данных сайта');
 const settings={};for(const [key,max] of Object.entries(limits)){const v=data.settings[key];if(typeof v!=='string'||v.length>max)throw Error('Проверьте поле '+key);settings[key]=v;}
 if(!settings.name.trim()||!settings.logo.trim()||!settings.title.trim())throw Error('Укажите имя, логотип и заголовок');
 if(settings.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email))throw Error('Проверьте email');
 if(settings.telegram&&(!/^https:\/\/t\.me\/[a-zA-Z0-9_]+$/.test(settings.telegram)))throw Error('Ссылка Telegram: https://t.me/username');
 settings.available=Boolean(data.settings.available);
 const ids=new Set();const projects=data.projects.map(p=>{
 if(!p||typeof p.title!=='string'||!p.title.trim()||p.title.length>80||!['Дизайн','Разработка','Брендинг','Автоматизация','ИИ и боты','Обучение','Продукты'].includes(p.category)||typeof p.description!=='string'||!p.description.trim()||p.description.length>1200||!Number.isInteger(p.year)||p.year<2000||p.year>2100)throw Error('Проверьте название, категорию, описание и год проекта');
 if(typeof p.id!=='string'||!p.id||ids.has(p.id))throw Error('Проекты должны иметь уникальные идентификаторы');ids.add(p.id);
 if(p.url&&!safeURL(p.url))throw Error('Ссылки проектов должны начинаться с https:// или http://');
 if(p.cover&&(typeof p.cover!=='string'||p.cover.length>450000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.cover)))throw Error('Некорректная или слишком большая обложка');
 return {...caseFields(p),id:p.id,title:p.title.trim(),description:p.description.trim(),category:p.category,year:p.year,url:p.url||'',cover:p.cover||'',visual:['sage','orbit','form','mono'].includes(p.visual)?p.visual:'sage',published:p.published!==false};
 });return {version:1,settings,projects};
}
