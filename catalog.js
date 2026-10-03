/* ==========================================================================
   VESTRO — LIVE CATALOG + WHATSAPP ORDER BASKET
   Loads products from Firebase Firestore (managed via admin.html).
   Shows a "collection arriving" note until the first piece is added.
   ========================================================================== */
(async function(){
"use strict";

const WA = window.VESTRO_WHATSAPP || "97466194953";
/* pieces added before this moment are archived (see firebase-config.js) */
const FRESH_START = window.VESTRO_FRESH_START || 0;

const STYLE_MAT = { goldtissue:'mat-velvet', saffron:'mat-forest', temple:'mat-velvet', marigold:'mat-forest' };
/* Categories are free-form: whatever the owner types in the admin panel becomes
   a category (e.g. "Kurthis", "Lehengas"). Older products were saved with short
   keys, so map those to their display names; anything else is shown as typed. */
const LEGACY_CATS = { saree:'Sarees', modern:'Modern wear', workwear:'Work wear' };
const CAT_ORDER = ['Sarees', 'Modern wear', 'Work wear'];
function catOf(p){
  const c = (p.category || '').trim();
  if(!c) return 'Sarees';
  return LEGACY_CATS[c] || c;
}
/* the distinct categories present, defaults first then new ones alphabetically */
function catsPresent(){
  const present = [...new Set(products.map(catOf))];
  present.sort((a,b)=>{
    const ia = CAT_ORDER.indexOf(a), ib = CAT_ORDER.indexOf(b);
    if(ia !== -1 && ib !== -1) return ia - ib;
    if(ia !== -1) return -1;
    if(ib !== -1) return 1;
    return a.localeCompare(b);
  });
  return present;
}

/* ---------- load products ---------- */
function firebaseReady(){
  const c = window.VESTRO_FIREBASE_CONFIG;
  return c && c.apiKey && !/^PASTE/.test(c.apiKey);
}

async function loadProducts(){
  if(!firebaseReady()) return [];
  try{
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    const { getFirestore, collection, getDocs, query, orderBy, where } =
      await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const app = initializeApp(window.VESTRO_FIREBASE_CONFIG);
    const db = getFirestore(app);
    /* archived pieces (and their photos) are never downloaded */
    const snap = await getDocs(query(collection(db,'products'),
      where('createdAt','>=',FRESH_START), orderBy('createdAt','desc')));
    const items = [];
    snap.forEach(d => items.push({ id:d.id, ...d.data() }));
    return items;
  }catch(err){
    console.warn('Vestro: could not load products from Firebase.', err);
    return [];
  }
}

/* ---------- order basket (saved locally in the browser) ---------- */
const CART_KEY = 'vestro-order';
function readCart(){
  try{ return JSON.parse(localStorage.getItem(CART_KEY)) || []; }catch(e){ return []; }
}
/* storage can be blocked (private browsing on some phones) — the basket then
   simply lasts until the page is closed */
function writeCart(items){
  try{ localStorage.setItem(CART_KEY, JSON.stringify(items)); }catch(e){}
}

/* ---------- WhatsApp message builders ---------- */
function singleOrderLink(p){
  const price = p.price ? ` (${p.price})` : '';
  const msg = `Hi Vestro by RA! I'd like to order the *${p.name}*${price} ✨\nPlease confirm availability & delivery.`;
  return `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;
}
/* always use the latest name/price from the loaded products, not what
   was stored when the customer first tapped "Add to order" */
function liveItem(c){
  const p = products.find(x => x.id === c.id);
  return p ? { name: p.name, price: p.price || '' } : { name: c.name, price: c.price || '' };
}

function basketOrderLink(items){
  const lines = items.map((c,i)=>{
    const t = liveItem(c);
    return `${i+1}. ${t.name}${t.price ? ' — '+t.price : ''}`;
  });
  const msg = `Hi Vestro by RA! ✨ I'd like to order these:\n\n${lines.join('\n')}\n\nTotal pieces: ${items.length}\nPlease confirm availability, price & delivery.`;
  return `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;
}

/* ---------- render ---------- */
const grid = document.getElementById('productGrid');
const bar       = document.getElementById('cartBar');
const barCount  = document.getElementById('cartCount');
const barSend   = document.getElementById('cartSend');
const barClear  = document.getElementById('cartClear');
const barPanel  = document.getElementById('cartPanel');
const barToggle = document.getElementById('cartToggle');
if(!grid) return;

let products = await loadProducts();
products = products.filter(p => p.status !== 'hidden' && (p.createdAt || 0) >= FRESH_START);

/* drop basket items whose product no longer exists / is hidden or sold out */
let cart = readCart().filter(c => products.some(p => p.id === c.id && p.status !== 'soldout'));
writeCart(cart);

function el(tag, cls, text){
  const n = document.createElement(tag);
  if(cls) n.className = cls;
  if(text != null) n.textContent = text;
  return n;
}

function imagesOf(p){
  if(p.images && p.images.length) return p.images;
  return p.image ? [p.image] : [];
}

/* pull the number out of a price like "QR 450" so we can compute % off */
function priceNum(s){
  const m = String(s || '').replace(/[,\s]/g,'').match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}
function percentOff(p){
  const now = priceNum(p.price), was = priceNum(p.oldPrice);
  if(now == null || was == null || was <= now) return null;
  const pct = Math.round((was - now) / was * 100);
  return (pct >= 1 && pct <= 90) ? pct : null;
}

/* the 2 most recently added pieces get a "New" tag (live products only) */
const newIds = new Set(
  products.length > 3
    ? products.filter(p => p.createdAt).slice(0, 2).map(p => p.id)
    : []
);

function drapeFor(p){
  const cover = imagesOf(p)[0];
  if(cover){
    const d = el('div','drape drape-photo');
    const img = el('span','drape-img');
    img.style.backgroundImage = `url("${cover.replace(/"/g,'%22')}")`;
    d.appendChild(img);
    return d;
  }
  const style = STYLE_MAT[p.style] ? p.style : 'goldtissue';
  const d = el('div', `drape ${STYLE_MAT[style]}`);
  const fold = el('span', `fold f-${style}`);
  const tassel = el('span','tassel');
  for(let i=0;i<4;i++) tassel.appendChild(el('i'));
  fold.appendChild(tassel);
  d.appendChild(fold);
  return d;
}

