
(function(){
"use strict";
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer: fine)').matches;

/* ---------- NAV SCROLL STATE ---------- */
const nav = document.getElementById('nav');
const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
window.addEventListener('scroll', onScroll, {passive:true}); onScroll();

/* ---------- MOBILE MENU ---------- */
const burger = document.getElementById('navBurger');
const navLinks = document.getElementById('navLinks');
if(burger && navLinks){
  const setMenu = (open) => {
    nav.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  burger.addEventListener('click', ()=> setMenu(!nav.classList.contains('menu-open')));
  navLinks.querySelectorAll('a').forEach(a=> a.addEventListener('click', ()=> setMenu(false)));
  document.addEventListener('keydown', e=>{ if(e.key === 'Escape') setMenu(false); });
}

/* ---------- YEAR ---------- */
document.getElementById('yr').textContent = new Date().getFullYear();

/* ---------- SCROLL REVEALS ---------- */
/* Elements animate in every time they come back into view. When one leaves, it
   remembers which side it left from, so it re-enters from that side — rising
   when you scroll down, descending when you scroll up. */
if('IntersectionObserver' in window){
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      const el = e.target;
      if(e.isIntersecting){
        /* 12% visible, or a good slice of a very tall block */
        if(e.intersectionRatio >= .12 || e.intersectionRect.height > 160) el.classList.add('in');
      }else{
        el.classList.remove('in');
        el.classList.toggle('from-top', e.boundingClientRect.top < 0);
      }
    });
  },{threshold:[0,.12,.3]});
  /* catalog.js uses this for the product cards it adds later */
  window.VESTRO_REVEAL = el => io.observe(el);
}else{
  /* very old browsers: just show everything */
  window.VESTRO_REVEAL = el => el.classList.add('in');
}
/* headings: wrap the text so it can rise out from behind an edge (see styles.css) */
document.querySelectorAll('h1.reveal, h2.reveal').forEach(h=>{
  const rise = document.createElement('span');
  rise.className = 'rise';
  while(h.firstChild) rise.appendChild(h.firstChild);
  h.appendChild(rise);
});
document.querySelectorAll('.reveal').forEach(window.VESTRO_REVEAL);

/* ---------- SCROLL PROGRESS LINE + HERO DRIFT ---------- */
(function(){
  const bar = document.getElementById('scrollProgress');
  const heroEl = document.querySelector('.hero');
  const heroContent = document.querySelector('.hero-content');
  let ticking = false;
  function update(){
    ticking = false;
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if(bar) bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y/max) : 0) + ')';
    /* the first screen's words drift down and fade as it scrolls away */
    if(!reduced && heroEl && heroContent){
      const h = heroEl.offsetHeight;
      if(y < h){
        heroContent.style.transform = 'translate3d(0,' + (y*0.2).toFixed(1) + 'px,0)';
        heroContent.style.opacity = Math.max(0, 1 - y/(h*0.75)).toFixed(3);
      }
    }
  }
  window.addEventListener('scroll', ()=>{ if(!ticking){ ticking = true; requestAnimationFrame(update); } }, {passive:true});
  update();
})();

