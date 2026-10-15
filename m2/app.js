(function () {
  'use strict';
  const D=window.DragonDemo,$=id=>document.getElementById(id);
  const board=new D.PreviewLeaderboard();
  let scene,items,gesture=null,activeDialog=null,toastTimer,comboTimer;
  const format=value=>value.toLocaleString('zh-CN');
  function toast(message) {
    clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;
    toastTimer=setTimeout(()=>$('toast').hidden=true,3500);
  }
  function combo(level) {
    clearTimeout(comboTimer);$('combo').textContent=level===10?'龙神珠！本局继续':'合成 '+D.animals[level].short+' +'+10*2**level;
    $('combo').classList.add('show');comboTimer=setTimeout(()=>$('combo').classList.remove('show'),1600);
  }
  function update(state) {
    const modal=Boolean(document.querySelector('dialog[open]'));
    const blocked=state.paused||state.stopped||modal;
    $('score').textContent=format(state.score);$('best').textContent=format(state.best);$('stamina').textContent='∞';
    $('current-name').textContent='准备投放 · '+D.animals[state.next].short;
    D.portrait($('next-animal'),scene?scene.sequence[(scene.sequenceIndex+1)%scene.sequence.length]:0);
    $('pause-overlay').hidden=!state.paused||modal;
    $('pause-overlay').querySelector('span').textContent=state.stopped?'超过停止线了':'稍歇片刻';
    $('resume').textContent=state.stopped?'腾出位置继续':'继续游玩';
    $('pause').textContent=state.paused?'▷':'Ⅱ';$('pause').setAttribute('aria-label',state.paused?'继续游戏':'暂停游戏');
    $('drop').disabled=blocked||state.itemTargeting;
    $('item-remove').disabled=blocked;
    $('item-remove').setAttribute('aria-pressed',String(state.itemTargeting));
    $('item-swap').disabled=blocked||state.itemTargeting;$('item-shake').disabled=blocked||state.itemTargeting;
    $('item-hint').hidden=!state.itemTargeting;$('arena').classList.toggle('targeting',state.itemTargeting);
    $('stop-score').textContent=format(state.score);$('ranking-score').textContent=format(state.score);$('submit-score').disabled=state.score<=0;
  }
  function openDialog(dialog,back=null) {
    if(dialog.open)return;
    items.cancel();gesture=null;
    const previous=activeDialog;
    dialog.restorePause=previous?previous.restorePause:scene.paused;
    dialog.back=back;
    if(previous)previous.close();
    activeDialog=dialog;scene.locked=true;scene.setPaused(true);dialog.showModal();scene.emit();
    if(dialog===$('leaderboard-dialog')){
      renderRanks();feedback(scene.score?'输入昵称，模拟提交本局最高成绩。':'先合成获得积分，再提交本局成绩。');
    }
  }
  function closeDialog(dialog) {if(dialog.open)dialog.close();}
  function reset() {
    items.cancel();gesture=null;
    if(activeDialog){activeDialog.back=null;activeDialog.restorePause=false;activeDialog.close();}
    scene.locked=false;scene.reset();$('drop-hint').classList.remove('fade');$('combo').classList.remove('show');
    $('game-canvas').focus({preventScroll:true});
  }
  function requestRestart() {
    if(scene.score>0)openDialog($('restart-dialog'),scene.stopped?$('stop-dialog'):null);
    else reset();
  }
  function pause() {
    if(activeDialog)return;
    items.cancel();gesture=null;
    if(scene.stopped){openDialog($('stop-dialog'));return;}
    scene.setPaused(!scene.paused);
  }
  function point(event) {
    const box=$('game-canvas').getBoundingClientRect();
    return {x:(event.clientX-box.left)/box.width*394,y:(event.clientY-box.top)/box.height*560};
  }
  function dropped() {
    if(scene.drop()){$('drop-hint').classList.add('fade');$('game-canvas').focus({preventScroll:true});}
  }
  function portrait(parent,level) {
    const canvas=document.createElement('canvas');canvas.width=92;canvas.height=92;canvas.setAttribute('aria-hidden','true');parent.appendChild(canvas);D.portrait(canvas,level);
  }
  function populateAnimals() {
    D.animals.forEach((animal,level)=>{
      const row=document.createElement('div');row.className='chain-row';portrait(row,level);
      const label=document.createElement('span');label.className='animal-label';label.textContent=animal.name;row.appendChild(label);
      const number=document.createElement('span');number.className='chain-number';number.textContent=String(level+1).padStart(2,'0');row.appendChild(number);$('side-chain').appendChild(row);
      const card=document.createElement('div');card.className='catalog-card';portrait(card,level);
      const name=document.createElement('span');name.textContent=animal.name;card.appendChild(name);$('catalog-grid').appendChild(card);
    });
    D.portrait($('stop-portrait'),5);
  }
  function feedback(message,type='') {
    $('ranking-feedback').textContent=message;$('ranking-feedback').className='ranking-feedback '+type;
    $('nickname').setAttribute('aria-invalid',String(type==='error'));
  }
  function renderRanks() {
    const rows=board.ranked();$('ranking-list').replaceChildren();$('mini-ranks').replaceChildren();
    rows.forEach((record,index)=>{
      const row=document.createElement('li');row.className='ranking-row'+(record.isYou?' is-you':'');
      const rank=document.createElement('span');rank.className='ranking-position';rank.textContent=record.rank;
      const name=document.createElement('span');name.className='ranking-name';name.textContent=record.nickname;
      if(record.isYou){const tag=document.createElement('small');tag.textContent='你';name.appendChild(tag);}
      const score=document.createElement('strong');score.className='ranking-points';score.textContent=format(record.score);
      row.append(rank,name,score);$('ranking-list').appendChild(row);
      if(index<3){
        const mini=document.createElement('li'),position=document.createElement('i'),player=document.createElement('span'),points=document.createElement('strong');
        position.textContent=record.rank;player.textContent=record.nickname;points.textContent=format(record.score);mini.append(position,player,points);$('mini-ranks').appendChild(mini);
      }
    });
    const mine=rows.find(record=>record.isYou);
    $('my-rank').textContent=mine?'你 · '+mine.nickname+'　　第 '+mine.rank+' 名 / 最高 '+format(mine.score)+' 分':'你还没有上榜，来合成第一只萌兽吧。';
  }
  D.ready.then(()=>{
    if(D.revision!==document.documentElement.dataset.assetRevision)throw new Error('Animal reference revision mismatch');
    scene=new D.FreeScene($('game-canvas'),{update,merge:combo,message:toast,overflow:()=>openDialog($('stop-dialog'))});
    items=new D.Items(scene,toast);D.scene=scene;D.items=items;D.leaderboard=board;
    populateAnimals();renderRanks();scene.emit();
    const canvas=$('game-canvas');
    canvas.addEventListener('pointerdown',event=>{
      if(event.button!==0||scene.paused||scene.stopped||activeDialog)return;
      event.preventDefault();canvas.focus({preventScroll:true});
      gesture={id:event.pointerId,type:scene.itemTargeting?'remove':'drop'};canvas.setPointerCapture(event.pointerId);
      if(gesture.type==='drop')scene.aim(point(event).x);
    });
    canvas.addEventListener('pointermove',event=>{
      if(scene.itemTargeting||scene.paused||scene.stopped||activeDialog)return;
      if(gesture?.id===event.pointerId||(!gesture&&event.pointerType==='mouse'))scene.aim(point(event).x);
    });
    canvas.addEventListener('pointerup',event=>{
      if(gesture?.id!==event.pointerId)return;
      const action=gesture.type;gesture=null;
      if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
      const pos=point(event);
      if(action==='remove'){items.removeAt(pos.x,pos.y);return;}
      if(scene.itemTargeting)return;
      scene.aim(pos.x);dropped();
    });
    canvas.addEventListener('pointercancel',()=>{gesture=null;});canvas.addEventListener('lostpointercapture',()=>{gesture=null;});
    canvas.addEventListener('keydown',event=>{
      if(activeDialog)return;
      if(['ArrowLeft','ArrowRight','Space'].includes(event.code))event.preventDefault();
      if(event.code==='KeyP'&&!event.repeat){pause();return;}
      if(event.code==='Escape'){items.cancel();return;}
      if(scene.paused||scene.stopped||scene.itemTargeting)return;
      if(event.code==='ArrowLeft')scene.aim(scene.pointer-18);
      if(event.code==='ArrowRight')scene.aim(scene.pointer+18);
      if(event.code==='Space'&&!event.repeat)dropped();
    });
    document.addEventListener('keydown',event=>{
      if(activeDialog||event.target===canvas)return;
      if(event.code==='Escape')items.cancel();
      if(event.code==='KeyP'&&!event.repeat)pause();
    });
    $('drop').addEventListener('click',dropped);$('pause').addEventListener('click',pause);$('resume').addEventListener('click',pause);
    $('item-remove').addEventListener('click',()=>{gesture=null;items.toggleRemove();if(scene.itemTargeting)canvas.focus({preventScroll:true});});
    $('cancel-item').addEventListener('click',()=>items.cancel());$('item-swap').addEventListener('click',()=>items.swap());$('item-shake').addEventListener('click',()=>items.shake());
    $('catalog').addEventListener('click',()=>openDialog($('catalog-dialog')));
    ['leaderboard','footer-leaderboard','side-leaderboard'].forEach(id=>$(id).addEventListener('click',()=>openDialog($('leaderboard-dialog'))));
    $('stop-leaderboard').addEventListener('click',()=>openDialog($('leaderboard-dialog'),$('stop-dialog')));
    $('restart').addEventListener('click',requestRestart);$('stop-restart').addEventListener('click',requestRestart);
    $('confirm-restart').addEventListener('click',reset);$('cancel-restart').addEventListener('click',()=>closeDialog($('restart-dialog')));
    $('side-source').addEventListener('click',()=>openDialog($('info-dialog')));
    $('continue-item').addEventListener('click',()=>{if(items.revive()){$('stop-dialog').restorePause=false;$('stop-dialog').back=null;closeDialog($('stop-dialog'));}});
    $('ranking-form').addEventListener('submit',event=>{
      event.preventDefault();const result=board.submit($('nickname').value,scene.score);
      feedback(result.message,result.ok?'success':'error');
      if(result.ok){$('nickname').value=board.currentNickname;renderRanks();}else $('nickname').focus();
    });
    $('nickname').addEventListener('input',()=>{$('nickname').setAttribute('aria-invalid','false');$('ranking-feedback').classList.remove('error');});
    for(const dialog of document.querySelectorAll('dialog')){
      dialog.querySelector('[data-close]').addEventListener('click',()=>closeDialog(dialog));
      dialog.addEventListener('close',()=>{
        if(activeDialog!==dialog)return;
        activeDialog=null;
        if(dialog.back&&scene.stopped){openDialog(dialog.back);return;}
        scene.locked=false;scene.setPaused(scene.stopped||Boolean(dialog.restorePause));
      });
      dialog.addEventListener('cancel',()=>{gesture=null;});
    }
    document.addEventListener('visibilitychange',()=>{if(document.hidden){gesture=null;items.cancel();scene.setPaused(true);}});
  }).catch(error=>{console.error(error);$('load-error').hidden=false;$('drop').disabled=true;});
})();
