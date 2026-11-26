(()=>{
 'use strict';
 const root=document.getElementById('taller'),q=s=>root.querySelector(s);
 const stage=q('.stage'),canvas=q('.world');let g=canvas.getContext('2d');g.imageSmoothingEnabled=false;
 let G=g; // contexto sobre el que dibujan las primitivas

 // ───────── Medidas del mundo (píxeles del lienzo de 480 × 270) ─────────
 const W=480,H=270,S=72,STEP=170,TOP=80,FLOOR=206,FEET=226,TOTAL=50,FOCUS=240,REACH=36;

 // ───────── Participantes de muestra para el modo demo: [nombre, rosas, foto] ─────────
 const actors=[['@miso',5,0],['@vera_art',1,1],['@bruno',0,2],['@lucia',25,1],['@dani.rm',0,3],
               ['@nora',2,0],['@keko99',0,2],['@sofi_',8,3],['@tomi',0,1]];
 const tierOf=r=>r>=20?3:r>=5?2:r>=1?1:0;
 const TIER_NAME=['','Marco dorado','Marco de gala','Obra maestra'];

 // ───────── Utilidades ─────────
 const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
 const clamp=(x,l,h)=>Math.min(h,Math.max(l,x)),lerp=(a,b,v)=>a+(b-a)*v;
 const hash=(a,b)=>{const v=Math.sin(a*127.1+b*311.7)*43758.5453;return v-Math.floor(v);};
 const rnd=Math.random;
 function rect(x,y,w,h,c){G.fillStyle=c;G.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
 function poly(pts,c){G.fillStyle=c;G.beginPath();pts.forEach(([x,y],i)=>i?G.lineTo(Math.round(x),Math.round(y)):G.moveTo(Math.round(x),Math.round(y)));G.closePath();G.fill();}
 function line(x,y,X,Y,c,size=1){
   const n=Math.max(1,Math.ceil(Math.max(Math.abs(X-x),Math.abs(Y-y))));G.fillStyle=c;
   for(let i=0;i<=n;i++)G.fillRect(Math.round(lerp(x,X,i/n)-size/2),Math.round(lerp(y,Y,i/n)-size/2),size,size);
 }
 function oval(x,y,rx,ry,c){for(let n=-ry;n<=ry;n++){const w=Math.round(rx*Math.sqrt(Math.max(0,1-(n/ry)**2)));rect(x-w,y+n,w*2+1,1,c);}}
 function glow(x,y,r,rgb,a){
   if(a<=.003)return;const gr=g.createRadialGradient(x,y,0,x,y,r);
   gr.addColorStop(0,`rgba(${rgb},${a})`);gr.addColorStop(1,`rgba(${rgb},0)`);g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2);
 }
 function spark(x,y,s,c,a){G.globalAlpha=clamp(a,0,1);rect(x,y-s,1,s*2+1,c);rect(x-s,y,s*2+1,1,c);G.globalAlpha=1;}

 // Tipografía de 3 × 5 píxeles para las placas de los cuadros.
 const FONT={A:'25755',B:'65656',C:'34443',D:'65556',E:'74647',F:'74644',G:'34553',H:'55755',I:'72227',J:'11152',K:'55655',L:'44447',
   M:'57555',N:'65555',O:'25552',P:'65644',Q:'25563',R:'65655',S:'34216',T:'72222',U:'55557',V:'55552',W:'55575',X:'55255',Y:'55222',Z:'71247',
   0:'75557',1:'26227',2:'61247',3:'61216',4:'55711',5:'74616',6:'34757',7:'71222',8:'75757',9:'75716','@':'25743','_':'00007','.':'00002','-':'00700'};
 function text(str,x,y,c){
   str=str.toUpperCase();let px=Math.round(x-(str.length*4-1)/2);G.fillStyle=c;
   for(const ch of str){const gl=FONT[ch];if(gl)for(let r=0;r<5;r++){const b=+gl[r];for(let k=0;k<3;k++)if(b&(4>>k))G.fillRect(px+k,y+r,1,1);}px+=4;}
 }

 // ───────── Paleta ─────────
 const GD='#7a5220',GM='#b9862f',GO='#e6b84c',GL='#ffe596';
 const THEMES=[
   {wall:'#1c4a45',motif:'#245a52',upper:'#143732'},   // esmeralda
   {wall:'#5a1f2a',motif:'#6c2a36',upper:'#431620'},   // burdeos
   {wall:'#1f3160',motif:'#2a3f76',upper:'#172549'},   // azul noche
   {wall:'#48245a',motif:'#582f6c',upper:'#361a45'}];  // ciruela
 const FRAMES=[
   {b:7,dark:'#2e1a10',mid:'#6e4428',light:'#96633c',deep:'#3f2616',mid2:'#7d4f2e',inner:'#c9a050'},
   {b:8,dark:GD,mid:GM,light:GL,deep:'#8a601f',mid2:GO,inner:GL},
   {b:9,dark:GD,mid:GO,light:'#fff1b8',deep:'#8a601f',mid2:'#f0c659',inner:GL},
   {b:10,dark:'#8a5a16',mid:'#f2c54f',light:'#fff6cf',deep:'#9a6a1c',mid2:'#ffd866',inner:'#fff1b8'}];
 const SKIN='#f0b488',SKIN_D='#cf8c64',HAIR='#4a3528',BERET='#c8402f',BERET_H='#e8644c',BERET_D='#8a2a22';
 const SHIRT='#f4e6c4',SHIRT_D='#cdbd98',STRIPE='#3d5a80',APRON='#2f4a6b',APRON_L='#41618a',APRON_D='#223650';
 const TR='#3a3f52',TR_D='#2a2e3e',OUTLINE='#150f18';
 const FALLBACK=['#c8402f','#e6b84c','#3d5a80','#f4e6c4','#6b8f5a','#a2562f'];

 // ───────── Estado ─────────
 // Cada cuadro guarda una ficha {id, coins, p}; p es la persona {uid, name, pic, hud, ready}.
 let assigned=[],atlasPics=[],mode='',srv=null,lastEv=0,asking=false,demoN=0;
 const people=new Map();
 const atlas=new Image(),plate=mk(S,S),ink=plate.getContext('2d'),blank=mk(S,S);
 const tile=mk(STEP,H),tg=tile.getContext('2d'),vignette=mk(W,H);
 const SW=132,SH=164,OX=44,OY=158,spr=mk(SW,SH),sg=spr.getContext('2d'),sil=mk(SW,SH),lg=sil.getContext('2d');
 let room=1,slot=0,finished=[],lit=new Float32Array(TOTAL+1),personX=0,cam=0,C=0,t=0,life=0,phase='walk';
 let paused=false,speed=1,prev=0,loaded=false,facing=1,moving=0,walkAmt=0,veil=1,cartelT=0,cheerT=0,pt=0,fdt=0;
 let tip=null,tipColor=GO,passNow=0,fx=null,hand={x:8,y:-52},parts=[];
 const dust=Array.from({length:46},(_,k)=>({x:hash(k,1)*W,y:30+hash(k,2)*170,sp:2+hash(k,3)*5,ph:hash(k,4)*6.28}));

 // ───────── Fondo: un tramo de sala prerenderizado ─────────
 function buildTile(th){
   G=tg;
   rect(0,0,STEP,H,th.wall);
   rect(0,0,STEP,10,'#0a1413');
   rect(0,10,STEP,3,GD);rect(0,13,STEP,2,GO);rect(0,15,STEP,1,GL);rect(0,16,STEP,4,GM);
   for(let x=1;x<STEP;x+=5)rect(x,17,3,2,GD);
   rect(0,20,STEP,2,GD);
   rect(0,22,STEP,38,th.upper);
   for(let x=5;x<STEP;x+=10){rect(x,44,1,5,th.motif);rect(x-2,46,5,1,th.motif);}
   rect(0,24,STEP,2,'#090c0d');
   rect(0,60,STEP,1,GL);rect(0,61,STEP,2,GM);rect(0,63,STEP,1,GD);
   for(let r=0;r<8;r++)for(let k=0;k<10;k++){            // damasco
     const x=k*17+(r%2)*8+4,y=68+r*15;
     rect(x,y,1,9,th.motif);rect(x-1,y+1,3,7,th.motif);rect(x-2,y+3,5,3,th.motif);rect(x,y+4,1,1,th.wall);
   }
   rect(0,184,STEP,1,GL);rect(0,185,STEP,2,GM);rect(0,187,STEP,1,GD);
   rect(0,188,STEP,14,'#3b2318');
   for(let x=0;x<STEP;x+=34){rect(x+3,190,28,10,'#2a170e');rect(x+4,191,26,8,'#4a2d1e');rect(x+4,191,26,1,'#62402b');}
   rect(0,202,STEP,4,'#22120b');rect(0,202,STEP,1,'#62402b');
   // Parqué: filas cada vez más altas para dar profundidad.
   const tones=['#8b5a35','#9a673d','#7d4f2e','#a67244'];let y=FLOOR;
   [5,6,7,9,11,13,13].forEach((h,r)=>{
     const off=Math.floor(hash(r,7)*85);
     for(let k=0;k<2;k++){
       const c=tones[Math.floor(hash(r+1,k+3)*4)];
       for(const x of [off+k*85,off+k*85-STEP]){
         rect(x,y,85,h,c);rect(x,y,1,h,'#5e3a22');
         rect(x+8+hash(r,k)*38,y+Math.floor(h/2),16+hash(k,r)*20,1,'rgba(60,30,12,.28)');
         rect(x+30+hash(k+5,r)*30,y+1,12,1,'rgba(255,220,170,.10)');
       }
     }
     rect(0,y,STEP,1,'#5e3a22');y+=h;
   });
   // Pilastra de piedra con capitel dorado y aplique.
   const px=77;
   rect(px,22,16,184,'#77705c');rect(px,22,3,184,'#9a927a');rect(px+3,22,1,184,'#857d67');rect(px+12,22,4,184,'#575242');
   rect(px+6,34,1,160,'#666050');rect(px+9,34,1,160,'#666050');
   rect(px-3,22,22,3,GO);rect(px-2,25,20,2,GM);rect(px-1,27,18,2,GD);rect(px-3,22,22,1,GL);
   rect(px-2,196,20,3,GM);rect(px-3,199,22,3,GO);rect(px-3,202,22,4,GD);rect(px-3,199,22,1,GL);
   rect(px+6,101,4,9,GD);rect(px+3,108,10,2,GM);rect(px+4,104,8,4,GO);rect(px+4,104,8,1,GL);rect(px+7,96,2,8,'#f3e9c9');
   G=g;
 }
 function buildStatic(){
   // Lienzo en blanco con trama de tela.
   G=blank.getContext('2d');rect(0,0,S,S,'#efe2c4');
   for(let y=0;y<S;y+=3)for(let x=(y/3%2)*2;x<S;x+=4)rect(x,y,1,1,'#e0d0ac');
   rect(0,0,S,1,'#d9c9a4');rect(0,0,1,S,'#d9c9a4');
   // Viñeta.
   const v=vignette.getContext('2d'),gr=v.createRadialGradient(W/2,122,110,W/2,122,320);
   gr.addColorStop(0,'rgba(3,5,8,0)');gr.addColorStop(1,'rgba(3,5,8,.72)');v.fillStyle=gr;v.fillRect(0,0,W,H);
   const top=v.createLinearGradient(0,0,0,40);top.addColorStop(0,'rgba(3,5,8,.45)');top.addColorStop(1,'rgba(3,5,8,0)');v.fillStyle=top;v.fillRect(0,0,W,40);
   G=g;
 }
 // Cada foto se guarda en tres acabados: mancha sepia, bloques de color y detalle.
 // `Z` es el lado en píxeles: 72 para los cuadros de la galería, 168 para el cuadro gigante.
 function makePic(img,sx,sy,sw,sh,Z=72,clean=false){
   {
     const S=Z,big=mk(S*2,S*2),b=big.getContext('2d');b.imageSmoothingQuality='high';
     b.fillStyle='#1c1f26';b.fillRect(0,0,S*2,S*2);     // fondo opaco: hay avatares con transparencia
     b.drawImage(img,sx,sy,sw,sh,0,0,S*2,S*2);
     const fin=mk(S,S),f=fin.getContext('2d');f.imageSmoothingQuality='high';f.drawImage(big,0,0,S,S);
     if(!clean)try{
       const im=f.getImageData(0,0,S,S),d=im.data;
       for(let j=0;j<d.length;j+=4)for(let k=0;k<3;k++)d[j+k]=clamp(Math.round(d[j+k]/10)*10*.96+[10,7,3][k],0,255);
       f.putImageData(im,0,0);
     }catch(e){}
     const block=(size)=>{const s=mk(size,size),sc=s.getContext('2d');sc.imageSmoothingQuality='high';sc.drawImage(fin,0,0,size,size);
       const o=mk(S,S),oc=o.getContext('2d');oc.imageSmoothingEnabled=false;oc.drawImage(s,0,0,S,S);return [o,oc,sc];};
     const [mid]=block(24),[sep,e]=block(12),tiny=mk(12,12).getContext('2d');tiny.drawImage(fin,0,0,12,12);
     e.globalCompositeOperation='color';e.fillStyle='#a9703f';e.fillRect(0,0,S,S);
     e.globalCompositeOperation='screen';e.fillStyle='rgba(255,230,190,.26)';e.fillRect(0,0,S,S);
     let grid=null;
     try{const d=tiny.getImageData(0,0,12,12).data;grid=[];for(let j=0;j<144;j++)grid.push(`rgb(${d[j*4]},${d[j*4+1]},${d[j*4+2]})`);}catch(e){}
     return {final:fin,mid,sepia:sep,grid,size:S,src:[img,sx,sy,sw,sh]};
   }
 }
 // Foto de reserva (silueta) para quien no tiene avatar o mientras carga.
 function placeholder(uid){
   const c=mk(S,S),x=c.getContext('2d'),h=[...uid].reduce((s,ch)=>s+ch.charCodeAt(0)*7,0)%360;
   x.fillStyle=`hsl(${h},42%,34%)`;x.fillRect(0,0,S,S);x.fillStyle=`hsl(${h},38%,68%)`;
   x.beginPath();x.arc(S/2,27,14,0,7);x.fill();x.beginPath();x.ellipse(S/2,S+8,27,32,0,0,7);x.fill();
   return makePic(c,0,0,S,S);
 }
 const hudOf=pic=>{try{return pic.final.toDataURL();}catch(e){return '';}};
 function person(uid,info){
   info=info||{};const img=info.img||'',key=uid+'|'+img;let p=people.get(key);
   if(p){if(info.name)p.name=info.name;return p;}
   p={uid,name:info.name||uid,pic:null,hud:'',ready:false};people.set(key,p);
   const demo=/^demo:(\d)$/.exec(img);
   if(demo){p.pic=atlasPics[+demo[1]%4];p.hud=hudOf(p.pic);p.ready=true;return p;}
   p.pic=placeholder(uid);p.hud=hudOf(p.pic);
   if(/^https?:/.test(img)){
     const im=new Image(),url='avatar?u='+encodeURIComponent(img);
     im.onload=()=>{const s=Math.min(im.naturalWidth,im.naturalHeight);
       p.pic=makePic(im,(im.naturalWidth-s)/2,(im.naturalHeight-s)/2,s,s);p.hud=url;p.ready=true;if(loaded)ui();};
     im.onerror=()=>{p.ready=true;};setTimeout(()=>{p.ready=true;},5000);im.src=url;
   }else p.ready=true;
   return p;
 }
 function colorAt(pic,px,py){
   const gr=pic.grid;if(!gr)return FALLBACK[Math.floor(rnd()*FALLBACK.length)];
   return gr[clamp(Math.floor(py/6),0,11)*12+clamp(Math.floor(px/6),0,11)];
 }

 // ───────── Decoración ─────────
 function door(x,label){
   rect(x-38,98,76,108,GD);oval(x,98,38,30,GD);rect(x-35,98,70,108,GO);oval(x,98,35,27,GO);
   rect(x-32,98,64,108,'#07090c');oval(x,98,32,24,'#07090c');
   rect(x-32,196,64,10,'#1c120c');
   for(const s of [-1,1]){
     poly([[x+s*32,98],[x+s*21,80],[x+s*12,77],[x+s*19,130],[x+s*25,206],[x+s*32,206]],'#7a1c28');
     poly([[x+s*32,98],[x+s*26,88],[x+s*24,140],[x+s*28,206],[x+s*32,206]],'#a52a38');
     rect(x+s*23-1,128,3,3,GO);
   }
   rect(x-20,60,40,10,GD);rect(x-19,61,38,8,'#c9a455');text(label,x,63,'#3a2a12');
 }
 function pedestal(x){rect(x-7,176,14,30,'#6f6a58');rect(x-7,176,3,30,'#8a8470');rect(x+4,176,3,30,'#565142');rect(x-9,173,18,3,'#8a8470');rect(x-9,203,18,3,'#4f4a3c');}
 function decor(i,x){
   const v=Math.floor(hash(i+room*13,5)*4);
   if(v===0){pedestal(x);poly([[x-7,173],[x+7,173],[x+5,166],[x-5,166]],'#b5ae96');rect(x-2,162,4,4,'#a8a18a');oval(x,157,4,5,'#c4bda4');rect(x+2,154,2,7,'#9d967f');}
   else if(v===1){pedestal(x);oval(x,164,6,8,'#d9dfe8');rect(x-3,153,6,4,'#d9dfe8');rect(x-4,152,8,2,'#b9c2d0');rect(x-5,162,11,2,'#3d5a9a');rect(x-2,167,5,2,'#3d5a9a');rect(x+3,158,2,11,'#aab4c4');}
   else if(v===2){
     for(let k=0;k<7;k++){const a=-1.1+k*.37,len=20+hash(k,i)*16;line(x,190,x+Math.sin(a)*len,190-Math.cos(a)*len,'#24573a',3);line(x,189,x+Math.sin(a)*len,189-Math.cos(a)*len,'#3f8556',1);}
     poly([[x-8,190],[x+8,190],[x+6,206],[x-6,206]],'#a4552f');rect(x-9,188,18,3,'#c06a3c');rect(x+3,191,2,14,'#7f3f22');
   }
 }
 function bigPlant(x){
   for(let k=0;k<9;k++){
     const a=-1.25+k*.31+Math.sin(life*.8+k)*.025,len=46+hash(k,2)*24;let px=x,py=242;
     for(let s=1;s<=8;s++){
       const tt=s/8,nx=x+Math.sin(a)*len*tt,ny=242-Math.cos(a)*len*tt+tt*tt*Math.abs(Math.sin(a))*28;
       line(px,py,nx,ny,'#08170f',4-Math.floor(tt*2));line(px,py-1,nx,ny-1,'#143424',1);px=nx;py=ny;
     }
   }
   rect(x-18,240,36,5,'#241510');poly([[x-16,245],[x+16,245],[x+12,272],[x-12,272]],'#160c09');
 }

 // ───────── Cuadros ─────────
 function drawFrame(i){
   const cx=i*STEP-C,x=cx-S/2,y=TOP,rec=finished[i],a=assigned[i],tier=a?tierOf(a.coins):0,F=FRAMES[tier],b=F.b,L=lit[i];
   // Foco de carril.
   rect(cx-1,26,2,6,'#090c0d');poly([[cx-5,32],[cx+5,32],[cx+7,40],[cx-7,40]],'#14181b');rect(cx-5,40,10,1,L>.4?'#fff2c0':'#3a3a34');
   rect(x-b+2,y-b+4,S+b*2,S+b*2,'rgba(0,0,0,.38)');
   rect(x-b,y-b,S+b*2,S+b*2,F.dark);rect(x-b+1,y-b+1,S+b*2-2,S+b*2-2,F.mid);
   rect(x-b+1,y-b+1,S+b*2-2,1,F.light);rect(x-b+1,y-b+1,1,S+b*2-2,F.light);
   rect(x-b+3,y-b+3,S+b*2-6,S+b*2-6,F.deep);rect(x-b+4,y-b+4,S+b*2-8,S+b*2-8,F.mid2);
   if(tier){                                                   // perlado
     const m=4+Math.floor((b-6)/2),n=Math.floor((S+b*2-m*2)/4);
     for(let k=0;k<=n;k++){const o=m+k*4;
       rect(x-b+o,y-b+m,1,1,F.light);rect(x-b+o,y+S+b-m-1,1,1,F.dark);rect(x-b+m,y-b+o,1,1,F.light);rect(x+S+b-m-1,y-b+o,1,1,F.dark);}
   }
   rect(x-2,y-2,S+4,S+4,F.inner);rect(x-1,y-1,S+2,S+2,'#1c120c');
   G.drawImage(rec?rec.p.pic.final:i===slot?plate:blank,x,y);
   if(tier>=2){                                                // esquinas con gema
     const gem=tier===3?['#3aa0e8','#bfe6ff']:['#d8324a','#ff9aa8'];
     for(const sx of [-1,1])for(const sy of [-1,1]){
       const ox=cx+sx*(S/2+b-4),oy=y+S/2+sy*(S/2+b-4);
       oval(ox,oy,5,5,F.dark);oval(ox,oy,4,4,F.mid2);rect(ox-1,oy-1,3,3,gem[0]);rect(ox-1,oy-1,1,1,gem[1]);
     }
   }
   if(tier===3){                                               // corona
     const cy=y-b;poly([[cx-11,cy+1],[cx-12,cy-8],[cx-6,cy-4],[cx,cy-11],[cx+6,cy-4],[cx+12,cy-8],[cx+11,cy+1]],F.dark);
     poly([[cx-10,cy],[cx-10,cy-6],[cx-5,cy-2],[cx,cy-9],[cx+5,cy-2],[cx+10,cy-6],[cx+10,cy]],F.mid2);
     rect(cx-10,cy-1,21,1,F.light);rect(cx-1,cy-5,3,3,'#d8324a');rect(cx-1,cy-5,1,1,'#ff9aa8');rect(cx-8,cy-3,2,2,'#3aa0e8');rect(cx+7,cy-3,2,2,'#3aa0e8');
   }
   if(fx&&fx.i===i){                                           // destello al terminar
     const f=clamp(1-fx.t/.35,0,1);if(f>0){G.globalAlpha=f*.85;rect(x,y,S,S,'#fff6d8');G.globalAlpha=1;}
     const s=(fx.t-.12)/.75;
     if(s>0&&s<1){G.save();G.beginPath();G.rect(x,y,S,S);G.clip();const o=x-34+s*(S+68);
       poly([[o,y],[o+16,y],[o-8,y+S],[o-24,y+S]],'rgba(255,255,255,.42)');poly([[o+22,y],[o+26,y],[o+2,y+S],[o-2,y+S]],'rgba(255,255,255,.3)');G.restore();}
   }
   if(L<.98)rect(x-b,y-b,S+b*2,S+b*2,`rgba(4,8,12,${(.5*(1-L)).toFixed(3)})`);
   // Placa.
   const label=a?('@'+a.p.uid).slice(0,15):String(i+1).padStart(2,'0'),pw=Math.max(22,label.length*4+7);
   rect(cx-pw/2,165,pw,10,'#4a3416');rect(cx-pw/2+1,166,pw-2,8,a?'#d2ac5a':'#8f7a4a');rect(cx-pw/2+1,166,pw-2,1,a?GL:'#a8935e');
   text(label,cx,168,'#33230e');
   if(rec&&tier>=2){                                           // brillos permanentes
     const n=tier===3?6:2;
     for(let k=0;k<n;k++){const ph=(life*1.3+hash(i,k)*5)%2.4;if(ph<.6){
       const along=hash(k,i+3)*(S+b*2),side=k%4,px=side<2?x-b+along:(side===2?x-b:x+S+b-1),py=side<2?(side?y+S+b-1:y-b):y-b+along;
       spark(px,py,2,'#fff6cf',Math.sin(ph/.6*Math.PI));}}
   }
 }

 // ───────── Pintor (se dibuja en un sprite y se le añade contorno) ─────────
 function leg(hx,hy,fx_,fy,c1,c2){
   const dx=fx_-hx,dy=fy-hy,d=Math.hypot(dx,dy)||1,m=Math.min(d,43.5),ex=hx+dx/d*m,ey=hy+dy/d*m,h=Math.sqrt(Math.max(0,484-m*m/4));
   const kx=(hx+ex)/2+dy/d*h,ky=(hy+ey)/2-dx/d*h;
   line(hx,hy,kx,ky,c1,7);line(kx,ky,ex,ey-3,c2,6);
   rect(ex-4,ey-5,9,5,'#5a3a26');rect(ex+3,ey-3,5,3,'#5a3a26');rect(ex-4,ey-1,12,2,'#2a1a11');
 }
 function arm(sx,sy,hx,hy,sleeve){
   const dx=hx-sx,dy=hy-sy,d=Math.hypot(dx,dy)||1,m=Math.min(d,55.5),ex=sx+dx/d*m,ey=sy+dy/d*m,h=Math.sqrt(Math.max(0,784-m*m/4));
   const kx=(sx+ex)/2-dy/d*h,ky=(sy+ey)/2+dx/d*h;
   line(sx,sy,kx,ky,sleeve,6);line(lerp(sx,kx,.45),lerp(sy,ky,.45),lerp(sx,kx,.6),lerp(sy,ky,.6),STRIPE,6);
   line(kx,ky,ex,ey,SKIN,4);rect(kx-3,ky-3,6,6,sleeve);
   return [ex,ey];
 }
 // `M` solo se usa en la escena del cuadro gigante: {fx, fy, tip, cheer, cheerT, flip} en coordenadas de pantalla.
 function drawPainter(M){
   const tip_=M?M.tip:tip,painting=M?!!M.tip:phase==='paint'&&tip,cheer=M?M.cheer:phase==='admire'&&facing<0,ph=moving*.16,w=M?0:walkAmt;
   let lift=0,crouch=0,lean=0,target,btip;
   if(painting){
     const lx=tip_.x-(M?M.fx:personX),ly=tip_.y-(M?M.fy:FEET);
     lift=clamp((-ly-118)/20,0,1)*3;crouch=clamp((ly+100)/26,0,1)*5;lean=2;
     target={x:lx-11,y:ly+15};btip={x:lx,y:ly};
   }
   const by=crouch-lift-Math.abs(Math.cos(ph))*2*w;
   if(cheer){const wv=Math.sin(life*13)*3;target={x:13+wv,y:-112+by};}
   else if(!painting){const sw=Math.sin(ph)*w;target={x:9-sw*7,y:-52+by+sw*2};}
   // La mano se mueve con suavidad salvo al pintar, donde sigue la pincelada exacta.
   const k=painting?(M?1-Math.exp(-fdt*30):clamp(t/.15,0,1)):1-Math.exp(-fdt*16);
   hand.x=lerp(hand.x,target.x,k);hand.y=lerp(hand.y,target.y,k);
   if(!painting)btip=cheer?{x:hand.x+5,y:hand.y-24}:{x:hand.x+9,y:hand.y-20};

   G=sg;sg.setTransform(1,0,0,1,0,0);sg.clearRect(0,0,SW,SH);sg.setTransform(1,0,0,1,OX,OY);
   const hipY=-44+by,foot=o=>({x:lerp(o>0?6:-5,Math.sin(ph+(o>0?0:Math.PI))*11,w),y:-Math.max(0,Math.cos(ph+(o>0?0:Math.PI)))*5*w});
   const fa=foot(-1),fb=foot(1);
   leg(-3,hipY,fa.x,fa.y,TR_D,TR_D);                                   // pierna lejana
   // Brazo lejano con la paleta.
   const sw2=Math.sin(ph)*w*3;
   line(2+lean,-79+by,14+sw2,-60+by,SHIRT_D,5);
   oval(20+sw2,-57+by,10,4,'#6e4a2a');oval(20+sw2,-58+by,10,3,'#c9965a');
   ['#c8402f','#e6b84c','#3d7a5a','#3d5a80','#f4e6c4'].forEach((c,j)=>rect(13+sw2+j*3,-60+by+(j%2),2,2,c));
   oval(13+sw2,-58+by,2,2,SKIN_D);
   leg(3,hipY,fb.x,fb.y,TR,TR);                                         // pierna cercana
   rect(-7,-48+by,14,8,TR);
   // Camisa de rayas, delantal y pañuelo.
   poly([[-8+lean,-83+by],[6+lean,-84+by],[10+lean,-76+by],[9,-46+by],[-8,-46+by],[-10+lean,-74+by]],SHIRT);
   for(let n=0;n<6;n++)rect(-8,-78+by+n*5,16,2,STRIPE);
   poly([[lean,-78+by],[7+lean,-76+by],[10,-62+by],[11,-30+by],[-6,-30+by],[-7,-50+by],[-2,-62+by]],APRON);
   rect(-7,-52+by,17,2,APRON_D);rect(1,-46+by,7,6,APRON_L);rect(1,-46+by,7,1,APRON_D);
   rect(-3,-38+by,2,2,'#e6b84c');rect(5,-35+by,3,2,'#d8324a');rect(3,-59+by,2,1,'#f4e6c4');rect(-2,-33+by,2,1,'#6bbf8a');
   rect(-6+lean,-87+by,13,4,BERET);poly([[-5+lean,-85+by],[-12+lean,-74+by],[-7+lean,-73+by]],BERET_D);
   // Cabeza de perfil con bigote y boina.
   const hx=3+lean,hy=-98+by,blink=(life%3.4)<.12;
   oval(hx-3,hy+1,10,10,HAIR);oval(hx,hy,10,11,SKIN);
   rect(hx-11,hy-5,6,13,HAIR);rect(hx-6,hy-1,3,5,SKIN_D);
   rect(hx+9,hy-1,4,4,SKIN);rect(hx+10,hy+3,2,1,SKIN_D);
   if(blink)rect(hx+4,hy-3,3,1,HAIR);else{rect(hx+4,hy-5,3,3,'#fffaf0');rect(hx+5,hy-4,2,2,'#2a1c18');}
   rect(hx+3,hy-8,5,1,HAIR);rect(hx+2,hy+4,10,2,HAIR);rect(hx+11,hy+3,2,1,HAIR);rect(hx+1,hy+5,2,2,HAIR);
   if(cheer)rect(hx+4,hy+7,5,2,'#8a2a22');else rect(hx+5,hy+8,3,1,'#b86a50');
   rect(hx+2,hy+1,2,2,'#e89a84');
   oval(hx-2,hy-10,13,5,BERET_D);oval(hx-3,hy-12,12,4,BERET);rect(hx-9,hy-15,8,1,BERET_H);rect(hx-2,hy-19,2,4,BERET_D);rect(hx-9,hy-7,18,2,BERET_D);
   // Brazo que pinta, pincel y mano.
   const [ax,ay]=arm(1+lean,-79+by,hand.x,hand.y,SHIRT);
   const dx=btip.x-ax,dy=btip.y-ay,d=Math.hypot(dx,dy)||1,ux=dx/d,uy=dy/d;
   line(ax-ux*7,ay-uy*7,btip.x-ux*7,btip.y-uy*7,'#8a5a30',2);
   line(btip.x-ux*9,btip.y-uy*9,btip.x-ux*6,btip.y-uy*6,'#c8ccd0',3);
   line(btip.x-ux*5,btip.y-uy*5,btip.x,btip.y,painting?tipColor:'#e6d2a8',3);
   if(M&&painting){rect(btip.x-7,btip.y-4,15,8,'#d8d2c0');rect(btip.x-7,btip.y-3,15,6,tipColor);}   // rodillo
   oval(ax,ay,3,3,SKIN);rect(ax-1,ay-1,2,2,SKIN_D);
   sg.setTransform(1,0,0,1,0,0);
   lg.globalCompositeOperation='source-over';lg.clearRect(0,0,SW,SH);lg.drawImage(spr,0,0);
   lg.globalCompositeOperation='source-in';lg.fillStyle=OUTLINE;lg.fillRect(0,0,SW,SH);
   G=g;
   const ct=M?M.cheerT:cheerT,jump=cheer?Math.abs(Math.sin(ct*7.5))*7*(M?1:clamp(1.2-ct,0,1)):0;
   const x=M?M.fx:Math.round(personX)-C,fy=M?M.fy:FEET;
   if(!M)oval(x,FEET+1,Math.round(15-jump*.6),3,'rgba(0,0,0,.4)');
   g.save();g.translate(x,fy-(M?jump:Math.round(jump)));if(M?M.flip:facing<0)g.scale(-1,1);
   for(const [ox,oy] of [[1,0],[-1,0],[0,1],[0,-1]])g.drawImage(sil,-OX+ox,-OY+oy);
   g.drawImage(spr,-OX,-OY);g.restore();
 }

 // ───────── Composición del fotograma ─────────
 function draw(){
   G=g;g.globalAlpha=1;g.globalCompositeOperation='source-over';C=Math.round(cam);
   const i0=Math.floor(C/STEP)-1,i1=Math.ceil((C+W)/STEP),a0=Math.max(0,i0),a1=Math.min(TOTAL-1,i1);
   for(let i=i0;i<=i1;i++)g.drawImage(tile,i*STEP-C,0);
   if(i0<=-1)door(-STEP-C,'ENTRADA');if(i1>=TOTAL)door(TOTAL*STEP-C,'SALIDA');
   // Luz sobre la pared.
   g.globalCompositeOperation='lighter';
   for(let i=a0;i<=a1;i++){
     const cx=i*STEP-C,L=lit[i];glow(cx,TOP+34,104,'255,196,116',.3*L);
     const a=assigned[i];
     if(a&&tierOf(a.coins)===3&&L>.3){
       const boost=fx&&fx.i===i?clamp(1.6-fx.t,0,1):0;
       for(let k=0;k<10;k++){const an=life*.5+k*.628;g.fillStyle=`rgba(255,214,120,${(.045+.07*boost).toFixed(3)})`;g.beginPath();g.moveTo(cx,TOP+36);
         g.lineTo(cx+Math.cos(an-.12)*88,TOP+36+Math.sin(an-.12)*88);g.lineTo(cx+Math.cos(an+.12)*88,TOP+36+Math.sin(an+.12)*88);g.fill();}
     }
   }
   for(let i=i0;i<=i1;i++){const fl=.8+.2*Math.sin(life*9+i*2.1)*hash(Math.floor(life*12),i);glow(i*STEP+85-C,94,30,'255,160,70',.36*fl);}
   g.globalCompositeOperation='source-over';
   for(let i=i0;i<=i1;i++){
     const x=i*STEP+85-C,f=Math.floor(life*10+i)%3;
     rect(x-1,91+(f===1?1:0),3,5,'#ff9d3a');rect(x-1+(f===2?1:0),89,2,4,'#ffd772');rect(x,92,1,2,'#fff6cf');
     if(i>=-1&&i<TOTAL)decor(i,x);
   }
   for(let i=a0;i<=a1;i++)drawFrame(i);
   // Conos de luz y reflejo en el parqué.
   g.globalCompositeOperation='lighter';
   for(let i=a0;i<=a1;i++){
     const cx=i*STEP-C,L=lit[i];if(L<.02)continue;
     poly([[cx-5,41],[cx+5,41],[cx+56,170],[cx-56,170]],`rgba(255,222,150,${(.045*L).toFixed(3)})`);
     g.save();g.translate(cx,234);g.scale(1,.3);glow(0,0,78,'255,196,116',.26*L);g.restore();
   }
   g.globalCompositeOperation='source-over';
   drawPainter();
   // Partículas.
   for(const p of parts){
     const x=p.x-C,a=clamp((p.max-p.life)/Math.min(.5,p.max),0,1);
     if(p.type==='spark'){g.globalCompositeOperation='lighter';spark(x,p.y,p.s,p.c,a);g.globalCompositeOperation='source-over';}
     else if(p.type==='petal'){g.globalAlpha=a;rect(x,p.y,3,2,p.c);rect(x+1,p.y-1,2,1,p.c);g.globalAlpha=1;}
     else{g.globalAlpha=a;rect(x,p.y,p.s,p.landed?1:p.s,p.c);g.globalAlpha=1;}
   }
   g.globalCompositeOperation='lighter';
   for(const d of dust){
     const x=((d.x-cam*.25+Math.sin(life*.4+d.ph)*6)%W+W)%W,y=30+((d.y-30-life*d.sp)%170+170)%170;
     g.globalAlpha=.12+.16*(.5+.5*Math.sin(life*1.7+d.ph));rect(x,y,1,1,'#ffe9b8');
   }
   g.globalAlpha=1;g.globalCompositeOperation='source-over';
   // Primer plano con más paralaje.
   const P=STEP*1.35,off=325-FOCUS*1.35;
   for(let n=Math.floor((cam*1.35-off-60)/P);n<=Math.ceil((cam*1.35-off+W+60)/P);n++)bigPlant(Math.round(n*P+off-cam*1.35));
   g.drawImage(vignette,0,0);
   if(veil>0)rect(0,0,W,H,`rgba(5,6,10,${veil.toFixed(3)})`);
 }

 // ───────── Pincelada: tres pasadas sobre el lienzo ─────────
 const PASSES=[{n:6,r:9,dur:2,src:'sepia',dir:1,flip:0,wob:1.5,name:'BOCETO'},
               {n:9,r:6,dur:2.8,src:'mid',dir:-1,flip:0,wob:1,name:'COLOR'},
               {n:12,r:4.5,dur:3.6,src:'final',dir:1,flip:1,wob:.6,name:'DETALLES'}];
 const PAINT_T=PASSES.reduce((s,p)=>s+p.dur,0);
 function pathPoint(p,u,passes=PASSES,S=72){
   const P=passes[p],cf=clamp(u,0,.99999)*P.n,col=Math.floor(cf),e=.5-.5*Math.cos(Math.PI*(cf-col)),v=(col+P.flip)%2?1-e:e,ci=P.dir>0?col:P.n-1-col;
   return {x:(ci+.5)*S/P.n+P.wob*Math.sin(v*6.283+col),y:lerp(P.r*.45,S-1-P.r*.45,v)};
 }
 function locate(tt,passes=PASSES){let p=0;while(p<passes.length-1&&tt>=passes[p].dur){tt-=passes[p].dur;p++;}return [p,tt/passes[p].dur];}
 // Por defecto pinta el cuadro de la galería; el cuadro gigante pasa sus propias pasadas, tamaño y lienzo.
 function stampAt(tt,src,passes=PASSES,S=72,ctx=ink){
   const [p,u]=locate(tt,passes),P=passes[p],o=pathPoint(p,u,passes,S),im=src[P.src],seed=Math.floor(tt*170),R=Math.ceil(P.r);
   for(let dy=-R;dy<=R;dy++){
     const y=Math.round(o.y)+dy;if(y<0||y>=S||Math.abs(dy)>P.r)continue;
     const w=Math.sqrt(P.r*P.r-dy*dy)+(hash(seed,dy)-.5)*2*Math.max(1,S/168),x0=Math.max(0,Math.round(o.x-w)),x1=Math.min(S,Math.round(o.x+w)+1);
     if(x1>x0)ctx.drawImage(im,x0,y,x1-x0,1,x0,y,x1-x0,1);
   }
   if(passes===PASSES)passNow=p;
   return o;
 }
 const startX=i=>i*STEP-S/2+pathPoint(0,0).x-REACH;
 function burst(i,tier){
   const cx=i*STEP,cy=TOP+S/2,golds=['#ffe596','#fff6cf','#ffc94a'];
   for(let k=0;k<[16,30,50,90][tier];k++){
     const a=rnd()*6.283,r=38+rnd()*24,v=20+rnd()*70;
     parts.push({type:'spark',x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r,vx:Math.cos(a)*v,vy:Math.sin(a)*v-12,life:0,max:.5+rnd()*.9,c:golds[k%3],s:1+(k%3===0)});
   }
   if(tier>=2)for(let k=0;k<tier*16;k++)
     parts.push({type:'petal',x:cx-70+rnd()*140,y:20+rnd()*50,vx:0,vy:20+rnd()*18,life:-rnd()*.8,max:3.6,ph:rnd()*6,c:['#e23a5a','#ff7a94','#c21f45'][k%3],fy:FEET-8+rnd()*26});
 }

 // ───────── Cuadro gigante del ganador (súper cuadro) ─────────
 // Mientras dura, la galería queda congelada tal cual (incluido un retrato a medias) y se retoma al volver.
 // Se dibuja en un lienzo aparte de 1920 × 1080 (K = 4 píxeles reales por unidad de la galería) para que la
 // ciudad, el rascacielos y la foto se vean en alta resolución. El pintor conserva su pixel art.
 const K=4,B=168,BX=156,BY=22,CITY_H=420,LZ=B*K;
 const MPASSES=[{n:4,r:24*K,dur:3.2,src:'sepia',dir:1,flip:0,wob:2*K},{n:6,r:17*K,dur:4.2,src:'mid',dir:-1,flip:0,wob:1.5*K},{n:8,r:13*K,dur:4.8,src:'final',dir:1,flip:0,wob:K}];
 const MPAINT=MPASSES.reduce((s,p)=>s+p.dur,0),lona=mk(LZ,LZ),lctx=lona.getContext('2d'),city=mk(W*K,CITY_H*K);
 const hd=q('.hd'),h=hd.getContext('2d');
 const FIRE=['#ffe596','#ff7a94','#7fd4ff','#b6ff9a','#ffb84a','#d9a6ff','#ffffff'];
 let mural=null,lastMural=0;
 function buildCity(){
   const c=city.getContext('2d'),HH=CITY_H,X0=108,X1=372;c.setTransform(K,0,0,K,0,0);
   const fr=(x,y,w,hh,col)=>{c.fillStyle=col;c.fillRect(x,y,w,hh);};
   const dot=(x,y,r,col)=>{c.fillStyle=col;c.beginPath();c.arc(x,y,r,0,7);c.fill();};
   const glo=(x,y,r,rgb,a)=>{const gr=c.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,`rgba(${rgb},${a})`);gr.addColorStop(1,`rgba(${rgb},0)`);c.fillStyle=gr;c.fillRect(x-r,y-r,r*2,r*2);};
   const lin=(x0,y0,x1,y1,...stops)=>{const gr=c.createLinearGradient(x0,y0,x1,y1);stops.forEach((s,i)=>gr.addColorStop(i/(stops.length-1),s));return gr;};
   // Cielo, estrellas, luna y nubes.
   fr(0,0,W,HH,lin(0,0,0,HH,'#02041a','#0a0f33','#1c1a52','#3a2760','#7a4262'));
   for(let k=0;k<620;k++){
     const x=hash(k,1)*W,y=hash(k,2)*320,s=.16+hash(k,3)*.46;c.globalAlpha=.3+hash(k,4)*.7;
     fr(x,y,s,s,hash(k,5)>.85?'#ffe9c2':hash(k,5)>.7?'#bcd0ff':'#ffffff');
     if(hash(k,6)>.972){c.globalAlpha=.55;fr(x-1.4,y+s/2-.06,2.8+s,.12,'#fff');fr(x+s/2-.06,y-1.4,.12,2.8+s,'#fff');}
   }
   c.globalAlpha=1;
   glo(430,40,80,'170,190,255',.24);glo(430,40,28,'255,250,225',.55);
   c.fillStyle=(()=>{const gr=c.createRadialGradient(425,35,1,430,40,13.5);gr.addColorStop(0,'#fffef2');gr.addColorStop(1,'#d6cfae');return gr;})();c.beginPath();c.arc(430,40,13,0,7);c.fill();
   c.globalAlpha=.2;for(const [mx,my,mr] of [[425,36,3],[435,45,2.2],[432,33,1.5],[424,44,1.8],[437,37,1.2]])dot(mx,my,mr,'#8f8a6a');c.globalAlpha=1;
   for(let k=0;k<11;k++){c.save();c.translate(hash(k,31)*W,46+hash(k,32)*190);c.scale(1,.2);glo(0,0,44+hash(k,33)*70,'80,90,165',.24);c.restore();}
   fr(0,HH-220,W,220,lin(0,HH-220,0,HH,'rgba(255,150,90,0)','rgba(255,150,90,.30)'));   // resplandor de la ciudad
   // Skyline en tres capas, de lejos a cerca.
   const layer=(seed,col,minH,maxH,wmin,wmax,win,lit)=>{
     let x=-6,k=0;
     while(x<W){
       const w=wmin+hash(k,seed)*(wmax-wmin),hh=minH+hash(k,seed+1)*(maxH-minH),y=HH-hh;fr(x,y,w,hh,col);
       if(hash(k,seed+2)>.55)fr(x+w*.28,y-3-hash(k,seed+3)*9,w*.44,14,col);
       if(hash(k,seed+4)>.72){fr(x+w/2-.2,y-16,.4,16,col);dot(x+w/2,y-16,.7,'#ff5050');}
       for(let wy=y+2;wy<HH-6;wy+=win*2.1)for(let wx=x+1.2;wx<x+w-win-.6;wx+=win*1.7){
         const r=hash(wx*3.1+seed,wy*1.7);if(r>lit)fr(wx,wy,win,win*1.3,r>.94?'#fff0c0':r>.87?'#9fc4ff':'#f0b860');}
       x+=w+.8;k++;
     }
   };
   layer(50,'#1d2560',120,240,14,30,.7,.8);
   fr(0,HH-270,W,270,'rgba(70,55,130,.20)');                                              // bruma
   layer(60,'#121740',95,205,18,36,1,.76);
   layer(70,'#0a0e28',60,150,22,44,1.3,.72);
   // Edificios cercanos a los lados.
   for(const [bx,bw,bh] of [[-14,74,340],[66,40,255],[378,46,290],[424,72,360]]){
     fr(bx,HH-bh,bw,bh,lin(bx,0,bx+bw,0,'#0d1230','#060814'));fr(bx,HH-bh,bw,1.2,'#27305f');fr(bx+bw*.2,HH-bh-8,bw*.26,8,'#090c1e');fr(bx+bw*.6,HH-bh-4,bw*.2,4,'#0b0f24');
     for(let wy=HH-bh+6;wy<HH-26;wy+=7)for(let wx=bx+3;wx<bx+bw-5;wx+=5.5){
       const r=hash(wx+.3,wy+1.7);
       fr(wx,wy,3.6,4.4,r>.9?lin(0,wy,0,wy+4.4,'#cfe6ff','#5f8fd8'):r>.66?lin(0,wy,0,wy+4.4,'#fff0c0','#e59a3a'):'#12173a');
       fr(wx+1.7,wy,.25,4.4,'#070a18');if(r>.66)fr(wx,wy+3.4,3.6,1,'rgba(0,0,0,.3)');
     }
   }
   // Rascacielos de vidrio.
   fr(X0,6,X1-X0,HH,lin(X0,0,X1,0,'#1e2a60','#131b44','#080c20'));
   const lit=[];
   for(let wy=14;wy<HH-60;wy+=10)for(let wx=X0+6;wx<X1-8;wx+=12){
     const r=hash(wx*.7,wy*1.3);
     if(r>.74){
       const cool=r>.93;lit.push([wx,wy,cool]);
       fr(wx,wy,9.6,7.4,cool?lin(0,wy,0,wy+7.4,'#d6ecff','#5a8fe0'):lin(0,wy,0,wy+7.4,'#fff2c4','#f0a445'));
       fr(wx,wy+5.4,9.6,2,'rgba(40,20,0,.32)');
       if(hash(wx,wy)>.55){const px=wx+1.6+hash(wy,wx)*5.4;fr(px,wy+3,1.5,2.6,'rgba(25,15,10,.6)');dot(px+.75,wy+2.5,.75,'rgba(25,15,10,.6)');}
       if(hash(wy*2,wx)>.68)for(let b2=0;b2<5;b2++)fr(wx,wy+.5+b2*.95,9.6,.28,'rgba(255,255,255,.28)');
       if(hash(wx*5,wy)>.8)fr(wx+6.4,wy+1.2,2.2,3.4,'rgba(60,110,70,.55)');
     }else{
       fr(wx,wy,9.6,7.4,lin(wx,wy,wx+9.6,wy+7.4,'#27367a','#161f4c','#0d1332'));
       c.fillStyle='rgba(190,210,255,.11)';c.beginPath();c.moveTo(wx+1,wy+7.4);c.lineTo(wx+4,wy);c.lineTo(wx+5.6,wy);c.lineTo(wx+2.6,wy+7.4);c.fill();
       c.fillStyle='rgba(190,210,255,.06)';c.beginPath();c.moveTo(wx+5.4,wy+7.4);c.lineTo(wx+8.4,wy);c.lineTo(wx+9,wy);c.lineTo(wx+6,wy+7.4);c.fill();
     }
   }
   for(let wx=X0+4.6;wx<X1;wx+=12){fr(wx,6,.9,HH,'#0a0e24');fr(wx,6,.25,HH,'#3a4a8c');}
   for(let wy=22.2;wy<HH-50;wy+=10){fr(X0,wy,X1-X0,1.5,'#0b1028');fr(X0,wy,X1-X0,.25,'#2a3670');}
   fr(X0,6,2.6,HH,'#3f4f96');fr(X0+2.6,6,.5,HH,'#7f93d8');fr(X1-3.4,6,3.4,HH,'#05070f');
   c.globalCompositeOperation='lighter';for(const [wx,wy,cool] of lit)glo(wx+4.8,wy+3.7,11,cool?'120,170,255':'255,185,95',.11);c.globalCompositeOperation='source-over';
   // Coronación con luces de cornisa.
   fr(X0-7,.6,X1-X0+14,6.4,lin(0,.6,0,7,'#3a4686','#161d44'));fr(X0-7,.6,X1-X0+14,.6,'#9fb0e8');fr(X0-3,7,X1-X0+6,1.6,'#070a18');
   for(let x=X0-3;x<X1+2;x+=6.5){fr(x,2.6,3.6,2,'#ffe9b0');glo(x+1.8,3.6,7,'255,210,130',.35);}
   // Bastidor dorado de la lona, cables y focos.
   fr(BX-11,BY-11,B+22,B+22,'#03050b');
   fr(BX-9,BY-9,B+18,B+18,lin(BX-9,BY-9,BX+B+9,BY+B+9,'#fff3c4','#d9ab3c','#8a6718','#e3bb55'));
   fr(BX-5.5,BY-5.5,B+11,B+11,'#4a3810');fr(BX-4.5,BY-4.5,B+9,B+9,lin(0,BY-4,0,BY+B+4,'#c79a30','#7a5a14'));fr(BX-2.5,BY-2.5,B+5,B+5,'#070a14');
   for(let k=0;k<=22;k++){const o=k*(B+14)/22;for(const [rx,ry] of [[BX-7+o,BY-7.2],[BX-7+o,BY+B+7.2],[BX-7.2,BY-7+o],[BX+B+7.2,BY-7+o]])dot(rx,ry,.55,'#fff6cf');}
   fr(BX-9,7,.6,BY-16,'#aeb7d6');fr(BX+B+8.4,7,.6,BY-16,'#aeb7d6');
   for(let k=0;k<6;k++){const x=BX+14+k*(B-28)/5;fr(x-.4,BY-17,.8,5,'#6b7391');fr(x-3,BY-14.5,6,3.4,'#141a30');fr(x-2.4,BY-11.4,4.8,.9,'#fff6cf');glo(x,BY-10.5,9,'255,236,180',.5);}
   // Calle mojada, portal iluminado, farolas y estelas de coches.
   fr(0,HH-24,W,24,lin(0,HH-24,0,HH,'#161a2c','#06070c'));fr(0,HH-24,W,.6,'#3f4870');
   fr(192,HH-66,96,4,lin(0,HH-66,0,HH-62,'#4a5796','#1c2450'));fr(198,HH-62,84,38,'#0a0f24');
   fr(202,HH-58,76,34,lin(0,HH-58,0,HH-24,'#fff0c0','#f0a850'));for(let x=202;x<=278;x+=15.2)fr(x-.6,HH-58,1.2,34,'#0a0f24');fr(202,HH-44,76,.8,'#0a0f24');
   glo(240,HH-34,90,'255,200,120',.36);fr(206,HH-24,68,24,lin(0,HH-24,0,HH,'rgba(255,200,120,.38)','rgba(255,200,120,0)'));
   for(let x=24;x<W;x+=58){
     if(x>180&&x<300)continue;
     fr(x-.45,HH-54,.9,30,'#333b5e');fr(x-3.4,HH-55,6.8,1.3,'#333b5e');glo(x,HH-52,30,'255,214,140',.5);dot(x,HH-53,1.4,'#fff6d8');
     fr(x-3,HH-24,6,24,lin(0,HH-24,0,HH,'rgba(255,214,140,.38)','rgba(255,214,140,0)'));
   }
   for(let k=0;k<7;k++){const x=hash(k,90)*W,y=HH-18+hash(k,91)*13,l=18+hash(k,92)*40,red=k%2;
     fr(x,y,l,.7,lin(x,0,x+l,0,red?'rgba(255,70,70,0)':'rgba(255,255,255,0)',red?'rgba(255,70,70,.8)':'rgba(255,250,220,.8)'));}
 }
 function startMural(rec,info){
   if(mural||!loaded||!rec)return;
   mural={rec,p:person(rec.uid,info),t:0,stage:'intro',camY:150,gx:141,gy:392,tip:null,pt:0,big:null,parts:[],fire:0};
   lctx.fillStyle='#efe2c4';lctx.fillRect(0,0,LZ,LZ);lctx.fillStyle='rgba(150,125,80,.10)';
   for(let k=0;k<LZ;k+=3){lctx.fillRect(0,k,LZ,1);lctx.fillRect(k,0,1,LZ);}
   q('.cartel b').textContent='🏆 '+mural.p.name;q('.cartel span').textContent='gana el súper cuadro';
   q('.cartel').classList.add('ver');
 }
 function endMural(){
   const m=mural;mural=null;lastMural=m.rec.id;veil=1;stage.classList.remove('mural');q('.campeon').classList.remove('ver');
   q('.cartel').classList.remove('ver');q('.cartel b').textContent='Galería '+String(room).padStart(2,'0');q('.cartel span').textContent='El taller de retratos';
   if(mode==='live')api({action:'mural_done',id:m.rec.id}).catch(()=>{});
 }
 function updateMural(dt){
   const m=mural;m.t+=dt;life+=dt;fdt=dt;
   if(m.stage==='intro'){
     veil=Math.min(1,veil+dt*1.8);
     if(m.t>2.2&&(m.p.ready||m.t>7)){
       m.big=makePic(...m.p.pic.src,LZ,true);m.stage='rise';m.t=0;     // la foto original, a 672 px y sin degradar
       stage.classList.add('mural');q('.cartel').classList.remove('ver');
       q('.campeon').textContent='🏆 '+m.p.name+' · SUPER CUADRO'+(m.rec.n?' Nº '+m.rec.n:'')+' · '+m.rec.coins+' monedas';q('.campeon').classList.add('ver');
     }
   }else if(m.stage==='rise'){
     veil=Math.max(0,veil-dt*1.4);const k=clamp(m.t/3.4,0,1),e=k*k*(3-2*k);
     m.camY=lerp(150,0,e);m.gy=lerp(392,116,e);
     if(k>=1){m.stage='paint';m.t=0;m.pt=0;}
   }else if(m.stage==='paint'){
     const end=Math.min(m.t,MPAINT);let o;
     for(let tt=m.pt;tt<end;tt+=.006){
       o=stampAt(tt,m.big,MPASSES,LZ,lctx);
       if(rnd()<.14)m.parts.push({x:BX+o.x/K,y:BY+o.y/K,vx:-40+rnd()*80,vy:-60+rnd()*50,g:260,life:0,max:1.4,c:colorAt(m.big,o.x*72/LZ,o.y*72/LZ),s:.6+rnd()*1.2});
     }
     o=stampAt(end,m.big,MPASSES,LZ,lctx);m.pt=end;m.tip={x:BX+o.x/K,y:BY+o.y/K};tipColor=colorAt(m.big,o.x*72/LZ,o.y*72/LZ);
     m.gx+=clamp((m.tip.x-36-m.gx)*6*dt,-120*dt,120*dt);m.gy=lerp(m.gy,Math.min(262,m.tip.y+80),1-Math.exp(-dt*5));
     if(m.t>=MPAINT){lctx.drawImage(m.big.final,0,0);m.tip=null;m.stage='finale';m.t=0;}
   }else if(m.stage==='finale'){
     const k=1-Math.exp(-dt*2.5);m.gx=lerp(m.gx,112,k);m.gy=lerp(m.gy,252,k);
     m.fire-=dt;
     if(m.fire<=0){                                          // fuegos artificiales
       m.fire=.16+rnd()*.22;const fx_=rnd()<.5?8+rnd()*112:360+rnd()*112,fy=8+rnd()*150,   // a los lados, sin tapar la foto
c=FIRE[Math.floor(rnd()*FIRE.length)],n=46+Math.floor(rnd()*40),big=1+rnd()*.9;
       for(let k2=0;k2<n;k2++){const a=k2/n*6.283+rnd()*.1,v=(30+rnd()*52)*big;m.parts.push({x:fx_,y:fy,vx:Math.cos(a)*v,vy:Math.sin(a)*v,g:42,life:0,max:1+rnd()*.8,c,s:.5+rnd()*.5,glow:true});}
     }
     if(m.t>7){m.stage='out';m.t=0;}
   }else{veil=Math.min(1,veil+dt*1.8);if(veil>=1){endMural();return;}}
   for(const p of m.parts){p.life+=dt;p.vy+=p.g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.glow){p.vx*=1-dt*1.5;p.vy*=1-dt*1.5;}}
   m.parts=m.parts.filter(p=>p.life<p.max);
 }
 function drawMural(){
   const m=mural,cy=m.camY,by=BY-cy,fin=m.stage==='finale'||m.stage==='out',g0=g;
   g=h;G=h;h.setTransform(K,0,0,K,0,0);h.globalAlpha=1;h.globalCompositeOperation='source-over';h.imageSmoothingEnabled=true;h.imageSmoothingQuality='high';
   const fr=(x,y,w,hh,col)=>{h.fillStyle=col;h.fillRect(x,y,w,hh);};
   h.drawImage(city,0,-cy,W,CITY_H);
   // Balizas rojas en las azoteas vecinas y focos del bastidor sobre la tela.
   h.globalCompositeOperation='lighter';
   const bl=.35+.65*Math.max(0,Math.sin(life*3.2));
   for(const [bx,by2] of [[23,80],[86,165],[401,130],[460,60]])glow(bx,by2-cy,9,'255,60,60',.75*bl);
   for(const [sx,ph,sp] of [[70,0,.5],[395,2,.42],[455,4,.6]]){               // reflectores lejanos barriendo el cielo
     const a=-1.57+Math.sin(life*sp+ph)*.55,ex=sx+Math.cos(a)*330,ey=300-cy+Math.sin(a)*330,gr0=h.createLinearGradient(sx,300-cy,ex,ey);
     gr0.addColorStop(0,'rgba(170,200,255,.16)');gr0.addColorStop(1,'rgba(170,200,255,0)');h.fillStyle=gr0;
     h.beginPath();h.moveTo(sx-1,300-cy);h.lineTo(sx+1,300-cy);h.lineTo(ex+26,ey);h.lineTo(ex-26,ey);h.fill();
   }
   const px=((life*14)%620)-70,py=34+px*.03-cy*.6;                              // avión cruzando el cielo
   glow(px,py,3,'255,255,255',.9);if(Math.sin(life*9)>.2)glow(px-3,py+.6,4,'255,70,70',.9);
   for(let k=0;k<6;k++){const x=BX+14+k*(B-28)/5;h.fillStyle='rgba(255,240,205,.045)';h.beginPath();h.moveTo(x-2,by-10);h.lineTo(x+2,by-10);h.lineTo(x+30,by+B*.7);h.lineTo(x-30,by+B*.7);h.fill();}
   if(fin){                                                  // cañones de luz desde la calle
     for(const [sx,ph] of [[30,0],[130,1.3],[350,2.6],[450,3.9]]){
       const tx=240+Math.sin(life*1.2+ph)*150,gr=h.createLinearGradient(sx,H,tx,by);gr.addColorStop(0,'rgba(255,240,190,.22)');gr.addColorStop(1,'rgba(255,240,190,0)');
       h.fillStyle=gr;h.beginPath();h.moveTo(sx-3,H);h.lineTo(sx+3,H);h.lineTo(tx+38,by-20);h.lineTo(tx-38,by-20);h.fill();
     }
     glow(240,by+B/2,170,'255,205,120',.26+.08*Math.sin(life*6));
   }
   h.globalCompositeOperation='source-over';
   h.drawImage(lona,BX,by,B,B);
   // Tela: sombra del bastidor y pliegues suaves.
   let gr=h.createLinearGradient(0,by,0,by+16);gr.addColorStop(0,'rgba(0,0,0,.30)');gr.addColorStop(1,'rgba(0,0,0,0)');fr(BX,by,B,16,gr);
   for(let k=1;k<6;k++){const x=BX+k*B/6;gr=h.createLinearGradient(x-5,0,x+5,0);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(.5,'rgba(0,0,0,.055)');gr.addColorStop(1,'rgba(255,255,255,.03)');fr(x-5,by,10,B,gr);}
   h.strokeStyle='rgba(0,0,0,.35)';h.lineWidth=.8;h.strokeRect(BX+.4,by+.4,B-.8,B-.8);
   if(fin){
     const f=clamp(1-m.t/.5,0,1);if(m.stage==='finale'&&f>0){h.globalAlpha=f*.9;fr(BX,by,B,B,'#fff6d8');h.globalAlpha=1;}
     const s=(m.t-.2)/1.3;
     if(m.stage==='finale'&&s>0&&s<1){h.save();h.beginPath();h.rect(BX,by,B,B);h.clip();const o=BX-70+s*(B+140);
       gr=h.createLinearGradient(o-40,0,o+30,0);gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(.5,'rgba(255,255,255,.5)');gr.addColorStop(1,'rgba(255,255,255,0)');
       h.fillStyle=gr;h.beginPath();h.moveTo(o,by);h.lineTo(o+34,by);h.lineTo(o-10,by+B);h.lineTo(o-44,by+B);h.fill();h.restore();}
     // Placa bajo la lona.
     const label='SUPER CUADRO'+(m.rec.n?' Nº '+m.rec.n:'')+'  ·  @'+m.p.uid;
     h.font='700 6.2px "Bahnschrift SemiCondensed","Arial Narrow","Segoe UI",sans-serif';h.textAlign='center';h.textBaseline='middle';
     const pw=Math.min(B+10,h.measureText(label).width+14);
     fr(240-pw/2,by+B+13,pw,11,'#3a2a0c');gr=h.createLinearGradient(0,by+B+13.6,0,by+B+23.4);gr.addColorStop(0,'#fff0b8');gr.addColorStop(.5,'#dcb04a');gr.addColorStop(1,'#9a7420');
     fr(240-pw/2+.6,by+B+13.6,pw-1.2,9.8,gr);h.fillStyle='#2a1c06';h.fillText(label,240,by+B+18.8,pw-6);
   }
   // Góndola de limpiacristales colgada de la azotea, con el pintor dentro.
   const gx=m.gx,gy=m.gy-cy;
   fr(gx-25.3,6-cy,.6,gy-22-(6-cy),'#8089ac');fr(gx+28.7,6-cy,.6,gy-22-(6-cy),'#8089ac');
   fr(gx-27.5,gy-24,5,6,'#2a3050');fr(gx+26.5,gy-24,5,6,'#2a3050');fr(gx-27.5,gy-24,5,.7,'#6f7aa8');fr(gx+26.5,gy-24,5,.7,'#6f7aa8');   // motores
   fr(gx-26,gy-18,1.2,19,'#59618a');fr(gx+28.8,gy-18,1.2,19,'#59618a');fr(gx-26,gy-18,56,1.1,'#7f89b4');                                  // barandilla trasera
   h.imageSmoothingEnabled=false;
   drawPainter({fx:gx,fy:gy,tip:m.tip&&{x:m.tip.x,y:m.tip.y-cy},cheer:fin,cheerT:m.t,flip:false});
   h.imageSmoothingEnabled=true;
   gr=h.createLinearGradient(0,gy,0,gy+7);gr.addColorStop(0,'#ffe596');gr.addColorStop(.25,'#e0aa2c');gr.addColorStop(1,'#6e5216');fr(gx-29,gy,62,7,gr);
   for(let k=0;k<8;k++)fr(gx-27+k*8,gy+2.4,4,1.2,'rgba(30,20,0,.55)');                                                                   // franjas de aviso
   fr(gx-29,gy-10,62,1.3,'#dfe5f5');fr(gx-29,gy-5,62,.7,'#aab3d0');for(let k=0;k<7;k++)fr(gx-28.6+k*10.1,gy-10,.8,10,'#aab3d0');          // barandilla delantera
   for(const p of m.parts){
     const a=clamp((p.max-p.life)/.5,0,1),py=p.y-cy;
     if(p.glow){
       h.globalCompositeOperation='lighter';h.globalAlpha=a*.3;h.fillStyle=p.c;h.beginPath();h.arc(p.x,py,p.s*3.2,0,7);h.fill();
       h.globalAlpha=a;h.strokeStyle=p.c;h.lineWidth=p.s*.7;h.beginPath();h.moveTo(p.x-p.vx*.06,py-p.vy*.06);h.lineTo(p.x,py);h.stroke();
       h.beginPath();h.arc(p.x,py,p.s,0,7);h.fill();h.globalCompositeOperation='source-over';h.globalAlpha=1;
     }else{h.globalAlpha=a;h.fillStyle=p.c;h.beginPath();h.arc(p.x,py,p.s,0,7);h.fill();h.globalAlpha=1;}
   }
   h.drawImage(vignette,0,0,W,H);
   if(veil>0)fr(0,0,W,H,`rgba(5,6,10,${veil.toFixed(3)})`);
   g=g0;G=g0;
 }

 // ───────── Interfaz ─────────
 const setAv=(el,p)=>{el.style.backgroundImage=p&&p.hud?`url("${p.hud}")`:'none';};
 const el=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;};
 // Regalo con su icono y la cantidad enviada. Sin icono conocido, un emoji.
 function chip(g){
   const c=el('span','regalo');
   if(g.img&&mode==='live'){const im=el('img');im.alt='';im.src='avatar?u='+encodeURIComponent(g.img);c.appendChild(im);}
   else c.appendChild(el('i','',/^ros[ea]/i.test(g.name)?'🌹':'🎁'));
   c.appendChild(el('b','','×'+g.n));return c;
 }
 const roses=n=>n?[{name:'Rose',img:'',unit:1,n}]:[];
 const giftsOf=r=>r.gifts&&r.gifts.length?r.gifts:roses(r.coins);
 const demoRec=a=>({coins:a[1],gifts:roses(a[1]),p:person(a[0].slice(1),{name:a[0],img:'demo:'+a[2]})});
 function upcoming(){   // [{p, coins, gifts}] y cuántos hay en total
   if(mode==='demo')return [[0,1,2,3].map(k=>demoRec(actors[(demoN+k)%actors.length])),0];
   if(!srv)return [[],0];
   return [srv.queue.slice(0,4).map(e=>({coins:e.coins,gifts:e.gifts,p:person(e.uid,srv.users[e.uid])})),srv.queueLen];
 }
 function ui(){
   const a=slot<TOTAL?assigned[slot]:null,tier=a?tierOf(a.coins):0,n2=v=>String(v).padStart(2,'0');
   q('.room').textContent=n2(room);q('.contador b').textContent=n2(finished.filter(Boolean).length);
   q('.name').textContent=a?a.p.name:slot<TOTAL?'Lienzo libre':'¡Completa!';setAv(q('.actual .av'),a&&a.p);
   const turn=q('.turn');turn.textContent=a&&!a.coins?'Turno de «yo»':'';
   if(a&&a.coins){giftsOf(a).slice(0,3).forEach(g=>turn.appendChild(chip(g)));if(tier)turn.appendChild(el('span','',TIER_NAME[tier]));}
   q('.actual').dataset.tier=tier;stage.classList.toggle('libre',!a&&slot<TOTAL);
   q('.phase').textContent=(slot>=TOTAL?'GALERÍA COMPLETA':!a?'ESPERANDO PARTICIPANTES':phase==='paint'?'PINTANDO · '+PASSES[passNow].name:phase==='admire'?'¡RETRATO TERMINADO!':phase==='wait'?'PREPARANDO EL LIENZO':'DE CAMINO AL LIENZO')+(slot<TOTAL?' · CUADRO '+n2(slot+1):'');
   const [next,count]=upcoming(),list=q('.siguientes');list.textContent='';
   for(const b of next){
     const li=el('li'),av=el('span','av');setAv(av,b.p);if(b.coins){const em=el('em');em.appendChild(chip(giftsOf(b)[0]));av.appendChild(em);}
     li.append(av,el('span','',b.p.name));list.appendChild(li);
   }
   q('.mas').textContent=count>4?'+'+(count-4):'';q('.cola').classList.toggle('vacia',!next.length);
   stage.classList.toggle('paused',paused);
   q('.pause').textContent=paused?'Continuar':'Pausar';q('.rate').textContent='Velocidad ×'+speed;
 }
 function change(s){phase=s;t=0;ui();q('.announce').textContent=q('.phase').textContent+' · '+q('.name').textContent;}
 // Empieza una galería. Con `restore` recupera los cuadros ya terminados (recarga de la página).
 function begin(restore){
   finished=[];assigned=[];(restore||[]).forEach((r,i)=>{assigned[i]=finished[i]=r;});slot=finished.length;
   lit.fill(0);for(let i=0;i<slot;i++)lit[i]=.72;
   personX=slot?startX(Math.min(slot,TOTAL))-90:-STEP;cam=(slot?personX+34:-STEP+70)-FOCUS;
   facing=1;veil=1;cartelT=slot?0:2.1;parts=[];fx=null;tip=null;loaded=true;
   buildTile(THEMES[(room-1)%THEMES.length]);ink.drawImage(blank,0,0);
   q('.cartel b').textContent='Galería '+String(room).padStart(2,'0');requestNext();change('walk');
 }

 // ───────── Cola: servidor en directo o participantes de muestra ─────────
 const api=body=>fetch('api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());
 const canPaint=()=>slot<TOTAL&&assigned[slot]&&assigned[slot].p.ready;
 function requestNext(){
   if(slot>=TOTAL||assigned[slot]||asking)return;
   if(mode==='demo'){
     assigned[slot]={id:demoN+1,...demoRec(actors[demoN++%actors.length])};ui();return;
   }
   if(!srv||(!srv.current&&!srv.queueLen))return;
   asking=true;const s=slot,r=room;
   api({action:'next'}).then(d=>{
     asking=false;
     if(d.current&&s===slot&&r===room&&!assigned[slot]){assigned[slot]={id:d.current.id,coins:d.current.coins,gifts:d.current.gifts,v:d.v,p:person(d.current.uid,d.user)};ui();}
   }).catch(()=>{asking=false;});
 }
 function toast(e,s){
   const name=(s.users[e.uid]||{}).name||e.uid;
   const txt=e.kind==='join'?`${name} entra en la cola · nº ${e.pos}`:e.kind==='gift'?` ${name}`+(e.pos?` · sube al nº ${e.pos}`:' · ¡mejora su marco!'):e.text;
   if(!txt)return;const box=q('.avisos'),d=el('div',e.kind,txt);
   if(e.kind==='gift')d.prepend(chip({name:e.gift||'Regalo',img:e.img,n:e.n||1}));
   box.appendChild(d);
   while(box.children.length>3)box.firstChild.remove();setTimeout(()=>d.remove(),4500);
 }
 function onState(s){
   const fromGallery=()=>s.gallery.map(g=>({id:g.id,coins:g.coins,gifts:g.gifts,p:person(g.uid,s.users[g.uid])}));
   const checkMural=()=>{if(s.mural&&s.mural.id!==lastMural)startMural(s.mural,s.users[s.mural.uid]);};
   if(!srv){srv=s;mode='live';room=s.room;lastEv=s.events.reduce((m,e)=>Math.max(m,e.id),0);begin(fromGallery());checkMural();return;}
   // Servidor reiniciado (por ejemplo, tras subir cambios): recargar para no quedarse con código viejo.
   if(s.boot&&srv.boot&&s.boot!==srv.boot){location.reload();return;}
   srv=s;
   // Reinicio desde el panel: la galería del servidor va por detrás de la nuestra.
   if(s.room<room||(s.room===room&&s.gallery.length<finished.filter(Boolean).length)){room=s.room;begin(fromGallery());return;}
   const r=slot<TOTAL&&assigned[slot];
   if(r&&!finished[slot]&&s.v>=(r.v||0)){
     if(s.current&&s.current.id===r.id){r.coins=s.current.coins;r.gifts=s.current.gifts;}
     else if(!s.gallery.some(g=>g.id===r.id)&&s.room===room){   // saltado desde el panel
       assigned[slot]=null;tip=null;ink.drawImage(blank,0,0);if(phase==='paint')change('wait');
     }
   }
   for(const e of s.events)if(e.id>lastEv){lastEv=e.id;toast(e,s);}
   checkMural();requestNext();ui();
 }

 // ───────── Lógica ─────────
 function update(dt){
   life+=dt;t+=dt;fdt=dt;let moved=0;
   if(phase!=='fade')veil=Math.max(0,veil-dt*.9);
   if(cartelT>0)cartelT-=dt;
   q('.cartel').classList.toggle('ver',cartelT>0);
   if(phase==='walk'){
     const dest=slot<TOTAL?startX(slot):TOTAL*STEP,d=dest-personX,s=veil>.35?0:Math.min(Math.abs(d),dt*78);
     personX+=Math.sign(d)*s;moved=s;
     requestNext();
     if(veil<=.35&&Math.abs(d)<=s+.01)change(slot<TOTAL?'wait':'fade');
   }else if(phase==='wait'){                       // en el lienzo, a la espera de participante o de su foto
     if(canPaint()){pt=0;passNow=0;ink.drawImage(blank,0,0);change('paint');}else requestNext();
   }else if(phase==='paint'&&!assigned[slot]){tip=null;change('wait');
   }else if(phase==='paint'){
     const a=assigned[slot],tier=tierOf(a.coins),src=a.p.pic,end=Math.min(t,PAINT_T),before=passNow;let o;
     for(let tt=pt;tt<end;tt+=.006){
       o=stampAt(tt,src);
       if(rnd()<.05+.03*tier){const c=colorAt(src,o.x,o.y);
         parts.push({type:'drop',x:slot*STEP-S/2+o.x,y:TOP+o.y,vx:-30+rnd()*60,vy:-50+rnd()*40,life:0,max:1.3+rnd()*.6,c,s:1+(rnd()<.4),fy:FEET-6+rnd()*22});}
       if(tier>=2&&rnd()<.03*tier)parts.push({type:'spark',x:slot*STEP-S/2+o.x+rnd()*8-4,y:TOP+o.y+rnd()*8-4,vx:rnd()*20-10,vy:-10-rnd()*20,life:0,max:.5+rnd()*.4,c:'#ffe596',s:1});
     }
     o=stampAt(end,src);pt=end;
     tip={x:slot*STEP-S/2+o.x,y:TOP+o.y};tipColor=colorAt(src,o.x,o.y);
     const dx=clamp((tip.x-REACH-personX)*9*dt,-90*dt,90*dt);personX+=dx;moved=Math.abs(dx)*.6;
     if(passNow!==before)ui();
     if(t>=PAINT_T){ink.drawImage(src.final,0,0);finished[slot]=a;fx={i:slot,t:0};burst(slot,tier);cheerT=0;tip=null;
       if(mode==='live')api({action:'done',id:a.id}).catch(()=>{});change('admire');}
   }else if(phase==='admire'){
     const d=slot*STEP+S/2+28-personX;
     if(Math.abs(d)>.5){const s=Math.min(Math.abs(d),dt*95);personX+=Math.sign(d)*s;moved=s;}
     else{facing=-1;cheerT+=dt;if(cheerT>1.15){facing=1;slot++;ink.drawImage(blank,0,0);requestNext();change('walk');}}
   }else{
     veil=Math.min(1,veil+dt*1.4);
     if(veil>=1&&t>1){room=mode==='live'?Math.max(room+1,srv.room):room+1;begin();}
   }
   moving+=moved;
   if(dt>0)walkAmt=lerp(walkAmt,moved/dt>6?1:0,1-Math.exp(-dt*14));
   const focus=phase==='paint'||phase==='admire'||phase==='wait'?slot*STEP:clamp(personX+34,-STEP+70,Math.min(slot,TOTAL)*STEP);
   cam=lerp(cam,focus-FOCUS,1-Math.exp(-dt*3.2));
   // Los focos se encienden al llegar el pintor y quedan a media luz al terminar.
   for(let i=0;i<TOTAL;i++){
     const target=i<slot?.72:i===slot?1:0;let v=lerp(lit[i],target,1-Math.exp(-dt*3));
     lit[i]=v;
   }
   if(fx)fx.t+=dt;
   for(const p of parts){
     p.life+=dt;if(p.life<0)continue;
     if(p.type==='drop'){if(!p.landed){p.vy+=260*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.y>=p.fy){p.y=p.fy;p.landed=true;p.s=2;}}}
     else if(p.type==='spark'){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=1-dt*2;p.vy*=1-dt*2;}
     else if(p.y<p.fy){p.y+=p.vy*dt;p.x+=Math.sin(p.life*3+p.ph)*22*dt;}
   }
   parts=parts.filter(p=>p.life<p.max);
   if(phase==='paint')q('.progreso i').style.width=(t/PAINT_T*100).toFixed(1)+'%';
   else if(phase==='walk')q('.progreso i').style.width='0%';
 }
 const step=dt=>mural?updateMural(dt):update(dt);
 const frame=()=>mural&&mural.stage!=='intro'?drawMural():draw();
 function tick(now){
   const dt=prev?Math.min(.08,(now-prev)/1000):0;prev=now;
   if(!paused&&loaded){step(dt*speed);frame();}
   requestAnimationFrame(tick);
 }

 // Para pruebas desde la consola: tallerAvanzar(30) adelanta 30 segundos de juego.
 window.tallerAvanzar=s=>{for(let k=0;k<s*25;k++)step(.04);frame();return mural?`cuadro gigante: ${mural.stage} ${mural.t.toFixed(1)}s`:`galería ${room}, cuadro ${slot+1}, ${phase}`;};

 // ───────── Controles ─────────
 const save=()=>{try{localStorage.setItem('taller-velocidad',speed);}catch(e){}};
 const togglePause=()=>{paused=!paused;ui();},nextSpeed=()=>{speed=speed===1?2:speed===2?4:1;ui();save();};
 q('.pause').onclick=togglePause;q('.rate').onclick=nextSpeed;
 addEventListener('keydown',e=>{
   if(e.target.tagName==='BUTTON')return;
   if(e.code==='Space'){e.preventDefault();togglePause();}else if(e.key==='v'||e.key==='V')nextSpeed();
   else if((e.key==='b'||e.key==='B')&&mode==='demo'){const a=actors[Math.floor(rnd()*actors.length)];startMural({id:Date.now(),uid:a[0].slice(1),coins:500,n:1},{name:a[0],img:'demo:'+a[2]});}
 });
 atlas.onload=()=>{
   buildStatic();buildCity();const n=atlas.naturalWidth/2;
   atlasPics=[0,1,2,3].map(i=>makePic(atlas,(i%2)*n,Math.floor(i/2)*n,n,n));
   try{const v=+localStorage.getItem('taller-velocidad');if([1,2,4].includes(v))speed=v;}catch(e){}
   paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
   // Con servidor (server.py) la cola es real; sin él, o con ?demo, participantes de muestra.
   const demo=()=>{if(mode)return;mode='demo';begin();update(0);draw();};
   if(location.protocol==='file:'||/[?&]demo\b/.test(location.search))demo();
   else{
     try{const es=new EventSource('events');
       es.onmessage=e=>{if(mode!=='demo')onState(JSON.parse(e.data));};
       es.onerror=()=>{if(!mode){es.close();demo();}};
     }catch(e){demo();}
     setTimeout(demo,3000);
   }
   requestAnimationFrame(tick);
 };
 atlas.src='assets/retratos.jpg';
})();
