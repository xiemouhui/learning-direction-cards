// Isolated HTTP fixture used only by scripts/test-server.mjs; never imported by the application.
import { createServer } from 'node:http';
export async function startFixtureProvider() {
  const server = createServer(async (request, response) => {
    const openai = request.url.startsWith('/openai/');
    const provider = openai ? 'openai' : 'deepseek';
    if (request.headers.authorization !== `Bearer fixture-${provider}-key`) { response.writeHead(401); response.end('{}'); return; }
    const chunks=[];for await(const chunk of request)chunks.push(chunk);
    let body={};try{body=JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{response.writeHead(400);response.end('{}');return;}
    response.setHeader('Content-Type','application/json');
    if(request.url.endsWith('/models')){response.end(JSON.stringify({object:'list',data:['a','b','error'].map(id=>({id:`fixture-${provider}-${id}`,object:'model'}))}));return;}
    if(request.url.endsWith('/tools/search')){
      const bad={title:'虚构偏题资料：Spring',url:'https://archive.org/fixture-spring',summary:'虚构不相关结果，仅用于验证筛选。'};
      const community=[
        {title:'虚构验收资料：认证加密',url:'https://www.bilibili.com/video/BVfixtureAead/',summary:'本条只用于自动验收，表示某位用户的认证加密学习体验，不是真实帖子。'},
        {title:'虚构小红书资料：AEAD学习经验',url:'https://www.xiaohongshu.com/explore/fixture-aead',summary:'虚构学习体验，仅用于测试。'},
        {title:'虚构贴吧资料：认证加密讨论',url:'https://tieba.baidu.com/p/123456789',summary:'虚构讨论，仅用于测试。'},
        {title:'虚构抖音资料：AEAD入门',url:'https://www.douyin.com/video/123456789',summary:'虚构学习体验，仅用于测试。'}
      ];
      const reference=[{title:'虚构验收资料：认证加密',url:'https://cryptography.io/en/latest/hazmat/primitives/aead/',summary:'虚构参考资料，仅用于测试。'}];
      const sites=[...String(body.query).matchAll(/site:([^\s]+)/g)].map(m=>m[1]);
      if(sites.length===1&&body.query?.startsWith('SQL ')){
        if(sites[0]==='xiaohongshu.com'){response.writeHead(429);response.end('{}');return;}
        const selected=sites[0]==='tieba.baidu.com'?[]:community.filter(row=>new URL(row.url).hostname.replace(/^www\./,'')===sites[0]).map(row=>({...row,title:'虚构SQL学习记录'}));
        response.end(JSON.stringify({results:selected}));return;
      }
      const matching=sites.length===1?community.filter(row=>new URL(row.url).hostname.replace(/^www\./,'')===sites[0]):community;
      response.end(JSON.stringify({results:body.query?.startsWith('HTTP ')?[bad]:[...(sites.some(site=>['bilibili.com','xiaohongshu.com','tieba.baidu.com','douyin.com'].includes(site))?matching:reference),bad]}));return;
    }
    if(body.model.endsWith('-error')){response.writeHead(401);response.end(JSON.stringify({error:{message:`fixture-${provider}-key invalid`}}));return;}
    const content=openai?body.input?.find(m=>m.role==='user')?.content:body.messages?.find(m=>m.role==='user')?.content;
    let context={};try{context=JSON.parse(content);}catch{/* invalid test request */}
    const source=context.webResults?.[0]?.id??context.sources?.[0]?.id;
    const explanation=context.searchOutcome?.mode==='compare'?`虚构四平台对照总结：本轮有资料的平台为${[...new Set(context.webResults.map(row=>row.platform))].join('、')}。共同点与分歧需要按来源核对，不把缺失平台当作共识。下一步先做局部验证，摘要不代表完整内容。`:'虚构模型验收：先验证未知基础，再依据结果选择下一步；任务回报本身不改变等级。';
    const draft={explanation,sourceIds:source?[source]:[],evidenceIds:[],questions:['你希望先验证哪项基础？']};
    const text=JSON.stringify(draft);
    response.end(JSON.stringify(openai?{id:'resp-fixture',object:'response',status:'completed',output:[{id:'msg-fixture',type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text,annotations:[]}]}],usage:{input_tokens:10,output_tokens:20,total_tokens:30}}:{choices:[{finish_reason:'stop',message:{content:text}}],usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30}}));
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  return { url:`http://127.0.0.1:${server.address().port}`,stop:()=>{server.closeAllConnections();server.close();} };
}
