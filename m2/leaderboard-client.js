(function () {
  'use strict';
  class RemoteLeaderboard {
    constructor(apiBase) {
      this.apiBase=apiBase.replace(/\/+$/,'');this.currentNickname='';this.rows=[];this.me=null;this.records=new Map();
      const key='dragon-ranking-player-v1:'+this.apiBase;
      let token;
      try{token=localStorage.getItem(key);}catch{}
      if(!/^[a-f0-9]{64}$/.test(token||''))token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
      this.token=token;
      /* Save before the first request so retries retain ownership after a lost response. */
      try{localStorage.setItem(key,token);}catch{}
    }
    async request(method,path,body) {
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
      try{
        const response=await fetch(this.apiBase+path,{method,signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',headers:{Authorization:'Bearer '+this.token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
        const data=await response.json();
        if(!response.ok)throw new Error(data.error?.message||'排行榜暂时无法连接，请重试。');
        return data;
      }catch(error){
        if(error.name==='AbortError'||error instanceof TypeError)throw new Error('排行榜连接超时或网络不可用，请稍后重试。');
        throw error;
      }finally{clearTimeout(timer);}
    }
    ingest(data) {
      if(!Array.isArray(data.leaderboard))throw new Error('排行榜返回格式有误，请稍后重试。');
      this.rows=data.leaderboard;this.me=data.me||null;this.currentNickname=this.me?.nickname||'';
      this.records=new Map(this.rows.map(row=>[row.nickname,row]));
    }
    ranked(){return this.rows;}
    getMine(){return this.me;}
    async load(){this.ingest(await this.request('GET','/api/leaderboard'));}
    async submit(nickname,score) {
      try{
        const data=await this.request('POST','/api/scores',{nickname,score,mode:'free-v2'});this.ingest(data);
        return {ok:true,improved:data.improved,row:this.me,message:data.improved?'成绩已保存！第 '+this.me.rank+' 名。':'已保留最高成绩 '+this.me.score.toLocaleString('zh-CN')+' 分。'};
      }catch(error){return {ok:false,message:error.message};}
    }
  }
  window.DragonDemo.RemoteLeaderboard=RemoteLeaderboard;
})();
