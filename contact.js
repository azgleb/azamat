(()=>{
const form=document.querySelector('#inquiry-form'),status=document.querySelector('#inquiry-status'),button=form.querySelector('[type=submit]');
let started=Date.now(),requestId=crypto.randomUUID(),pending=false;
if(!PortfolioAPI.configured()){status.textContent='Форма скоро начнёт принимать заявки. Пока воспользуйтесь контактами ниже.';button.disabled=true;}
form.addEventListener('input',()=>{if(!pending)requestId=crypto.randomUUID();});
form.onsubmit=async e=>{e.preventDefault();if(pending)return;pending=true;const data=new FormData(form);for(const control of form.elements)control.disabled=true;status.classList.remove('error');status.textContent='Отправляем заявку…';
try{await PortfolioAPI.call('submitLead',{requestId,name:data.get('name').trim(),contact:data.get('contact').trim(),service:data.get('service'),budget:data.get('budget'),message:data.get('message').trim(),website:data.get('website'),elapsedMs:Date.now()-started,consent:data.has('consent')});
form.reset();requestId=crypto.randomUUID();started=Date.now();status.textContent='Спасибо! Заявка сохранена. Я свяжусь с вами по указанному контакту.';
}catch(error){status.textContent=error.message+' Заявку можно отправить повторно; одинаковая заявка не будет записана дважды.';status.classList.add('error');}finally{pending=false;for(const control of form.elements)control.disabled=false;}};
})();
