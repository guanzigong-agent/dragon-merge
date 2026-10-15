import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../src/index.js';
import { database } from './sqlite-d1.mjs';
import { mkdtempSync,rmSync,rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const origin='https://guanzigong-agent.github.io';
function setup(db=database()) {
  let now=Date.now();const handler=createHandler({now:()=>now});const env={DB:db,ALLOWED_ORIGIN:origin};
  async function request(path,body,token,extra={}) {
    if(body!==undefined&&!token)token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
    const headers={Origin:origin,...(body!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{}),...extra};
    const result=await handler(new Request('https://ranking.example'+path,{method:body!==undefined?'POST':'GET',headers,...(body!==undefined?{body:JSON.stringify(body)}:{})}),env);
    return {status:result.status,headers:result.headers,data:await result.json()};
  }
  return {request,db,env,handler,tick:()=>now+=3000};
}
test('scores are shared, ordered and preserve only the owner best',async()=>{
  const f=setup();try{
    assert.deepEqual((await f.request('/api/leaderboard')).data.leaderboard,[]);
    const a=await f.request('/api/scores',{nickname:'小鹿',score:160,mode:'free-v2'});
    assert.equal(a.status,201);assert.match(a.data.token,/^[a-f0-9]{64}$/);assert.equal(a.data.me.score,160);
    const raw=f.db.raw.prepare('SELECT * FROM players').get();assert.notEqual(raw.token_hash,a.data.token);
    const b=await f.request('/api/scores',{nickname:'小狐',score:320,mode:'free-v2'});
    assert.equal(b.data.me.rank,1);
    const read=await f.request('/api/leaderboard',undefined,a.data.token);
    assert.deepEqual(read.data.leaderboard.map(r=>r.nickname),['小狐','小鹿']);assert.equal(read.data.me.rank,2);
    const lower=await f.request('/api/scores',{nickname:'小鹿',score:20,mode:'free-v2'},a.data.token);
    assert.equal(lower.data.me.score,160);assert.equal(lower.data.improved,false);
    f.tick();const higher=await f.request('/api/scores',{nickname:'小鹿',score:640,mode:'free-v2'},a.data.token);
    assert.equal(higher.data.me.rank,1);assert.equal(higher.data.me.score,640);
    assert.equal(f.db.raw.prepare('SELECT COUNT(*) AS n FROM players').get().n,2);
  }finally{f.db.close();}
});
test('nickname ownership, invalid tokens and concurrent claims',async()=>{
  const f=setup();try{
    const claimed=await Promise.all([1,2].map(()=>f.request('/api/scores',{nickname:'同一个名字',score:160,mode:'free-v2'})));
    assert.deepEqual(claimed.map(r=>r.status).sort(),[201,409]);
    const bad=await f.request('/api/scores',{nickname:'另一只',score:160,mode:'free-v2'},'invalid-token');
    assert.equal(bad.status,401);
    assert.equal((await f.request('/api/leaderboard')).data.leaderboard.length,1);
  }finally{f.db.close();}
});
test('tied scores share rank and reach time breaks display ties',async()=>{
  const f=setup();try{
    await f.request('/api/scores',{nickname:'甲',score:160,mode:'free-v2'});f.tick();
    await f.request('/api/scores',{nickname:'乙',score:160,mode:'free-v2'});
    const rows=(await f.request('/api/leaderboard')).data.leaderboard;
    assert.deepEqual(rows.map(r=>r.rank),[1,1]);assert.deepEqual(rows.map(r=>r.nickname),['甲','乙']);
  }finally{f.db.close();}
});
test('database survives reopening; public rows contain no credentials',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'dragon-ranking-'));let f=setup(database(join(dir,'test.sqlite')));
  try{
    const result=await f.request('/api/scores',{nickname:'长久保存',score:160,mode:'free-v2'});f.db.close();
    f=setup(database(join(dir,'test.sqlite')));
    const read=await f.request('/api/leaderboard',undefined,result.data.token);
    assert.equal(read.data.me.nickname,'长久保存');assert.equal(read.data.me.score,160);
    assert.deepEqual(Object.keys(read.data.leaderboard[0]).sort(),['isYou','nickname','rank','score']);
  }finally{f.db.close();rmSync(join(dir,'test.sqlite'),{force:true});rmdirSync(dir);}
});
test('input, body, origin, method and database failures return clear errors',async()=>{
  const f=setup();try{
    for(const data of [{nickname:' ',score:20},{nickname:'太长太长太长太长太长太长太长',score:20},{nickname:'测试',score:0},{nickname:'测试',score:23},{nickname:'测试',score:1e12},{nickname:'测试',score:20,mode:'wrong'}]){
      assert.equal((await f.request('/api/scores',{mode:'free-v2',...data})).status,400);
    }
    assert.equal((await f.request('/api/scores',{nickname:'x',score:20,mode:'free-v2'},null,{Origin:'https://other.example'})).status,403);
    assert.equal((await f.request('/api/scores',{nickname:'x'.repeat(2048),score:20,mode:'free-v2'})).status,413);
    assert.equal((await f.request('/missing')).status,404);
    assert.equal((await f.handler(new Request('https://ranking.example/api/scores',{method:'DELETE',headers:{Origin:origin}}),f.env)).status,405);
    assert.equal((await f.request('/health')).status,200);f.env.DB=null;
    assert.equal((await f.request('/api/leaderboard')).status,503);
  }finally{f.db.close();}
});
test('higher-score writes are rate limited without dropping the old best',async()=>{
  const f=setup();try{
    const a=await f.request('/api/scores',{nickname:'别太快',score:160,mode:'free-v2'});
    assert.equal((await f.request('/api/scores',{nickname:'别太快',score:320,mode:'free-v2'},a.data.token)).status,429);
    f.tick();assert.equal((await f.request('/api/scores',{nickname:'别太快',score:320,mode:'free-v2'},a.data.token)).status,200);
  }finally{f.db.close();}
});
