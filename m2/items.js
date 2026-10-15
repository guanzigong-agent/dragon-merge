/* Proposed effects for the M2 interface review, not verified original rules. */
(function () {
  'use strict';
  const D=window.DragonDemo;
  class Items {
    constructor(scene,message) {this.scene=scene;this.message=message;}
    available() {const s=this.scene;return !s.paused&&!s.stopped&&!s.locked;}
    cancel() {
      const s=this.scene;if(!s.itemTargeting)return;
      s.itemTargeting=false;s.locked=false;s.emit();
    }
    toggleRemove() {
      const s=this.scene;if(s.itemTargeting){this.cancel();return;}
      if(!this.available())return;
      if(!s.bodies.length){this.message('场内还没有萌兽，先投放一只吧。');return;}
      s.itemTargeting=true;s.locked=true;s.emit();
    }
    removeAt(x,y) {
      const s=this.scene;if(!s.itemTargeting)return false;
      const target=[...s.bodies].reverse().find(b=>Math.hypot(b.x-x,b.y-y)<=b.r+5);
      if(!target){this.message('点在萌兽身上即可移除，或点击取消。');return false;}
      s.bodies=s.bodies.filter(b=>b.id!==target.id);s.itemUses.remove++;s.lineTime=0;
      this.cancel();this.message('已移除'+D.animals[target.level].short+'，积分保留。');return true;
    }
    swap() {
      if(!this.available())return false;
      const s=this.scene;s.nextOverride=(s.nextLevel()+1)%4;s.aim(s.pointer);s.itemUses.swap++;s.emit();
      this.message('待投放已换成'+D.animals[s.nextLevel()].short+'。');return true;
    }
    shake() {
      if(!this.available())return false;
      const s=this.scene;
      if(!s.bodies.length){this.message('场内还没有萌兽，先投放一只吧。');return false;}
      s.bodies.forEach((b,i)=>{b.vx=(i%2?1:-1)*(140+(i%3)*35);b.vy=-220;b.age=Math.min(b.age,1);});
      s.lineTime=0;s.itemUses.shake++;s.emit();this.message('摇一摇，让小动物重新找个位置。');return true;
    }
    revive() {
      const s=this.scene;if(!s.stopped)return false;
      let targets=s.bodies.filter(b=>b.y-b.r<220);
      if(!targets.length)targets=[...s.bodies].sort((a,b)=>(a.y-a.r)-(b.y-b.r)).slice(0,3);
      const ids=new Set(targets.map(b=>b.id));s.bodies=s.bodies.filter(b=>!ids.has(b.id));
      for(const b of s.bodies)b.age=Math.min(b.age,1);
      s.stopped=false;s.paused=false;s.lineTime=0;s.itemUses.revive++;s.emit();
      this.message('顶部已腾出空间，保留积分继续玩。');return true;
    }
  }
  D.Items=Items;
})();
