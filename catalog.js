/* ==========================================================================
   VESTRO — LIVE CATALOG + WHATSAPP ORDER BASKET
   Draws the products that feed.js downloads (managed via admin.html).
   The cards appear as soon as the names arrive — or at once, from the copy
   saved on the last visit — and the photos fill in as they come.
   Shows a "collection arriving" note only when the shop really is empty.
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

/* ---------- the product feed (feed.js starts it in <head>) ---------- */
function loadFeed(){
  if(window.VESTRO_FEED) return Promise.resolve(window.VESTRO_FEED);
  /* a copy of the page from before feed.js existed: fetch it now */
  return new Promise(resolve=>{
    const s = document.createElement('script');
    s.src = 'feed.js';
    s.onload = ()=> resolve(window.VESTRO_FEED || null);
    s.onerror = ()=> resolve(null);
    document.head.appendChild(s);
  });
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

/* the scroll animation lives in script.js */
const reveal = window.VESTRO_REVEAL || (n => n.classList.add('in'));

let products = [];     /* the pieces on show, newest first */
let loaded = false;    /* the live list has arrived (not only the copy from the last visit) */
let failed = false;    /* the live list could not be fetched */
let thumbs = null;     /* id -> small preview photo, once that list arrives */
let thumbsSettled = false;
let cart = readCart();
let feed = window.VESTRO_FEED || null;

/* ---------- the copy kept from the last visit, so returning customers see the
   collection at once while the fresh list downloads ---------- */
const FEED_KEY = 'vestro-feed-v1';
function readCopy(){
  try{
    const s = JSON.parse(localStorage.getItem(FEED_KEY));
    return s && s.fresh === FRESH_START && Array.isArray(s.items) ? s.items : null;
  }catch(e){ return null; }
}
function saveCopy(){
  const slim = withThumbs => JSON.stringify({ fresh: FRESH_START, items: products.map(p => ({
    id:p.id, name:p.name, weave:p.weave, price:p.price, oldPrice:p.oldPrice, category:p.category,
    status:p.status, style:p.style, createdAt:p.createdAt, thumb: withThumbs ? p.thumb : undefined
  })) });
  try{ localStorage.setItem(FEED_KEY, slim(true)); }
  catch(e){
    /* no room for the previews (or storage is blocked): keep the words at least */
    try{ localStorage.setItem(FEED_KEY, slim(false)); }catch(e2){}
  }
}

/* take in a list of products (live, or the saved copy), keeping the photos
   already downloaded for pieces we know */
function adopt(list){
  const known = new Map(products.map(p => [p.id, p]));
  products = list
    .filter(p => p.status !== 'hidden' && (p.createdAt || 0) >= FRESH_START)
    .sort((a,b)=> (b.createdAt || 0) - (a.createdAt || 0))
    .map(p =>{
      const o = known.get(p.id);
      return o ? Object.assign(o, p) : p;
    });
  applyThumbs();
}
function applyThumbs(){
  if(!thumbs) return;
  products.forEach(p => { p.thumb = thumbs.get(p.id) || ''; });
}

function el(tag, cls, text){
  const n = document.createElement(tag);
  if(cls) n.className = cls;
  if(text != null) n.textContent = text;
  return n;
}
const cssUrl = src => `url("${src.replace(/"/g,'%22')}")`;

/* A product's photos arrive in steps: p.thumb (small preview) with the list,
   then p.images (full size). p.images stays undefined until they are fetched. */
function imagesOf(p){ return p.images || []; }
function coverOf(p){ return (p.images && p.images[0]) || p.thumb || ''; }
/* photo = something to show · wait = photos still on their way · woven = no photo, show the drape design */
function drapeKind(p){
  if(coverOf(p)) return 'photo';
  return (p.images === undefined && !p.photoFailed) ? 'wait' : 'woven';
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
let newIds = new Set();
function findNew(){
  newIds = new Set(
    products.length > 3
      ? products.filter(p => p.createdAt).slice(0, 2).map(p => p.id)
      : []
  );
}

const cards = new Map();   /* product id -> its drape (photo) element in the grid */

function drapeFor(p){
  const kind = drapeKind(p);
  let d;
  if(kind === 'woven'){
    const style = STYLE_MAT[p.style] ? p.style : 'goldtissue';
    d = el('div', `drape ${STYLE_MAT[style]}`);
    const fold = el('span', `fold f-${style}`);
    const tassel = el('span','tassel');
    for(let i=0;i<4;i++) tassel.appendChild(el('i'));
    fold.appendChild(tassel);
    d.appendChild(fold);
  }else{
    d = el('div','drape drape-photo' + (kind === 'wait' ? ' drape-wait' : ''));
    const img = el('span','drape-img');
    if(kind === 'photo') img.style.backgroundImage = cssUrl(coverOf(p));
    d.appendChild(img);
  }
  d._kind = kind;
  d._src = coverOf(p);

  if(p.status === 'soldout'){
    d.appendChild(el('span','sold-badge','Sold out'));
  }else{
    const pct = percentOff(p);
    if(pct) d.appendChild(el('span','off-badge', `${pct}% off`));
    if(newIds.has(p.id)) d.appendChild(el('span','new-badge','New'));
  }
  d.classList.add('drape-click');
  d.setAttribute('role','button');
  d.setAttribute('tabindex','0');
  d.setAttribute('aria-label', `View ${p.name}`);
  d.addEventListener('click', ()=> openViewer(p));
  d.addEventListener('keydown', e=>{ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openViewer(p); } });
  return d;
}

/* bring a card's photo up to date without redrawing (or re-animating) the card */
function paintCard(p){
  const old = cards.get(p.id);
  if(!old || !old.parentNode) return;
  const kind = drapeKind(p), src = coverOf(p);
  if(kind === 'photo' && old._kind === 'photo'){
    if(old._src === src) return;
    /* preview -> full photo: swap once it is decoded, so nothing flashes */
    old._src = src;
    const pre = new Image();
    const swap = ()=>{ if(old._src === src) old.querySelector('.drape-img').style.backgroundImage = cssUrl(src); };
    pre.src = src;
    (pre.decode ? pre.decode() : Promise.resolve()).then(swap, swap);
    return;
  }
  if(kind === old._kind) return;
  const fresh = drapeFor(p);
  old.parentNode.replaceChild(fresh, old);
  cards.set(p.id, fresh);
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
    const cover = coverOf(p);
    if(cover){ thumb.style.backgroundImage = cssUrl(cover); }
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
  cards.set(p.id, drape);
  if(p.status === 'soldout') card.classList.add('is-sold');
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
const catImgs = new Map();   /* category -> its circle, so the photo can be added when it arrives */
function renderCats(){
  if(!catRow) return;
  catImgs.clear();
  const present = catsPresent();
  if(present.length < 2){ catRow.hidden = true; return; }
  catRow.hidden = false;
  catRow.textContent = '';
  present.forEach(c=>{
    const items = products.filter(p => catOf(p) === c);
    const b = el('button','cat-circle' + (activeCat === c ? ' cat-on' : ''));
    b.type = 'button';
    const img = el('span','cat-img');
    catImgs.set(c, img);
    b.appendChild(img);
    b.appendChild(el('b', null, c));
    b.appendChild(el('small', null, items.length === 1 ? '1 piece' : `${items.length} pieces`));
    b.addEventListener('click', ()=> setCat(activeCat === c ? 'all' : c));
    catRow.appendChild(b);
  });
  syncCatImages();
}
function syncCatImages(){
  catImgs.forEach((img, c)=>{
    if(img._has) return;
    const cover = products.filter(p => catOf(p) === c).map(coverOf).find(Boolean);
    if(cover){ img.style.backgroundImage = cssUrl(cover); img._has = true; }
  });
}

function bindFx(scope){
  scope.querySelectorAll('.reveal').forEach(reveal);
}

function noteBox(title, em, text){
  const box = el('div','empty reveal');
  const NS = 'http://www.w3.org/2000/svg';
  const orn = document.createElementNS(NS,'svg');
  orn.setAttribute('class','orn'); orn.setAttribute('aria-hidden','true');
  const use = document.createElementNS(NS,'use');
  use.setAttribute('href','#paisley');
  orn.appendChild(use);
  box.appendChild(orn);
  const h = el('h3', null, title);
  h.appendChild(el('em', null, em));
  box.appendChild(h);
  box.appendChild(el('p', null, text));
  const row = el('div','cta-row');
  box.appendChild(row);
  return box;
}

/* shown while the collection has no pieces */
function emptyState(){
  const box = noteBox('The new collection is ', 'on its way',
    'We are choosing the first pieces of a new chapter, one at a time. Message us on WhatsApp for a private preview, or to be the first to know when they arrive.');
  const a = el('a','btn btn-primary','Request a preview');
  a.href = `https://wa.me/${WA}?text=${encodeURIComponent("Hi Vestro by RA! I'd love a preview of the new collection ✨")}`;
  a.target = '_blank'; a.rel = 'noopener';
  box.lastChild.appendChild(a);
  return box;
}

/* shown when the collection could not be downloaded (no connection, usually) */
function failedState(){
  const box = noteBox('The collection is ', 'taking a moment',
    'We could not load the pieces just now. Please check your connection and try again — or see every piece in our WhatsApp catalogue.');
  const again = el('button','btn btn-primary','Try again');
  again.type = 'button';
  again.addEventListener('click', ()=>{
    failed = false;
    renderAll();
    feed.load();
    listen();
  });
  const a = el('a','btn btn-outline','See it on WhatsApp');
  a.href = `https://wa.me/c/${WA}`;
  a.target = '_blank'; a.rel = 'noopener';
  box.lastChild.append(again, a);
  return box;
}

/* a placeholder card, shown for the moment before the pieces arrive */
function skeletonCard(){
  const card = el('article','card');
  card.setAttribute('aria-hidden','true');
  const inner = el('div','card-inner');
  const d = el('div','drape drape-wait');
  d.appendChild(el('span','drape-img'));
  inner.appendChild(d);
  inner.appendChild(el('div','skel-line'));
  inner.appendChild(el('div','skel-line short'));
  card.appendChild(inner);
  return card;
}

function renderGrid(){
  grid.textContent = '';
  cards.clear();
  findNew();
  const list = activeCat === 'all' ? products : products.filter(p => catOf(p) === activeCat);
  if(list.length){
    list.forEach((p,i)=> grid.appendChild(cardFor(p,i)));
  }else if(loaded){
    grid.appendChild(emptyState());
  }else if(failed){
    grid.appendChild(failedState());
  }else{
    for(let i=0;i<4;i++) grid.appendChild(skeletonCard());
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

/* what is on screen, so a fresh list that changes nothing isn't redrawn */
let drawn = null;
function stateKey(){
  if(!products.length) return loaded ? 'empty' : (failed ? 'failed' : 'wait');
  return JSON.stringify(products.map(p => [p.id, p.name, p.weave, p.price, p.oldPrice, catOf(p), p.status, p.style]));
}
function renderAll(){
  if(activeCat !== 'all' && !products.some(p => catOf(p) === activeCat)) activeCat = 'all';
  drawn = stateKey();
  renderCats();
  renderFilters();
  renderGrid();
}

/* ---------- full-size photos: a few at a time, top of the page first ---------- */
const asked = new Set();
const queue = [];
let running = 0;

function wantPhotos(p, first){
  if(p.images !== undefined) return;
  if(asked.has(p.id)){
    /* already waiting in line: the viewer can move it to the front */
    const at = queue.indexOf(p.id);
    if(first && at > 0){ queue.splice(at, 1); queue.unshift(p.id); }
    return;
  }
  asked.add(p.id);
  p.photoFailed = false;
  first ? queue.unshift(p.id) : queue.push(p.id);
  pump();
}
function pump(){
  while(feed && running < 3 && queue.length){
    const id = queue.shift();
    running++;
    feed.photos(id).then(imgs =>{
      const p = products.find(x => x.id === id);
      if(p) p.images = imgs;
    }, ()=>{
      asked.delete(id);   /* opening the piece will try again */
      const p = products.find(x => x.id === id);
      if(p) p.photoFailed = true;
    }).then(()=>{
      running--;
      const p = products.find(x => x.id === id);
      if(p){
        paintCard(p);
        syncCatImages();
        if(pmProduct && pmProduct.id === id) refreshViewer();
        if(inCart(p)) renderPanel();
      }
      pump();
    });
  }
}
/* wait for the small previews first, so they are not slowed down by the big photos */
function fetchPhotos(){
  if(!thumbsSettled) return;
  products.forEach(p => wantPhotos(p));
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

/* the full photos, or the small preview until they arrive */
function viewerImages(p){
  const full = imagesOf(p);
  return full.length ? full : (p.thumb ? [p.thumb] : []);
}

function pmRender(){
  const many = pmImages.length > 1;
  if(pmImages.length){
    pmImg.style.background = '';
    pmImg.style.backgroundImage = cssUrl(pmImages[pmIndex]);
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

/* the open piece's photos have just arrived */
function refreshViewer(){
  pmImages = viewerImages(pmProduct);
  pmIndex = Math.min(pmIndex, Math.max(0, pmImages.length - 1));
  pmRender();
}

function pmSyncAdd(){
  if(!pmProduct) return;
  const added = inCart(pmProduct);
  pmAdd.textContent = added ? 'Added ✓' : 'Add to order';
  pmAdd.classList.toggle('chip-added', added);
}

function openViewer(p){
  pmProduct = p; pmImages = viewerImages(p); pmIndex = 0;
  wantPhotos(p, true);
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

/* ---------- first paint, then the live list ---------- */
/* what the last visit saved goes up at once; otherwise placeholder cards */
const copy = readCopy();
if(copy) adopt(copy);
renderAll();
updateBar();

if(!feed) feed = await loadFeed();
if(!feed || !feed.ready){
  /* Firebase is not set up: nothing to show */
  products = []; loaded = true;
  renderAll();
  return;
}

function listen(){
  const info = feed.info, small = feed.thumbs;
  info.then(list =>{
    if(info !== feed.info) return;   /* "Try again" started a newer download */
    loaded = true; failed = false;
    adopt(list);
    /* drop basket items whose product no longer exists / is hidden or sold out */
    cart = cart.filter(c => products.some(p => p.id === c.id && p.status !== 'soldout'));
    writeCart(cart);
    if(stateKey() !== drawn) renderAll();
    else products.forEach(paintCard);
    updateBar();
    fetchPhotos();
    saveCopy();
  }, err =>{
    if(info !== feed.info) return;
    console.warn('Vestro: could not load the collection.', err);
    failed = true;
    if(!products.length) renderAll();
  });
  small.then(list =>{
    if(small !== feed.thumbs) return;
    thumbs = new Map();
    list.forEach(t => { if(t.thumb) thumbs.set(t.id, t.thumb); });
    applyThumbs();
    products.forEach(paintCard);
    syncCatImages();
    if(cart.length) renderPanel();
    if(loaded) saveCopy();
  }, ()=>{}).then(()=>{
    thumbsSettled = true;
    fetchPhotos();
  });
}
listen();
})();
