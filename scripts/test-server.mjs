import { mkdirSync,readFileSync,readdirSync } from 'node:fs';
import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { startFixtureProvider } from './fixture-provider.mjs';
const fixture=await startFixtureProvider();
const env={...process.env,DATABASE_URL:'data/e2e.db',MOCK_AI:'0',APP_BASE_URL:'http://127.0.0.1:3001',LLM_PROVIDER:'deepseek',DEEPSEEK_BASE_URL:fixture.url+'/deepseek',DEEPSEEK_API_KEY:'fixture-deepseek-key',DEEPSEEK_MODEL:'fixture-deepseek-a',DEEPSEEK_MODELS:'fixture-deepseek-a,fixture-deepseek-b',OPENAI_BASE_URL:fixture.url+'/openai/v1',OPENAI_API_KEY:'fixture-openai-key',OPENAI_MODEL:'fixture-openai-a',OPENAI_MODELS:'fixture-openai-a,fixture-openai-b',TAVILY_API_KEY:''};
mkdirSync('data',{recursive:true});
const db=new Database(env.DATABASE_URL);db.pragma('foreign_keys=ON');
db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY,created_at TEXT NOT NULL)');
for(const file of readdirSync('migrations').filter(f=>/^\d{4}\.sql$/.test(f)).sort()){
 const version=Number(file.slice(0,4));if(db.prepare('SELECT 1 FROM schema_migrations WHERE version=?').get(version))continue;
 db.transaction(()=>{db.exec(readFileSync('migrations/'+file,'utf8'));db.prepare('INSERT INTO schema_migrations VALUES (?,?)').run(version,new Date().toISOString());})();
}
const release=JSON.parse(readFileSync('knowledge/releases/2026-10-20.4.json','utf8')),body=JSON.stringify(release),now=new Date().toISOString();
db.prepare('INSERT OR IGNORE INTO knowledge_releases VALUES (?,?,?,?,?)').run(release.id,createHash('sha256').update(body).digest('hex'),body,now,now);db.close();
Object.assign(process.env,env);
const { default:next }=await import('next');
const { createServer }=await import('node:http');
const app=next({dev:false,hostname:'127.0.0.1',port:3001});await app.prepare();const handler=app.getRequestHandler();
const server=createServer((request,response)=>{
 if(request.url==='/__test_shutdown'&&request.method==='POST'&&request.headers['x-test-server']==='isolated-e2e'){
  response.end('stopped');setTimeout(()=>{fixture.stop();server.closeAllConnections();server.close();process.exit(0);},100);return;
 }
 void handler(request,response);
});
server.listen(3001,'127.0.0.1');