function inCart(p){ return cart.some(c => c.id === p.id); }

function toggleCart(p, btn){
  if(inCart(p)){
    cart = cart.filter(c => c.id !== p.id);
    btn.textContent = 'Add to order';
    btn.classList.remove('chip-added');
  }else{
    cart.push({ id:p.id, name:p.name, price:p.price || '' });
    btn.textContent = 'Added ✓';
    btn.classList.add('chip-added');
  }
  writeCart(cart);
  updateBar();
}

function removeFromCart(id){
  cart = cart.filter(c => c.id !== id);
  writeCart(cart);
  const btn = grid.querySelector(`.chip-add[data-id="${CSS.escape(id)}"]`);
  if(btn){ btn.textContent = 'Add to order'; btn.classList.remove('chip-added'); }
  updateBar();
}

/* mini thumbnails for the basket list */
const THUMB_GRAD = {
  goldtissue:'linear-gradient(140deg,#f4e6c6 0%,#e3c88e 42%,#cda760 74%,#b98a3e 100%)',
  saffron:   'linear-gradient(140deg,#fbf6ea 0%,#f2ead6 55%,#e0904c 100%)',
  temple:    'linear-gradient(140deg,#f8f1de 0%,#efe2c2 60%,#e0cb9c 100%)',
  marigold:  'linear-gradient(140deg,#eec886 0%,#dfa858 45%,#cd8038 100%)'
};

