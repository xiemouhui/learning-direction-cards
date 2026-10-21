export default async function teardown(){
 try{await fetch('http://127.0.0.1:3001/__test_shutdown',{method:'POST',headers:{'x-test-server':'isolated-e2e'},signal:AbortSignal.timeout(2000)});}catch{/* 失败启动时服务器可能不存在。 */}
}
