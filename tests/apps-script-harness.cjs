const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
function harness(){
 const properties=new Map(),cache=new Map(),rows=[],logs=[],calls=[];let now=Date.now(),remote=JSON.parse(fs.readFileSync(__dirname+'/../site.json','utf8')),sha='sha-1';
 function range(row,col,count=1,cols=1){return {getValues:()=>rows.slice(row-1,row-1+count).map(r=>r.slice(col-1,col-1+cols)),setValue:value=>{rows[row-1][col-1]=value;},createTextFinder:text=>({matchEntireCell:()=>({findNext:()=>{const at=rows.findIndex((r,i)=>i>=row-1&&i<row-1+count&&r[col-1]===text);return at<0?null:{getRow:()=>at+1};}})})};}
 const sheet={getLastRow:()=>rows.length,appendRow:r=>rows.push(r),setFrozenRows:()=>{},getRange:range};
 const book={getId:()=> 'private-sheet',getSheetByName:()=>sheet,insertSheet:()=>sheet};
 const scriptProperties={getProperty:key=>properties.get(key)||null,setProperty:(key,value)=>properties.set(key,value),setProperties:obj=>Object.entries(obj).forEach(([k,v])=>properties.set(k,v))};
 const scriptCache={get:key=>{const v=cache.get(key);return v&&v.expires>now?v.value:null;},put:(key,value,ttl)=>cache.set(key,{value,expires:now+ttl*1000}),remove:key=>cache.delete(key)};
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const ctx=vm.createContext({Date:Clock,console:{log:message=>logs.push(message)},PropertiesService:{getScriptProperties:()=>scriptProperties},CacheService:{getScriptCache:()=>scriptCache},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},SpreadsheetApp:{create:()=>book,openById:()=>book},ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>text})},Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,text)=>Array.from(crypto.createHash('sha256').update(text).digest()),base64Decode:text=>Array.from(Buffer.from(text,'base64')),base64Encode:text=>Buffer.from(text).toString('base64'),newBlob:text=>({getBytes:()=>Buffer.from(text),getDataAsString:()=>Buffer.from(text).toString('utf8')})},UrlFetchApp:{fetch:(url,opts)=>{
 calls.push({url,method:opts.method});let code=200,payload;
 if(opts.method==='get')payload={sha,encoding:'base64',content:Buffer.from(JSON.stringify(remote)).toString('base64')};
 else{const data=JSON.parse(opts.payload);if(data.sha!==sha){code=409;payload={message:'conflict'};}else{remote=JSON.parse(Buffer.from(data.content,'base64').toString());sha+='-next';payload={content:{sha}};}}
 return {getResponseCode:()=>code,getContentText:()=>JSON.stringify(payload)};
 }}});
 vm.runInContext(fs.readFileSync(__dirname+'/../google-apps-script/Code.gs','utf8'),ctx);
 properties.set('GITHUB_REPOSITORY','owner/portfolio');properties.set('GITHUB_TOKEN','server-test-secret');
 ctx.setup();const password=logs.find(x=>x.startsWith('Новый пароль')).split(': ').slice(1).join(': ');
 function request(body){return JSON.parse(ctx.doPost({postData:{contents:JSON.stringify(body)}}));}
 return {ctx,properties,rows,cache,calls,request,password,advance:ms=>now+=ms,login:()=>request({action:'login',username:'azamat',password}).data.session,getRemote:()=>remote};
}
module.exports={harness};
