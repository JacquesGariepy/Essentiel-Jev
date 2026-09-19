/** Raw local HTTP transport for tests. Node fetch overwrites Sec-Fetch-Mode,
 * so it cannot model a browser navigation's Fetch Metadata faithfully. */
import http from 'node:http';
export function browserRequest(url, options={}) {
  return new Promise((resolve,reject)=>{
    const req=http.request(url,{method:options.method||'GET',headers:options.headers||{}},res=>{
      const chunks=[];
      res.on('data',chunk=>chunks.push(chunk));res.on('error',reject);
      res.on('end',()=>{
        const headers=new Headers();
        for(const [key,value] of Object.entries(res.headers)){
          if(Array.isArray(value))for(const item of value)headers.append(key,item);
          else if(value!==undefined)headers.set(key,value);
        }
        resolve(new Response([204,205,304].includes(res.statusCode)?null:Buffer.concat(chunks),{status:res.statusCode,headers}));
      });
    });
    req.setTimeout(10000,()=>req.destroy(new Error('Local test HTTP timeout')));
    req.on('error',reject);req.end(options.body);
  });
}
