const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {harness}=require('./apps-script-harness.cjs');
test('case fields and ordered materials survive client validation and authenticated publication',()=>{
 const ctx={window:{},URL};vm.runInNewContext(fs.readFileSync('content.js','utf8'),ctx);const h=harness(),session=h.login(),current=h.request({action:'readSite',session}).data;
 const p=current.data.projects[0];p.url='';p.task='Задача';p.solution='Решение';p.result='Результат';p.materials=[{kind:'image',name:'photo.jpg',caption:'Фото',data:p.cover},{kind:'document',name:'example.txt',caption:'Пример',data:'data:application/octet-stream;base64,SGVsbG8='}];
 const checked=ctx.window.Portfolio.validate(current.data);assert.equal(checked.projects[0].materials[1].name,'example.txt');
 assert.equal(h.request({action:'publishSite',session,sha:current.sha,data:checked}).ok,true);assert.equal(h.getRemote().projects[0].task,'Задача');assert.equal(h.getRemote().projects[0].materials.length,2);
 for(const patch of [{name:'bad.html'},{data:'javascript:alert(1)'},{kind:'script'}]){const data=structuredClone(current.data);Object.assign(data.projects[0].materials[1],patch);assert.throws(()=>ctx.window.Portfolio.validate(data));assert.equal(h.request({action:'publishSite',session,sha:'x',data}).ok,false);}
});