/* ---------- 3D SILK SASH: twisting ribbon streaming across the band ---------- */
(function(){
  if(!window.THREE) return;
  const wrap = document.getElementById('ribbonWrap');
  const canvas = document.getElementById('ribbon');
  if(!wrap || !canvas) return;

  /* phones without WebGL (or with it switched off): drop the band, keep the page working */
  let renderer;
  try{ renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true}); }
  catch(err){ wrap.hidden = true; return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 4, .1, 100);
  camera.position.set(0, 0, 10);

  /* ribbon texture: ivory silk body with zari borders on both long edges */
  function sashTexture(){
    const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0,0,1024,0);
    grad.addColorStop(0,'#f6efdc'); grad.addColorStop(.5,'#f0e4c4'); grad.addColorStop(1,'#f6efdc');
    g.fillStyle = grad; g.fillRect(0,0,1024,256);
    /* weave */
    for(let x=0;x<1024;x+=5){ g.fillStyle='rgba(140,105,60,.04)'; g.fillRect(x,0,1,256); }
    for(let y=0;y<256;y+=6){ g.fillStyle='rgba(100,70,40,.03)'; g.fillRect(0,y,1024,1); }
    /* borders along both long edges */
    function border(y0, flip){
      const bh = 46;
      const bg = g.createLinearGradient(0, flip? y0+bh : y0, 0, flip? y0 : y0+bh);
      bg.addColorStop(0,'#e6c26e'); bg.addColorStop(.55,'#b98a3e'); bg.addColorStop(1,'#8a5f22');
      g.fillStyle = bg; g.fillRect(0, y0, 1024, bh);
      g.fillStyle = 'rgba(90,22,32,.5)';
      for(let x=0;x<1024;x+=40){ g.fillRect(x, y0, 2, bh); }
      g.fillStyle = '#5a1620';
      for(let x=20;x<1024;x+=40){
        g.save(); g.translate(x, y0 + bh*.5); g.rotate(Math.PI/4); g.fillRect(-5,-5,10,10); g.restore();
      }
      /* saffron pinstripe on the body side */
      g.fillStyle = '#c9662c';
      g.fillRect(0, flip? y0 - 7 : y0 + bh + 3, 1024, 3);
      /* wine selvedge at the outer hem */
      g.fillStyle = '#5a1620';
      g.fillRect(0, flip? y0 + bh - 4 : y0, 1024, 4);
    }
    border(4, false);      /* top edge  */
    border(206, true);     /* bottom edge */
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(5, 1);
    tex.anisotropy = 4;
    return tex;
  }

  const LEN = 26, HGT = 1.55, SX = 220, SY = 16;
  const geo = new THREE.PlaneGeometry(LEN, HGT, SX, SY);
  const mat = new THREE.MeshPhongMaterial({
    map: sashTexture(),
    side: THREE.DoubleSide,
    shininess: 55,
    specular: new THREE.Color(0xf5e3b8)
  });
  const sash = new THREE.Mesh(geo, mat);
  scene.add(sash);

  scene.add(new THREE.AmbientLight(0xfff4e2, .78));
  const key = new THREE.DirectionalLight(0xffeecf, .9); key.position.set(2, 4, 6); scene.add(key);
  const rim = new THREE.PointLight(0xd9b36a, .55, 50); rim.position.set(-8, 2, 4); scene.add(rim);

  const pos = geo.attributes.position;
  const N = pos.count;
  const ox = new Float32Array(N), oy = new Float32Array(N);
  for(let i=0;i<N;i++){ ox[i]=pos.getX(i); oy[i]=pos.getY(i); }

  /* cursor swell */
  let px = .5, hover = 0, hoverT = 0;
  wrap.addEventListener('pointermove', e=>{
    const r = wrap.getBoundingClientRect();
    px = (e.clientX - r.left)/r.width;
    hoverT = 1;
  });
  ['pointerleave','pointercancel'].forEach(ev=>wrap.addEventListener(ev, ()=>{ hoverT = 0; }));

  function wave(t){
    const mx = (px - .5) * LEN;
    for(let i=0;i<N;i++){
      const x = ox[i], y0 = oy[i];
      const g = hover * 1.05 * Math.exp(-((x-mx)*(x-mx))/6); /* localized rise near cursor */
      const th = Math.sin(x*0.42 - t*1.0)*1.15 + g*0.8;       /* traveling twist */
      const y = y0*Math.cos(th)
              + Math.sin(x*0.5 + t*0.85)*0.42
              + Math.sin(x*0.18 - t*0.5)*0.22
              + g*0.55;
      const z = y0*Math.sin(th)
              + Math.cos(x*0.33 - t*0.7)*0.35;
      pos.setY(i, y); pos.setZ(i, z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }

  function resize(){
    const w = wrap.clientWidth, h = wrap.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
    /* stretch the sash so it always runs past both screen edges */
    const visW = 2 * camera.position.z * Math.tan(camera.fov * Math.PI/360) * camera.aspect;
    sash.scale.x = (visW * 1.15) / LEN;
    renderer.render(scene, camera);
  }
  window.addEventListener('resize', resize, {passive:true}); resize();

  if(reduced){
    wave(2.1);
    renderer.render(scene, camera);
    return;
  }

  /* animate only while the band is on screen */
  let visible = false, raf = null;
  function loop(ms){
    const t = ms*0.001;
    hover += (hoverT - hover)*0.06;
    wave(t);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  function start(){ if(raf===null){ raf = requestAnimationFrame(loop); } }
  function stop(){ if(raf!==null){ cancelAnimationFrame(raf); raf = null; } }
  const rio = new IntersectionObserver(es=>{
    es.forEach(en=>{ visible = en.isIntersecting; visible ? start() : stop(); });
  },{threshold:0});
  rio.observe(wrap);
  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden){ stop(); } else if(visible){ start(); }
  });
})();