function renderPanel(){
  if(!barPanel) return;
  barPanel.textContent = '';
  cart.forEach(c=>{
    const p = products.find(x => x.id === c.id) || {};
    const row = el('div','cart-item');
    const thumb = el('div','cart-item-thumb');
    const cover = imagesOf(p)[0];
    if(cover){ thumb.style.backgroundImage = `url("${cover.replace(/"/g,'%22')}")`; }
    else{ thumb.style.background = THUMB_GRAD[p.style] || THUMB_GRAD.goldtissue; }
    row.appendChild(thumb);
    const info = el('div','cart-item-info');
    const t = liveItem(c);
    info.appendChild(el('h4', null, t.name));
    if(t.price) info.appendChild(el('p', null, t.price));
    row.appendChild(info);
    const x = el('button','cart-item-x','×');
    x.type = 'button';
    x.setAttribute('aria-label', `Remove ${c.name} from order`);
    x.addEventListener('click', ()=> removeFromCart(c.id));
    row.appendChild(x);
    barPanel.appendChild(row);
  });
}

let panelOpen = false;
function setPanel(open){
  panelOpen = open;
  if(barPanel) barPanel.hidden = !open;
  if(barToggle) barToggle.setAttribute('aria-expanded', String(open));
}

function updateBar(){
  if(!bar) return;
  if(cart.length === 0){ bar.hidden = true; setPanel(false); return; }
  bar.hidden = false;
  barCount.textContent = cart.length === 1 ? '1 piece selected' : `${cart.length} pieces selected`;
  barSend.href = basketOrderLink(cart);
  renderPanel();
}

function cardFor(p, i){
  const card = el('article','card reveal');
  if(i) card.style.transitionDelay = (Math.min(i,4) * .08) + 's';

  const inner = el('div','card-inner');
  const drape = drapeFor(p);
  if(p.status === 'soldout'){
    card.classList.add('is-sold');
    drape.appendChild(el('span','sold-badge','Sold out'));
  }else{
    const pct = percentOff(p);
    if(pct) drape.appendChild(el('span','off-badge', `${pct}% off`));
    if(newIds.has(p.id)) drape.appendChild(el('span','new-badge','New'));
  }
  drape.classList.add('drape-click');
  drape.setAttribute('role','button');
  drape.setAttribute('tabindex','0');
  drape.setAttribute('aria-label', `View ${p.name}`);
  drape.addEventListener('click', ()=> openViewer(p));
  drape.addEventListener('keydown', e=>{ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openViewer(p); } });
  inner.appendChild(drape);
  inner.appendChild(el('h3', null, p.name));
  if(p.weave) inner.appendChild(el('p','weave', p.weave));
  if(p.price){
    const priceEl = el('p','price', p.price);
    if(p.oldPrice && percentOff(p)){
      const was = el('s','price-old', p.oldPrice);
      priceEl.append(' ', was);
    }
    inner.appendChild(priceEl);
  }

  const foot = el('div','card-foot');
  if(p.status === 'soldout'){
    foot.appendChild(el('span','chip chip-sold','Sold out'));
    const ask = el('a','chip','Ask on WhatsApp');
    ask.href = `https://wa.me/${WA}?text=${encodeURIComponent(`Hi! Will the "${p.name}" be back in stock? 🤍`)}`;
    ask.target = '_blank'; ask.rel = 'noopener';
    foot.appendChild(ask);
  }else{
    const add = el('button','chip chip-add', inCart(p) ? 'Added ✓' : 'Add to order');
    if(inCart(p)) add.classList.add('chip-added');
    add.type = 'button';
    add.dataset.id = p.id;
    add.addEventListener('click', ()=> toggleCart(p, add));
    foot.appendChild(add);

    const buy = el('a','chip chip-wa','Order now');
    buy.href = singleOrderLink(p);
    buy.target = '_blank'; buy.rel = 'noopener';
    foot.appendChild(buy);
  }
  inner.appendChild(foot);
  card.appendChild(inner);
  return card;
}

/* ---------- category filters + grid rendering ---------- */
const filterRow = document.getElementById('filterRow');
const catRow = document.getElementById('catRow');
let activeCat = 'all';

function setCat(val){
  activeCat = val;
  renderCats(); renderFilters(); renderGrid();
}

