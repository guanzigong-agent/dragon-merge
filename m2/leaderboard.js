/* Sample-only adapter. No network requests, secrets or persistent storage. */
(function () {
  'use strict';
  const D=window.DragonDemo;
  class PreviewLeaderboard {
    constructor() {
      this.records=new Map();this.currentNickname='';this.sequence=0;
      [['山间小鹿',19200],['一口一颗龙珠',12640],['青团',8320],['云游小狐',4480],['慢慢合成',2560]].forEach(([nickname,score])=>this.records.set(nickname,{nickname,score,order:this.sequence++}));
    }
    ranked() {
      const rows=[...this.records.values()].sort((a,b)=>b.score-a.score||a.order-b.order);
      return rows.map((row,index)=>({...row,rank:rows.findIndex(other=>other.score===row.score)+1,isYou:row.nickname===this.currentNickname}));
    }
    submit(nickname,score) {
      const name=String(nickname).normalize('NFKC').trim().replace(/\s+/g,' ');
      if(!name||Array.from(name).length>12||/[\u0000-\u001f\u007f]/.test(name))return {ok:false,message:'请输入 1—12 个字的昵称。'};
      if(!Number.isSafeInteger(score)||score<=0)return {ok:false,message:'先合成获得积分，再提交本局成绩。'};
      const old=this.records.get(name);const improved=!old||score>old.score;
      if(improved)this.records.set(name,{nickname:name,score,order:old?old.order:this.sequence++});
      this.currentNickname=name;
      const row=this.ranked().find(record=>record.isYou);
      return {ok:true,improved,row,message:improved?'模拟提交成功！本页排名第 '+row.rank+'。':'已保留更高成绩 '+row.score.toLocaleString('zh-CN')+' 分，无须重复提交。'};
    }
  }
  D.PreviewLeaderboard=PreviewLeaderboard;
})();