/* ---------- DOHA → KERALA PARCEL ---------- */
(function(){
  const path = document.getElementById('flight');
  const parcel = document.getElementById('parcel');
  if(!path || !parcel) return;
  const len = path.getTotalLength();
  if(reduced){
    const p = path.getPointAtLength(len*.62);
    parcel.setAttribute('transform', `translate(${p.x} ${p.y})`);
    return;
  }
  let start = null;
  const DUR = 5200;
  function frame(ts){
    if(start===null) start = ts;
    let t = ((ts - start) % DUR) / DUR;
    // ease in-out
    t = t<.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2;
    const p = path.getPointAtLength(len*t);
    parcel.setAttribute('transform', `translate(${p.x} ${p.y})`);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

/* ---------- THREE.JS FLOWING SILK (ivory kasavu, gold + wine border) ---------- */
(function(){
  if(!window.THREE) return;
  const canvas = document.getElementById('silk');
  const hero = document.querySelector('.hero');
  if(!canvas || !hero) return;

  let renderer;
  try{ renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true}); }
  catch(err){ return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
  camera.position.set(0, .35, 9.6);

  /* --- ivory kasavu silk texture with a real zari border story --- */
  function silkTexture(){
    const c = document.createElement('canvas'); c.width = c.height = 1024;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0,0,1024,880);
    /* champagne silk body */
    grad.addColorStop(0.00,'#e9dab9');
    grad.addColorStop(0.22,'#f7f0dd');
    grad.addColorStop(0.48,'#e8d6ac');
    grad.addColorStop(0.74,'#d9bf86');
    grad.addColorStop(1.00,'#c6a566');
    g.fillStyle = grad; g.fillRect(0,0,1024,1024);
    /* weave threads */
    for(let x=0;x<1024;x+=6){
      g.fillStyle = 'rgba(140,105,60,'+(x%18===0?0.07:0.035)+')';
      g.fillRect(x,0,1,1024);
    }
    for(let y=0;y<1024;y+=9){
      g.fillStyle = 'rgba(100,70,40,0.04)';
      g.fillRect(0,y,1024,1);
    }
    /* zari border: gold band + wine diamond motifs + saffron pinstripe + wine selvedge */
    const bh = 172, by = 1024-bh;
    const bg = g.createLinearGradient(0,by,0,1024);
    bg.addColorStop(0,'#e6c26e'); bg.addColorStop(.55,'#b98a3e'); bg.addColorStop(1,'#8a5f22');
    g.fillStyle = bg; g.fillRect(0,by,1024,bh);
    g.fillStyle = 'rgba(90,22,32,.5)';
    for(let x=0;x<1024;x+=44){ g.fillRect(x,by,2,bh); }
    g.save(); g.fillStyle = '#5a1620';
    for(let x=22;x<1024;x+=44){
      g.save(); g.translate(x, by+bh*.42); g.rotate(Math.PI/4); g.fillRect(-7,-7,14,14); g.restore();
    }
    g.restore();
    /* saffron pinstripe above the border */
    g.fillStyle = '#c9662c'; g.fillRect(0,by-10,1024,4);
    /* wine selvedge line at the very hem */
    g.fillStyle = '#5a1620'; g.fillRect(0,1024-8,1024,8);
    g.strokeStyle = 'rgba(90,22,32,.5)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0,by+1.5); g.lineTo(1024,by+1.5); g.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    return tex;
  }

  const W = 15, H = 8.4, SX = 110, SY = 64;
  const geo = new THREE.PlaneGeometry(W, H, SX, SY);
  const mat = new THREE.MeshPhongMaterial({
    map: silkTexture(),
    side: THREE.DoubleSide,
    shininess: 40,
    specular: new THREE.Color(0x3a301e)
  });
  const cloth = new THREE.Mesh(geo, mat);

  const group = new THREE.Group();
  group.add(cloth);
  group.rotation.set(-0.34, -0.18, -0.10);
  group.position.set(1.4, -0.15, 0);
  scene.add(group);

  /* a little under full brightness, so the folds keep their shading on a pale page */
  const ambient = new THREE.AmbientLight(0xfff6e6, .52); scene.add(ambient);
  const key = new THREE.DirectionalLight(0xfff1d6, .36); key.position.set(4,6,6); scene.add(key);
  const rim = new THREE.PointLight(0xd9b36a, .1, 60); rim.position.set(-7,-2,5); scene.add(rim);

  /* wave animation over original vertex grid */
  const pos = geo.attributes.position;
  const N = pos.count;
  const ox = new Float32Array(N), oy = new Float32Array(N);
  for(let i=0;i<N;i++){ ox[i]=pos.getX(i); oy[i]=pos.getY(i); }

  function wave(t){
    for(let i=0;i<N;i++){
      const x = ox[i], y = oy[i];
      const z =
        Math.sin(x*0.85 + t*1.05)*0.36 +
        Math.sin(x*0.42 + y*0.62 + t*0.72)*0.27 +
        Math.cos(y*1.25 + t*0.9)*0.13;
      pos.setZ(i, z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }

  /* size to hero. On a tall screen (phone, tablet held upright) the wide cloth
     would show only a thin, flat slice, so it is turned upright and scaled until
     it covers the whole first screen, folds and all. */
  function resize(){
    const w = hero.clientWidth, h = hero.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
    const visH = 2 * camera.position.z * Math.tan(camera.fov * Math.PI/360);
    const visW = visH * camera.aspect;
    if(camera.aspect < 1){
      const s = Math.max(visH*1.6/W, visW*1.6/H);
      group.scale.setScalar(s);
      group.rotation.z = Math.PI/2 - 0.18;
      group.position.set(0, 0, 0);
      ambient.intensity = .74;
    }else{
      ambient.intensity = .52;
      group.scale.setScalar(1);
      group.rotation.z = -0.10;
      group.position.set(1.4, -0.15, 0);
    }
    renderer.render(scene, camera);
  }
  window.addEventListener('resize', resize); window.addEventListener('orientationchange', resize); resize();

  /* mouse parallax */
  let tx = 0, ty = 0;
  if(finePointer && !reduced){
    hero.addEventListener('pointermove', e=>{
      const r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left)/r.width - .5);
      ty = ((e.clientY - r.top)/r.height - .5);
    });
  }

  if(reduced){
    wave(1.4);
    renderer.render(scene, camera);
    return;
  }

  const baseRX = group.rotation.x, baseRY = group.rotation.y;
  /* animate only while the hero is on screen — saves phone battery further down the page */
  let visible = true, raf = null;
  function loop(ms){
    /* scrolling also pushes the ripple along, so the cloth answers a thumb as well as a mouse */
    const t = ms*0.001 + window.scrollY*0.004;
    wave(t);
    group.rotation.y += ((baseRY + tx*0.12) - group.rotation.y)*0.05;
    group.rotation.x += ((baseRX + ty*0.08) - group.rotation.x)*0.05;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  function start(){ if(raf===null){ raf = requestAnimationFrame(loop); } }
  function stop(){ if(raf!==null){ cancelAnimationFrame(raf); raf = null; } }
  start();
  if('IntersectionObserver' in window){
    new IntersectionObserver(es=>{
      es.forEach(en=>{ visible = en.isIntersecting; visible ? start() : stop(); });
    },{threshold:0}).observe(hero);
  }
  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden){ stop(); } else if(visible){ start(); }
  });
})();
})();
