/* Anonymous, casual-play scores. Client-reported points are not anti-cheat proof. */
class HttpError extends Error {
  constructor(status,code,message){super(message);Object.assign(this,{status,code});}
}
const fail=(status,code,message)=>{throw new HttpError(status,code,message);};
async function tokenIdentity(request,db) {
  const auth=request.headers.get('Authorization');
  if(!auth)return {token:null,hash:null,player:null};
  const token=/^Bearer ([a-f0-9]{64})$/.exec(auth)?.[1];
  if(!token)fail(401,'invalid_identity','玩家身份无效，请重新打开游戏。');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
  const hash=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
  const player=await db.prepare('SELECT * FROM players WHERE token_hash = ?1').bind(hash).first();
  return {token,hash,player};
}
async function readJson(request) {
  if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))fail(415,'content_type','请使用 JSON 提交成绩。');
  const reader=request.body?.getReader();if(!reader)fail(400,'empty_body','提交内容为空。');
  let size=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
    if(size>1024){await reader.cancel();fail(413,'body_too_large','提交内容过长。');}chunks.push(value);
  }
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{fail(400,'invalid_json','提交格式有误，请重试。');}
}
function validate(data) {
  if(!data||typeof data.nickname!=='string')fail(400,'invalid_nickname','请输入 1—12 个字的昵称。');
  const nickname=data.nickname.normalize('NFKC').trim().replace(/\s+/g,' ');
  if(!nickname||Array.from(nickname).length>12||/[\u0000-\u001f\u007f\u200b-\u200f\u2060\ufeff]/.test(nickname))fail(400,'invalid_nickname','请输入 1—12 个字的昵称。');
  if(data.mode!=='free-v2'||!Number.isSafeInteger(data.score)||data.score<=0||data.score>1e9||data.score%20!==0)fail(400,'invalid_score','成绩格式有误，请完成一次正常合成后重试。');
  return {nickname,key:nickname.toLowerCase(),score:data.score};
}
async function leaderboard(db,playerId=null) {
  const result=await db.prepare('SELECT id, nickname, best_score AS score, RANK() OVER (ORDER BY best_score DESC) AS rank FROM players ORDER BY best_score DESC, reached_at ASC, id ASC LIMIT 50').all();
  const rows=result.results.map(row=>({nickname:row.nickname,score:row.score,rank:row.rank,isYou:row.id===playerId}));
  const mine=playerId?await db.prepare('SELECT nickname, best_score AS score, 1 + (SELECT COUNT(*) FROM players other WHERE other.best_score > players.best_score) AS rank FROM players WHERE id = ?1').bind(playerId).first():null;
  return {leaderboard:rows,me:mine?{...mine,isYou:true}:null,mode:'free-v2'};
}
export function createHandler({now=()=>Date.now()}={}) {
  return async function handle(request,env) {
    const origin=request.headers.get('Origin'),allowed=env.ALLOWED_ORIGIN;
    const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin'};
    if(origin&&origin===allowed)Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600'});
    const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
    try{
      const path=new URL(request.url).pathname;
      if(origin&&origin!==allowed)fail(403,'origin_denied','此来源不允许访问排行榜。');
      if(!['/health','/api/leaderboard','/api/scores'].includes(path))fail(404,'not_found','接口不存在。');
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
      const method=path==='/api/scores'?'POST':'GET';
      if(request.method!==method)fail(405,'method_not_allowed','请求方式不支持。');
      if(method==='POST'&&(!origin||origin!==allowed))fail(403,'origin_required','请从游戏网页提交成绩。');
      if(!env.DB)fail(503,'unavailable','排行榜暂时无法连接，请稍后重试。');
      if(path==='/health'){await env.DB.prepare('SELECT 1 AS ok').first();return json({ok:true});}
      const identity=await tokenIdentity(request,env.DB);
      if(method==='GET')return json(await leaderboard(env.DB,identity.player?.id));
      const input=validate(await readJson(request));
      if(!identity.token)fail(401,'identity_required','缺少玩家身份，请重新打开游戏。');
      const time=now();let playerId=identity.player?.id,improved=false,created=false;
      if(!identity.player){
        playerId=crypto.randomUUID();
        await env.DB.prepare('INSERT INTO players (id, nickname, nickname_key, token_hash, best_score, reached_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)').bind(playerId,input.nickname,input.key,identity.hash,input.score,time).run();
        improved=true;created=true;
      }else{
        const old=identity.player;
        if(input.score>old.best_score||input.key!==old.nickname_key){
          const result=await env.DB.prepare('UPDATE players SET nickname = ?1, nickname_key = ?2, reached_at = CASE WHEN ?3 > best_score THEN ?4 ELSE reached_at END, best_score = MAX(best_score, ?3), updated_at = ?4 WHERE id = ?5 AND updated_at <= ?6').bind(input.nickname,input.key,input.score,time,playerId,time-2000).run();
          if(!result.meta.changes)fail(429,'too_fast','提交有点快，请稍等两秒再试。');
          improved=input.score>old.best_score;
        }
      }
      return json({...await leaderboard(env.DB,playerId),improved,...(created?{token:identity.token}:{})},created?201:200);
    }catch(error){
      if(error instanceof HttpError)return json({error:{code:error.code,message:error.message}},error.status);
      if(String(error.message).includes('UNIQUE constraint failed'))return json({error:{code:'nickname_taken',message:'这个昵称已有人使用，请换一个昵称。'}},409);
      return json({error:{code:'unavailable',message:'排行榜暂时无法连接，成绩未确认保存，请稍后重试。'}},503);
    }
  };
}
const handle=createHandler();
export default {fetch:(request,env)=>handle(request,env)};
