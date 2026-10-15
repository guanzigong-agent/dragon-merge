(function () {
  'use strict';
  const D=window.DragonDemo;
  const $=id=>document.getElementById(id);
  let scene,toastTimer,comboTimer,gesture=null;
  function toast(text) {clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4000);}
  function combo(level) {
    clearTimeout(comboTimer);const box=$('combo');
    box.textContent=level===10?'龙神珠！本局继续':'合成 '+D.animals[level].short+' +'+(10*Math.pow(2,level));
    box.classList.add('show');comboTimer=setTimeout(()=>box.classList.remove('show'),1900);
  }
  function update(state) {
    $('score').textContent=state.score.toLocaleString('zh-CN');$('best').textContent=state.best.toLocaleString('zh-CN');$('stamina').textContent=state.stamina;
    $('current-name').textContent='准备投放 · '+D.animals[state.next].short;
    D.portrait($('next-animal'),scene?scene.sequence[(scene.sequenceIndex+1)%scene.sequence.length]:0);
    $('pause-overlay').hidden=!state.paused||document.querySelector('dialog[open]')!==null;
    $('pause-overlay').querySelector('span').textContent=state.stopped?'超过停止线了':'稍歇片刻';
    $('resume').textContent=state.stopped?'查看提示':'继续游玩';
    $('pause').textContent=state.paused?'▷':'Ⅱ';$('pause').setAttribute('aria-label',state.paused?'继续游戏':'暂停游戏');
    $('drop').disabled=state.paused||state.stopped||state.stamina===0;
  }
  function openDialog(dialog) {
    if(dialog.open)return;
    gesture=null;dialog.restorePause=scene.paused;scene.locked=true;
    scene.setPaused(true);dialog.showModal();$('pause-overlay').hidden=true;
  }
  function closeDialog(dialog) {if(dialog.open)dialog.close();}
  function reset() {
    scene.reset();gesture=null;$('drop-hint').classList.remove('fade');$('combo').classList.remove('show');
    for(const dialog of document.querySelectorAll('dialog[open]')){dialog.restorePause=false;dialog.close();}
    scene.locked=false;scene.setPaused(false);$('game-canvas').focus({preventScroll:true});
  }
  function dropped() {if(scene.drop()){$('drop-hint').classList.add('fade');$('game-canvas').focus({preventScroll:true});}}
  function aim(event) {
    const box=$('game-canvas').getBoundingClientRect();scene.aim((event.clientX-box.left)/box.width*394);
  }
  function pause() {
    gesture=null;
    if(scene.stopped){openDialog($('stop-dialog'));return;}
    if(document.querySelector('dialog[open]'))return;
    scene.setPaused(!scene.paused);
  }
  function makePortrait(parent,level) {
    const canvas=document.createElement('canvas');canvas.width=92;canvas.height=92;canvas.setAttribute('aria-hidden','true');
    parent.appendChild(canvas);D.portrait(canvas,level);return canvas;
  }
  function populate() {
    D.animals.forEach((animal,level)=>{
      const row=document.createElement('div');row.className='chain-row';makePortrait(row,level);
      const label=document.createElement('span');label.className='animal-label';label.textContent=animal.name;row.appendChild(label);
      const number=document.createElement('span');number.className='chain-number';number.textContent=String(level+1).padStart(2,'0');row.appendChild(number);$('side-chain').appendChild(row);
      const card=document.createElement('button');card.className='catalog-card';card.setAttribute('aria-label',animal.name+'，查看合成演示');
      makePortrait(card,level);
      const name=document.createElement('span');name.textContent=animal.name;card.appendChild(name);
      const action=document.createElement('small');action.textContent=level===10?'演示合成龙神珠':'点击演示合成';card.appendChild(action);
      card.addEventListener('click',()=>{
        $('catalog-dialog').restorePause=false;closeDialog($('catalog-dialog'));scene.locked=false;scene.demo(level===10?9:level);$('drop-hint').classList.add('fade');
      });$('catalog-grid').appendChild(card);
    });
    D.portrait($('stop-portrait'),5);
  }
  D.ready.then(()=>{
    if(D.revision!==document.documentElement.dataset.prototypeRevision){
      $('load-error').textContent='页面资源版本不一致，请打开 M1-R2 入口。';
      throw new Error('Prototype asset revision mismatch');
    }
    scene=new D.Scene($('game-canvas'),{update,merge:combo,message:toast,overflow:()=>openDialog($('stop-dialog'))});
    D.scene=scene;populate();scene.emit();
    const canvas=$('game-canvas');
    canvas.addEventListener('pointerdown',event=>{
      if(event.button!==0||scene.paused||scene.stopped||document.querySelector('dialog[open]'))return;
      event.preventDefault();canvas.focus({preventScroll:true});gesture=event.pointerId;canvas.setPointerCapture(event.pointerId);aim(event);
    });
    canvas.addEventListener('pointermove',event=>{if(gesture===event.pointerId||(event.pointerType==='mouse'&&gesture===null&&!scene.paused))aim(event);});
    canvas.addEventListener('pointerup',event=>{if(gesture!==event.pointerId)return;aim(event);gesture=null;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);dropped();});
    canvas.addEventListener('pointercancel',()=>{gesture=null;});
    canvas.addEventListener('lostpointercapture',()=>{gesture=null;});
    canvas.addEventListener('keydown',event=>{
      if(document.querySelector('dialog[open]'))return;
      if(['ArrowLeft','ArrowRight','Space'].includes(event.code))event.preventDefault();
      if(event.code==='KeyP'&&!event.repeat){pause();return;}
      if(scene.paused||scene.stopped)return;
      if(event.code==='ArrowLeft')scene.aim(scene.pointer-18);
      if(event.code==='ArrowRight')scene.aim(scene.pointer+18);
      if(event.code==='Space'&&!event.repeat)dropped();
    });
    document.addEventListener('keydown',event=>{if(event.code==='KeyP'&&event.target!==canvas&&!event.repeat&&!document.querySelector('dialog[open]'))pause();});
    $('drop').addEventListener('click',dropped);$('pause').addEventListener('click',pause);$('resume').addEventListener('click',pause);
    $('restart').addEventListener('click',reset);$('stop-restart').addEventListener('click',reset);
    $('merge-demo').addEventListener('click',()=>{scene.demo(3);$('drop-hint').classList.add('fade');});
    $('catalog').addEventListener('click',()=>openDialog($('catalog-dialog')));
    $('line-demo').addEventListener('click',()=>openDialog($('stop-dialog')));
    $('side-source').addEventListener('click',()=>openDialog($('info-dialog')));
    $('sound-info').addEventListener('click',()=>toast('这一版先评审画面和操作，音效尚未加入。'));
    $('continue-item').addEventListener('click',()=>toast('原版道具效果尚未核对，本版先展示入口。可重新开始继续体验。'));
    for(const dialog of document.querySelectorAll('dialog')){
      dialog.querySelector('[data-close]').addEventListener('click',()=>closeDialog(dialog));
      dialog.addEventListener('close',()=>{scene.locked=false;scene.setPaused(scene.stopped||Boolean(dialog.restorePause));});
      dialog.addEventListener('cancel',()=>{gesture=null;});
    }
    document.addEventListener('visibilitychange',()=>{if(document.hidden){gesture=null;scene.setPaused(true);}});
  }).catch(error=>{console.error(error);$('load-error').hidden=false;$('drop').disabled=true;});
})();
