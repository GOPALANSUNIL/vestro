
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
const io = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
},{threshold:.15});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

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

  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
  camera.position.set(0, .35, 9.6);

  /* --- ivory kasavu silk texture with a real zari border story --- */
  function silkTexture(){
    const c = document.createElement('canvas'); c.width = c.height = 1024;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0,0,1024,880);
    grad.addColorStop(0.00,'#d9c49a');
    grad.addColorStop(0.22,'#f1e6cc');
    grad.addColorStop(0.48,'#dcc391');
    grad.addColorStop(0.74,'#c4a368');
    grad.addColorStop(1.00,'#a8854c');
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
    shininess: 38,
    specular: new THREE.Color(0x3a2f1c)
  });
  const cloth = new THREE.Mesh(geo, mat);

  const group = new THREE.Group();
  group.add(cloth);
  group.rotation.set(-0.34, -0.18, -0.10);
  group.position.set(1.4, -0.15, 0);
  scene.add(group);

  /* low ambient + a raking key light, so the folds read against the dark hero */
  scene.add(new THREE.AmbientLight(0xfff6e6, .3));
  const key = new THREE.DirectionalLight(0xfff1d6, .62); key.position.set(7,5,3.5); scene.add(key);
  const rim = new THREE.PointLight(0xd9b36a, .25, 60); rim.position.set(-7,-2,5); scene.add(rim);

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

  /* size to hero */
  function resize(){
    const w = hero.clientWidth, h = hero.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  window.addEventListener('resize', resize); resize();

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
  let raf;
  function loop(ms){
    const t = ms*0.001;
    wave(t);
    group.rotation.y += ((baseRY + tx*0.12) - group.rotation.y)*0.05;
    group.rotation.x += ((baseRX + ty*0.08) - group.rotation.x)*0.05;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden){ cancelAnimationFrame(raf); }
    else { raf = requestAnimationFrame(loop); }
  });
})();
})();
