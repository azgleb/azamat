const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const files = {'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/content.js':'content.js','/site.json':'site.json','/admin.html':'admin.html','/admin.js':'admin.js','/admin.css':'admin.css'};
http.createServer((req,res)=>{
 const file=files[new URL(req.url,'http://localhost').pathname];
 if(!file){res.writeHead(404);return res.end('Not found');}
 res.setHeader('Content-Type',{'html':'text/html; charset=utf-8','css':'text/css; charset=utf-8','js':'text/javascript; charset=utf-8','json':'application/json; charset=utf-8'}[file.split('.').pop()]);
 fs.createReadStream(path.join(root,file)).pipe(res);
}).listen(process.env.PORT || 3000,'0.0.0.0',()=>console.log('Portfolio listening on port '+(process.env.PORT || 3000)));
