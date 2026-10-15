/* Original video frame references; no original transparent sprite package. */
(function () {
  'use strict';
  const revision='M1-R2';
  const frames = ['frame-0010.jpg','rabbit-reference-m1-r2.jpg','fox-reference-m1-r2.jpg','frame-0196.jpg','frame-0198.jpg'];
  const animals = [
    {name:'小鸟',short:'小鸟',frame:0,crop:[181,273,33,34],radius:15},
    {name:'小兔',short:'小兔',frame:1,crop:[311,786,46,47],radius:22},
    {name:'小鹿',short:'小鹿',frame:2,crop:[22,185,66,67],radius:28},
    {name:'空·小马',short:'小马',frame:2,crop:[22,285,66,67],radius:34},
    {name:'九·小狐',short:'小狐',frame:2,crop:[22,385,66,67],radius:42},
    {name:'呆·小虎',short:'小虎',frame:3,crop:[21,185,69,69],radius:50},
    {name:'风·小麟',short:'小麟',frame:3,crop:[21,285,69,69],radius:58},
    {name:'怒·小雀',short:'小雀',frame:3,crop:[21,385,69,69],radius:67},
    {name:'困·小鲲',short:'小鲲',frame:3,crop:[21,485,69,69],radius:78},
    {name:'喜·小龙',short:'小龙',frame:3,crop:[21,585,69,69],radius:90},
    {name:'龙神珠',short:'龙神珠',frame:4,crop:[20,483,70,70],radius:28}
  ];
  const images = frames.map(name => {const img = new Image();img.src = 'assets/'+name+'?v=m1-r2';return img;});
  const ready = Promise.all(images.map(img => new Promise((resolve,reject) => {
    if(img.complete && img.naturalWidth) resolve(img);
    else {img.addEventListener('load',()=>resolve(img),{once:true});img.addEventListener('error',()=>reject(new Error('Reference image failed: '+img.src)),{once:true});}
  })));
  function draw(ctx,level,x,y,r,angle=0) {
    const animal=animals[level];if(!animal)return;
    const img=images[animal.frame];if(!img.naturalWidth)return;
    const [sx,sy,sw,sh]=animal.crop;
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    ctx.shadowColor='#28594628';ctx.shadowBlur=4;ctx.shadowOffsetY=2;
    ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fillStyle='#e6ebd980';ctx.fill();
    ctx.shadowColor='transparent';ctx.clip();
    ctx.drawImage(img,sx,sy,sw,sh,-r,-r,r*2,r*2);
    ctx.restore();
    ctx.save();ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);
    ctx.strokeStyle=level===10?'#9b6c32':'#d9efd699';ctx.lineWidth=1.6;ctx.stroke();ctx.restore();
  }
  function portrait(canvas,level) {
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
    draw(ctx,level,canvas.width/2,canvas.height/2,canvas.width*.44);
  }
  window.DragonDemo={revision,animals,images,ready,draw,portrait};
})();
