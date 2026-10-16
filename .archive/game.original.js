/* Pulse Thief — Phaser 3.90.0. Fully procedural neon graphics. */
(() => {
  'use strict';
  const W=960,H=600, FIELD={x:42,y:113,w:876,h:406};
  const CONFIG={initialCharges:3, baseNodes:16, nodesPerSector:2, targetFraction:0.74, relayRadius:105, amplifierRadius:158, boltRadius:180};
  const COLORS={cyan:0x49ecff,pink:0xff5ccf,yellow:0xffd36c,purple:0xb797ff,green:0x62ffad,white:0xe4f8ff,dim:0x537b95,navy:0x081527};
  const TYPES=['relay','relay','relay','relay','amp','split','cap','battery'];
  const COLOR_BY_TYPE={relay:COLORS.cyan,amp:COLORS.pink,split:COLORS.yellow,cap:COLORS.purple,battery:COLORS.green};
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

  class PulseScene extends Phaser.Scene {
    constructor(){super({key:'Pulse'});}
    create(){
      this.sector=1;this.score=0;this.best=0;this.muted=false;this.audioContext=null;this.all=[];
      try{this.best=Number(localStorage.getItem('pulse_thief_best')||0);}catch(e){}
      this.makeBackground();this.makeUI();
      this.input.keyboard.on('keydown-R',()=>this.restartRun());
      this.input.keyboard.on('keydown-M',()=>this.toggleMute());
      this.startSector();
    }
    makeBackground(){
      this.add.rectangle(W/2,H/2,W,H,0x07101e);
      const grid=this.add.graphics().setDepth(0);
      grid.lineStyle(1,0x29425d,0.23);
      for(let x=FIELD.x;x<=FIELD.x+FIELD.w;x+=30){grid.lineBetween(x,FIELD.y,x,FIELD.y+FIELD.h);}
      for(let y=FIELD.y;y<=FIELD.y+FIELD.h;y+=30){grid.lineBetween(FIELD.x,y,FIELD.x+FIELD.w,y);}
      const border=this.add.graphics();border.lineStyle(2,0x22718b,0.65);border.strokeRoundedRect(FIELD.x,FIELD.y,FIELD.w,FIELD.h,14);
      border.lineStyle(12,0x12bfe8,0.035);border.strokeRoundedRect(FIELD.x,FIELD.y,FIELD.w,FIELD.h,14);
      for(let i=0;i<38;i++){
        const s=this.add.circle(Phaser.Math.Between(55,907),Phaser.Math.Between(120,512),Phaser.Math.FloatBetween(.4,1.6),0x4aa9cb,.12).setDepth(0);
        this.tweens.add({targets:s,alpha:.42,duration:Phaser.Math.Between(1100,2500),yoyo:true,repeat:-1});
      }
    }
    makeUI(){
      const text=(x,y,str,size=16,color='#d8f6ff')=>this.add.text(x,y,str,{fontFamily:'Arial, sans-serif',fontSize:size+'px',fontStyle:'bold',color});
      this.title=text(44,27,'SECTOR 01',24,'#e2faff');
      text(45,62,'ENERGY NETWORK / CLEAR THE GRID',11,'#749fb5').setLetterSpacing(2);
      this.scoreLabel=text(386,28,'SCORE  000000',18,'#d7eeff');
      this.bestLabel=text(386,60,'BEST  '+String(this.best).padStart(6,'0'),12,'#7299ad');
      this.chargeLabel=text(720,26,'CHARGES  ● ● ●',17,'#ffcf70');
      this.targetLabel=text(720,58,'TARGET  0 / 0',12,'#8eb3c3');
      this.add.rectangle(481,545,872,2,0x21546b,.8);
      this.statusLabel=text(48,561,'CHOOSE A NODE TO INJECT ENERGY',12,'#8ec9df');
      this.helpLabel=text(913,562,'R: RESTART  /  M: SOUND',10,'#5c8199').setOrigin(1,0);
      this.overlay=this.add.container(0,0).setDepth(70).setVisible(false);
      this.overlay.add(this.add.rectangle(480,315,875,405,0x06111e,.88).setStrokeStyle(2,0x32bfd8,.75));
      this.overlayTitle=text(480,213,'SECTOR CLEARED',35,'#7ef4ff').setOrigin(.5);this.overlay.add(this.overlayTitle);
      this.overlayStats=text(480,280,'',17,'#b6dce8').setOrigin(.5);this.overlay.add(this.overlayStats);
      const btnBg=this.add.rectangle(480,369,264,55,0x154356).setStrokeStyle(2,0x52dff0).setInteractive({useHandCursor:true});
      this.overlay.add(btnBg);
      this.btnLabel=text(480,357,'NEXT SECTOR  →',17,'#e5fcff').setOrigin(.5,0);this.overlay.add(this.btnLabel);
      btnBg.on('pointerover',()=>btnBg.setFillStyle(0x206b7b));btnBg.on('pointerout',()=>btnBg.setFillStyle(0x154356));
      btnBg.on('pointerdown',()=>{this.playTone(660,.075,'sine');if(this.won)this.sector++;this.startSector();});
      this.add.text(52,494,'RELAY', {fontSize:'10px',color:'#49ecff'}).setDepth(2);
      this.add.text(117,494,'AMPLIFIER', {fontSize:'10px',color:'#ff5ccf'}).setDepth(2);
      this.add.text(213,494,'SPLITTER', {fontSize:'10px',color:'#ffd36c'}).setDepth(2);
      this.add.text(304,494,'CAPACITOR x2', {fontSize:'10px',color:'#b797ff'}).setDepth(2);
      this.add.text(422,494,'+CHARGE', {fontSize:'10px',color:'#62ffad'}).setDepth(2);
    }
    startSector(){
      if(this.all)for(const node of this.all)node.container.destroy();
      if(this.effects)for(const fx of this.effects)fx.destroy();
      this.all=[];this.effects=[];this.pending=0;this.ended=false;this.busy=false;this.won=false;this.lastReaction=0;
      this.activated=0;this.combo=0;this.maxCombo=0;
      this.charges=CONFIG.initialCharges + (this.sector>=4?1:0);
      const count=Math.min(29,CONFIG.baseNodes+(this.sector-1)*CONFIG.nodesPerSector);
      this.target=Math.ceil(count*CONFIG.targetFraction);
      const positions=[];
      for(let i=0;i<count;i++){
        let x,y,tries=0;
        do{x=Phaser.Math.Between(86,873);y=Phaser.Math.Between(158,459);tries++;}
        while(positions.some(p=>Math.hypot(x-p.x,y-p.y)<65)&&tries<300);
        positions.push({x,y});
      }
      positions.forEach((p,i)=>this.createNode(p.x,p.y,i,count));
      this.overlay.setVisible(false);this.updateHud();this.statusLabel.setText('SELECT A NODE TO START A REACTION');
    }
    createNode(x,y,i,count){
      let type=TYPES[Phaser.Math.Between(0,TYPES.length-1)];
      if(i===0)type='battery';if(i===1)type='amp';if(i===2)type='split';
      const color=COLOR_BY_TYPE[type];
      const container=this.add.container(x,y).setDepth(10);
      const aura=this.add.circle(0,0,24,color,.07).setStrokeStyle(2,color,.15);
      const halo=this.add.circle(0,0,18,color,.075);
      const rim=this.add.circle(0,0,15,0x09192a).setStrokeStyle(2,color,.95);
      const core=this.add.circle(0,0,6,color,.97);
      const icon=this.add.text(0,0,({relay:'●',amp:'✦',split:'◆',cap:'Ⅱ',battery:'+'})[type],{fontFamily:'Arial',fontSize:type==='relay'?'9px':'16px',color:'#07111f',fontStyle:'bold'}).setOrigin(.5);
      container.add([aura,halo,rim,core,icon]);
      const node={x,y,type,color,container,aura,halo,rim,core,icon,hits:0,activated:false,fired:false};
      this.all.push(node);
      container.setSize(47,47).setInteractive(new Phaser.Geom.Circle(0,0,25),Phaser.Geom.Circle.Contains).on('pointerdown',()=>this.inject(node));
      this.tweens.add({targets:aura,scale:Phaser.Math.FloatBetween(1.13,1.37),alpha:.15,duration:Phaser.Math.Between(850,1500),yoyo:true,repeat:-1});
    }
    inject(node){
      if(this.ended||this.busy||node.activated||this.charges<=0)return;
      this.unlockAudio();this.charges--;this.busy=true;this.combo=0;
      this.statusLabel.setText('ENERGY RELEASED — CHAIN IN PROGRESS');
      this.receive(node,true);this.updateHud();
      this.lastReaction=this.time.now;
      const watch=this.time.addEvent({delay:220,loop:true,callback:()=>{
        if(this.ended){watch.remove();return;}
        if(this.time.now-this.lastReaction>750){this.busy=false;watch.remove();this.checkResult();}
      }});
    }
    receive(node,manual=false){
      if(this.ended||node.activated)return;
      node.hits++;this.lastReaction=this.time.now;
      if(node.type==='cap'&&node.hits<2){
        this.spark(node.x,node.y,node.color,9);this.playTone(280,.07,'triangle');
        this.tweens.add({targets:node.rim,scale:1.35,duration:100,yoyo:true});
        return;
      }
      node.activated=true;this.activated++;this.combo++;this.maxCombo=Math.max(this.combo,this.maxCombo);
      const points=100*Math.min(this.combo,12);this.score+=points;
      if(this.score>this.best){this.best=this.score;try{localStorage.setItem('pulse_thief_best',String(this.best));}catch(e){}}
      node.container.disableInteractive();
      this.tweens.add({targets:node.core,scale:1.9,duration:140,yoyo:true});
      this.tweens.add({targets:node.rim,alpha:.26,duration:300});
      node.aura.setFillStyle(node.color,.27);
      this.flashNumber(node.x,node.y,'+'+points,node.color);
      this.spark(node.x,node.y,node.color,node.type==='amp'?16:10);
      this.playTone(Math.min(1000,230+this.combo*46),.095,'sine');
      if(node.type==='battery'){this.charges=Math.min(8,this.charges+1);this.flashNumber(node.x,node.y-24,'+1 CHARGE',COLORS.green);}
      this.updateHud();
      this.time.delayedCall(125,()=>this.fire(node));
    }
    fire(node){
      if(this.ended)return;this.lastReaction=this.time.now;
      const radius=node.type==='amp'?CONFIG.amplifierRadius:CONFIG.relayRadius;
      this.drawShockwave(node.x,node.y,radius,node.color);
      const neighbors=this.all.filter(n=>!n.activated&&n!==node&&dist(n,node)<=radius).sort((a,b)=>dist(a,node)-dist(b,node));
      neighbors.forEach(n=>{
        this.arc(node,n,node.color);
        this.time.delayedCall(75+dist(node,n)*1.5,()=>this.receive(n));
      });
      if(node.type==='split'){
        // Three seeded projectiles; each strikes the closest unactivated node in its sector.
        const others=this.all.filter(n=>!n.activated&&n!==node&&dist(n,node)<CONFIG.boltRadius).sort((a,b)=>dist(b,node)-dist(a,node));
        const chosen=[];
        for(const n of others){const angle=Math.atan2(n.y-node.y,n.x-node.x);if(chosen.every(c=>Math.abs(Math.atan2(Math.sin(angle-c.angle),Math.cos(angle-c.angle)))>.75)){chosen.push({node:n,angle});if(chosen.length>=3)break;}}
        chosen.forEach(({node:n})=>{this.arc(node,n,COLORS.yellow);this.time.delayedCall(160+dist(node,n)*1.6,()=>this.receive(n));});
      }
    }
    drawShockwave(x,y,radius,color){
      const ring=this.add.circle(x,y,2).setStrokeStyle(3,color,.95).setFillStyle(color,.06).setDepth(8);
      this.tweens.add({targets:ring,scale:radius/2,alpha:0,duration:440,ease:'Cubic.easeOut',onComplete:()=>ring.destroy()});
    }
    arc(a,b,color){
      const g=this.add.graphics().setDepth(13);
      g.lineStyle(2,color,1);g.beginPath();g.moveTo(a.x,a.y);
      for(let i=1;i<6;i++){
        const t=i/6,px=a.x+(b.x-a.x)*t,py=a.y+(b.y-a.y)*t;
        const offset=Phaser.Math.Between(-9,9);
        g.lineTo(px+(b.y-a.y)/Math.max(1,dist(a,b))*offset,py-(b.x-a.x)/Math.max(1,dist(a,b))*offset);
      }
      g.lineTo(b.x,b.y);g.strokePath();
      this.tweens.add({targets:g,alpha:0,duration:220,delay:95,onComplete:()=>g.destroy()});
    }
    spark(x,y,color,count){
      for(let i=0;i<count;i++){
        const a=Math.random()*Math.PI*2,r=Phaser.Math.Between(24,55);
        const dot=this.add.circle(x,y,Phaser.Math.Between(1,3),color,1).setDepth(20);
        this.tweens.add({targets:dot,x:x+Math.cos(a)*r,y:y+Math.sin(a)*r,alpha:0,scale:0,duration:Phaser.Math.Between(240,510),ease:'Cubic.easeOut',onComplete:()=>dot.destroy()});
      }
    }
    flashNumber(x,y,s,color){
      const txt=this.add.text(x,y-23,s,{fontFamily:'Arial',fontSize:s.startsWith('+1')?'12px':'13px',fontStyle:'bold',color:'#'+color.toString(16).padStart(6,'0')}).setOrigin(.5).setDepth(30);
      this.tweens.add({targets:txt,y:y-57,alpha:0,duration:650,onComplete:()=>txt.destroy()});
    }
    updateHud(){
      this.title.setText('SECTOR '+String(this.sector).padStart(2,'0'));
      this.scoreLabel.setText('SCORE  '+String(this.score).padStart(6,'0'));
      this.bestLabel.setText('BEST  '+String(this.best).padStart(6,'0'));
      this.chargeLabel.setText('CHARGES  '+('● '.repeat(this.charges)||'EMPTY'));
      this.targetLabel.setText('TARGET  '+this.activated+' / '+this.target+'  ('+this.all.length+' TOTAL)');
    }
    checkResult(){
      if(this.ended)return;
      if(this.activated>=this.target){this.endSector(true);return;}
      if(this.charges<=0){this.endSector(false);return;}
      if(this.all.every(n=>n.activated)){this.endSector(this.activated>=this.target);return;}
      this.statusLabel.setText('CHAIN x'+this.maxCombo+'  •  CHOOSE ANOTHER NODE  •  '+this.charges+' CHARGES LEFT');
    }
    endSector(won){
      this.ended=true;this.won=won;this.overlay.setVisible(true);
      this.overlayTitle.setText(won?'SECTOR CLEARED':'ENERGY DEPLETED').setColor(won?'#7ef4ff':'#ff7ea8');
      if(won){this.score+=this.charges*500;this.updateHud();this.playTone(840,.2,'triangle');}
      this.overlayStats.setText(this.activated+'/'+this.all.length+' nodes activated   •   BEST CHAIN x'+this.maxCombo+'\n\nTOTAL SCORE '+this.score).setAlign('center');
      this.btnLabel.setText(won?'NEXT SECTOR  →':'RETRY SECTOR  ↻');
          }
    restartRun(){this.sector=1;this.score=0;this.tweens.killAll();this.startSector();}
    toggleMute(){this.muted=!this.muted;this.statusLabel.setText(this.muted?'SOUND MUTED':'SOUND ENABLED');}
    unlockAudio(){if(this.audioContext)return;try{this.audioContext=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}
    playTone(freq,duration=.1,type='sine'){
      if(this.muted||!this.audioContext)return;
      try{const ctx=this.audioContext,osc=ctx.createOscillator(),gain=ctx.createGain(),now=ctx.currentTime;
        osc.type=type;osc.frequency.setValueAtTime(freq,now);osc.frequency.exponentialRampToValueAtTime(Math.max(70,freq*.62),now+duration);
        gain.gain.setValueAtTime(.055,now);gain.gain.exponentialRampToValueAtTime(.001,now+duration);
        osc.connect(gain);gain.connect(ctx.destination);osc.start(now);osc.stop(now+duration+.01);
      }catch(e){}
    }
  }
  const game=new Phaser.Game({type:Phaser.AUTO,parent:'game',width:W,height:H,backgroundColor:'#07101e',render:{antialias:true},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[PulseScene]});
})();
