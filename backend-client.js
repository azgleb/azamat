window.PortfolioAPI=(()=>{
let session='';
function configured(){return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(window.PORTFOLIO_BACKEND_URL||'');}
async function call(action,data={}){
 if(!configured())throw Error('Приём заявок и вход ещё не подключены. Владелец сайта должен настроить Google Apps Script.');
 let response;
 try{response=await fetch(window.PORTFOLIO_BACKEND_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,...data,...(session?{session}:{})}),credentials:'omit',redirect:'follow',signal:AbortSignal.timeout(45000)});}catch{throw Error('Не удалось получить ответ сервера. Проверьте интернет и попробуйте снова.');}
 let result;try{result=await response.json();}catch{throw Error('Сервис не ответил. Проверьте публикацию Google Apps Script и доступ «Все».');}
 if(!response.ok||!result.ok){const error=Error(result.error||'Не удалось выполнить запрос');error.code=result.code;if(error.code==='AUTH'){session='';window.dispatchEvent(new Event('portfolio-session-expired'));}throw error;}
 return result.data;
}
async function login(username,password){const result=await call('login',{username,password});session=result.session;return result;}
async function logout(){try{if(session)await call('logout');}finally{session='';}}
return {call,login,logout,configured};
})();
