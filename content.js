window.Portfolio=(()=>{
const limits={name:80,logo:40,title:160,intro:500,aboutTitle:160,about:2000,skills:500,contactTitle:160,email:254,telegram:200};
function safeURL(value){try{return typeof value==='string'&&['https:','http:'].includes(new URL(value).protocol);}catch{return false;}}
function element(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
function validate(data){
 if(!data||data.version!==1||!data.settings||!Array.isArray(data.projects)||data.projects.length>200)throw Error('Неверный формат данных сайта');
 const settings={};for(const [key,max] of Object.entries(limits)){const v=data.settings[key];if(typeof v!=='string'||v.length>max)throw Error('Проверьте поле '+key);settings[key]=v;}
 if(!settings.name.trim()||!settings.logo.trim()||!settings.title.trim())throw Error('Укажите имя, логотип и заголовок');
 if(settings.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email))throw Error('Проверьте email');
 if(settings.telegram&&(!/^https:\/\/t\.me\/[a-zA-Z0-9_]+$/.test(settings.telegram)))throw Error('Ссылка Telegram: https://t.me/username');
 settings.available=Boolean(data.settings.available);
 const ids=new Set();const projects=data.projects.map(p=>{
 if(!p||typeof p.title!=='string'||!p.title.trim()||p.title.length>80||!['Дизайн','Разработка','Брендинг'].includes(p.category)||typeof p.description!=='string'||!p.description.trim()||p.description.length>1200||!Number.isInteger(p.year)||p.year<2000||p.year>2100)throw Error('Проверьте название, категорию, описание и год проекта');
 if(typeof p.id!=='string'||!p.id||ids.has(p.id))throw Error('Проекты должны иметь уникальные идентификаторы');ids.add(p.id);
 if(p.url&&!safeURL(p.url))throw Error('Ссылки проектов должны начинаться с https:// или http://');
 if(p.cover&&(typeof p.cover!=='string'||p.cover.length>450000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.cover)))throw Error('Некорректная или слишком большая обложка');
 return {id:p.id,title:p.title.trim(),description:p.description.trim(),category:p.category,year:p.year,url:p.url||'',cover:p.cover||'',visual:['sage','orbit','form','mono'].includes(p.visual)?p.visual:'sage',published:p.published!==false};
 });return {version:1,settings,projects};
}
function applySettings(s){
 document.title=s.name+' — портфолио';document.querySelector('meta[name="description"]').content=s.intro;
 document.querySelectorAll('.logo').forEach(el=>{el.replaceChildren(document.createTextNode(s.logo),element('span','','®'));});
 const title=document.querySelector('h1');title.textContent=s.title;
 document.querySelector('.hero-bottom p').textContent=s.intro;
 const status=document.querySelector('.hero-top .eyebrow');status.replaceChildren(element('span','status-dot'),document.createTextNode(s.available?'ОТКРЫТ К НОВЫМ ПРОЕКТАМ':'СЕЙЧАС РАБОТАЮ НАД ПРОЕКТАМИ'));status.classList.toggle('unavailable',!s.available);
 document.querySelector('.about h2').textContent=s.aboutTitle;document.querySelector('.about p').textContent=s.about;
 document.querySelector('.skills').replaceChildren(...s.skills.split(',').map(x=>x.trim()).filter(Boolean).map(x=>element('span','',x)));
 const ct=document.querySelector('.contact h2');ct.replaceChildren(document.createTextNode(s.contactTitle),element('span','','↗'));
 const contact=document.querySelector('.contact>p:last-child');contact.replaceChildren();
 if(s.email){const a=element('a','','Написать на '+s.email+' ↗');a.href='mailto:'+s.email;contact.append(a);}
 if(s.telegram){const a=element('a','','Telegram ↗');a.href=s.telegram;a.target='_blank';a.rel='noopener noreferrer';contact.append(a);}
 if(!s.email&&!s.telegram)contact.textContent='Контакты скоро появятся здесь.';
 document.querySelector('footer>span').textContent='© '+new Date().getFullYear()+' '+s.name;
}
return {validate,element,safeURL,limits,applySettings};
})();