/* shop-by-category circles (Laly's-style), built from the live products */
function renderCats(){
  if(!catRow) return;
  const present = catsPresent();
  if(present.length < 2){ catRow.hidden = true; return; }
  catRow.hidden = false;
  catRow.textContent = '';
  present.forEach(c=>{
    const items = products.filter(p => catOf(p) === c);
    const b = el('button','cat-circle' + (activeCat === c ? ' cat-on' : ''));
    b.type = 'button';
    const img = el('span','cat-img');
    const cover = items.map(p => imagesOf(p)[0]).find(Boolean);
    if(cover) img.style.backgroundImage = `url("${cover.replace(/"/g,'%22')}")`;
    b.appendChild(img);
    b.appendChild(el('b', null, c));
    b.appendChild(el('small', null, items.length === 1 ? '1 piece' : `${items.length} pieces`));
    b.addEventListener('click', ()=> setCat(activeCat === c ? 'all' : c));
    catRow.appendChild(b);
  });
}

function bindFx(scope){
  scope.querySelectorAll('.reveal').forEach(reveal);
}

/* shown while the collection has no pieces */
function emptyState(){
  const box = el('div','empty reveal');
  const NS = 'http://www.w3.org/2000/svg';
  const orn = document.createElementNS(NS,'svg');
  orn.setAttribute('class','orn'); orn.setAttribute('aria-hidden','true');
  const use = document.createElementNS(NS,'use');
  use.setAttribute('href','#paisley');
  orn.appendChild(use);
  box.appendChild(orn);
  const h = el('h3', null, 'The new collection is ');
  h.appendChild(el('em', null, 'on its way'));
  box.appendChild(h);
  box.appendChild(el('p', null, 'We are choosing the first pieces of a new chapter, one at a time. Message us on WhatsApp for a private preview, or to be the first to know when they arrive.'));
  const row = el('div','cta-row');
  const a = el('a','btn btn-primary','Request a preview');
  a.href = `https://wa.me/${WA}?text=${encodeURIComponent("Hi Vestro by RA! I'd love a preview of the new collection ✨")}`;
  a.target = '_blank'; a.rel = 'noopener';
  row.appendChild(a);
  box.appendChild(row);
  return box;
}

function renderGrid(){
  grid.textContent = '';
  const list = activeCat === 'all' ? products : products.filter(p => catOf(p) === activeCat);
  if(list.length === 0){
    grid.appendChild(emptyState());
  }else{
    list.forEach((p,i)=> grid.appendChild(cardFor(p,i)));
  }
  bindFx(grid);
}

function renderFilters(){
  if(!filterRow) return;
  const present = catsPresent();
  if(present.length < 2){ filterRow.hidden = true; return; }
  filterRow.hidden = false;
  filterRow.textContent = '';
  const mk = (val, label)=>{
    const b = el('button','chip' + (activeCat === val ? ' chip-on' : ''), label);
    b.type = 'button';
    b.addEventListener('click', ()=> setCat(val));
    filterRow.appendChild(b);
  };
  mk('all','All');
  present.forEach(c => mk(c, c));
}

/* ---------- product viewer (click a saree to open) ---------- */
const pmBackdrop = document.getElementById('pmBackdrop');
const pmImg   = document.getElementById('pmImg');
const pmCount = document.getElementById('pmCount');
const pmDots  = document.getElementById('pmDots');
const pmName  = document.getElementById('pmName');
const pmWeave = document.getElementById('pmWeave');
const pmPrice = document.getElementById('pmPrice');
const pmAdd   = document.getElementById('pmAdd');
const pmBuy   = document.getElementById('pmBuy');
const pmSold  = document.getElementById('pmSold');

let pmProduct = null, pmIndex = 0, pmImages = [];

