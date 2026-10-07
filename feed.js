/* ==========================================================================
   VESTRO — PRODUCT FEED
   Starts downloading the collection the moment the page opens (this file is
   loaded in <head>), so the pieces are ready by the time the page is drawn.
   It reads Firestore directly — no Firebase library to download first — and
   takes the lightest things first:
     1. names, prices, categories      (a few KB)        -> the cards appear
     2. small preview photos ("thumb") (~30 KB a piece)  -> the photos appear
     3. full photos, a product at a time (catalog.js asks) -> they sharpen
   catalog.js draws all of it. The admin portal saves the "thumb" previews.
   ========================================================================== */
(function(){
"use strict";

var cfg = window.VESTRO_FIREBASE_CONFIG;
var ready = !!(cfg && cfg.projectId && cfg.apiKey && !/^PASTE/.test(cfg.apiKey) && window.fetch && window.Promise);
var BASE = ready
  ? 'https://firestore.googleapis.com/v1/projects/' + cfg.projectId + '/databases/(default)/documents/products'
  : '';
var KEY = ready ? 'key=' + encodeURIComponent(cfg.apiKey) : '';

/* what the cards need, without the photos */
var INFO = ['name','weave','price','oldPrice','category','status','style','createdAt'];

function wait(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

function getJSON(url, tries){
  return fetch(url).then(function(r){
    if(!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).catch(function(err){
    if(tries > 1) return wait(1200).then(function(){ return getJSON(url, tries - 1); });
    throw err;
  });
}

/* Firestore's wire format -> plain values */
function val(v){
  if(!v) return undefined;
  if('stringValue' in v) return v.stringValue;
  if('integerValue' in v) return Number(v.integerValue);
  if('doubleValue' in v) return v.doubleValue;
  if('booleanValue' in v) return v.booleanValue;
  if('arrayValue' in v) return (v.arrayValue.values || []).map(val);
  return undefined;
}
function plain(doc){
  var o = { id: doc.name.split('/').pop() }, f = doc.fields || {};
  for(var k in f) o[k] = val(f[k]);
  return o;
}

/* every product, newest first, with only the named fields */
function list(fields, token, got){
  var url = BASE + '?pageSize=300&orderBy=createdAt%20desc&' +
    fields.map(function(f){ return 'mask.fieldPaths=' + f; }).join('&') +
    (token ? '&pageToken=' + encodeURIComponent(token) : '') + '&' + KEY;
  return getJSON(url, 2).then(function(page){
    var all = (got || []).concat((page.documents || []).map(plain));
    return page.nextPageToken ? list(fields, page.nextPageToken, all) : all;
  });
}

/* one product's full-size photos */
function photos(id){
  return getJSON(BASE + '/' + encodeURIComponent(id) + '?mask.fieldPaths=images&mask.fieldPaths=image&' + KEY, 2)
    .then(function(doc){
      var p = plain(doc);
      if(p.images && p.images.length) return p.images;
      return p.image ? [p.image] : [];
    });
}

var feed = window.VESTRO_FEED = {
  ready: ready,
  photos: photos,
  /* (re)start the two list downloads — also used by "Try again" */
  load: function(){
    feed.info = ready ? list(INFO) : Promise.resolve([]);
    feed.thumbs = ready ? list(['thumb']) : Promise.resolve([]);
    /* catalog.js handles failures; this only keeps the console quiet until it does */
    feed.info.catch(function(){});
    feed.thumbs.catch(function(){});
  }
};
feed.load();
})();
