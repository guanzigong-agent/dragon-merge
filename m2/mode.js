/* M2 review mode reuses the confirmed M1-R2 scene and frame references. */
(function () {
  'use strict';
  const D=window.DragonDemo;
  class FreeScene extends D.Scene {
    reset() {
      this.nextOverride=null;this.itemTargeting=false;this.orbs=0;this.drops=0;
      this.itemUses={remove:0,swap:0,shake:0,revive:0};
      super.reset();this.stamina=Infinity;this.emit();
    }
    nextLevel() {return this.nextOverride??super.nextLevel();}
    drop() {
      if(this.itemTargeting)return false;
      this.stamina=Infinity;
      if(!super.drop())return false;
      this.nextOverride=null;this.drops++;this.emit();return true;
    }
    merge(a,b) {
      if(a.level===9&&b.level===9)this.orbs++;
      return super.merge(a,b);
    }
    snapshot() {
      return {...super.snapshot(),stamina:Infinity,orbs:this.orbs||0,drops:this.drops||0,itemTargeting:Boolean(this.itemTargeting),itemUses:{...this.itemUses}};
    }
    draw() {
      super.draw();
      if(!this.itemTargeting)return;
      const c=this.ctx;c.save();c.strokeStyle='#fff1b8';c.lineWidth=2.5;c.setLineDash([4,4]);
      for(const b of this.bodies){c.beginPath();c.arc(b.x,b.y,b.r+4,0,2*Math.PI);c.stroke();}
      c.restore();
    }
  }
  D.FreeScene=FreeScene;
})();
