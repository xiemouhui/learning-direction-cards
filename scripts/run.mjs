import { registerHooks, createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { loadEnvFile } from 'node:process';
const task=process.argv[2];
if(!['database','validate','demo','diagnose','search-acceptance','comparison-acceptance','recovery-drill','backup-database'].includes(task))throw new Error('未知维护脚本。');
if(existsSync(resolve('.env.local')))loadEnvFile(resolve('.env.local'));
process.argv.splice(2,1);
// Node 24 同步模块钩子使用已锁定的 TypeScript 编译器；无 CLI 临时管道或系统用户查询。
registerHooks({
 resolve(specifier,context,nextResolve){
  try{return nextResolve(specifier,context);}catch(error){
   if(specifier.startsWith('.')&&context.parentURL){
    const candidate=resolve(dirname(fileURLToPath(context.parentURL)),specifier)+'.ts';
    if(existsSync(candidate))return {url:pathToFileURL(candidate).href,format:'commonjs',shortCircuit:true};
   }
   throw error;
  }
 },
 load(url,context,nextLoad){
  if(url.endsWith('.ts')){
   const source=readFileSync(fileURLToPath(url),'utf8');
   const result=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true,resolveJsonModule:true}});
   return {format:'commonjs',source:result.outputText,shortCircuit:true};
  }
  return nextLoad(url,context);
 }
});
createRequire(import.meta.url)(resolve(`scripts/${task}.ts`));
