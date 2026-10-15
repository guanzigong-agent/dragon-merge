/* Small, deliberately approximate physics scene for UI review only. */
(function () {
  'use strict';
  const D=window.DragonDemo;
  const W=394,H=560,FLOOR=548,LINE=118;
  const FIXED_STEP=1/120,GRAVITY=2800,MAX_FALL_SPEED=1500,SPAWN_SPEED=300;
  class Scene {
    constructor(canvas,callbacks={}) {
      this.canvas=canvas;this.ctx=canvas.getContext('2d');this.callbacks=callbacks;
      this.bodies=[];this.particles=[];this.pointer=W/2;this.score=0;this.best=0;this.stamina=100;
      this.paused=false;this.stopped=false;this.locked=false;this.sequenceIndex=0;this.sequence=[0,0,1,0,2,1,0,2,3,0,1];
      this.nextId=1;this.lineTime=0;this.lastDrop=-Infinity;this.lastTime=0;this.accumulator=0;
      this.reset();
      this.frame=this.frame.bind(this);this.raf=requestAnimationFrame(this.frame);
    }
    make(level,x,y,vx=0) {
      return {id:this.nextId++,level,x,y,r:D.animals[level].radius,vx,vy:0,angle:0,age:0};
    }
    nextLevel() {return this.sequence[this.sequenceIndex%this.sequence.length];}
    reset() {
      this.bodies=[this.make(5,72,FLOOR-50),this.make(4,177,FLOOR-42),this.make(1,247,FLOOR-22),this.make(2,325,FLOOR-28)];
      this.particles=[];this.score=0;this.stamina=100;this.sequenceIndex=0;
      this.pointer=W/2;this.paused=false;this.stopped=false;this.lineTime=0;this.lastDrop=-Infinity;this.accumulator=0;
      this.emit();this.draw();
    }
    emit() {if(this.callbacks.update)this.callbacks.update(this.snapshot());}
    snapshot() {return {score:this.score,best:this.best,stamina:this.stamina,next:this.nextLevel(),pointer:this.pointer,paused:this.paused,stopped:this.stopped,bodies:this.bodies.map(b=>({level:b.level,x:b.x,y:b.y,r:b.r}))};}
    aim(x) {const r=D.animals[this.nextLevel()].radius;this.pointer=Math.max(r+7,Math.min(W-r-7,x));}
    drop() {
      if(this.paused||this.stopped||this.locked)return false;
      if(this.stamina<=0){if(this.callbacks.message)this.callbacks.message('演示体力用完了，可以重新开始。');return false;}
      const now=performance.now();if(now-this.lastDrop<230)return false;
      this.lastDrop=now;this.aim(this.pointer);
      const body=this.make(this.nextLevel(),this.pointer,44);body.vy=SPAWN_SPEED;
      this.bodies.push(body);
      this.sequenceIndex++;this.stamina--;this.emit();
      if(this.bodies.length>48)this.overflow();
      return true;
    }
    setPaused(value) {this.paused=Boolean(value);this.emit();}
    demo(level=3) {
      level=Math.max(0,Math.min(9,level));this.reset();
      const r=D.animals[level].radius;
      this.bodies=[this.make(level,W/2-r*.91,FLOOR-r-55,12),this.make(level,W/2+r*.91,FLOOR-r-55,-12)];
      if(this.callbacks.message)this.callbacks.message('两只'+D.animals[level].short+'相遇，看看会变成谁。');
      this.emit();
    }
    overflow() {
      if(this.stopped)return;
      this.stopped=true;this.paused=true;this.emit();
      if(this.callbacks.overflow)this.callbacks.overflow();
    }
    merge(a,b) {
      const level=a.level+1;
      if(level>=D.animals.length)return null;
      const body=this.make(level,(a.x+b.x)/2,(a.y+b.y)/2,(a.vx+b.vx)/2);
      body.vy=(a.vy+b.vy)*.25-40;body.angle=(a.angle+b.angle)/2;
      this.score+=10*Math.pow(2,level);this.best=Math.max(this.best,this.score);
      for(let i=0;i<12;i++){
        const angle=i*Math.PI/6;
        this.particles.push({x:body.x,y:body.y,vx:Math.cos(angle)*65,vy:Math.sin(angle)*65,life:.65});
      }
      if(this.callbacks.merge)this.callbacks.merge(level);
      this.emit();return body;
    }
    step(dt) {
      if(this.paused||this.locked)return;
      for(const b of this.bodies){
        b.age+=dt;b.vy=Math.min(MAX_FALL_SPEED,b.vy+GRAVITY*dt);
        b.x+=b.vx*dt;b.y+=b.vy*dt;b.angle+=b.vx*dt/Math.max(15,b.r);
        b.vx*=Math.pow(.76,dt);
        if(b.x<b.r+5){b.x=b.r+5;b.vx=Math.abs(b.vx)*.24;}
        if(b.x>W-b.r-5){b.x=W-b.r-5;b.vx=-Math.abs(b.vx)*.24;}
        if(b.y>FLOOR-b.r){b.y=FLOOR-b.r;b.vy=Math.abs(b.vy)>35?-Math.abs(b.vy)*.12:0;b.vx*=.96;}
      }
      for(let pass=0;pass<4;pass++){
        const removed=new Set(),added=[];
        for(let i=0;i<this.bodies.length;i++){
          const a=this.bodies[i];if(removed.has(a.id))continue;
          for(let j=i+1;j<this.bodies.length;j++){
            const b=this.bodies[j];if(removed.has(b.id))continue;
            const dx=b.x-a.x,dy=b.y-a.y;const dist=Math.hypot(dx,dy);const sum=a.r+b.r;
            if(dist>=sum)continue;
            if(a.level===b.level&&a.level<10){
              const merged=this.merge(a,b);removed.add(a.id);removed.add(b.id);added.push(merged);break;
            }
            const nx=dist>.001?dx/dist:1,ny=dist>.001?dy/dist:0;
            const invA=1/(a.r*a.r),invB=1/(b.r*b.r),invSum=invA+invB;
            const overlap=Math.min(sum-dist,28);
            a.x-=nx*overlap*invA/invSum;a.y-=ny*overlap*invA/invSum;
            b.x+=nx*overlap*invB/invSum;b.y+=ny*overlap*invB/invSum;
            const relative=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
            if(relative<0){
              const impulse=-relative*1.12/invSum;
              a.vx-=impulse*nx*invA;a.vy-=impulse*ny*invA;
              b.vx+=impulse*nx*invB;b.vy+=impulse*ny*invB;
            }
          }
        }
        if(removed.size)this.bodies=this.bodies.filter(b=>!removed.has(b.id)).concat(added);
      }
      for(const b of this.bodies){b.x=Math.max(b.r+5,Math.min(W-b.r-5,b.x));b.y=Math.min(FLOOR-b.r,b.y);}
      const piled=this.bodies.some(b=>b.age>1.8&&b.y-b.r<LINE&&Math.abs(b.vy)<48);
      this.lineTime=piled?this.lineTime+dt:0;
      if(this.lineTime>1.8)this.overflow();
      this.particles=this.particles.filter(p=>p.life>0);
      for(const p of this.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;}
    }
    draw() {
      const c=this.ctx;c.clearRect(0,0,W,H);
      const bg=D.images[0];
      if(bg.naturalWidth)c.drawImage(bg,0,315,394,515,0,0,W,H);
      else{c.fillStyle='#adcbbb';c.fillRect(0,0,W,H);}
      const wash=c.createLinearGradient(0,0,0,H);wash.addColorStop(0,'#bad3c132');wash.addColorStop(.65,'#e5edc808');wash.addColorStop(1,'#1d663c18');c.fillStyle=wash;c.fillRect(0,0,W,H);
      c.save();c.beginPath();c.setLineDash([5,6]);c.moveTo(10,LINE);c.lineTo(W-10,LINE);
      c.strokeStyle=this.lineTime>0?'#a66042':'#698d6670';c.lineWidth=1;c.stroke();c.restore();
      const level=this.nextLevel();const r=D.animals[level].radius;this.aim(this.pointer);
      c.save();c.setLineDash([2,7]);c.strokeStyle='#4873524d';c.beginPath();c.moveTo(this.pointer,44+r+10);c.lineTo(this.pointer,FLOOR);c.stroke();c.restore();
      if(!this.stopped)D.draw(c,level,this.pointer,44,r);
      for(const b of this.bodies)D.draw(c,b.level,b.x,b.y,b.r,b.angle);
      for(const p of this.particles){c.save();c.globalAlpha=Math.max(0,p.life/.65);c.fillStyle='#ffdf84';c.beginPath();c.arc(p.x,p.y,2.5,0,Math.PI*2);c.fill();c.restore();}
      c.fillStyle='#466c492d';c.fillRect(0,FLOOR+1,W,H-FLOOR);
    }
    frame(time) {
      const elapsed=this.lastTime?Math.min(.1,Math.max(0,(time-this.lastTime)/1000)):0;this.lastTime=time;
      if(this.paused||this.locked)this.accumulator=0;
      else{
        this.accumulator+=elapsed;
        while(this.accumulator>=FIXED_STEP){this.step(FIXED_STEP);this.accumulator-=FIXED_STEP;}
      }
      this.draw();this.raf=requestAnimationFrame(this.frame);
    }
  }
  D.Scene=Scene;
})();