function pmRender(){
  const many = pmImages.length > 1;
  if(pmImages.length){
    pmImg.style.background = '';
    pmImg.style.backgroundImage = `url("${pmImages[pmIndex].replace(/"/g,'%22')}")`;
  }else{
    pmImg.style.backgroundImage = '';
    pmImg.style.background = THUMB_GRAD[pmProduct.style] || THUMB_GRAD.goldtissue;
  }
  document.getElementById('pmPrev').hidden = !many;
  document.getElementById('pmNext').hidden = !many;
  pmCount.hidden = !many;
  pmCount.textContent = `${pmIndex + 1} / ${pmImages.length}`;
  pmDots.textContent = '';
  if(many){
    pmImages.forEach((_, i)=>{
      const d = el('i', i === pmIndex ? 'on' : null);
      d.addEventListener('click', ()=>{ pmIndex = i; pmRender(); });
      pmDots.appendChild(d);
    });
  }
}

function pmSyncAdd(){
  if(!pmProduct) return;
  const added = inCart(pmProduct);
  pmAdd.textContent = added ? 'Added ✓' : 'Add to order';
  pmAdd.classList.toggle('chip-added', added);
}

function openViewer(p){
  pmProduct = p; pmImages = imagesOf(p); pmIndex = 0;
  pmName.textContent = p.name;
  pmWeave.textContent = p.weave || ''; pmWeave.hidden = !p.weave;
  pmPrice.textContent = p.price || ''; pmPrice.hidden = !p.price;
  if(p.price && p.oldPrice && percentOff(p)){
    const was = el('s','price-old', p.oldPrice);
    pmPrice.append(' ', was);
  }
  const sold = p.status === 'soldout';
  pmAdd.hidden = sold; pmBuy.hidden = sold; pmSold.hidden = !sold;
  pmBuy.href = singleOrderLink(p);
  pmSyncAdd();
  pmRender();
  pmBackdrop.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeViewer(){
  pmBackdrop.hidden = true;
  document.body.style.overflow = '';
  pmProduct = null;
}

function pmStep(d){
  if(pmImages.length < 2) return;
  pmIndex = (pmIndex + d + pmImages.length) % pmImages.length;
  pmRender();
}

if(pmBackdrop){
  document.getElementById('pmClose').addEventListener('click', closeViewer);
  document.getElementById('pmPrev').addEventListener('click', ()=> pmStep(-1));
  document.getElementById('pmNext').addEventListener('click', ()=> pmStep(1));
  pmBackdrop.addEventListener('click', e=>{ if(e.target === pmBackdrop) closeViewer(); });
  document.addEventListener('keydown', e=>{
    if(pmBackdrop.hidden) return;
    if(e.key === 'Escape') closeViewer();
    if(e.key === 'ArrowLeft') pmStep(-1);
    if(e.key === 'ArrowRight') pmStep(1);
  });
  /* swipe between photos on touch screens */
  let touchX = null;
  pmImg.addEventListener('touchstart', e=>{ touchX = e.touches[0].clientX; }, {passive:true});
  pmImg.addEventListener('touchend', e=>{
    if(touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if(Math.abs(dx) > 45) pmStep(dx < 0 ? 1 : -1);
    touchX = null;
  }, {passive:true});
  pmAdd.addEventListener('click', ()=>{
    if(!pmProduct) return;
    const gridBtn = grid.querySelector(`.chip-add[data-id="${CSS.escape(pmProduct.id)}"]`);
    if(gridBtn){ gridBtn.click(); }
    else{ toggleCart(pmProduct, pmAdd); }
    pmSyncAdd();
  });
}

/* basket bar events */
if(barToggle) barToggle.addEventListener('click', ()=> setPanel(!panelOpen));
if(barClear) barClear.addEventListener('click', ()=>{
  cart = []; writeCart(cart); updateBar();
  grid.querySelectorAll('.chip-add').forEach(b=>{ b.textContent='Add to order'; b.classList.remove('chip-added'); });
});
updateBar();

/* ---------- reveal helper (the scroll animation lives in script.js) ---------- */
const reveal = window.VESTRO_REVEAL || (n => n.classList.add('in'));

/* ---------- first paint ---------- */
renderCats();
renderFilters();
renderGrid();
})();
