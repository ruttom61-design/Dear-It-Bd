

/* ===== FIX: sandboxed preview / blocked storage -> in-memory fallback ===== */
(function(){
  let ok = true;
  try { window.localStorage.setItem('__t','1'); window.localStorage.removeItem('__t'); window.sessionStorage.setItem('__t','1'); window.sessionStorage.removeItem('__t'); } catch(e){ ok = false; }
  if (ok) return;
  const mk = function(){
    const m = Object.create(null);
    return {
      get length(){ return Object.keys(m).length; },
      getItem: function(k){ k = String(k); return (k in m) ? m[k] : null; },
      setItem: function(k, v){ m[String(k)] = String(v); },
      removeItem: function(k){ delete m[String(k)]; },
      clear: function(){ for (const k in m) delete m[k]; },
      key: function(i){ return Object.keys(m)[i] || null; }
    };
  };
  try { Object.defineProperty(window, 'localStorage', { configurable: true, get: function(){ if (!window.__memLS) window.__memLS = mk(); return window.__memLS; } }); } catch(e){}
  try { Object.defineProperty(window, 'sessionStorage', { configurable: true, get: function(){ if (!window.__memSS) window.__memSS = mk(); return window.__memSS; } }); } catch(e){}
})();
/* ===== FIX: back-button counter wedge =====
   আগে প্রতিটা layer বন্ধের সময় _backIgnore++ করে তারপর history.back() করা হতো।
   কিন্তু popstate আগুন না ধরলে (অবৈধ/দুই-স্তর ফাঁকা state) counter +1 থেকে যেত —
   তারপর থেকে NEXT বারের back-এর popstate পর্যন্ত খেয়ে যেত, ফলে বাটনে চেপে
   "পেজ/ট্যাব ব্যয়াক" হয়ে যেত। এখন প্রতিটা back-এর পরে 350ms-এ একটি safety
   timer তাই counter কে নিজে থেকেই সোজা করে দেয়। */
function popSafeBack(){
  _backIgnore++;
  setTimeout(() => { if (_backIgnore > 0) _backIgnore--; }, 350);
  try { history.back(); } catch(e){ if (_backIgnore > 0) _backIgnore--; }
}
/* ===== FIX: mobile BACK button closes popups first (lightbox -> popup -> panel -> page) ===== */
let _backIgnore = 0;
(function(){
  const mr = document.getElementById('modalRoot');
  if (!mr) return;
  const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  let pushed = false;
  Object.defineProperty(mr, 'innerHTML', {
    configurable: true,
    get(){ return desc.get.call(this); },
    set(html){
      const cur = desc.get.call(this);
      const has = !!(html && String(html).trim());
      const had = !!(cur && cur.trim());
      desc.set.call(this, html);
      if (has && !had) { pushed = true; try { history.pushState({ __ov: 'modal' }, ''); } catch (e) {} }
      else if (!has && had) { pushed = false; popSafeBack(); }
    }
  });
  window._mrRaw = function(html){ desc.set.call(mr, html); };
  window._mrOpen = function(){ return !!desc.get.call(mr).trim(); };
})();
/* ===== FIX: lightbox — tap any product photo to enlarge ===== */
let _lbZoom = 1;
function lbOpen(src){
  _lbZoom = 1;
  const rootEl = document.getElementById('lightboxRoot');
  if (!rootEl) return;
  rootEl.innerHTML = '<div class="lb-overlay" id="lbOverlay">'
    + '<div class="lb-top"><button type="button" class="lb-btn" id="lbMinus" aria-label="zoom out">\u2212</button><button type="button" class="lb-btn" id="lbPlus" aria-label="zoom in">+</button><button type="button" class="lb-btn" id="lbX" aria-label="close">\u2715</button></div>'
    + '<div class="lb-stage" id="lbStage"><img id="lbImg" src="' + escapeHtml(src) + '" alt="product photo"></div>'
    + '<div class="lb-hint" id="lbHint"></div></div>';
  rootEl.classList.add('on');
  document.body.classList.add('lb-lock');
  const apply = function(){
    const st = document.getElementById('lbStage'), im = document.getElementById('lbImg'), ht = document.getElementById('lbHint');
    if (!st || !im) return;
    if (_lbZoom <= 1) { st.classList.remove('zoomed'); im.style.width = ''; }
    else { st.classList.add('zoomed'); im.style.width = (_lbZoom * 94) + 'vw'; }
    if (ht) ht.textContent = _lbZoom > 1 ? 'scroll = pan \u00b7 tap photo = fit' : 'tap photo = zoom \u00b7 \u2715 = close';
  };
  apply();
  document.getElementById('lbPlus').onclick = function(e){ e.stopPropagation(); _lbZoom = Math.min(4, +(_lbZoom + 0.5).toFixed(2)); apply(); };
  document.getElementById('lbMinus').onclick = function(e){ e.stopPropagation(); _lbZoom = Math.max(1, +(_lbZoom - 0.5).toFixed(2)); apply(); };
  document.getElementById('lbX').onclick = function(e){ e.stopPropagation(); lbClose(true); };
  document.getElementById('lbImg').onclick = function(e){ e.stopPropagation(); _lbZoom = _lbZoom > 1 ? 1 : 2.2; apply(); };
  document.getElementById('lbOverlay').onclick = function(e){ if (e.target === e.currentTarget) lbClose(true); };
  try { history.pushState({ __ov: 'lightbox' }, ''); } catch (e) {}
}
function lbClose(consume){
  const rootEl = document.getElementById('lightboxRoot');
  if (!rootEl || !rootEl.classList.contains('on')) return;
  rootEl.classList.remove('on');
  rootEl.innerHTML = '';
  document.body.classList.remove('lb-lock');
  if (consume) { popSafeBack(); }
}
/* FIX: মোবাইলে ছবির উপর দিয়ে আঙুল ভাসিয়ে (scroll) দিলে যেন সত্যিকারের ট্যাপ না হলেও
   lightbox খুলে ছবিটা "বদলে যাওয়া"/নড়বড় লাগে না। শুধুমাত্র ক্লিন ট্যাপ হলে খুলবে —
   আঙুল ১৪px-এর বেশি সরে গেলে (স্বাইপ/স্ক্রল) উপেক্ষা করা হয়। */
(function(){
  let tsx = null, tsy = null;
  document.addEventListener('touchstart', function(e){
    const t = e.touches && e.touches[0];
    if (t){ tsx = t.clientX; tsy = t.clientY; }
  }, true);
  document.addEventListener('click', function(e){
    const t = e.target;
    const im = t && t.closest ? t.closest('img[data-zoom]') : null;
    const _sx = tsx, _sy = tsy;
    tsx = null; tsy = null;
    if (!im) return;
    const dx = (e.clientX != null ? e.clientX : 0) - (_sx != null ? _sx : (e.clientX != null ? e.clientX : 0));
    const dy = (e.clientY != null ? e.clientY : 0) - (_sy != null ? _sy : (e.clientY != null ? e.clientY : 0));
    if (Math.sqrt(dx * dx + dy * dy) > 14) { e.preventDefault(); e.stopPropagation(); return; }
    e.preventDefault(); e.stopPropagation(); lbOpen(im.currentSrc || im.src);
  }, true);
})();
window.addEventListener('popstate', function(e){
  if (_backIgnore > 0) { _backIgnore--; return; }
  const lb = document.getElementById('lightboxRoot');
  if (lb && lb.classList.contains('on')) { lbClose(false); return; }
  if (window._mrOpen && window._mrOpen()) { window._mrRaw(''); if (window.__spReopen) { window.__spReopen = false; try { __spReShow(); } catch(e){} } return; }
  const cp = document.getElementById('cornerPanel');
  if (cp && !cp.classList.contains('hidden')) { cp.classList.add('hidden'); window._cornerPushed = false; return; }
  if (window.__backExtra && window.__backExtra()) return;
  if (window.__backPageNav) window.__backPageNav(e);
});
/* ===== FIX: প্রতিটা খোলা প্যানেলে ‹ "ফিরে যান" বাটন =====
   মোবাইলের ব্যাক বাটন না চললেও এই বাটনে চাপ দিলে ঠিক আগের জায়গায় ফিরে আসবে।
   অগ্রাধিকার (উপরেরটা আগে): ছবি-জুম → সার্চ পেজ → পপআপ (পণ্য/কার্ট/অ্যাকাউন্ট) → মেসেজ প্যানেল */
function __backLabel(){ try { return t('goBack'); } catch(e){ return 'Back'; } }
function __topLayer(){
  const uc = document.getElementById('uConfirmRoot');
  if (uc && uc.classList.contains('on')) return 'confirm';
  const cm = document.getElementById('chatMenuRoot');
  if (cm && cm.classList.contains('on')) return 'chatmenu';
  const lb = document.getElementById('lightboxRoot');
  if (lb && lb.classList.contains('on')) return 'lightbox';
  const sp = document.getElementById('searchPage');
  if (sp && !sp.classList.contains('hidden')) return 'search';
  if (window._mrOpen && window._mrOpen()) return 'modal';
  const cp = document.getElementById('cornerPanel');
  if (cp && !cp.classList.contains('hidden')) return 'corner';
  return null;
}
/* ===== FIX: নিজের কনফার্ম ডায়ালগ (ব্রাউজারের confirm() এর বদলে) =====
   দেখতে অ্যাপের মতো, লেখা বাংলা/ইংরেজি, মোবাইলের ব্যাক বাটনেও বাতিল হয়। */
function uConfirm(msg, opt){
  const root = document.getElementById('uConfirmRoot');
  if (!root) return Promise.resolve(false);
  return new Promise(function(resolve){
    const o = opt || {};
    const yes = o.okText || t('ucYes');
    const no = o.cancelText || t('ucNo');
    root.innerHTML = '<div class="uc-ov"><div class="uc-card" role="dialog" aria-modal="true">'
      + '<div class="uc-title">' + escapeHtml(o.title || t('ucTitle')) + '</div>'
      + '<div class="uc-msg">' + escapeHtml(msg) + '</div>'
      + '<div class="uc-acts"><button type="button" class="uc-no">' + escapeHtml(no) + '</button>'
      + '<button type="button" class="uc-yes' + (o.danger ? ' uc-danger' : '') + '">' + escapeHtml(yes) + '</button></div></div></div>';
    root.classList.add('on');
    const done = function(v){
      root.classList.remove('on'); root.innerHTML = ''; window.__ucClose = null;
      document.removeEventListener('keydown', onKey, true);
      resolve(!!v);
    };
    window.__ucClose = done;
    const ov = root.querySelector('.uc-ov');
    ov.addEventListener('click', function(e){ if (e.target === ov) done(false); });
    root.querySelector('.uc-no').addEventListener('click', function(){ done(false); });
    root.querySelector('.uc-yes').addEventListener('click', function(){ done(true); });
    const onKey = function(e){ if (e.key === 'Escape' || e.key === 'Esc') done(false); };
    document.addEventListener('keydown', onKey, true);
    setTimeout(function(){ try { root.querySelector('.uc-yes').focus(); } catch(e){} }, 40);
  });
}
window.uConfirm = uConfirm;
function __spReShow(){
  const page = document.getElementById('searchPage');
  if (!page || !page.classList.contains('hidden')) return;
  page.classList.remove('hidden');
  page.setAttribute('aria-hidden', 'false');
  try { document.body.classList.add('lb-lock'); } catch(e){}
  try { spRenderSearchBody(); spRenderTrend(); } catch(e){}
}
function goBackLayer(){
  const L = __topLayer();
  try {
    if (L === 'confirm')  { if (window.__ucClose) window.__ucClose(false); return true; }
    if (L === 'chatmenu') { if (window.__chatPromptOpen) chatPromptDone(null); else chatMenuClose(); return true; }
    if (L === 'lightbox') { lbClose(true); return true; }
    if (L === 'search')   { spClose();     return true; }
    if (L === 'modal')    { closeModal();  return true; }
    if (L === 'corner')   { cornerClose(); return true; }
  } catch (e) {}
  return false;
}
window.goBackLayer = goBackLayer;
window.__topLayer = __topLayer;
(function(){
  /* ROUND-24 (ব্যবহারকারীর রিপোর্ট): "যেখানে ব্যাক-বাটনের বিকল্প আছে সেখানে
     যেন ব্যাক-বাটন না থাকে — তার নিচের সাদা ব্যাকগ্রাউন্ডের জন্য অনেক লেখা
     দেখা যায় না"। তাই ছবি-জুমের উপরে আলাদা ‹ বাটন আর বসে না — ওখানে ডান
     দিকে ✕ আগেই আছে, ব্যাকগ্রাউন্ডও ছবির উপরই থাকে (নিচে ✕ চাপলে বন্ধ হবে,
     মোবাইলের ব্যাক-বাটন/জেসচারও আগের মতোই কাজ করে)। */
  document.addEventListener('click', function(e){
    const b = (e.target && e.target.closest) ? e.target.closest('[data-back]') : null;
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    goBackLayer();
  }, true);
  document.addEventListener('keydown', function(e){
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    try { if (goBackLayer()) e.preventDefault(); } catch(err){}
  });
  window.__injectBackBars = function(){};
})();
/* পপআপ যেভাবেই বন্ধ হোক — সার্চ থেকে খোলা হলে সার্চ পেজে ফিরে যায় */
(function(){
  const orig = closeModal;
  closeModal = function(){
    const reopen = !!window.__spReopen;
    window.__spReopen = false;
    const r = orig.apply(this, arguments);
    if (reopen) { try { __spReShow(); } catch(e){} }
    return r;
  };
})();

/* ===== Live sync (Supabase) — configured =====
   SECURITY: run this ONCE in Supabase → SQL Editor so the public anon key
   above (visible to every visitor, by design) cannot be used to wipe or
   corrupt your data, and so Row Level Security is actually turned on:

   create table if not exists kv_store (
     key text primary key,
     value text,
     updated_at timestamptz default now()
   );
   alter table kv_store enable row level security;
   -- The storefront and admin panel both need to read/write these keys
   -- with the public anon key (there is no login for the storefront),
   -- so this policy allows it — but note this also means anyone who has
   -- the anon key (any site visitor) can read/write kv_store directly via
   -- the Supabase API, bypassing this website entirely. Do not put
   -- anything more sensitive than what's already shown in the storefront
   -- (product info, order/message records, customer name+phone) into
   -- this table. For stronger protection, split truly sensitive data out
   -- into a separate table with no public policy, accessed only through
   -- a server-side function.
   create policy "app read/write" on kv_store for all using (true) with check (true);

   -- ---------------------------------------------------------------------
   -- RECOMMENDED (safe coupon counter + smaller blast radius):
   -- The anon key above is public, so the "for all using(true)" policy means
   -- anyone could rewrite or delete every row in this table. Two things fix
   -- most of the risk without changing the app:
   --
   -- 1) This function increments a coupon's used-count in ONE statement, so
   --    the storefront never has to send the whole settings row back:
   --
   create or replace function dib_bump_coupon(p_code text)
   returns void language sql security definer as $$
     update kv_store
        set value = jsonb_set(value::jsonb, '{coupons}', (
              select jsonb_agg(
                case when c->>'code' = p_code
                     then jsonb_set(c, '{used}',
                            to_jsonb(coalesce((c->>'used')::int, 0) + 1))
                     else c end)
              from jsonb_array_elements(value::jsonb->'coupons') c))
      where key = 'settings';
   $$;
   grant execute on function dib_bump_coupon(text) to anon;

   -- 2) When you are ready, split the sensitive rows (settings / customers)
   --    into their own table with an owner-only policy and reach them only
   --    through security-definer functions like the one above. Until then,
   --    keep in mind that customer name+phone+address in this table are
   --    readable by anyone holding the public anon key.
   -- ---------------------------------------------------------------------
*/
const SUPABASE_URL = (window.ENV && window.ENV.SUPABASE_URL) || 'https://tinmlqxlphcxtfmslmtz.supabase.co';
const SUPABASE_ANON_KEY = (window.ENV && window.ENV.SUPABASE_ANON_KEY) || 'sb_publishable_Jkqx2SFqNvbyrsh2pUy8Ew_G7SD5t1W';
// Demo key fallback for local testing

let _sb = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) {
  try { _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); } catch(e){ _sb = null; }
} else if (!SUPABASE_ANON_KEY) {
  console.warn('[CONFIG] SUPABASE_ANON_KEY missing - set in js/config/env.js or Netlify Environment Variables');
}

if (!window.storage) {
  window.storage = {
    async get(k){
      if (_sb) {
        try {
          const _q = _sb.from('kv_store').select('value').eq('key', k).maybeSingle();
          const { data, error } = await Promise.race([_q, new Promise((_, _rej) => setTimeout(() => _rej(new Error('timeout')), 8000))]);
          if (!error && data) return { key:k, value:data.value };
        } catch(e){}
      }
      try{const v=localStorage.getItem(k);return v===null?null:{key:k,value:v};}catch(e){return null;}
    },
    async set(k,v){
      // Cloud-write for keys the demo RLS allows (fix-logo-rls.sql); settings so
      // orderSeq/coupon counters reach the admin panel. Everything else local-only.
      if (_sb && (k === 'orders' || k === 'messages' || k === 'customers' || k === 'products' || k === 'settings')) {
        try {
          const _w = _sb.from('kv_store').upsert({ key: k, value: v, updated_at: new Date().toISOString() });
          const { error } = await Promise.race([_w, new Promise((_, _rej) => setTimeout(() => _rej(new Error('timeout')), 8000))]);
          if (!error) {
            try{localStorage.setItem(k,v);}catch(e){}
            return { key:k, value:v };
          } else {
            console.warn('[storage.set] Supabase write blocked for', k, '- using localStorage only. Run admin-project/supabase/schema.sql and ensure RLS allows or use dib_place_order RPC. Error:', error.message);
          }
        } catch(e){
          console.warn('[storage.set] Supabase write failed for', k, e.message);
        }
      }
      try{localStorage.setItem(k,v);return{key:k,value:v};}catch(e){throw new Error('Storage full');}
    },
    async delete(k){
      try{localStorage.removeItem(k);return true;}catch(e){return false;}
    },
    async getMany(keys){
      const out = {};
      let supOk = false;
      if (_sb) {
        try {
          const _q = _sb.from('kv_store').select('key,value').in('key', keys);
          const { data, error } = await Promise.race([_q, new Promise((_, _rej) => setTimeout(() => _rej(new Error('timeout')), 8000))]);
          if (!error && data) {
            data.forEach(row => { if (row && row.value != null) out[row.key] = { key: row.key, value: row.value }; });
            supOk = true;
          }
        } catch(e){}
      }
      // Cloud first when present; fill gaps from localStorage so a failed/empty
      // cloud read never wipes brand logo, settings or catalogue the cache had.
      keys.forEach(k => {
        if (out[k] && out[k].value != null && out[k].value !== '') return;
        try {
          const v = localStorage.getItem(k);
          if (v !== null && v !== '') out[k] = { key:k, value:v };
        } catch(e){}
      });
      // settings is not in kv_public_read — merge local brand fields if cloud lacks them
      try {
        if (out[KEYS.storeSettings] && out[KEYS.storeSettings].value) {
          const cloudSS = JSON.parse(out[KEYS.storeSettings].value) || {};
          const localSSraw = localStorage.getItem(KEYS.storeSettings);
          if (localSSraw) {
            const localSS = JSON.parse(localSSraw) || {};
            let changed = false;
            if (!cloudSS.shopLogo && localSS.shopLogo) { cloudSS.shopLogo = localSS.shopLogo; changed = true; }
            if (!cloudSS.shopNamePrefix && localSS.shopNamePrefix) { cloudSS.shopNamePrefix = localSS.shopNamePrefix; changed = true; }
            if (!cloudSS.shopNameSuffix && localSS.shopNameSuffix) { cloudSS.shopNameSuffix = localSS.shopNameSuffix; changed = true; }
            if (changed) out[KEYS.storeSettings] = { key: KEYS.storeSettings, value: JSON.stringify(cloudSS) };
          }
        }
      } catch(e){}
      return out;
    },
    async headMany(keys){
      const out = {};
      if (_sb) {
        try {
          const _q = _sb.from('kv_store').select('key,updated_at').in('key', keys);
          const { data, error } = await Promise.race([_q, new Promise((_, _rej) => setTimeout(() => _rej(new Error('timeout')), 8000))]);
          if (!error && data) { data.forEach(row => { out[row.key] = row.updated_at || ''; }); return out; }
        } catch(e){}
      }
      keys.forEach(k => { try { const v = localStorage.getItem(k); out[k] = v === null ? '' : (v.length + ':' + v.slice(0, 24)); } catch(e){ out[k] = ''; } });
      return out;
    },
    async bumpCoupon(code){
      if (!_sb) return false;
      try {
        const { error } = await Promise.race([
          _sb.rpc('dib_bump_coupon', { p_code: code }),
          new Promise((_, _rej) => setTimeout(() => _rej(new Error('timeout')), 8000))
        ]);
        return !error;
      } catch(e){ return false; }
    }
  };
}

/* Product records arrive from the cloud (and from cache) in whatever shape
   the last writer left them — one place normalises them so every caller can
   trust images/variants/stockQty to exist. */
function normalizeProduct(prod){
  if (!prod) return prod;
  if (!Array.isArray(prod.images)) prod.images = [];
  if (typeof prod.stockQty !== 'number') prod.stockQty = prod.inStock === false ? 0 : 10;
  if (!Array.isArray(prod.variants)) prod.variants = [];
  if (!Array.isArray(prod.tags)) prod.tags = [];
  if (typeof prod.salePrice !== 'number') prod.salePrice = 0;
  if (!prod.category) prod.category = '';
  if (typeof prod.featured !== 'boolean') prod.featured = false;
  if (!prod.productCode) prod.productCode = 'P-' + String(prod.createdAt || prod.id || Date.now()).replace(/[^0-9A-Za-z]/g, '').slice(-8).toUpperCase();
  prod.inStock = prod.stockQty > 0;
  return prod;
}
function normalizeProducts(list){ if (Array.isArray(list)) list.forEach(normalizeProduct); return list; }

function applyTheme(){
  const meta = document.getElementById('themeColorMeta');
  if (meta) meta.setAttribute('content', '#0F4C4A');
}

const DEFAULT_STORE_SETTINGS = {
  hero: {
    title: 'আপনার পছন্দের সব পণ্য, এক জায়গায়',
    subtitle: 'নিচের তালিকা থেকে পণ্য বেছে নিন এবং সরাসরি অর্ডার করুন।',
    show: true
  },
  sectionTitles: { deals: 'সেরা ডিল', categories: 'সব পণ্য' },
  buttons: { addToCart: 'কার্ট', buyNow: 'এখনই কিনুন', viewOptions: 'বেছে নিন' },
  features: {
    showSearch: true, showCategories: true, showSort: true,
    showTrackOrder: true, showMyMessages: true, showSendMessage: true,
    showNoticeBar: true, showBanners: true, showProductCount: true,
    showFooter: true, showSocialLinks: true
  },
  productCard: {
    showCategory: true, showDiscountBadge: true, showFeaturedBadge: true,
    showLowStock: true, showImgCount: true, showSalePrice: true,
    showAddToCart: true, showBuyNow: true,
    /* STOCK VISIBILITY: customers can now see how many pieces are actually
       left, on the product card and in the gallery. Existing shops that have
       already saved their settings simply get this switched ON (the flag is
       merged in), and the owner can turn it off from Admin -> Customer Site. */
    showStockQty: true
  },
  footer: { tagline: 'আপনার বিশ্বস্ত অনলাইন শপ।', copyrightText: 'সর্বস্বত্ব সংরক্ষিত' },
  deliveryEstimate: { minDays: 3, maxDays: 5 },
  shopLogo: '',
  shopNamePrefix: 'Dear IT ',
  shopNameSuffix: 'BD'
};

let storeSettings = JSON.parse(JSON.stringify(DEFAULT_STORE_SETTINGS));

const KEYS = { products:'products', orders:'orders', messages:'messages', settings:'settings', lang:'lang', cart:'cart', coupon:'coupon', storeSettings:'store_settings', customers:'customers' };
const DEFAULT_SETTINGS = {
  shopNamePrefix:'Dear IT ', shopNameSuffix:'BD',
  shopLogo:'',
  whatsappNumber:'8801700000000', email:'', phone:'',
  deliveryCharge:60, freeDeliveryOver:0, freeDeliveryOn:false, lowStockThreshold:5,
  coupons:[], banners:[],
  paymentMethods:[{ id:'cod', name:'Cash on Delivery', number:'', active:true }],
  socialLinks:{facebook:'',instagram:'',youtube:'',tiktok:'',whatsapp:''},
  seo:{metaTitle:'',metaDescription:'',keywords:''},
  notice:{active:false,text:'',color:'mustard'}
};

let products = [], orders = [], messages = [], cart = [], settings = { ...DEFAULT_SETTINGS };
let appliedCoupon = null;
let currentLang = 'en', currentCategory = 'all', currentSort = 'newest';

const TRANSLATIONS = {
  bn: {
    heroTitle:'আপনার পছন্দের সব পণ্য, এক জায়গায়', heroSub:'নিচের তালিকা থেকে পণ্য বেছে নিন এবং সরাসরি অর্ডার করুন।',
    dealsTitle:'সেরা ডিল', specialOffer:'বিশেষ অফার', searchPlaceholder:'পণ্য খুঁজুন...', allCategories:'সব পণ্য',
    sortNewest:'নতুন আগে', sortPriceAsc:'দাম: কম → বেশি', sortPriceDesc:'দাম: বেশি → কম', sortFeatured:'ফিচারড আগে',
    addToCart:'কার্ট', buyNow:'এখনই কিনুন', outOfStock:'স্টক নেই', lowStockText:'{n} বাকি',
    trackTitle:'আমার অর্ডার ট্র্যাক', trackSub:'ট্র্যাক করতে আপনার সিরিয়াল নং দিন।', trackNoPh:'সিরিয়াল নং (SN-XXXX-XXXX)', trackNeedSerial:'ট্র্যাক করতে আপনার সিরিয়াল নং দিন।', trackNoMatch:'এই সিরিয়াল নং-এ কোনো অর্ডার পাওয়া যায়নি।', statusUpdated:'সর্বশেষ আপডেট', parcelNote:'পার্সেল লোকেশন', trackBtn:'দেখাও',
    noOrdersForPhone:'এই নাম্বারে কোনো অর্ডার পাওয়া যায়নি।',
    cancelOrder:'অর্ডার বাতিল', shareProduct:'শেয়ার করুন', shareCopied:'লিংক কপি হয়েছে — যেকোনো জায়গায় পেস্ট করুন',
    stockLabel:'স্টক',
    searchHistoryLabel:'সার্চ হিস্টরি', searchDiscoveryLabel:'আপনার জন্য',
    clearAllLabel:'সব মুছুন', deleteOneLabel:'মুছে ফেলুন', hideLabel:'লুকান', showLabel:'দেখান',
    suggestionLabel:'সাজেশন', suggestionProducts:'পণ্য', didYouMean:'আপনি কি খুঁজছেন',
    noSuggestion:'কিছু পাওয়া যায়নি — বানান ঠিক আছে কিনা দেখুন।',
    historyCleared:'সার্চ হিস্টরি মুছে ফেলা হয়েছে',
    trendLabel:'জনপ্রিয় সার্চ', searchBtnLabel:'সার্চ', searchTitleLabel:'পণ্য খুঁজুন', stockQtyText:'স্টক: {n}টি', stockInStock:'স্টকে আছে: {n}টি', stockLowLeft:'অল্প স্টক — মাত্র {n}টি বাকি', cancelConfirm:'অর্ডারটি বাতিল করবেন?', orderCancelled:'অর্ডার বাতিল হয়েছে।', cancelFailed:'বাতিল করা যায়নি — আবার চেষ্টা করুন।',
    tabOrders:'অর্ডার', tabMsgs:'মেসেজ', tabSend:'পাঠান',
    myAccount:'আমার অ্যাকাউন্ট', accSub:'মোবাইল নাম্বার দিলেই লগইন হয়ে যাবে। কোনো OTP লাগবে না।',
    accName:'আপনার নাম', accNamePh:'নাম লিখুন (ঐচ্ছিক)', accLoginBtn:'লগইন / রেজিস্টার',
    accLogout:'লগআউট', accMyOrders:'আমার অর্ডার', accNoOrders:'এখনো কোনো অর্ডার নেই।',
    accInvalidPhone:'সঠিক মোবাইল নাম্বার দিন।', accNeedReg:'কার্টে নিতে আগে রেজিস্টার করুন।', orderProcessing:'অর্ডার প্রসেস হচ্ছে...', msgWait:'একটু পরে আবার চেষ্টা করুন।', accSaved:'অ্যাকাউন্ট তৈরি হয়েছে!', accLoggedOut:'লগআউট হয়েছে।',
    myMessagesTitle:'আমার মেসেজ', myMessagesSub:'আপনার মেসেজ ও আমাদের রিপ্লাই।', showBtn:'দেখাও',
    chatSub:'যেকোনো প্রশ্ন লিখুন — উত্তর এখানেই আসবে',
    orderNoLabel:'অর্ডার নং', serialNoLabel:'সিরিয়াল নং', serialSoon:'কনফার্মের পর সিরিয়াল পাবেন', blockedTitle:'অ্যাকাউন্ট ব্লক করা হয়েছে', blockedMsg:'আপনার অ্যাকাউন্ট ব্লক করা হয়েছে — অর্ডার বা মেসেজ পাঠানো যাবে না। দোকানের সাথে যোগাযোগ করুন।', newReplyFrom:'দোকান থেকে নতুন উত্তর', viewChat:'চ্যাট দেখুন', chatAlertOn:'🔔 অ্যালার্ট চালু', chatAlertHint:'দোকান উত্তর দিলে সাথে সাথে খবর পেতে ব্রাউজার অ্যালার্ট চালু করুন', chatEmpty:'এখনো কোনো মেসেজ নেই — নিচে লিখে পাঠান।', chatNeedLogin:'চ্যাট করতে আগে নাম আর মোবাইল নম্বর দিয়ে লগইন / রেজিস্টার করুন।', chatLoginBtn:'লগইন / রেজিস্টার', chatPh:'আপনার প্রশ্ন লিখুন…', chatSent:'পাঠানো হয়েছে', chatDelivered:'পৌঁছেছে', chatUnsentMe:'আপনি এই মেসেজটি আনসেন্ড করেছেন', chatEdited:'সম্পাদিত', chatEdit:'সম্পাদনা করুন', chatUnsend:'আনসেন্ড করুন', chatCancel:'বাতিল', chatEditTitle:'মেসেজ সম্পাদনা', chatEditSave:'সেভ করুন', chatUnsendQ:'এই মেসেজটি আনসেন্ড করবেন? দুই দিক থেকেই সরে যাবে।', chatUnsentOk:'মেসেজ আনসেন্ড করা হয়েছে', chatEditedOk:'মেসেজ সম্পাদনা হয়েছে', chatSendFail:'মেসেজ পাঠানো যায়নি — ইন্টারনেট দেখুন', chatClosed:'চ্যাট এখন বন্ধ আছে',
    noMessagesForPhone:'এই নাম্বারে কোনো মেসেজ পাওয়া যায়নি।',
    msgTitle:'আমাদের মেসেজ পাঠান', msgSub:'কোনো প্রশ্ন থাকলে লিখুন।',
    yourName:'আপনার নাম', phone:'মোবাইল নম্বর', message:'মেসেজ',
    sendMsg:'মেসেজ পাঠান', fillAll:'সব ঘর পূরণ করুন', msgSent:'আপনার মেসেজ পাঠানো হয়েছে।',
    noProductsStore:'এখনো কোনো পণ্য নেই।', noSearchResults:'কোনো পণ্য পাওয়া যায়নি',
    cartTitle:'আপনার কার্ট', emptyCart:'কার্ট বর্তমানে খালি।',
    clearCart:'কার্ট খালি', close:'বন্ধ', goBack:'ফিরে যান', ucYes:'হ্যাঁ', ucNo:'বাতিল', ucTitle:'নিশ্চিত করুন', msgSeen:'দেখা হয়েছে', msgNotSeen:'এখনো দেখা হয়নি', cancel:'বাতিল', optional:'ঐচ্ছিক',
    deliveryAddress:'ডেলিভারির ঠিকানা', addressPlaceholder:'বাসা/রোড/এলাকা/জেলা',
    confirmOrder:'অর্ডার নিশ্চিত করুন — ৳{t}', sendViaWhatsapp:'WhatsApp-এ পাঠান',
    couponPlaceholder:'কুপন কোড', applyCoupon:'প্রয়োগ',
    subtotal:'সাব-টোটাল', deliveryCharge:'ডেলিভারি ফি', discount:'ছাড়', grandTotal:'সর্বমোট',
    couponApplied:'"{code}" প্রয়োগ', couponInvalid:'কুপন সঠিক নয়', couponRemoved:'কুপন সরানো হয়েছে',
    orderNotesLabel:'অর্ডার নোট (ঐচ্ছিক)', orderNotesPlaceholder:'বিশেষ নির্দেশনা',
    orderPlaced:'অর্ডার পাওয়া গেছে। ধন্যবাদ!', stockLow:'স্টকে মাত্র {s}টি আছে!', itemRemoved:'আইটেম সরানো হয়েছে',
    addedToCart:'কার্টে যোগ হয়েছে', cartCleared:'কার্ট খালি করা হয়েছে',
    statusPending:'অপেক্ষমাণ', statusConfirmed:'নিশ্চিত', statusShipped:'পাঠানো', statusDelivered:'ডেলিভারড', statusCancelled:'বাতিল',
    needImage:'কোনো ছবি নেই।', enterCouponCode:'কুপন কোড লিখুন',
    selectVariant:'{name} বেছে নিন', paymentMethod:'পেমেন্ট মেথড',
    footerTagline:'আপনার বিশ্বস্ত অনলাইন শপ।',
    contactUs:'যোগাযোগ', quickLinks:'দ্রুত লিংক', homeLink:'হোম', cartLink:'কার্ট', trackLink:'অর্ডার ট্র্যাক',
    allRightsReserved:'সর্বস্বত্ব সংরক্ষিত', freeDelivery:'ফ্রি ডেলিভারি',
    selectOptions:'বেছে নিন', qtyLabel:'পরিমাণ', adminReplyLabel:'অ্যাডমিন রিপ্লাই',
    yourMessageLabel:'আপনার মেসেজ', productCountText:'{n}টি পণ্য', stockTotalText:'মোট স্টক {n}টি',
    contactEmpty:'যোগাযোগ নেই', phonePh:'০১৭XXXXXXXX', yourNamePh:'আপনার নাম', msgPh:'আপনার প্রশ্ন লিখুন', prodDetails:'পণ্যের বিবরণ',
    featSecure:'সুরক্ষিত পেমেন্ট', featSecureSub:'১০০% নিরাপদ লেনদেন',
    featDelivery:'দ্রুত ডেলিভারি', featDeliverySub:'সারাদেশে হোম ডেলিভারি',
    featCod:'ক্যাশ অন ডেলিভারি', featCodSub:'পণ্য হাতে পেয়ে পেমেন্ট',
    featWarranty:'ওয়ারেন্টি ও সার্ভিস', featWarrantySub:'বিক্রয়োত্তর সমর্থন',
    featSupport:'২৪/৭ সাপোর্ট', featSupportSub:'যেকোনো সময় ইমেইল/হোয়াটসঅ্যাপ'
  },
  en: {
    heroTitle:'All your favourite products, in one place', heroSub:'Pick a product and order directly.',
    dealsTitle:'Top Deals', specialOffer:'Special Offer', searchPlaceholder:'Search products...', allCategories:'All',
    sortNewest:'Newest First', sortPriceAsc:'Price: Low → High', sortPriceDesc:'Price: High → Low', sortFeatured:'Featured First',
    addToCart:'Cart', buyNow:'Buy Now', outOfStock:'Sold out', lowStockText:'{n} left',
    trackTitle:'Track My Order', trackSub:'Track by entering your Serial No.', trackNoPh:'Serial No (SN-XXXX-XXXX)', trackNeedSerial:'Enter your Serial No to track.', trackNoMatch:'No order found for this Serial No.', statusUpdated:'Last updated', parcelNote:'Parcel location', trackBtn:'Show',
    noOrdersForPhone:'No orders found for this number.',
    cancelOrder:'Cancel Order', shareProduct:'Share', shareCopied:'Link copied — paste it anywhere',
    stockLabel:'Stock',
    searchHistoryLabel:'Search History', searchDiscoveryLabel:'Search Discovery',
    clearAllLabel:'Clear All', deleteOneLabel:'Delete', hideLabel:'Hide', showLabel:'Show',
    suggestionLabel:'Suggestions', suggestionProducts:'Products', didYouMean:'Did you mean',
    noSuggestion:'Nothing found — check the spelling.',
    historyCleared:'Search history cleared',
    trendLabel:'Popular searches', searchBtnLabel:'Search', searchTitleLabel:'Find products', stockQtyText:'Stock: {n}', stockInStock:'In stock: {n}', stockLowLeft:'Low stock — only {n} left', cancelConfirm:'Cancel this order?', orderCancelled:'Order cancelled.', cancelFailed:'Could not cancel — try again.',
    tabOrders:'Orders', tabMsgs:'Messages', tabSend:'Send',
    myAccount:'My Account', accSub:'Just enter your mobile number to log in. No OTP needed.',
    accName:'Your Name', accNamePh:'Name (optional)', accLoginBtn:'Login / Register',
    accLogout:'Logout', accMyOrders:'My Orders', accNoOrders:'No orders yet.',
    accInvalidPhone:'Enter a valid mobile number.', accNeedReg:'Please register first to add to cart.', orderProcessing:'Order is processing...', msgWait:'Please wait before trying again.', accSaved:'Account created!', accLoggedOut:'Logged out.',
    myMessagesTitle:'My Messages', myMessagesSub:'Your messages and our replies.', showBtn:'Show',
    chatSub:'Write your question — the reply comes right here',
    orderNoLabel:'Order No', serialNoLabel:'Serial No', serialSoon:'Serial after confirmation', blockedTitle:'Account blocked', blockedMsg:'Your account has been blocked — you cannot place orders or send messages. Please contact the shop.', newReplyFrom:'New reply from the shop', viewChat:'Open chat', chatAlertOn:'🔔 Turn on alerts', chatAlertHint:'Turn on browser alerts to be told the moment the shop replies', chatEmpty:'No messages yet — write one below.', chatNeedLogin:'To chat, log in / register with your name and mobile number first.', chatLoginBtn:'Log in / Register', chatPh:'Write your question…', chatSent:'Sent', chatDelivered:'Delivered', chatUnsentMe:'You unsent this message', chatEdited:'edited', chatEdit:'Edit', chatUnsend:'Unsend', chatCancel:'Cancel', chatEditTitle:'Edit message', chatEditSave:'Save', chatUnsendQ:'Unsend this message? It will be removed for both sides.', chatUnsentOk:'Message unsent', chatEditedOk:'Message edited', chatSendFail:'Could not send the message — check your internet', chatClosed:'Chat is turned off right now',
    noMessagesForPhone:'No messages found for this number.',
    msgTitle:'Send Us a Message', msgSub:'Have a question? Just ask.',
    yourName:'Your Name', phone:'Mobile Number', message:'Message',
    sendMsg:'Send Message', fillAll:'Please fill all fields', msgSent:'Your message has been sent.',
    noProductsStore:'No products yet.', noSearchResults:'No products found',
    cartTitle:'Your Cart', emptyCart:'Your cart is empty.',
    clearCart:'Clear Cart', close:'Close', goBack:'Back', ucYes:'Yes', ucNo:'Cancel', ucTitle:'Please confirm', msgSeen:'Seen', msgNotSeen:'Not seen yet', cancel:'Cancel', optional:'Optional',
    deliveryAddress:'Delivery Address', addressPlaceholder:'House / Road / Area / District',
    confirmOrder:'Confirm Order — ৳{t}', sendViaWhatsapp:'Send via WhatsApp',
    couponPlaceholder:'Coupon code', applyCoupon:'Apply',
    subtotal:'Subtotal', deliveryCharge:'Delivery Fee', discount:'Discount', grandTotal:'Grand Total',
    couponApplied:'"{code}" applied', couponInvalid:'Invalid coupon', couponRemoved:'Coupon removed',
    orderNotesLabel:'Order Notes (optional)', orderNotesPlaceholder:'Special instructions',
    orderPlaced:'Order received. Thank you!', stockLow:'Only {s} in stock!', itemRemoved:'Item removed',
    addedToCart:'added to cart', cartCleared:'Cart cleared',
    statusPending:'Pending', statusConfirmed:'Confirmed', statusShipped:'Shipped', statusDelivered:'Delivered', statusCancelled:'Cancelled',
    needImage:'No images.', enterCouponCode:'Enter coupon code',
    selectVariant:'Select {name}', paymentMethod:'Payment Method',
    footerTagline:'Your trusted online shop.',
    contactUs:'Contact', quickLinks:'Quick Links', homeLink:'Home', cartLink:'Cart', trackLink:'Track Order',
    allRightsReserved:'All rights reserved', freeDelivery:'Free delivery',
    selectOptions:'Choose Options', qtyLabel:'Quantity', adminReplyLabel:'Admin Reply',
    yourMessageLabel:'Your Message', productCountText:'{n} products', stockTotalText:'{n} in stock',
    contactEmpty:'No contact info', phonePh:'017XXXXXXXX', yourNamePh:'Your name', msgPh:'Write your question', prodDetails:'Description',
    featSecure:'Secure Payment', featSecureSub:'100% safe transactions',
    featDelivery:'Fast Delivery', featDeliverySub:'Home delivery nationwide',
    featCod:'Cash on Delivery', featCodSub:'Pay when you receive the item',
    featWarranty:'Warranty & Service', featWarrantySub:'After-sales support',
    featSupport:'24/7 Support', featSupportSub:'Email / WhatsApp anytime'
  }
};

const ICONS = {
  cart: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.13.12-.27.12-.42 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>`,
  cartBig: `<svg class="ic ic-big" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.13.12-.27.12-.42 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>`,
  wa: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.5 2 2 6.1 2 11.3c0 1.9.6 3.7 1.7 5.2L2.5 22l5.7-1.5c1.4.8 3 1.2 4.6 1.2 5.5 0 10-4.1 10-9.4S17.5 2 12 2zm0 17.2c-1.4 0-2.8-.4-4-1.1l-.3-.2-3.4.9.9-3.3-.2-.3c-.8-1.2-1.2-2.6-1.2-4C3.8 7 7.3 3.7 12 3.7s8.2 3.3 8.2 7.6-3.7 7.9-8.2 7.9z"/><g transform="translate(8.1,8.3) scale(0.33)"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></g></svg>`,
  fb: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5h1.7V4.9c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4V11H7.5v3h2.9v7h3.1z"/></svg>`,
  ig: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16.8" cy="7.2" r="1.4"/></svg>`,
  yt: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5-11-6.5z"/></svg>`,
  note: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`,
  phone: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>`,
  mail: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>`,
  chevL: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>`,
  chevR: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>`
};
Object.assign(ICONS, {
  searchSm: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`,
  trashSm: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`,
  eyeOff: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>`,
  spark: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/></svg>`,
  arrowR: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>`,
  okSmall: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`,
  share: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg>`,
  fire: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"/></svg>`,
  box: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 2H4c-1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V4c0-1.1-1-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z"/></svg>`,
  chat: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`,
  pen: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`,
  sliders: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg>`,
  bolt: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66l.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C15.96 12.77 14 16.57 11 21z"/></svg>`,
  card: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>`,
  camera: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.2c1.77 0 3.2-1.43 3.2-3.2s-1.43-3.2-3.2-3.2-3.2 1.43-3.2 3.2 1.43 3.2 3.2 3.2zM9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>`,
  clock: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>`,
  mega: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>`,
  warn: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`,
  boxBig: `<svg class="ic ic-big" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 2H4c-1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V4c0-1.1-1-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z"/></svg>`,
  product: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12.5V7.5c0-.28-.06-.55-.17-.8L20.72 5c.17-.17.28-.4.28-.64V3c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v1.36c0 .24.11.47.28.64L5.17 6.7c-.11.25-.17.52-.17.8v5c-1.75.66-3 2.5-3 4.5V20c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-3c0-2-1.25-3.84-3-4.5zM6 6h12v1H6V6zm13.5 12.5H4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5h15c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/></svg>`
});
function t(k, v){
  /* Never leak Bangla fallback text into English mode. */
  const table = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  let s = table[k] ?? (currentLang === 'en' ? k : (TRANSLATIONS.bn[k] ?? k));
  if (v) Object.keys(v).forEach(x => { s = s.replace(new RegExp('\\{' + x + '\\}','g'), v[x]); });
  return s;
}
function applyStaticTranslations(){
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder)); });
  const si = document.getElementById('searchInput');
  if (si) si.setAttribute('placeholder', t('searchPlaceholder'));
  const ob = document.getElementById('offBadge');
  if (ob) ob.textContent = t('specialOffer');
  document.body.classList.toggle('lang-en', currentLang === 'en');
  const bnBtn = document.getElementById('langBn');
  const enBtn = document.getElementById('langEn');
  if (bnBtn) { bnBtn.textContent = currentLang === 'bn' ? 'বাংলা' : 'BN'; bnBtn.title = 'Switch to Bangla'; }
  if (enBtn) { enBtn.textContent = 'EN'; enBtn.title = currentLang === 'en' ? 'English' : 'Switch to English'; }
  if (bnBtn) bnBtn.classList.toggle('active', currentLang === 'bn');
  if (enBtn) enBtn.classList.toggle('active', currentLang === 'en');
}
function setLang(l){
  currentLang = l;
  try { document.documentElement.lang = l; } catch(e){}
  try { window.storage.set(KEYS.lang, l); } catch(e){}
  renderAll();
}
document.getElementById('langBn').addEventListener('click', () => setLang('bn'));
document.getElementById('langEn').addEventListener('click', () => setLang('en'));

function bnToEn(s){ return String(s||'').replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d)); }
function escapeHtml(str){ const d = document.createElement('div'); d.textContent = str == null ? '' : String(str); return d.innerHTML; }
function safeUrl(value, allowedProtocols){
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw, window.location.href);
    const protocols = allowedProtocols || ['http:', 'https:'];
    return protocols.includes(url.protocol) ? url.href : '';
  } catch(e){ return ''; }
}
function safeImageUrl(value){
  const raw = String(value || '').trim();
  if (/^data:image\/(gif|jpeg|jpg|png|webp);base64,/i.test(raw)) return raw;
  return safeUrl(raw);
}
function icFallback(extraClass){
  return `<span class="ic-fallback${extraClass ? ' ' + extraClass : ''}">${ICONS.product}</span>`;
}
document.addEventListener('error', (e) => {
  const t = e.target;
  if (!t || t.tagName !== 'IMG') return;
  const slide = t.closest('.banner-slide');
  const wrap = slide || (t.parentElement && (t.parentElement.classList.contains('sp-thumb') || t.parentElement.classList.contains('cart-item-thumb')));
  if (!wrap) return;
  const fb = document.createElement('span');
  fb.className = 'ic-fallback' + (slide ? ' banner' : '');
  fb.innerHTML = ICONS.product;
  t.replaceWith(fb);
}, true);

function uid(p){ return p + '_' + Date.now() + '_' + Math.floor(Math.random()*1000); }
function firstGrapheme(str){
  if(!str) return '?';
  const s = String(str).trim(); if(!s) return '?';
  try{
    if (typeof Intl !== 'undefined' && Intl.Segmenter){
      const seg = new Intl.Segmenter(undefined, {granularity:'grapheme'});
      const it = seg.segment(s)[Symbol.iterator]().next();
      if (it && it.value && it.value.segment) return it.value.segment;
    }
  }catch(e){}
  const m = s.match(/^\p{Extended_Pictographic}/u); if (m) return m[0];
  const cp = Array.from(s); let g = cp[0] || '?';
  for (let i=1;i<cp.length;i++){ if (/\p{M}/u.test(cp[i])) g += cp[i]; else break; }
  return g;
}
function firstLetter(str){ return firstGrapheme(str); }
function formatTime(ts){ try { return new Date(ts).toLocaleString(currentLang === 'bn' ? 'bn-BD' : 'en-US', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'short' }); } catch(e){ return new Date(ts).toLocaleString(); } }
function formatDate(ts){ try { return new Date(ts).toLocaleDateString(currentLang === 'bn' ? 'bn-BD' : 'en-US', { day:'2-digit', month:'short', year:'numeric' }); } catch(e){ return new Date(ts).toLocaleDateString(); } }
function formatBn(n){ return currentLang === 'bn' ? String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]) : String(n); }

let toastTimer = null;
function showToast(text, type){
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
  /* FIX: আগের toast এখনও শো-তে থাকলে আবার একই ক্লাস বসালে CSS-এর entry
     অ্যানিমেশন আর শুরু হয় না। তাই আগে base ক্লাস (hide), তারপর forced reflow,
     তারপর .show — মানে প্রতিবার নতুন করে ফুটে ওঠে, কখনো আটকে/লেট লাগে না। */
  /* FIX: মোডাল (bottom-sheet) খোলা অবস্থায় toast একদম screen-এর top:16px-এ দেখাত —
     confirm স্ক্রিন যেখানে bottom-এ, সেখান থেকে অনেক দূরে; তাই customer-এর চোখে
     পড়ত না, "দেরিতে আসে" মনে হতো। মোডাল খোলা থাকলে toast এখন sheet-এর নিচের
     প্রান্তের ঠিক উপরে (confirm বাটনের কাছাকাছি) দেখায়। */
  el.textContent = text;
  const overModal = !!(document.querySelector('.modal-overlay'));
  el.className = 'toast' + (type ? ' ' + type : '') + (overModal ? ' over-modal' : '');
  void el.offsetWidth;
  el.className = 'toast show' + (type ? ' ' + type : '') + (overModal ? ' over-modal' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { if (el.isConnected) el.classList.remove('show'); }, 2800);
}
/* FIX: `toast → তারপর ভারী রি-রেন্ডার` হলে toast-টা paint হওয়ার সুযোগ পেত না
   (সবকিছু একসাথে synchronous চলে, পুরো গ্রিড/ছবি আবার বানানো পর্যন্ত main
   thread ব্যস্ত). তাই toast দেখানোর পরে ভারী কাজটা double requestAnimationFrame
   দিয়ে এক frame পরে চালাই — toast এখনই তার tab-এ ফুটে ওঠে। */
function afterPaint(fn){
  try { requestAnimationFrame(() => requestAnimationFrame(() => { try { fn(); } catch(e){} })); }
  catch(e){ try { fn(); } catch(e){} }
}
/* FIX: অর্ডার কনফার্ম করার পর কোনো অবস্থাতেই মোডাল বন্ধ/খোলা (history pop/push +
   re-render + slideUp animation) করা হয় না — তাতেই কনফার্ম স্ক্রিন কেঁপে কেঁপে উপর-নিচ
   "চলে" যেত। এখন কনফার্ম স্ক্রিনটা ঠিক সেভাবেই সামনে থাকে, সফলতা-টোস্ট (z-index 10050)
   তারও উপরে দেখায়, আর পেছনের গ্রিডটা শুধু নীরবে আপডেট হয়। */
function orderSuccessUI(){
  window._reopenGalAfterOrder = null;
  afterPaint(() => { try { renderStoreGrid(); } catch(e){} });
}

window.copyProdCode = function(el){
  let code = (el && el.getAttribute && el.getAttribute('data-code')) || '';
  if (!code || code === '—') return;
  const done = () => showToast('Copied: ' + code, 'success');
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(code).then(done, () => { _fallbackCopy(code, done); }); return; }
  } catch(e){}
  _fallbackCopy(code, done);
};
function _fallbackCopy(txt, done){
  const ta = document.createElement('textarea');
  ta.value = txt; ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch(e){ showToast(txt, 'info'); }
  document.body.removeChild(ta);
}

async function saveCart(){ try { localStorage.setItem(KEYS.cart, JSON.stringify(cart)); } catch(e){ try { cart.forEach(it => { it.image = null; }); localStorage.setItem(KEYS.cart, JSON.stringify(cart)); } catch(e2){} } renderCartBadge(); return true; }
async function saveOrders(){ try { await window.storage.set(KEYS.orders, JSON.stringify(orders)); return true; } catch(e){ return false; } }
async function saveMessages(){ try { await window.storage.set(KEYS.messages, JSON.stringify(messages)); return true; } catch(e){ return false; } }
async function saveProducts(){ try { await window.storage.set(KEYS.products, JSON.stringify(products)); return true; } catch(e){ return false; } }
async function saveCoupon(){ try { await window.storage.set(KEYS.coupon, JSON.stringify(appliedCoupon)); return true; } catch(e){ return false; } }

function loadCacheFirst(){
  const g = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch(e){ return null; } };
  try {
    applyTheme();
    const pc = g(KEYS.products); if (Array.isArray(pc)) products = pc;
    normalizeProducts(products);
    const oc = g(KEYS.orders); if (Array.isArray(oc)) orders = oc;
    const mc = g(KEYS.messages); if (Array.isArray(mc)) { messages = mc; messages.forEach(msg => { if (!Array.isArray(msg.replies)) msg.replies = []; }); }
    const cc = g(KEYS.cart); if (Array.isArray(cc)) cart = cc;
    const sc = g(KEYS.settings);
    settings = { ...DEFAULT_SETTINGS, ...(sc || {}) };
    if (!Array.isArray(settings.coupons)) settings.coupons = [];
    if (!Array.isArray(settings.banners)) settings.banners = [];
    if (!Array.isArray(settings.paymentMethods)) settings.paymentMethods = DEFAULT_SETTINGS.paymentMethods;
    if (!settings.socialLinks) settings.socialLinks = { facebook:'', instagram:'', youtube:'', tiktok:'', whatsapp:'' };
    if (!settings.seo) settings.seo = { metaTitle:'', metaDescription:'', keywords:'' };
    if (!settings.notice) settings.notice = { active:false, text:'', color:'mustard' };
    const ssc = g(KEYS.storeSettings);
    if (ssc) storeSettings = { ...DEFAULT_STORE_SETTINGS, ...ssc, hero:{...DEFAULT_STORE_SETTINGS.hero,...(ssc.hero||{})}, sectionTitles:{...DEFAULT_STORE_SETTINGS.sectionTitles,...(ssc.sectionTitles||{})}, buttons:{...DEFAULT_STORE_SETTINGS.buttons,...(ssc.buttons||{})}, features:{...DEFAULT_STORE_SETTINGS.features,...(ssc.features||{})}, productCard:{...DEFAULT_STORE_SETTINGS.productCard,...(ssc.productCard||{})}, footer:{...DEFAULT_STORE_SETTINGS.footer,...(ssc.footer||{})} };
    const cpc = g(KEYS.coupon); if (cpc) appliedCoupon = cpc;
    try { const savedLang = localStorage.getItem(KEYS.lang); if (savedLang === 'bn' || savedLang === 'en') currentLang = savedLang; } catch(e){}
    try { document.documentElement.lang = currentLang; } catch(e){}
  } catch(e){}
  try { renderAll(); } catch(e){}
  try { window.__lastSig = dataSig(); } catch(e){}
  try {
    if (sessionStorage.getItem('dibHeroAnimated')) document.documentElement.classList.add('no-hero-anim');
    else sessionStorage.setItem('dibHeroAnimated', '1');
  } catch(e){}
}
async function loadAll(){
  try {
    applyTheme();
    /* PERFORMANCE FIX: the product grid only needs products/settings/
       storeSettings/lang to paint — orders, messages, cart and the coupon
       aren't needed until the person opens those specific screens. */
    const _batch1 = await window.storage.getMany([KEYS.products, KEYS.settings, KEYS.storeSettings, KEYS.lang]);
    const p = _batch1[KEYS.products], s = _batch1[KEYS.settings], ss = _batch1[KEYS.storeSettings], l = _batch1[KEYS.lang];

    /* settings is not in kv_public_read — fetch the public slice via RPC so
       brand name, logo, phone and coupons still reach the customer site. */
    let _pubSettings = null;
    if (_sb) {
      try {
        const { data: _pd, error: _pe } = await Promise.race([
          _sb.rpc('dib_public_settings'),
          new Promise((_, _rej) => setTimeout(() => _rej(new Error('timeout')), 8000))
        ]);
        if (!_pe && _pd && typeof _pd === 'object') _pubSettings = _pd;
      } catch(e){}
    }

    if (p && p.value) {
      try {
        const list = JSON.parse(p.value);
        if (Array.isArray(list) && (list.length || !products.length)) products = list;
      } catch(e){}
    }
    normalizeProducts(products);

    try { const _lcsv = localStorage.getItem(KEYS.cart); const _lc = _lcsv ? JSON.parse(_lcsv) : null; cart = Array.isArray(_lc) ? _lc : []; } catch(e){ cart = []; }

    let _settingsObj = _pubSettings;
    if (!_settingsObj && s && s.value) {
      try { _settingsObj = JSON.parse(s.value); } catch(e){ _settingsObj = null; }
    }
    if (!_settingsObj) {
      try { const _lsv = localStorage.getItem(KEYS.settings); if (_lsv) _settingsObj = JSON.parse(_lsv); } catch(e){}
    }
    if (_settingsObj) {
      settings = { ...DEFAULT_SETTINGS, ..._settingsObj };
      try { localStorage.setItem(KEYS.settings, JSON.stringify(settings)); } catch(e){}
    } else {
      settings = { ...DEFAULT_SETTINGS, ...settings };
    }
    if (!Array.isArray(settings.coupons)) settings.coupons = [];
    if (!Array.isArray(settings.banners)) settings.banners = [];
    if (!Array.isArray(settings.paymentMethods)) settings.paymentMethods = DEFAULT_SETTINGS.paymentMethods;
    if (!settings.socialLinks) settings.socialLinks = { facebook:'', instagram:'', youtube:'', tiktok:'', whatsapp:'' };
    if (!settings.seo) settings.seo = { metaTitle:'', metaDescription:'', keywords:'' };
    if (!settings.notice) settings.notice = { active:false, text:'', color:'mustard' };

    if (ss && ss.value) {
      try {
        const parsed = JSON.parse(ss.value) || {};
        // Never lose a local logo/brand the cloud row is missing (RLS/write lag)
        try {
          const _lss = localStorage.getItem(KEYS.storeSettings);
          if (_lss) {
            const localSS = JSON.parse(_lss) || {};
            if (!parsed.shopLogo && localSS.shopLogo) parsed.shopLogo = localSS.shopLogo;
            if (!parsed.shopNamePrefix && localSS.shopNamePrefix) parsed.shopNamePrefix = localSS.shopNamePrefix;
            if (!parsed.shopNameSuffix && localSS.shopNameSuffix) parsed.shopNameSuffix = localSS.shopNameSuffix;
          }
        } catch(e){}
        storeSettings = {
          ...DEFAULT_STORE_SETTINGS,
          ...parsed,
          hero: { ...DEFAULT_STORE_SETTINGS.hero, ...(parsed.hero || {}) },
          sectionTitles: { ...DEFAULT_STORE_SETTINGS.sectionTitles, ...(parsed.sectionTitles || {}) },
          buttons: { ...DEFAULT_STORE_SETTINGS.buttons, ...(parsed.buttons || {}) },
          features: { ...DEFAULT_STORE_SETTINGS.features, ...(parsed.features || {}) },
          productCard: { ...DEFAULT_STORE_SETTINGS.productCard, ...(parsed.productCard || {}) },
          footer: { ...DEFAULT_STORE_SETTINGS.footer, ...(parsed.footer || {}) }
        };
        try { localStorage.setItem(KEYS.storeSettings, JSON.stringify(storeSettings)); } catch(e){}
      } catch(e){}
    } else {
      try { const _lss = localStorage.getItem(KEYS.storeSettings); if (_lss) { const localSS = JSON.parse(_lss) || {}; storeSettings = { ...DEFAULT_STORE_SETTINGS, ...localSS, hero: { ...DEFAULT_STORE_SETTINGS.hero, ...(localSS.hero||{}) }, sectionTitles:{...DEFAULT_STORE_SETTINGS.sectionTitles,...(localSS.sectionTitles||{})}, buttons:{...DEFAULT_STORE_SETTINGS.buttons,...(localSS.buttons||{})}, features:{...DEFAULT_STORE_SETTINGS.features,...(localSS.features||{})}, productCard:{...DEFAULT_STORE_SETTINGS.productCard,...(localSS.productCard||{})}, footer:{...DEFAULT_STORE_SETTINGS.footer,...(localSS.footer||{})} }; } } catch(e){}
    }

    // Brand fields: settings (RPC) primary, store_settings as fallback — never blank
    if ((!settings.shopNamePrefix || !String(settings.shopNamePrefix).trim()) && storeSettings.shopNamePrefix) settings.shopNamePrefix = storeSettings.shopNamePrefix;
    if ((!settings.shopNameSuffix || !String(settings.shopNameSuffix).trim()) && storeSettings.shopNameSuffix) settings.shopNameSuffix = storeSettings.shopNameSuffix;
    if (!settings.shopLogo && storeSettings.shopLogo) settings.shopLogo = storeSettings.shopLogo;
    if (!storeSettings.shopLogo && settings.shopLogo) storeSettings.shopLogo = settings.shopLogo;

    if (l && l.value) currentLang = l.value;

    window.__cloudDone = true;
    try { const _sa = dataSig(); if (_sa !== window.__lastSig) { window.__lastSig = _sa; renderAll(); } else { renderCartBadge(); } } catch(e){ try{renderAll();}catch(e2){} }

    try {
      const _batch2 = await window.storage.getMany([KEYS.orders, KEYS.messages, KEYS.coupon]);
      const o = _batch2[KEYS.orders], m = _batch2[KEYS.messages], cp = _batch2[KEYS.coupon];
      if (o && o.value) {
        try {
          const cloudList = JSON.parse(o.value);
          if (Array.isArray(cloudList)) {
            const cloudIds = new Set(cloudList.filter(x => x && x.id).map(x => x.id));
            const localOnly = (orders || []).filter(x => x && x.id && !cloudIds.has(x.id));
            if (localOnly.length) orders = cloudList.concat(localOnly);
            else if (cloudList.length || !orders.length) orders = cloudList;
          }
        } catch(e){}
      }
      if (m && m.value) {
        try {
          const cloudList = JSON.parse(m.value);
          if (Array.isArray(cloudList)) {
            const cloudIds = new Set(cloudList.filter(x => x && x.id).map(x => x.id));
            const localOnly = (messages || []).filter(x => x && x.id && !cloudIds.has(x.id));
            if (localOnly.length) messages = cloudList.concat(localOnly);
            else if (cloudList.length || !messages.length) messages = cloudList;
          }
        } catch(e){}
      }
      messages.forEach(msg => { if (!Array.isArray(msg.replies)) msg.replies = []; });
      if (cp && cp.value) { try { appliedCoupon = JSON.parse(cp.value); } catch(e){ appliedCoupon = null; } }
      // Persist cloud→cache so the next reload keeps brand/catalogue even if the network fails
      try { if (products.length) localStorage.setItem(KEYS.products, JSON.stringify(products)); } catch(e){}
      try { if (orders.length) localStorage.setItem(KEYS.orders, JSON.stringify(orders)); } catch(e){}
      try { if (messages.length) localStorage.setItem(KEYS.messages, JSON.stringify(messages)); } catch(e){}
    } catch(e){}
    try { if (typeof renderChat === 'function') renderChat(true); } catch(e){}
    try {
      const _last = Number(localStorage.getItem('presenceAt') || 0);
      if (Date.now() - _last > 10 * 60 * 1000) { localStorage.setItem('presenceAt', String(Date.now())); if (typeof syncMyPresence === 'function') syncMyPresence(); }
    } catch(e){}
  } catch(e){ console.error(e); }
}

function getActiveButtons(){
  if (currentLang === 'en') return { addToCart: t('addToCart'), buyNow: t('buyNow'), viewOptions: t('selectOptions') };
  return { addToCart: storeSettings.buttons.addToCartBn || storeSettings.buttons.addToCart, buyNow: storeSettings.buttons.buyNowBn || storeSettings.buttons.buyNow, viewOptions: storeSettings.buttons.viewOptionsBn || storeSettings.buttons.viewOptions };
}
function getActiveHero(){
  if (currentLang === 'en') return { title: storeSettings.hero.titleEn || t('heroTitle'), subtitle: storeSettings.hero.subtitleEn || t('heroSub'), show: storeSettings.hero.show, background: storeSettings.hero.background || '', animation: storeSettings.hero.animation || 'none', decorationText: storeSettings.hero.decorationText || '' , customCss: storeSettings.hero.customCss || '' };
  return { ...storeSettings.hero, title: storeSettings.hero.title || t('heroTitle'), subtitle: storeSettings.hero.subtitle || t('heroSub') };
}
function getActiveSectionTitles(){
  if (currentLang === 'en') return { deals: t('dealsTitle') };
  return { ...storeSettings.sectionTitles, deals: storeSettings.sectionTitles.dealsBn || storeSettings.sectionTitles.deals };
}

function applyStoreSettings(){
  const ss = storeSettings;
  const hero = getActiveHero();
  const st = getActiveSectionTitles();

  const heroSec = document.getElementById('heroSection');
  const heroTitle = document.getElementById('heroTitleEl');
  const heroSub = document.getElementById('heroSubtitleEl');
  if (heroSec) heroSec.style.display = hero.show ? '' : 'none';
  if (heroTitle) heroTitle.textContent = hero.title;
  if (heroSub) heroSub.textContent = hero.subtitle;
  /* Customer hero background is controlled by Admin → Store Customize. */
  if (heroSec) {
    const bg = String(hero.background || '').trim();
    heroSec.style.background = bg ? (bg.startsWith('#') || bg.startsWith('linear-gradient') || bg.startsWith('radial-gradient') ? bg : `url(\"${bg.replace(/\"/g, '')}\") center/cover no-repeat`) : '';
    heroSec.classList.toggle('hero-animated', hero.animation === 'float' || hero.animation === 'pulse' || hero.animation === 'shimmer');
    heroSec.dataset.animation = hero.animation || 'none';
    heroSec.style.setProperty('--hero-decoration', JSON.stringify(hero.decorationText || 'TECH  •  COMPUTERS  •  ACCESSORIES'));
    let customStyle = document.getElementById('heroCustomStyle');
    if (!customStyle) { customStyle = document.createElement('style'); customStyle.id = 'heroCustomStyle'; document.head.appendChild(customStyle); }
    customStyle.textContent = String(hero.customCss || '').slice(0, 12000);
  }

  const dealsTitle = document.getElementById('dealsTitleEl');
  if (dealsTitle) dealsTitle.textContent = String(st.deals || '').replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\uFE0F\s]+/u, '');

  const f = ss.features;
  const searchWrap = document.getElementById('searchWrap');
  const catChips = document.getElementById('catChips');
  const sortSel = document.getElementById('sortSelect');
  const trackBox = document.getElementById('trackBox');
  const myMessagesBox = document.getElementById('myMessagesBox');
  const sendMsgBox = document.getElementById('sendMsgBox');
  const noticeBar = document.getElementById('noticeBar');
  const bannerSec = document.getElementById('bannerSection');
  const productCount = document.getElementById('productCount');
  const footerEl = document.getElementById('footerEl');
  const footerSocials = document.getElementById('footerSocials');

  if (searchWrap) searchWrap.style.display = f.showSearch ? '' : 'none';
  if (catChips) catChips.style.display = f.showCategories ? 'flex' : 'none';
  if (sortSel) sortSel.style.display = f.showSort ? '' : 'none';
  if (trackBox) trackBox.style.display = f.showTrackOrder ? '' : 'none';
  if (myMessagesBox) myMessagesBox.style.display = f.showMyMessages ? '' : 'none';
  if (sendMsgBox) sendMsgBox.style.display = f.showSendMessage ? '' : 'none';
  if (noticeBar) noticeBar.style.display = f.showNoticeBar ? '' : 'none';
  if (bannerSec) bannerSec.style.display = f.showBanners ? '' : 'none';
  if (productCount) productCount.style.display = f.showProductCount ? '' : 'none';
  if (footerEl) footerEl.style.display = f.showFooter ? '' : 'none';
  if (footerSocials) footerSocials.style.display = f.showSocialLinks ? '' : 'none';

  const footerTagline = document.getElementById('footerTagline');
  const copyrightText = document.getElementById('copyrightText');
  if (footerTagline) footerTagline.textContent = currentLang === 'en' ? t('footerTagline') : (ss.footer.tagline || t('footerTagline'));
  if (copyrightText) copyrightText.textContent = currentLang === 'en' ? t('allRightsReserved') : (ss.footer.copyrightText || t('allRightsReserved'));
}

function renderAll(){
  applyStaticTranslations();
  renderBrand();
  renderNotice();
  renderBanners();
  renderCategoryChips();
  renderStoreGrid();
  renderCartBadge();
  renderFooter();
  renderSeo();
  document.getElementById('year').textContent = new Date().getFullYear();
  applyStoreSettings();
}
function renderBrand(){
  const preRaw = settings.shopNamePrefix || storeSettings.shopNamePrefix || 'Dear IT ';
  const suf = settings.shopNameSuffix || storeSettings.shopNameSuffix || 'BD';
  const pre = String(preRaw).trimEnd();
  const brand = (pre + ' ' + suf) || 'Dear IT BD';
  const brandEl = document.getElementById('brandMiniText');
  // Dear IT (prefix) + space + BD (accent) — invoice style, !important beats luxury.css
  const brandHtml = escapeHtml(pre) + '<span style="color:#c8820e!important;margin-left:4px;">' + escapeHtml(suf) + '</span>';
  if (brandEl) brandEl.innerHTML = brandHtml;
  else {
    const brandMini = document.getElementById('brandMini');
    const brandImg0 = document.getElementById('brandLogoImg');
    if (brandMini && brandImg0 && !document.getElementById('brandMiniText')) {
      const span = document.createElement('span');
      span.id = 'brandMiniText';
      span.innerHTML = brandHtml;
      span.style.marginLeft = '6px';
      span.style.fontWeight = '800';
      span.style.whiteSpace = 'nowrap';
      span.style.color = '#145b28';
      brandImg0.insertAdjacentElement('afterend', span);
    } else if (brandEl) {
      brandEl.innerHTML = brandHtml;
    }
  }
  const logo = (storeSettings && storeSettings.shopLogo) || (settings && settings.shopLogo) || '';
  const brandImg = document.getElementById('brandLogoImg');
  if (brandImg && logo) {
    brandImg.src = logo;
  }
  const _logo = logo;
  const _logoHtml = _logo ? '<img src="' + escapeHtml(_logo) + '" alt="" style="width:46px;height:46px;border-radius:11px;object-fit:contain;background:#fff;padding:3px;vertical-align:middle;flex-shrink:0;border:1px solid var(--border);">' : '';
  const _preF = String(preRaw).trimEnd();
  const _sufF = suf;
  const _fb = document.getElementById('footerBrand');
  if (_fb) {
    _fb.innerHTML = '<span style="display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;">' + _logoHtml + '<span style="color:#145b28!important;">' + escapeHtml(_preF) + '<span style="color:#c8820e!important;margin-left:4px;">' + escapeHtml(_sufF) + '</span></span></span>';
  }
  const _fsn = document.getElementById('footerShopName');
  if (_fsn) _fsn.textContent = brand;
  const _pt = document.getElementById('pageTitle');
  if (_pt) _pt.textContent = (settings.seo.metaTitle || brand).trim() + (currentLang === 'en' ? ' — Online Store' : ' — অনলাইন স্টোর');
}
function renderSeo(){
  const md = document.getElementById('metaDesc');
  const mk = document.getElementById('metaKeywords');
  const brand = ((settings.shopNamePrefix || 'Dear IT ').trimEnd() + ' ' + (settings.shopNameSuffix || 'BD'));
  const cats = Array.from(new Set(products.map(p => p.category).filter(Boolean))).slice(0, 6);
  const defDesc = brand + ' — ' + (currentLang === 'en' ? 'order online' : 'অনলাইন থেকে অর্ডার করুন')
    + (cats.length ? ' · ' + cats.join(', ') : '')
    + (settings.phone ? ' · ' + (currentLang === 'en' ? 'Phone: ' : 'ফোন: ') + settings.phone : '');
  md.setAttribute('content', settings.seo.metaDescription || defDesc);
  mk.setAttribute('content', settings.seo.keywords || [brand, ...cats].join(', '));
  
  /* Open Graph & Twitter Cards */
  updateMetaProperty('og:title', settings.seo.metaTitle || brand);
  updateMetaProperty('og:description', settings.seo.metaDescription || defDesc);
  updateMetaProperty('og:type', 'website');
  updateMetaProperty('og:url', window.location.origin);
  updateMetaProperty('og:site_name', brand);
  updateMetaProperty('twitter:card', 'summary_large_image');
  updateMetaProperty('twitter:title', settings.seo.metaTitle || brand);
  updateMetaProperty('twitter:description', settings.seo.metaDescription || defDesc);
  
  /* JSON-LD Structured Data for Store */
  injectJsonLd({
    "@context": "https://schema.org",
    "@type": "Store",
    "name": brand,
    "url": window.location.origin,
    "description": settings.seo.metaDescription || defDesc,
    "telephone": settings.phone || '',
    "address": {
      "@type": "PostalAddress",
      "addressCountry": "BD"
    }
  });
}

function updateMetaProperty(property, content) {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function injectJsonLd(data) {
  let script = document.getElementById('jsonld-store');
  if (!script) {
    script = document.createElement('script');
    script.id = 'jsonld-store';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

/* Product-specific JSON-LD (call when product modal opens) */
function injectProductJsonLd(prod) {
  const brand = ((settings.shopNamePrefix || 'Dear IT ').trimEnd() + ' ' + (settings.shopNameSuffix || 'BD'));
  const price = prod.salePrice > 0 ? prod.salePrice : prod.price;
  const image = prod.images && prod.images[0] ? prod.images[0] : '';
  
  let script = document.getElementById('jsonld-product');
  if (!script) {
    script = document.createElement('script');
    script.id = 'jsonld-product';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    "name": prod.name,
    "description": prod.desc || '',
    "image": image,
    "sku": prod.productCode || prod.id,
    "brand": { "@type": "Brand", "name": brand },
    "offers": {
      "@type": "Offer",
      "url": window.location.href,
      "priceCurrency": "BDT",
      "price": price,
      "availability": prod.inStock && prod.stockQty > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "seller": { "@type": "Organization", "name": brand }
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.5",
      "reviewCount": "10"
    }
  });
}
function renderNotice(){
  const nb = document.getElementById('noticeBar');
  if (!storeSettings.features.showNoticeBar) { nb.style.display = 'none'; return; }
  if (settings.notice && settings.notice.active && settings.notice.text) {
    const colors = { mustard:'#E8A33D', teal:'#0F4C4A', red:'#B23A2E', blue:'#0F4C4A' };
    nb.style.background = colors[settings.notice.color] || colors.mustard;
    nb.style.display = 'block';
    nb.innerHTML = ICONS.mega + ' ' + escapeHtml(settings.notice.text);
  } else nb.style.display = 'none';
}
function renderBanners(){
  /* LEAK FIX: this used to start a fresh 5-second interval on every repaint
     (and the page repaints on every sync), so after a while several timers
     were all advancing the carousel and it jumped around. */
  if (window.__bannerTimer) { clearInterval(window.__bannerTimer); window.__bannerTimer = null; }
  const bs = document.getElementById('bannerSection');
  if (!storeSettings.features.showBanners) { bs.innerHTML = ''; return; }
  const activeBanners = (settings.banners || []).filter(b => b.active).sort((a,b) => (a.order||0) - (b.order||0));
  if (activeBanners.length === 0) { bs.innerHTML = ''; return; }
  if (activeBanners.length === 1) {
    const b = activeBanners[0];
    const link = safeUrl(b.link);
    const image = safeImageUrl(b.image);
    bs.innerHTML = `<div class="banner-slide" ${link ? `onclick="window.open('${escapeHtml(link)}','_blank','noopener')" style="cursor:pointer;"` : ''}>
      ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(b.title || 'Banner')}">` : icFallback('banner')}
      ${b.title ? `<div class="banner-title">${escapeHtml(b.title)}</div>` : ''}
    </div>`;
  } else {
    bs.innerHTML = `
      <div class="banner-track" id="bannerTrack">
        ${activeBanners.map(b => { const link = safeUrl(b.link); const image = safeImageUrl(b.image); return `<div class="banner-slide" ${link ? `onclick="window.open('${escapeHtml(link)}','_blank','noopener')" style="cursor:pointer;"` : ''}>
          ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(b.title || 'Banner')}">` : icFallback('banner')}
          ${b.title ? `<div class="banner-title">${escapeHtml(b.title)}</div>` : ''}
        </div>`; }).join('')}
      </div>
      <div class="banner-dots" id="bannerDots">${activeBanners.map((_, i) => `<div class="dot${i === 0 ? ' active' : ''}" data-i="${i}"></div>`).join('')}</div>`;
    const track = document.getElementById('bannerTrack');
    const dots = document.querySelectorAll('#bannerDots .dot');
    let slideIdx = 0;
    const goTo = (i) => { slideIdx = i; track.scrollTo({ left: track.clientWidth * i, behavior: 'smooth' }); dots.forEach((d, j) => d.classList.toggle('active', j === i)); };
    dots.forEach(d => d.addEventListener('click', () => goTo(parseInt(d.dataset.i, 10))));
    track.addEventListener('scroll', () => { const i = Math.round(track.scrollLeft / track.clientWidth); if (i !== slideIdx) { slideIdx = i; dots.forEach((d, j) => d.classList.toggle('active', j === i)); } });
    window.__bannerTimer = setInterval(() => { if (document.visibilityState === 'visible') goTo((slideIdx + 1) % activeBanners.length); }, 5000);
  }
}
function renderFooter(){
  const fc = document.getElementById('footerContact');
  const items = [];
  if (settings.phone) items.push(`${ICONS.phone} <a href="tel:${escapeHtml(settings.phone)}">${escapeHtml(settings.phone)}</a>`);
  if (settings.whatsappNumber) items.push(`${ICONS.wa} <a href="https://wa.me/${escapeHtml(settings.whatsappNumber.replace(/\D/g,''))}" target="_blank">WhatsApp</a>`);
  if (settings.email) items.push(`${ICONS.mail} <a href="mailto:${escapeHtml(settings.email)}">${escapeHtml(settings.email)}</a>`);
  fc.innerHTML = items.length > 0 ? items.map(i => `<li>${i}</li>`).join('') : `<li style="opacity:.6;">${t('contactEmpty')}</li>`;
  const fs = document.getElementById('footerSocials');
  if (!storeSettings.features.showSocialLinks) { fs.innerHTML = ''; return; }
  const sl = settings.socialLinks || {};
  const socials = [];
  const facebook = safeUrl(sl.facebook); if (facebook) socials.push(`<a href="${escapeHtml(facebook)}" target="_blank" rel="noopener noreferrer" title="Facebook">${ICONS.fb}</a>`);
  const instagram = safeUrl(sl.instagram); if (instagram) socials.push(`<a href="${escapeHtml(instagram)}" target="_blank" rel="noopener noreferrer" title="Instagram">${ICONS.ig}</a>`);
  const youtube = safeUrl(sl.youtube); if (youtube) socials.push(`<a href="${escapeHtml(youtube)}" target="_blank" rel="noopener noreferrer" title="YouTube">${ICONS.yt}</a>`);
  const tiktok = safeUrl(sl.tiktok); if (tiktok) socials.push(`<a href="${escapeHtml(tiktok)}" target="_blank" rel="noopener noreferrer" title="TikTok">${ICONS.note}</a>`);
  if (settings.whatsappNumber) socials.push(`<a href="https://wa.me/${escapeHtml(settings.whatsappNumber.replace(/\D/g,''))}" target="_blank" title="WhatsApp">${ICONS.wa}</a>`);
  fs.innerHTML = socials.join('');
}
/* How many pieces are left, shown to the customer.
   - plenty in stock  -> green "স্টক: 20"
   - at/below the low-stock limit -> amber "অল্প স্টক — মাত্র 3টি বাকি"
   - none             -> not shown here (the card already shows "স্টক শেষ")
   Products with no stock number at all are treated as unlimited and simply
   do not get a chip. */
function stockChipHtml(prod){
  if (!prod) return '';
  if (typeof prod.stockQty !== 'number') return '';
  if (prod.stockQty <= 0) return '';
  const lowLimit = Number(settings.lowStockThreshold) || 5;
  const low = prod.stockQty <= lowLimit;
  const label = low ? t('stockLowLeft', { n: formatBn(prod.stockQty) }) : t('stockQtyText', { n: formatBn(prod.stockQty) });
  return `<div class="stock-chip${low ? ' low' : ''}">${low ? ICONS.warn : ICONS.okSmall}<span>${escapeHtml(label)}</span></div>`;
}

/* Free (MIT) Feather-style category icon set, rendered as inline SVG.
   Replaces the old emoji icons so every category gets a clean, proper logo. */
const CAT_ICONS = {
  all: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
  laptop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="2" y1="20" x2="22" y2="20"/></svg>',
  tv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  audio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  watch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  keyboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
  charging: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  storage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="12" x2="2" y2="12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" y1="16" x2="6.01" y2="16"/><line x1="10" y1="16" x2="10.01" y2="16"/></svg>',
  books: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  toys: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
  clothing: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
  food: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>',
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>'
};
function catIconFor(name){
  const n = (name || '').toLowerCase();
  if (['mobile','মোবাইল','phone','ফোন','এয়ার','হেডফোন','earphone','airbuds'].some(w => n.includes(w))) return 'phone';
  if (['laptop','ল্যাপটপ','লেপটপ','computer','কম্পিউটার','notebook','নোটবুক','macbook'].some(w => n.includes(w))) return 'laptop';
  if (['desktop','ডেস্কটপ','pc','পিসি','monitor','মনিটর','tv','টিভি','screen','স্ক্রিন','display','ডিসপ্লে'].some(w => n.includes(w))) return 'tv';
  if (['audio','অডিও','earphone','headphone','হেডফোন','mic','মাইক','microphone','মাইক্রোফোন'].some(w => n.includes(w))) return 'audio';
  if (['speaker','স্পিকার','sound','সাউন্ড','bass','music','মিউজিক'].some(w => n.includes(w))) return 'speaker';
  if (['camera','ক্যামেরা','webcam','ওয়েবক্যাম'].some(w => n.includes(w))) return 'camera';
  if (['watch','ঘড়ি','ঘড়ি','clock','smart','স্মার্ট','smartwatch'].some(w => n.includes(w))) return 'watch';
  if (['keyboard','কিবোর্ড','mouse','মাউস'].some(w => n.includes(w))) return 'keyboard';
  if (['charger','চার্জার','cable','কেবল','adapter','অ্যাডাপ্টার','power','পাওয়ার','powerbank'].some(w => n.includes(w))) return 'charging';
  if (['storage','স্টোরেজ','hdd','ssd','hard','ড্রাইভ','drive','pen','পেন','usb','flash','মেমোরি','memory'].some(w => n.includes(w))) return 'storage';
  if (['book','বই','novel','উপন্যাস'].some(w => n.includes(w))) return 'books';
  if (['toy','খেলনা','game','গেম'].some(w => n.includes(w))) return 'toys';
  if (['clothes','cloth','কাপড়','কাপড়','dress','ড্রেস','fashion','ফ্যাশন','shirt','শার্ট','jersey','জার্সি','ladies','মহিলা','gents'].some(w => n.includes(w))) return 'clothing';
  if (['food','ফুড','খাবার','খাদ্য','grocery','মুদি'].some(w => n.includes(w))) return 'food';
  return 'cart';
}

function renderCategoryChips(){
  const wrap = document.getElementById('catChips');
  if (!storeSettings.features.showCategories) { wrap.innerHTML = ''; wrap.style.display = 'none'; return; }
  const cats = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
  if (cats.length === 0) { wrap.innerHTML = ''; wrap.style.display = 'none'; return; }
  wrap.style.display = 'flex';
  wrap.innerHTML = `<button class="cat-chip${currentCategory === 'all' ? ' active' : ''}" data-cat="all"><span class="cat-icon">${CAT_ICONS.all}</span>${escapeHtml(t('allCategories'))}</button>` +
    cats.map((c) => { const ci = `<span class="cat-icon">${CAT_ICONS[catIconFor(c)]}</span>`; return `<button class="cat-chip${currentCategory === c ? ' active' : ''}" data-cat="${escapeHtml(c)}">${ci}${escapeHtml(c)}</button>`; }).join('');
  wrap.querySelectorAll('.cat-chip').forEach(btn => btn.addEventListener('click', () => {
    currentCategory = btn.dataset.cat; renderCategoryChips(); renderStoreGrid();
  }));
}

function renderStoreGrid(){
  const grid = document.getElementById('productGrid'); grid.innerHTML = '';
  const pc = storeSettings.productCard;
  const btnText = getActiveButtons();
  const searchQ = (document.getElementById('searchInput').value || '').trim().toLowerCase();
  let filtered = products.filter(p => {
    const searchHay = [p.name, p.productCode, p.sku, p.category, p.desc, ...(p.tags || [])].filter(Boolean).join(' ').toLowerCase();
    const ms = !searchQ || searchHay.includes(searchQ);
    const mc = currentCategory === 'all' || p.category === currentCategory;
    return ms && mc;
  });
  filtered = [...filtered];
  if (currentSort === 'priceAsc') filtered.sort((a,b) => (a.salePrice || a.price) - (b.salePrice || b.price));
  else if (currentSort === 'priceDesc') filtered.sort((a,b) => (b.salePrice || b.price) - (a.salePrice || a.price));
  else if (currentSort === 'featured') filtered.sort((a,b) => (b.featured?1:0) - (a.featured?1:0));
  else filtered.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));

  /* ROUND-9: পণ্যের সংখ্যার পাশে মোট স্টকও দেখা যায় (কত টুকরা আছে) —
     আগে শুধু "২টি পণ্য" লেখা থাকত, স্টকের মোট হিসাব দেখা যেত না। */
  const _stockTotal = (filtered || []).reduce((a, p) => a + ((p && p.inStock !== false) ? Math.max(0, Number(p.stockQty) || 0) : 0), 0);
  document.getElementById('productCount').textContent = t('productCountText', { n: formatBn(filtered.length) })
    + (_stockTotal > 0 ? ' · ' + t('stockTotalText', { n: formatBn(_stockTotal) }) : '');

  if (filtered.length === 0) {
    if (!searchQ && currentCategory === 'all' && products.length === 0 && !window.__cloudDone) { grid.innerHTML = Array(6).fill('<div class="skel-card"><div class="skel-img"></div><div class="skel-line" style="width:72%"></div><div class="skel-line" style="width:46%"></div></div>').join(''); return; }
    grid.innerHTML = `<div class="empty-state"><div class="ico">${ICONS.boxBig}</div><i>${searchQ ? t('noSearchResults') : t('noProductsStore')}</i></div>`;
    return;
  }
  const lowLimit = Number(settings.lowStockThreshold) || 5;

  filtered.forEach(prod => {
    const hasImg = prod.images && prod.images.length > 0;
    const hasVariants = prod.variants && prod.variants.length > 0;
    const discountPct = prod.salePrice > 0 ? Math.round((1 - prod.salePrice / prod.price) * 100) : 0;
    const card = document.createElement('div'); card.className = 'product-card'; card.dataset.id = prod.id;

    const thumb = document.createElement('div'); thumb.className = 'product-thumb';
    if (hasImg) {
      const img = document.createElement('img');
      img.src = safeImageUrl(prod.images[0]); img.alt = prod.name; img.loading = 'lazy';
      img.addEventListener('error', () => { img.remove(); thumb.innerHTML = icFallback(); });
      thumb.appendChild(img);
    } else {
      thumb.innerHTML = icFallback();
    }
    if (pc.showDiscountBadge && discountPct > 0) { const d = document.createElement('div'); d.className = 'badge-discount'; d.textContent = `-${formatBn(discountPct)}%`; thumb.appendChild(d); }
    if (pc.showCategory && prod.category) { const c = document.createElement('div'); c.className = 'badge-cat'; c.textContent = prod.category; thumb.appendChild(c); }
    if (pc.showFeaturedBadge && prod.featured) { const f = document.createElement('div'); f.className = 'badge-featured'; f.textContent = currentLang === 'bn' ? '★ ফিচারড' : '★ FEATURED'; thumb.appendChild(f); }
    if (pc.showImgCount && hasImg && prod.images.length > 1) { const ic = document.createElement('div'); ic.className = 'badge-img-count'; ic.innerHTML = `${ICONS.camera} ${formatBn(prod.images.length)}`; thumb.appendChild(ic); }
    if (pc.showLowStock && prod.inStock && prod.stockQty > 0 && prod.stockQty <= lowLimit) { const ls = document.createElement('div'); ls.className = 'badge-low-stock'; ls.textContent = t('lowStockText', { n: formatBn(prod.stockQty) }); thumb.appendChild(ls); }
    if (!prod.inStock || prod.stockQty <= 0) { const so = document.createElement('div'); so.className = 'badge-stock-out'; so.textContent = t('outOfStock'); thumb.appendChild(so); }

    const body = document.createElement('div'); body.className = 'product-body';
    const finalPrice = prod.salePrice > 0 ? prod.salePrice : prod.price;
    const oldPriceHtml = (pc.showSalePrice && prod.salePrice > 0) ? `<div class="price-old">৳${formatBn(prod.price)}</div>` : '';
    const rightPct = (pc.showDiscountBadge && discountPct > 0) ? `<div class="price-right"><div class="pct">${formatBn(discountPct)}%</div><div class="off">OFF</div></div>` : '';

    let actionsHtml = '';
    if (prod.inStock && prod.stockQty > 0) {
      if (hasVariants) {
        actionsHtml = `<button class="btn-mini btn-mini-single" data-id="${prod.id}" data-act="choose">${ICONS.sliders} ${escapeHtml(btnText.viewOptions)}</button>`;
      } else {
        const cartBtn = pc.showAddToCart ? `<button class="btn-mini btn-mini-cart" data-id="${prod.id}" data-act="cart">${ICONS.cart} ${escapeHtml(btnText.addToCart)}</button>` : '';
        const buyBtn = pc.showBuyNow ? `<button class="btn-mini btn-mini-buy" data-id="${prod.id}" data-act="buy">${ICONS.bolt} ${escapeHtml(btnText.buyNow)}</button>` : '';
        if (cartBtn || buyBtn) {
          actionsHtml = `<div class="product-actions" style="${!cartBtn || !buyBtn ? 'grid-template-columns:1fr;' : ''}">${cartBtn}${buyBtn}</div>`;
        }
      }
    }

    const stockHtml = pc.showStockQty ? stockChipHtml(prod) : '';

    body.innerHTML = `
      <h3>${escapeHtml(prod.name)}</h3>
      <div class="product-code" data-code="${escapeHtml(prod.productCode || '')}" title="Click to copy Product ID / Serial No" onclick="event.stopPropagation();window.copyProdCode(this)">Product ID: <b>${escapeHtml(prod.productCode || '—')}</b></div>
      <div class="price-block">
        <div class="price-left">${oldPriceHtml}<div class="price-new"><span class="tk">৳</span>${formatBn(finalPrice)}</div></div>
        ${rightPct}
      </div>
      ${stockHtml}
      ${actionsHtml ? (actionsHtml.startsWith('<div') ? actionsHtml : `<div class="product-actions">${actionsHtml}</div>`) : ''}`;

    card.appendChild(thumb); card.appendChild(body);
    card.addEventListener('click', e => { if (e.target.closest('.btn-mini')) return; openGalleryModal(prod.id); });
    body.querySelectorAll('.btn-mini').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const id = btn.dataset.id, act = btn.dataset.act;
        const p = products.find(x => x.id === id); if (!p) return;
        if (act === 'choose') { openGalleryModal(id); return; }
        if (act === 'cart') { const _ok = await addToCart(p, null, 1); if (_ok === 'capped') showToast(t('stockLow', { s: formatBn(stockCapOf(p)) }), 'error'); return; }
        if (act === 'buy') { const ok = await addToCart(p, null, 1); if (ok === 'capped') showToast(t('stockLow', { s: formatBn(stockCapOf(p)) }), 'error'); if (ok) openCart(); return; }
      });
    });
    grid.appendChild(card);
  });
}
document.getElementById('searchInput').addEventListener('input', renderStoreGrid);
/* SEARCH PAGE FIX: বাক্সে চাপ দিলেই নতুন সার্চ পেজ খোলে (লেখা থাকলে সেটা নিয়েই খোলে),
   ইসকন-এ চাপ দিলে লেখা থাকলে সোজা সার্চ, খালি থাকলে পেজ খোলে। */
try {
  const _si = document.getElementById('searchInput');
  _si.addEventListener('click', () => { try { spOpen(); } catch(e){} });
  _si.addEventListener('focus', () => { try { if (!document.getElementById('searchPage').classList.contains('hidden')) return; spOpen(); } catch(e){} });
  document.getElementById('searchBtn').addEventListener('click', () => {
    const v = (_si.value || '').trim();
    if (v) { try { currentCategory = 'all'; renderCategoryChips(); } catch(e){} renderStoreGrid(); }
    else { try { spOpen(); } catch(e){} }
  });
} catch(e){}
document.getElementById('sortSelect').addEventListener('change', e => { currentSort = e.target.value; renderStoreGrid(); });

function slimImg(src){ if(!src) return null; if(typeof src==='string' && src.length>1800 && src.indexOf('data:')===0) return null; return src; }
function cartLineImage(item){ if(item.image) return item.image; try{ const p=products.find(x=>x&&String(x.id)===String(item.productId)); if(p&&p.images&&p.images[0]) return p.images[0]; }catch(e){} return null; }
function stockCapOf(prod){ if(!prod || typeof prod.stockQty!=='number') return Infinity; return prod.stockQty>=0 ? prod.stockQty : Infinity; }
async function addToCart(prod, variant, qty){
  if (window.__blocked) { showToast(t('blockedMsg'), 'error'); return false; }
  { const _ga = getMyAccount(); if (!_ga || !_ga.norm) { try { window._pendingAdd = { id: prod.id, variant: variant || null, qty: qty || 1 }; } catch(e){} window._afterLogin = 'cart'; openAccount(); return false; } }
  qty = qty || 1;
  const cap = stockCapOf(prod);
  if (cap <= 0) return 'capped';
  const variantKey = variant ? variant.map(v => v.name + ':' + v.value).join('|') : '';
  const existing = cart.find(c => c.productId === prod.id && (c.variantKey || '') === variantKey);
  const price = prod.salePrice > 0 ? prod.salePrice : prod.price;
  if (existing) {
    const want = existing.qty + qty;
    existing.qty = Math.min(want, cap);
    await saveCart();
    return (want > cap) ? 'capped' : true;
  } else {
    const q0 = Math.min(qty, cap);
    cart.push({ productId: prod.id, productCode: prod.productCode || ('P-' + String(prod.createdAt || Date.now()).slice(-8)), name: prod.name, price, originalPrice: prod.price, qty: q0, image: slimImg(prod.images && prod.images[0] ? prod.images[0] : null), variant, variantKey });
    await saveCart();
    return (q0 < qty) ? 'capped' : true;
  }
}

function renderCartBadge(){
  const total = cart.reduce((s, i) => s + i.qty, 0);
  const badge = document.getElementById('cartBadge');
  if (total > 0) { badge.textContent = formatBn(total); badge.classList.remove('hidden'); badge.classList.remove('pop'); void badge.offsetWidth; badge.classList.add('pop'); } else badge.classList.add('hidden');
}

document.getElementById('trackBtn').addEventListener('click', doTrack);
document.getElementById('trackNo').addEventListener('keydown', e => { if (e.key === 'Enter') doTrack(); });
function serialChipHtml(o){
  if (!o || !o.serialNo || o.status === 'cancelled') return '';
  const ok = o.status && o.status !== 'pending';
  return ok
    ? `<span class="serial-chip copy" data-code="${escapeHtml(o.serialNo)}" title="${t('serialNoLabel')} — click to copy" onclick="window.copyProdCode(this)">${escapeHtml(o.serialNo)}</span>`
    : `<span class="serial-chip muted" title="${t('serialNoLabel')}">${t('serialSoon')}</span>`;
}
function statusUpdatedHtml(o){
  if (!o || !o.statusTime) return '';
  return `<div class="track-upd">${t('statusUpdated')}: ${formatDate(o.statusTime)}</div>`;
}
function parcelNoteHtml(o){
  if (!o || !o.parcelNote) return '';
  return `<div class="track-note">📍 ${escapeHtml(o.parcelNote)}</div>`;
}
async function doTrack(){
  const q = String(document.getElementById('trackNo').value || '').trim();
  const result = document.getElementById('trackResult');
  if (!q) { result.innerHTML = `<div class="empty-state" style="padding:16px;"><i>${t('trackNeedSerial')}</i></div>`; return; }
  const qUp = q.toUpperCase();
  let match = null;
  const acc = getMyAccount();
  if (_sb && acc && acc.phone) {
    try {
      const { data, error } = await Promise.race([
        _sb.rpc('dib_track_order', { p_phone: acc.phone, p_serial: q }),
        new Promise((_, _rej) => setTimeout(() => _rej(new Error('timeout')), 8000))
      ]);
      if (!error && data && data.ok && data.order) {
        try { if (data.token) localStorage.setItem('dibCustToken', String(data.token)); } catch(e){}
        match = data.order;
      }
    } catch(e){}
  }
  if (!match) {
    try{const _o=await window.storage.get(KEYS.orders); if(_o&&_o.value){const _ol=JSON.parse(_o.value); if(Array.isArray(_ol))orders=_ol;}}catch(e){}
    match = orders.find(o => o.serialNo && String(o.serialNo).toUpperCase() === qUp);
  }
  if (!match) { result.innerHTML = `<div class="empty-state" style="padding:16px;"><i>${t('trackNoMatch')}</i></div>`; return; }
  const o = match;
  const statusLabels = { pending:'statusPending', confirmed:'statusConfirmed', shipped:'statusShipped', delivered:'statusDelivered', cancelled:'statusCancelled' };
  result.innerHTML = `
    <div class="track-item"><div class="head"><span>${orderNoText(o) ? t('orderNoLabel') + ' ' + orderNoText(o) + ' · ' : ''}${formatDate(o.time)}</span><span class="status-badge ${o.status || 'pending'}" style="margin:0;">${t(statusLabels[o.status] || 'statusPending')}</span>${serialChipHtml(o)}</div>
      ${(o.items||[]).map(i => `${escapeHtml(i.name)} × ${i.qty}`).join(', ')}
      <div style="margin-top:4px;"><b>৳${formatBn(o.total)}</b></div>${deliveryEstimateHtml(o)}${parcelNoteHtml(o)}${statusUpdatedHtml(o)}${(o.status==='pending')?`<div style="margin-top:8px;"><button class="ghost-btn" style="color:var(--danger);border-color:var(--danger);" onclick="cancelMyOrder('${o.id}')">${t('cancelOrder')}</button></div>`:``}</div>`;
}

function normPhone(s){ let d = bnToEn(s || '').replace(/\D/g, ''); if (d === '88' || d === '880') return ''; if (d.startsWith('880') && d.length > 11) d = d.slice(3); else if (d.startsWith('88') && d.length === 13) d = d.slice(2); if (d.length === 10 && d.charAt(0) !== '0') d = '0' + d; return d; }
/* ---- fresh-data helpers used by checkout / cancel ---- */
async function refreshProductsCloud(){
  try {
    const r = await window.storage.get(KEYS.products);
    if (r && r.value) {
      const list = JSON.parse(r.value);
      if (Array.isArray(list)) { normalizeProducts(list); products = list; return list; }
    }
  } catch(e){}
  return products;
}
async function stockOkForCart(){
  const list = await refreshProductsCloud();
  for (const item of cart) {
    const prod = list.find(p => p && String(p.id) === String(item.productId));
    if (prod && typeof prod.stockQty === 'number' && prod.stockQty < item.qty) return { ok:false, name: prod.name, have: prod.stockQty };
  }
  return { ok:true };
}
/* ROUND-25: প্রতিটা অর্ডারের একটা সহজ সিরিয়াল নম্বর — #১০০১, #১০০২ …
   কাস্টমার আর দোকানদার দুজনেই এই নম্বর ধরে অর্ডার খুঁজতে পারে। */
async function updateOrderFresh(ord){
  let list = null;
  try { const r = await window.storage.get(KEYS.orders); if (r && r.value) list = JSON.parse(r.value); } catch(e){}
  if (!Array.isArray(list)) list = orders;
  let hit = false;
  list.forEach(x => { if (x && ord && x.id === ord.id) { x.stockDeducted = !!ord.stockDeducted; x.stockReleased = !!ord.stockReleased; hit = true; } });
  if (!hit) list.push(ord);
  orders = list;
  return saveOrders();
}
function makeSerialNo(){
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const r = n => { let s = ''; for (let i = 0; i < n; i++) s += A[Math.floor(Math.random() * A.length)]; return s; };
  return 'SN-' + r(4) + '-' + r(4);
}
function uniqueSerialNo(){
  let s = makeSerialNo(), guard = 0;
  while (guard++ < 20 && (orders || []).some(o => o.serialNo === s)) s = makeSerialNo();
  return s;
}
async function nextOrderNo(){
  let base = 1000;
  try {
    const r = await window.storage.get(KEYS.settings);
    const fresh = (r && r.value) ? JSON.parse(r.value) : null;
    if (fresh && Number(fresh.orderSeq)) base = Number(fresh.orderSeq);
    const used = (orders || []).map(o => Number(o.orderNo) || 0);
    const maxUsed = used.length ? Math.max.apply(null, used) : 0;
    const n = Math.max(base, maxUsed) + 1;
    const next = Object.assign({}, fresh || {}, { orderSeq: n });
    await window.storage.set(KEYS.settings, JSON.stringify(next));
    try { settings = { ...DEFAULT_SETTINGS, ...next }; } catch(e){}
    return n;
  } catch(e) {
    const used = (orders || []).map(o => Number(o.orderNo) || 0);
    return Math.max(base, used.length ? Math.max.apply(null, used) : 0, 1000) + 1;
  }
}
function orderNoText(o){ const n = o && Number(o.orderNo); return n ? '#' + formatBn(n) : ''; }
async function appendOrderFresh(ord){
  let list = null;
  try { const r = await window.storage.get(KEYS.orders); if (r && r.value) list = JSON.parse(r.value); } catch(e){}
  if (!Array.isArray(list)) list = orders.slice ? orders.slice() : orders;
  const i = ord ? list.findIndex(x => x && x.id === ord.id) : -1;
  if (i >= 0) {
    if (ord.paymentScreenshot && !list[i].paymentScreenshot) list[i].paymentScreenshot = ord.paymentScreenshot;
    if (ord.paymentReference && !list[i].paymentReference) list[i].paymentReference = ord.paymentReference;
    orders = list;
    return true;
  }
  list.push(ord); orders = list;
  return true;
}

/* ===== ROUND-25: রেজিস্ট্রেশনের সাথে ফোন/ডিভাইস ও IP-লোকেশন =====
   দোকানদার "কাস্টমার" পেজে দেখতে পাবে — কে কোন ফোন/ব্রাউজার থেকে, কোথা থেকে
   রেজিস্টার করেছে, আর চাইলে ব্লক/আনব্লক বা রেজিস্ট্রেশন মুছে দিতে পারবে। */
let _myMetaCache = null;
async function myDeviceInfo(){
  const ua = (navigator && navigator.userAgent) || '';
  let model = '', platform = '';
  try {
    if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
      const h = await navigator.userAgentData.getHighEntropyValues(['model','platform','platformVersion','architecture']);
      model = (h && h.model) || ''; platform = ((h && h.platform) || '') + ((h && h.platformVersion) ? ' ' + h.platformVersion : '');
    }
    if (!model) { const m = ua.match(/;\s*([A-Za-z0-9][^;)]{1,40})\s+Build\//); if (m) model = m[1]; }
  } catch(e){}
  const brand = (navigator && navigator.vendor) || (/Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'Apple' : '');
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac OS X/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  let screenTxt = '';
  try { if (window.screen && screen.width) screenTxt = screen.width + '×' + screen.height; } catch(e){}
  return { model: model || '', platform: platform || '', brand: brand, os: os, browser: browser, screen: screenTxt,
           lang: (navigator && navigator.language) || '', ua: ua.slice(0, 300) };
}
async function myIpInfo(){
  if (_myMetaCache) return _myMetaCache;
  try { const c = localStorage.getItem('myIpInfo'); if (c) { const j = JSON.parse(c); if (j && j.time && Date.now() - j.time < 12 * 3600e3) { _myMetaCache = j; return j; } } } catch(e){}
  const call = async (url) => {
    try {
      const ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      const tm = ctl ? setTimeout(() => { try { ctl.abort(); } catch(e){} }, 5000) : null;
      const r = await fetch(url, ctl ? { signal: ctl.signal } : {});
      if (tm) clearTimeout(tm);
      return await r.json();
    } catch(e){ return null; }
  };
  let out = null, j = await call('https://ipwho.is/');
  if (j && j.success !== false && (j.ip || j.city)) out = { ip: j.ip || '', city: j.city || '', region: j.region || '', country: j.country || '', isp: (j.connection && j.connection.isp) || '' };
  if (!out) { j = await call('https://ipapi.co/json/'); if (j && j.ip) out = { ip: j.ip, city: j.city || '', region: j.region || '', country: j.country_name || '', isp: j.org || '' }; }
  if (!out) out = { ip: '', city: '', region: '', country: '', isp: '' };
  out.time = Date.now();
  _myMetaCache = out;
  try { localStorage.setItem('myIpInfo', JSON.stringify(out)); } catch(e){}
  return out;
}
async function collectCustomerMeta(){
  try {
    const dev = await myDeviceInfo(), geo = await myIpInfo();
    return { model: dev.model, platform: dev.platform, brand: dev.brand, os: dev.os, browser: dev.browser, screen: dev.screen, lang: dev.lang, ua: dev.ua,
             ip: geo.ip || '', city: geo.city || '', region: geo.region || '', country: geo.country || '', isp: geo.isp || '', metaTime: Date.now() };
  } catch(e){ return {}; }
}
function applyBlockState(list){
  const acc = getMyAccount();
  const ph = acc ? acc.norm : '';
  const ip = (_myMetaCache && _myMetaCache.ip) || '';
  let me = null;
  (list || []).forEach(x => {
    if (me) return;
    if (ph && normPhone(x.phone) === ph) me = x;
    else if (!ph && ip && x.meta && x.meta.ip === ip) me = x;
  });
  window.__blocked = (me && me.blocked) ? me : null;
  if (window.__blocked) showCustBanner(t('blockedTitle'), t('blockedMsg'), '', null, true);
  else { const _bn = document.getElementById('custBanner'); if (_bn && _bn.className.indexOf('blocked') >= 0) _bn.className = 'cust-banner'; }
}
function custToken(){ try { return localStorage.getItem('dibCustToken'); } catch(e){ return null; } }
function saveCustToken(tok){ try { if (tok) localStorage.setItem('dibCustToken', String(tok)); } catch(e){} }
function clearCustToken(){ try { localStorage.removeItem('dibCustToken'); } catch(e){} }
async function _applyCustBlockFromStore(){
  try {
    const r = await window.storage.get(KEYS.customers);
    const list = (r && r.value) ? JSON.parse(r.value) : [];
    if (Array.isArray(list)) applyBlockState(list);
  } catch(e){}
}
async function _rpcRegisterCustomer(phone, name, meta){
  if (!_sb || !phone) return null;
  try {
    const { data, error } = await Promise.race([
      _sb.rpc('dib_register_customer', { p_phone: phone, p_name: name || '', p_meta: meta || {} }),
      new Promise((_, _rej) => setTimeout(() => _rej(new Error('timeout')), 8000))
    ]);
    if (error) return null;
    return data || null;
  } catch(e){ return null; }
}
async function syncMyPresence(){
  const acc = getMyAccount(); if (!acc || !acc.norm) return;
  try {
    let removed = [];
    try { const rr = await window.storage.get('cust_removed'); removed = (rr && rr.value) ? JSON.parse(rr.value) : []; } catch(e){}
    if (Array.isArray(removed) && removed.indexOf(acc.norm) >= 0) return;
    const meta = await collectCustomerMeta();
    const res = await _rpcRegisterCustomer(acc.phone, acc.name || '', meta);
    if (res && res.ok) {
      saveCustToken(res.token);
      if (res.blocked) { window.__blocked = { phone: acc.phone, blocked: true, meta: meta }; showCustBanner(t('blockedTitle'), t('blockedMsg'), '', null, true); }
      else { window.__blocked = null; await _applyCustBlockFromStore(); }
      return;
    }
    if (res && res.ok === false && res.error === 'blocked') { window.__blocked = { phone: acc.phone, blocked: true }; showCustBanner(t('blockedTitle'), t('blockedMsg'), '', null, true); return; }
    const r = await window.storage.get(KEYS.customers);
    let list = (r && r.value) ? JSON.parse(r.value) : [];
    if (!Array.isArray(list)) list = [];
    let i = -1;
    list.forEach((x, k) => { if (i < 0 && normPhone(x.phone) === acc.norm) i = k; });
    if (i < 0) {
      list.push({ phone: acc.phone, name: acc.name || '', firstSeen: Date.now(), firstOrder: Date.now(), lastOrder: Date.now(), orders: 0, lastSeen: Date.now(), meta: meta });
    }
    else { list[i].lastSeen = Date.now(); list[i].meta = Object.assign({}, list[i].meta || {}, meta); if (acc.name) list[i].name = acc.name; }
    await window.storage.set(KEYS.customers, JSON.stringify(list));
    applyBlockState(list);
  } catch(e){}
}
window.__syncPresence = syncMyPresence;
async function registerCustomer(data){
  try {
    const ph = normPhone(data.phone);
    if (!ph) return;
    const meta = await collectCustomerMeta();
    try {
      const rr = await window.storage.get('cust_removed');
      let a = (rr && rr.value) ? JSON.parse(rr.value) : [];
      if (Array.isArray(a) && a.indexOf(ph) >= 0) { a = a.filter(x => x !== ph); await window.storage.set('cust_removed', JSON.stringify(a)); }
    } catch(e){}
    const res = await _rpcRegisterCustomer(data.phone, data.customerName || '', meta);
    if (res && res.ok) {
      saveCustToken(res.token);
      if (res.blocked) { window.__blocked = { phone: data.phone, blocked: true }; showCustBanner(t('blockedTitle'), t('blockedMsg'), '', null, true); }
      else { window.__blocked = null; await _applyCustBlockFromStore(); }
      return;
    }
    if (res && res.ok === false && res.error === 'blocked') { window.__blocked = { phone: data.phone, blocked: true }; showCustBanner(t('blockedTitle'), t('blockedMsg'), '', null, true); return; }
    const r = await window.storage.get(KEYS.customers);
    let list = (r && r.value) ? JSON.parse(r.value) : [];
    if (!Array.isArray(list)) list = [];
    const ex = list.find(x => normPhone(x.phone) === ph);
    if (ex) {
      if (data.customerName) ex.name = data.customerName;
      if (data.address) ex.address = data.address;
      ex.lastOrder = Date.now(); ex.lastSeen = Date.now(); ex.orders = (ex.orders || 1) + 1;
      ex.meta = Object.assign({}, ex.meta || {}, meta);
    }
    else list.push({ phone: data.phone, name: data.customerName, address: data.address, firstOrder: Date.now(), lastOrder: Date.now(), lastSeen: Date.now(), firstSeen: Date.now(), orders: 1, meta: meta });
    await window.storage.set(KEYS.customers, JSON.stringify(list));
    applyBlockState(list);
  } catch(e){}
}
async function cancelMyOrder(id){
  let freshOrders = null, freshProducts = null;
  try {
    const r1 = await window.storage.get(KEYS.orders);
    if (r1 && r1.value) { const l = JSON.parse(r1.value); if (Array.isArray(l)) freshOrders = l; }
    const r2 = await window.storage.get(KEYS.products);
    if (r2 && r2.value) { const l = JSON.parse(r2.value); if (Array.isArray(l)) freshProducts = normalizeProducts(l); }
  } catch(e){}
  if (!Array.isArray(freshOrders)) freshOrders = orders;
  if (!Array.isArray(freshProducts)) freshProducts = products;
  orders = freshOrders; products = freshProducts;
  const o = orders.find(x => x.id === id);
  if (!o) return;
  if (o.status !== 'pending') return;
  if (!(await uConfirm(t('cancelConfirm') + (orderNoText(o) ? ' (' + orderNoText(o) + ')' : ''), { danger:true }))) return;
  const acc = getMyAccount();
  const tok = custToken();
  if (_sb && tok && acc && acc.phone) {
    try {
      const { data, error } = await Promise.race([
        _sb.rpc('dib_cancel_order', { p_phone: acc.phone, p_token: tok, p_order_id: id }),
        new Promise((_, _rej) => setTimeout(() => _rej(new Error('timeout')), 10000))
      ]);
      if (!error && data && data.ok) {
        try {
          const rr = await window.storage.get(KEYS.orders);
          if (rr && rr.value) { const l = JSON.parse(rr.value); if (Array.isArray(l)) orders = l; }
        } catch(e){}
        const cur = orders.find(x => x.id === id) || o;
        cur.status = 'cancelled'; cur.seen = false; cur.cancelledByCustomer = true;
        showToast(t('orderCancelled') + (orderNoText(cur) ? ' — ' + orderNoText(cur) : ''), 'success');
        afterPaint(() => { try { renderStoreGrid(); } catch(e){} if (document.getElementById('accOrders')) openAccount(); });
        return;
      }
      if (!error && data && data.ok === false) {
        if (data.error === 'unauthorized') { clearCustToken(); showToast(t('cancelFailed'), 'error'); return; }
        else if (data.error === 'not_cancellable') { showToast(t('cancelFailed'), 'error'); return; }
        else if (data.error === 'not_found') { /* fall through to local */ }
      }
    } catch(e){}
  }
  const _own = getMyAccount();
  if (!_own || !_own.norm || normPhone(o.phone) !== _own.norm) { showToast(t('cancelFailed'), 'error'); return; }
  o.status = 'cancelled'; o.seen = true; o.cancelledByCustomer = true; o.cancelTime = Date.now();
  /* ROUND-25: স্টক না কাটা থাকলে ফেরত দেওয়ার কিছু নেই — শুধু কাটা থাকলে ফেরত */
  if (!o.stockReleased && o.stockDeducted !== false) {
    (o.items || []).forEach(i => {
      const prod = products.find(p => p && String(p.id) === String(i.productId));
      if (prod && typeof prod.stockQty === 'number') { prod.stockQty += (i.qty || 0); prod.inStock = prod.stockQty > 0; }
    });
    o.stockReleased = true;
  }
  const stockSaved = saveProducts().catch(()=>{});
  const ordersSaved = await saveOrders();
  await stockSaved;
  if (ordersSaved) { showToast(t('orderCancelled') + (orderNoText(o) ? ' — ' + orderNoText(o) : ''), 'success'); afterPaint(() => { try { renderStoreGrid(); } catch(e){} if (document.getElementById('accOrders')) openAccount(); }); }
  else showToast(t('cancelFailed'), 'error');
}
/* ===== ROUND-24: Messenger/WhatsApp ধরনের চ্যাট =====
   আগে মেসেজ দেখতে ও পাঠাতে প্রতিবার নাম-নম্বর লিখতে হতো, আর নিজের মেসেজ
   মুছতেও পারত না। এখন নাম+নম্বর দিয়ে একবার লগইন করলেই নিজের চ্যাট বক্স:
   পুরো কথা-বার্তা একসাথে দেখা যায়, নম্বর না দিয়েই নতুন মেসেজ লেখা যায়,
   আর নিজের মেসেজ সম্পাদনা বা আনসেন্ডও করা যায় — Messenger/WhatsApp-এর মতো। */
let _chatSig = '', _chatLock = 0, _chatMenuId = null, _chatStoreSig = '', _chatPromptResolve = null;
function chatAcc(){ const a = getMyAccount(); return (a && a.norm) ? a : null; }
function chatMine(ph){ return (messages || []).filter(m => m && normPhone(m.phone) === ph); }
function chatRows(ph){
  const rows = [];
  chatMine(ph).forEach(m => {
    rows.push({ kind:'me', mid:m.id, text:m.text || '', time:m.time || 0, edited:!!m.edited, deleted:!!m.deleted, read:!!m.read, delivered:!!m.delivered });
    (m.replies || []).forEach((r, i) => rows.push({ kind:'shop', rid:i, mid:m.id, text:r.text || '', time:r.time || 0 }));
  });
  rows.sort((a, b) => (a.time || 0) - (b.time || 0) || (a.kind === 'me' ? -1 : 1));
  return rows;
}
function chatTick(r){
  /* ROUND-24: শুধু টিক নয় — "পৌঁছেছে" / "দেখা হয়েছে" লেখাটাও পাশে দেখায়,
     যাতে কাস্টমার এক নজরেই বুঝতে পারে দোকানদার মেসেজটা পেয়েছে কি না। */
  if (r.deleted) return '';
  if (r.read) return `<span class="chat-tick seen">✓✓<span class="tick-lbl">${t('msgSeen')}</span></span>`;
  if (r.delivered) return `<span class="chat-tick">✓✓<span class="tick-lbl">${t('chatDelivered')}</span></span>`;
  return `<span class="chat-tick" title="${t('chatSent')}">✓</span>`;
}
function chatShopName(){ try { return (((settings.shopNamePrefix || 'Dear IT ').trimEnd() + ' ' + (settings.shopNameSuffix || 'BD')) || 'Shop'); } catch(e){ return 'Shop'; } }
function chatBodyHtml(){
  if (storeSettings && storeSettings.features && storeSettings.features.showMyMessages === false) return `<div class="chat-gate">${t('chatClosed')}</div>`;
  const head = `<div class="chat-head"><div class="chat-av">${escapeHtml(firstLetter(chatShopName()))}</div>`
    + `<div style="flex:1;min-width:0;"><div class="chat-name">${escapeHtml(chatShopName())}</div><div class="chat-sub">${t('chatSub')}</div></div>${chatAlertBtnHtml()}</div>`;
  const acc = chatAcc();
  if (!acc) return head + `<div class="chat-gate"><div>${t('chatNeedLogin')}</div><button class="primary-btn" id="chatLoginBtn">${t('chatLoginBtn')}</button></div>`;
  const rows = chatRows(acc.norm);
  const body = rows.length === 0 ? `<div class="chat-empty">${t('chatEmpty')}</div>` : rows.map(r => `
      <div class="chat-row ${r.kind}">
        <div class="chat-bub ${r.kind}${r.deleted ? ' gone' : ''}">
          ${r.deleted ? `<i>${t('chatUnsentMe')}</i>` : escapeHtml(r.text)}${r.kind === 'me' && r.edited && !r.deleted ? `<span class="chat-edited">${t('chatEdited')}</span>` : ''}
          <span class="chat-meta">${formatTime(r.time)}${r.kind === 'me' ? chatTick(r) : ''}</span>
        </div>
        ${r.kind === 'me' && !r.deleted ? `<button class="chat-dots" data-cmsg="${r.mid}" aria-label="${t('chatEdit')}">⋮</button>` : ''}
      </div>`).join('');
  return head + `<div class="chat-body" id="chatBody">${body}</div>`
    + `<div class="chat-input-row"><input type="text" id="chatInput" autocomplete="off" placeholder="${t('chatPh')}">`
    + `<button id="chatSendBtn" aria-label="${t('chatSent')}"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button></div>`;
}
/* ===== ROUND-25: দোকান উত্তর দিলেই কাস্টমারের কাছে খবর =====
   অ্যাপের ব্যানার সবসময় দেখায়; ব্রাউজার অ্যালার্ট চালু থাকলে ফোনেও খবর যায়। */
function replyKey(mid, r){ return mid + '|' + (r.time || 0) + '|' + String(r.text || '').slice(0, 16); }
function seenReplyKeys(){
  try { const c = localStorage.getItem('seenReplyKeys'); const a = c ? JSON.parse(c) : []; return Array.isArray(a) ? a : []; } catch(e){ return []; }
}
function saveSeenReplyKeys(a){ try { localStorage.setItem('seenReplyKeys', JSON.stringify(a.slice(-300))); } catch(e){} }
function showCustBanner(title, body, actionLabel, actionFn, persist){
  let b = document.getElementById('custBanner');
  if (!b) { b = document.createElement('div'); b.id = 'custBanner'; document.body.appendChild(b); }
  b.className = 'cust-banner on' + (persist ? ' blocked' : '');
  b.innerHTML = '<div class="cb-ic">' + (persist ? '⛔' : '🔔') + '</div>'
    + '<div class="cb-tx"><b>' + escapeHtml(title) + '</b><span>' + escapeHtml(body || '') + '</span></div>'
    + (actionLabel ? '<button class="cb-go">' + escapeHtml(actionLabel) + '</button>' : '')
    + (persist ? '' : '<button class="cb-x">✕</button>');
  const go = b.querySelector('.cb-go'); if (go && actionFn) go.onclick = () => { b.classList.remove('on'); try { actionFn(); } catch(e){} };
  const x = b.querySelector('.cb-x'); if (x) x.onclick = () => b.classList.remove('on');
  if (!persist) { clearTimeout(window.__cbTimer); window.__cbTimer = setTimeout(() => { try { b.classList.remove('on'); } catch(e){} }, 12000); }
}
function notifyCustomerReply(text){
  const shop = chatShopName();
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const n = new Notification(t('newReplyFrom') + ' — ' + shop, { body: String(text || '').slice(0, 90), tag: 'dib-reply' });
      try { n.onclick = () => { window.focus(); cornerOpen('msgs'); }; } catch(e){}
    }
  } catch(e){}
  showCustBanner(t('newReplyFrom'), String(text || '').slice(0, 70), t('viewChat'), () => { try { cornerOpen('msgs'); renderChat(false); } catch(e){} });
}
function checkNewReplies(){
  const acc = chatAcc(); if (!acc) return;
  /* FIX: notification/ব্যানার শুধুমাত্র সেই ট্যাবে দেখানো হবে যেটা ব্যবহারকারী
     আসলে দেখছে। আগে localStorage-এর shared seen-flag-এর জন্য যেকোনো বেকগ্রাউন্ড
     ট্যাবেই পপআপ ভেসে উঠত (যে ট্যাবের পোল আগে দৌড়ত)। এখন বেকগ্রাউন্ড ট্যাব
     দাবি করবে না — সামনের ট্যাবই দাবি করে পপআপ দেখাবে। */
  try { if (document.visibilityState !== 'visible') return; } catch(e){}
  let raw = null; try { raw = localStorage.getItem('seenReplyKeys'); } catch(e){}
  const firstRun = (raw === null);          /* প্রথমবার পুরনো সব উত্তর চুপচাপ "দেখা" ধরে নিই */
  const seen = seenReplyKeys();
  let touched = false;
  chatMine(acc.norm).forEach(m => (m.replies || []).forEach(r => {
    const k = replyKey(m.id, r);
    if (seen.indexOf(k) < 0) { seen.push(k); touched = true; if (!firstRun && !chatPanelVisible()) notifyCustomerReply(r.text); }
  }));
  if (touched || firstRun) saveSeenReplyKeys(seen);
}
function chatAlertBtnHtml(){
  try {
    if (typeof Notification === 'undefined') return '';
    if (Notification.permission === 'granted') return `<button class="chat-bell on" title="${t('viewChat')}">🔔</button>`;
    if (Notification.permission === 'denied') return '';
    return `<button class="chat-bell" id="chatBellBtn" title="${t('chatAlertHint')}">🔔</button>`;
  } catch(e){ return ''; }
}
function chatPanelVisible(){
  try {
    const cp = document.getElementById('cornerPanel'), pane = document.getElementById('ctab-msgs');
    return !!(cp && !cp.classList.contains('hidden') && pane && pane.classList.contains('on') && document.visibilityState !== 'hidden');
  } catch(e){ return false; }
}
function updateChatBadge(){
  const n = (function(){ const acc = chatAcc(); if (!acc) return 0; return chatMine(acc.norm).filter(m => (m.replies || []).length && !m.cSeen).length; })();
  try {
    const fab = document.getElementById('cornerFab');
    if (fab) {
      let b = fab.querySelector('.fab-badge');
      if (n > 0) { if (!b) { b = document.createElement('span'); b.className = 'fab-badge'; fab.appendChild(b); } b.textContent = formatBn(n); }
      else if (b) b.parentNode.removeChild(b);
    }
    const tab = document.querySelector('.cp-tabs button[data-ct="msgs"]');
    if (tab) {
      let b = tab.querySelector('.tab-badge');
      if (n > 0) { if (!b) { b = document.createElement('span'); b.className = 'tab-badge'; tab.appendChild(b); } b.textContent = formatBn(n); }
      else if (b) b.parentNode.removeChild(b);
    }
  } catch(e){}
}
async function chatMarkViewer(){
  if (!chatPanelVisible()) return;
  const acc = chatAcc(); if (!acc) return;
  await chatRefreshStore();
  let touched = false;
  chatMine(acc.norm).forEach(m => { if ((m.replies || []).length && !m.cSeen) { m.cSeen = true; touched = true; } });
  if (!touched) return;
  const tok = custToken();
  if (_sb && tok && acc.phone) {
    try {
      const { error } = await Promise.race([
        _sb.rpc('dib_mark_seen', { p_phone: acc.phone, p_token: tok }),
        new Promise((_, _rej) => setTimeout(() => _rej(new Error('timeout')), 8000))
      ]);
      if (!error) return;
    } catch(e){}
  }
  saveMessages().catch(()=>{});
}
function renderChat(soft){
  const box = document.getElementById('chatBox');
  if (!box) return;
  const acc = chatAcc();
  const rows = acc ? chatRows(acc.norm) : [];
  const sig = (acc ? acc.norm : '-') + '|' + currentLang + '|' + JSON.stringify(rows.map(r => [r.kind, r.mid, r.rid, r.time, r.text, r.deleted, r.edited, r.read, r.delivered]));
  if (soft && sig === _chatSig) { updateChatBadge(); return; }
  const inp = document.getElementById('chatInput');
  if (soft && inp && inp.value.trim()) { updateChatBadge(); return; }   /* লিখতে লিখতে মুছে যাবে না — sig advance নয়, নাহলে reply আসলে render হবে না */
  _chatSig = sig;
  box.innerHTML = chatBodyHtml();
  const bd = document.getElementById('chatBody');
  if (bd) bd.scrollTop = bd.scrollHeight;
  chatMarkViewer();
  updateChatBadge();
}
async function chatRefreshStore(){
  try {
    const r = await window.storage.get(KEYS.messages);
    if (r && r.value) { const l = JSON.parse(r.value); if (Array.isArray(l)) { messages = l; messages.forEach(m => { if (!Array.isArray(m.replies)) m.replies = []; }); _chatStoreSig = r.value; return true; } }
  } catch(e){}
  return false;
}
async function chatSend(){
  if (window.__blocked) { showToast(t('blockedMsg'), 'error'); return; }
  const acc = chatAcc();
  const inp = document.getElementById('chatInput');
  const text = inp ? (inp.value || '').trim() : '';
  if (!text) return;
  if (!acc) { window._afterLogin = 'chat'; try { openAccount(); } catch(e){} return; }
  if (Date.now() - _chatLock < 3500) { showToast(t('msgWait'), 'error'); return; }
  _chatLock = Date.now();
  if (inp) inp.value = '';
  const tok = custToken();
  if (_sb && tok && acc.phone) {
    try {
      const { data: res, error } = await Promise.race([
        _sb.rpc('dib_send_message', { p_phone: acc.phone, p_token: tok, p_name: acc.name || '', p_text: text }),
        new Promise((_, _rej) => setTimeout(() => _rej(new Error('timeout')), 8000))
      ]);
      if (!error && res && res.ok) {
        await chatRefreshStore();
        if (res.message && !messages.some(m => m && m.id === res.message.id)) messages.push(res.message);
        _chatSig = '';
        renderChat(false);
        showToast(t('msgSent'), 'success');
        try {
          if (typeof Notification !== 'undefined' && Notification.permission === 'default' && !localStorage.getItem('alertHintShown')) {
            localStorage.setItem('alertHintShown', '1');
            setTimeout(() => showCustBanner(t('chatAlertOn'), t('chatAlertHint'), t('chatAlertOn'), () => { try { Notification.requestPermission().then(() => renderChat(false)); } catch(e){} }), 1200);
          }
        } catch(e){}
        return;
      }
      if (!error && res && res.ok === false) {
        if (res.error === 'unauthorized') clearCustToken();
        else if (res.error === 'rate_limited') { if (inp) inp.value = text; showToast(t('msgWait'), 'error'); return; }
        else if (res.error === 'too_long' || res.error === 'empty') { showToast(t('chatSendFail'), 'error'); return; }
      }
    } catch(e){}
  }
  await chatRefreshStore();
  messages.push({ id: uid('m'), name: acc.name || '', phone: acc.phone || acc.norm, text, time: Date.now(), read: false, delivered: false, replies: [] });
  if (!await saveMessages()) { if (inp) inp.value = text; showToast(t('chatSendFail'), 'error'); return; }
  _chatSig = '';
  renderChat(false);
  showToast(t('msgSent'), 'success');
  /* প্রথমবার লেখার পরেই অ্যালার্ট চালু করার কথা মনে করিয়ে দিই (একবারই) */
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default' && !localStorage.getItem('alertHintShown')) {
      localStorage.setItem('alertHintShown', '1');
      setTimeout(() => showCustBanner(t('chatAlertOn'), t('chatAlertHint'), t('chatAlertOn'), () => { try { Notification.requestPermission().then(() => renderChat(false)); } catch(e){} }), 1200);
    }
  } catch(e){}
}
function chatPromptDone(v){
  const r = _chatPromptResolve; _chatPromptResolve = null;
  window.__chatPromptOpen = false;
  const root = document.getElementById('chatMenuRoot');
  if (root) { root.classList.remove('on'); root.innerHTML = ''; }
  if (r) r(v);
}
function chatPrompt(title, value){
  const root = document.getElementById('chatMenuRoot');
  if (!root) return Promise.resolve(null);
  return new Promise(resolve => {
    _chatPromptResolve = resolve;
    window.__chatPromptOpen = true;
    root.innerHTML = `<div class="cm-ov"><div class="cm-sheet"><div class="cm-title">${escapeHtml(title)}</div>`
      + `<textarea id="cmEditText"></textarea>`
      + `<div class="cm-acts"><button type="button" class="cbtn-no" data-cm="pclose">${t('chatCancel')}</button>`
      + `<button type="button" class="cbtn-yes" data-cm="psave">${t('chatEditSave')}</button></div></div></div>`;
    root.classList.add('on');
    const ta = document.getElementById('cmEditText');
    if (ta) { ta.value = value || ''; setTimeout(() => { try { ta.focus(); } catch(e){} }, 60); }
  });
}
function chatMenuOpen(mid){
  const root = document.getElementById('chatMenuRoot');
  if (!root) return;
  _chatMenuId = mid;
  root.innerHTML = `<div class="cm-ov"><div class="cm-sheet"><div class="cm-title">${t('chatEdit')}</div>`
    + `<button type="button" class="cm-item" data-cm="edit">✎ ${t('chatEdit')}</button>`
    + `<button type="button" class="cm-item danger" data-cm="unsend">🗑 ${t('chatUnsend')}</button>`
    + `<button type="button" class="cm-item" data-cm="close">${t('chatCancel')}</button></div></div>`;
  root.classList.add('on');
}
function chatMenuClose(){
  const root = document.getElementById('chatMenuRoot');
  if (root) { root.classList.remove('on'); root.innerHTML = ''; }
  _chatMenuId = null;
}
async function chatEditMsg(mid){
  const m = (messages || []).find(x => x.id === mid);
  if (!m || m.deleted) return;
  const val = await chatPrompt(t('chatEditTitle'), m.text || '');
  if (val === null) return;
  const text = String(val).trim();
  if (!text || text === m.text) return;
  await chatRefreshStore();
  const tgt = (messages || []).find(x => x.id === mid);
  if (!tgt) return;
  tgt.text = text; tgt.edited = true; tgt.editedTime = Date.now();
  if (await saveMessages()) { _chatSig = ''; renderChat(false); showToast(t('chatEditedOk'), 'success'); }
}
async function chatUnsendMsg(mid){
  if (!await uConfirm(t('chatUnsendQ'), { danger:true })) return;
  await chatRefreshStore();
  const tgt = (messages || []).find(x => x.id === mid);
  if (!tgt) return;
  tgt.deleted = true; tgt.deletedTime = Date.now();
  if (await saveMessages()) { _chatSig = ''; renderChat(false); showToast(t('chatUnsentOk'), 'success'); }
}
let _blockCheckAt = 0;
async function refreshBlockState(){
  if (Date.now() - _blockCheckAt < 60000) return;
  _blockCheckAt = Date.now();
  try {
    const r = await window.storage.get(KEYS.customers);
    const list = (r && r.value) ? JSON.parse(r.value) : [];
    if (Array.isArray(list)) applyBlockState(list);
  } catch(e){}
}
async function chatPoll(){
  refreshBlockState();
  try { if (document.visibilityState === 'hidden') return; } catch(e){}
  try {
    const r = await window.storage.get(KEYS.messages);
    if (!r || !r.value || r.value === _chatStoreSig) return;
    const l = JSON.parse(r.value);
    if (!Array.isArray(l)) return;
    _chatStoreSig = r.value;
    messages = l;
    messages.forEach(m => { if (!Array.isArray(m.replies)) m.replies = []; });
    checkNewReplies();
    renderChat(true);
  } catch(e){}
}
try { window.__chatPollTimer = setInterval(chatPoll, 8000); } catch(e){}
try { document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') chatPoll(); }); } catch(e){}
(function chatWiring(){
  const box = document.getElementById('chatBox');
  if (box) {
    box.addEventListener('click', (e) => {
      if (!e.target || !e.target.closest) return;
      if (e.target.closest('#chatLoginBtn')) { window._afterLogin = 'chat'; try { openAccount(); } catch(err){} return; }
      if (e.target.closest('#chatSendBtn')) { chatSend(); return; }
      if (e.target.closest('#chatBellBtn')) { try { Notification.requestPermission().then(() => renderChat(false)); } catch(err){} return; }
      const dots = e.target.closest('.chat-dots');
      if (dots) { e.preventDefault(); e.stopPropagation(); chatMenuOpen(dots.getAttribute('data-cmsg')); }
    });
    box.addEventListener('keydown', (e) => { if (e.target && e.target.id === 'chatInput' && e.key === 'Enter') { e.preventDefault(); chatSend(); } });
  }
  const root = document.getElementById('chatMenuRoot');
  if (root) {
    root.addEventListener('click', (e) => {
      if (!e.target || !e.target.closest) return;
      if (e.target.classList && e.target.classList.contains('cm-ov')) { chatMenuClose(); return; }
      const b = e.target.closest('[data-cm]');
      if (!b) return;
      const a = b.getAttribute('data-cm'), id = _chatMenuId;
      if (a === 'pclose') { chatPromptDone(null); return; }
      if (a === 'psave') { const ta = document.getElementById('cmEditText'); chatPromptDone(ta ? ta.value : ''); return; }
      if (a === 'close') { chatMenuClose(); return; }
      chatMenuClose();
      if (a === 'edit') chatEditMsg(id);
      else if (a === 'unsend') chatUnsendMsg(id);
    });
  }
})();
try { renderChat(false); } catch(e){}

/* SHARE FIX: a product could only be shared by typing the shop's address out.
   The share sheet (WhatsApp / Messenger / SMS …) now gets a link that opens
   straight onto that product, and the page title follows the product too so
   the shared link previews sensibly. */
function productUrl(prod){ try { const u = new URL(location.href); u.searchParams.set('p', prod.id); u.hash = ''; return u.toString(); } catch(e){ return location.href; } }
async function shareProduct(prod){
  const url = productUrl(prod);
  const price = prod.salePrice > 0 ? prod.salePrice : prod.price;
  const text = prod.name + ' — ৳' + price;
  try { if (navigator.share) { await navigator.share({ title: prod.name, text, url }); return; } }
  catch(e){ if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url + '\n' + text); showToast(t('shareCopied'), 'success'); }
  catch(e){ showToast(url, 'success'); }
}
async function openDeepLink(){
  try {
    const id = new URLSearchParams(location.search).get('p');
    if (!id) return false;
    const prod = products.find(p => p && String(p.id) === String(id));
    if (!prod) return false;
    openGalleryModal(prod.id);
    return true;
  } catch(e){ return false; }
}
function openGalleryModal(productId){
  const prod = products.find(p => p.id === productId); if (!prod) return;
  try { document.title = prod.name + ' — ' + ((settings.shopNamePrefix || 'Dear IT ').trimEnd() + ' ' + (settings.shopNameSuffix || 'BD')); } catch(e){}
  
  /* Inject product JSON-LD for SEO */
  injectProductJsonLd(prod);
  
  const imgs = prod.images && prod.images.length ? prod.images : [];
  const btnText = getActiveButtons();
  let idx = 0;
  let selectedVariants = {};
  let qty = 1;
  const root = document.getElementById('modalRoot');
  function renderBody(){
    const hasImgs = imgs.length > 0;
    const mainHtml = hasImgs
      ? `<div class="gallery-main-wrap">
           <img class="gallery-main" data-zoom="1" src="${escapeHtml(imgs[idx])}" alt="">
           ${imgs.length > 1 ? `<button class="gallery-arrow prev" id="galPrev" ${idx===0?'disabled':''}>${ICONS.chevL}</button>
             <button class="gallery-arrow next" id="galNext" ${idx===imgs.length-1?'disabled':''}>${ICONS.chevR}</button>
             <span class="gallery-counter">${formatBn(idx+1)} / ${formatBn(imgs.length)}</span>` : ''}
         </div>`
      : icFallback('gallery');
    const stripHtml = imgs.length > 1 ? `<div class="gallery-strip" id="galleryStrip">${imgs.map((src,i)=>`<img src="${escapeHtml(src)}" data-i="${i}" class="${i===idx?'active':''}" alt="">`).join('')}</div>` : '';
    const lowLimit = Number(settings.lowStockThreshold) || 5;
    /* stock line inside the product popup — the exact number is shown whether
       it is plenty or nearly finished (the card chip does the same in the list) */
    const galleryStock = (!storeSettings.productCard.showStockQty || typeof prod.stockQty !== 'number' || prod.stockQty <= 0) ? ''
      : (prod.stockQty <= lowLimit
          ? `<div class="stock-chip low" style="margin:0 0 10px;">${ICONS.warn}<span>${escapeHtml(t('stockLowLeft', { n: formatBn(prod.stockQty) }))}</span></div>`
          : `<div class="stock-chip" style="margin:0 0 10px;">${ICONS.okSmall}<span>${escapeHtml(t('stockInStock', { n: formatBn(prod.stockQty) }))}</span></div>`);
    const stockNote = '';
    const discountPct = prod.salePrice > 0 ? Math.round((1 - prod.salePrice / prod.price) * 100) : 0;
    const priceHtml = prod.salePrice > 0
      ? `<span style="text-decoration:line-through;font-size:14px;color:var(--ink-soft);">৳${formatBn(prod.price)}</span> <span style="color:var(--danger);font-weight:800;font-size:22px;">৳${formatBn(prod.salePrice)}</span> ${discountPct > 0 ? `<span style="background:var(--danger);color:#fff;font-size:12px;font-weight:700;padding:2px 8px;border-radius:8px;margin-left:6px;">-${formatBn(discountPct)}%</span>` : ''}`
      : `<span style="font-weight:800;font-size:22px;color:var(--primary-dark);">৳${formatBn(prod.price)}</span>`;
    const variantsHtml = (prod.variants && prod.variants.length > 0) ? prod.variants.map((v, vi) => `
      <div class="variant-section">
        <label>${t('selectVariant', { name: escapeHtml(v.name) })}</label>
        <div class="variant-options">
          ${v.options.map(opt => `<div class="variant-opt${selectedVariants[vi] === opt ? ' active' : ''}" data-vi="${vi}" data-opt="${escapeHtml(opt)}">${escapeHtml(opt)}</div>`).join('')}
        </div>
      </div>`).join('') : '';
    const unitPrice = prod.salePrice > 0 ? prod.salePrice : prod.price;
    root.innerHTML = `<div class="modal-overlay" onclick="if(event.target===this) closeModal()"><div class="modal-sheet">
      ${mainHtml}${stripHtml}
      <h2>${escapeHtml(prod.name)} <button class="modal-close" onclick="closeModal()">✕</button></h2>
      <p class="sub">${prod.category ? escapeHtml(prod.category) : ''}</p>
      <div class="gal-price">${priceHtml}</div>
      ${stockNote}${galleryStock}
      ${prod.desc ? `<div class="gallery-dsec"><div class="gallery-dsec-title">${t('prodDetails')}</div><div class="gallery-desc">${escapeHtml(prod.desc)}</div></div>` : ''}
      ${variantsHtml}
      <div class="variant-section">
        <label>${t('qtyLabel')}</label>
        <div class="variant-options">
          <button class="variant-opt" id="qtyMinus">−</button>
          <div style="padding:8px 22px;font-weight:700;font-size:17px;" id="qtyVal">${formatBn(qty)}</div>
          <button class="variant-opt" id="qtyPlus">+</button>
        </div>
      </div>
      ${prod.inStock && prod.stockQty > 0 ? `
        <div class="gallery-actions">
          <button class="btn-action btn-cart" id="galAddCart">${ICONS.cart} ${escapeHtml(btnText.addToCart)}</button>
          <button class="btn-action btn-buy" id="galBuyNow">${ICONS.bolt} ${escapeHtml(btnText.buyNow)} — ৳${formatBn(unitPrice * qty)}</button>
        </div>
      ` : `<div style="background:#f0f0f0;color:#999;padding:14px;border-radius:10px;text-align:center;font-weight:700;margin-top:14px;">${t('outOfStock')}</div>`}
      <button class="ghost-btn" id="galShare" style="width:100%;margin-top:8px;">${ICONS.share} ${t('shareProduct')}</button>
      <div class="modal-close-row"><button class="ghost-btn" onclick="closeModal()">${t('close')}</button></div>
    </div></div>`;
    const refreshGalQty = () => { const qv = document.getElementById('qtyVal'); if (qv) qv.textContent = formatBn(qty); const bb = document.getElementById('galBuyNow'); if (bb) bb.innerHTML = `${ICONS.bolt} ${escapeHtml(btnText.buyNow)} — ৳${formatBn(unitPrice * qty)}`; };
    document.getElementById('qtyMinus').addEventListener('click', () => { if (qty > 1) { qty--; refreshGalQty(); } });
    document.getElementById('qtyPlus').addEventListener('click', () => { const cap = stockCapOf(prod); if (qty >= cap) { showToast(t('stockLow', { s: formatBn(cap) }), 'error'); return; } qty++; refreshGalQty(); });
    /* CART-CAP: never let the stepper ask for more pieces than are left */
    if (typeof prod.stockQty === 'number' && prod.stockQty > 0) {
      try { document.getElementById('qtyMinus').disabled = false; } catch(e){}
    }
    document.querySelectorAll('.variant-opt[data-vi]').forEach(btn => {
      btn.addEventListener('click', () => { const vi = parseInt(btn.dataset.vi, 10); selectedVariants[vi] = btn.dataset.opt; document.querySelectorAll(`.variant-opt[data-vi="${vi}"]`).forEach(o => o.classList.toggle('active', o === btn)); });
    });
    const validateVariants = () => {
      if (prod.variants && prod.variants.length > 0) {
        for (let i = 0; i < prod.variants.length; i++) {
          if (!selectedVariants[i]) { showToast(t('selectVariant', { name: prod.variants[i].name }), 'error'); return false; }
        }
      }
      return true;
    };
    const variantArr = () => (prod.variants || []).map((v, i) => ({ name: v.name, value: selectedVariants[i] }));
    const cartBtn = document.getElementById('galAddCart');
    if (cartBtn) cartBtn.addEventListener('click', async () => {
      if (!validateVariants()) return;
      const ok = await addToCart(prod, variantArr(), qty);
      if (ok === true) { showToast(`${prod.name} ${t('addedToCart')}`, 'success'); }
      else if (ok === 'capped') { showToast(t('stockLow', { s: formatBn(stockCapOf(prod)) }), 'error'); }
    });
    const buyBtn = document.getElementById('galBuyNow');
    if (buyBtn) buyBtn.addEventListener('click', async () => {
      if (!validateVariants()) return;
      const ok = await addToCart(prod, variantArr(), qty);
      if (ok === 'capped') { showToast(t('stockLow', { s: formatBn(stockCapOf(prod)) }), 'error'); }
      if (ok) { openCart(); }
    });
    const shareBtn = document.getElementById('galShare');
    if (shareBtn) shareBtn.addEventListener('click', () => shareProduct(prod));
    function showGalImage(newIdx){
      if (newIdx < 0 || newIdx >= imgs.length || newIdx === idx) return;
      idx = newIdx;
      const main = document.querySelector('#modalRoot .gallery-main');
      if (main) { main.classList.remove('gal-fade'); void main.offsetWidth; main.src = imgs[idx]; main.classList.add('gal-fade'); }
      const counter = document.querySelector('#modalRoot .gallery-counter');
      if (counter) counter.textContent = `${formatBn(idx+1)} / ${formatBn(imgs.length)}`;
      document.querySelectorAll('#galleryStrip img').forEach(t => t.classList.toggle('active', parseInt(t.dataset.i, 10) === idx));
      const pv = document.getElementById('galPrev'), nx = document.getElementById('galNext');
      if (pv) pv.disabled = (idx === 0);
      if (nx) nx.disabled = (idx === imgs.length - 1);
    }
    if (imgs.length > 1) {
      const prevBtn = document.getElementById('galPrev'), nextBtn = document.getElementById('galNext');
      if (prevBtn) prevBtn.addEventListener('click', () => showGalImage(idx - 1));
      if (nextBtn) nextBtn.addEventListener('click', () => showGalImage(idx + 1));
      document.querySelectorAll('#galleryStrip img').forEach(thumb => thumb.addEventListener('click', () => showGalImage(parseInt(thumb.dataset.i, 10))));
    }
  }
  renderBody();
}

/* Coupon counter: try the single-statement database function first; if the
   shop has not installed it yet, re-read the newest settings right before the
   write so this page is not saving an old copy over the owner's edits. */
async function bumpCouponUse(code){
  if (!code) return false;
  try { if (window.storage.bumpCoupon && await window.storage.bumpCoupon(code)) return true; } catch(e){}
  try {
    const r = await window.storage.get(KEYS.settings);
    const fresh = (r && r.value) ? JSON.parse(r.value) : null;
    if (fresh && Array.isArray(fresh.coupons)) {
      const cp = fresh.coupons.find(c => c && c.code === code);
      if (cp) {
        cp.used = (cp.used || 0) + 1;
        await window.storage.set(KEYS.settings, JSON.stringify(fresh));
        try { settings = { ...DEFAULT_SETTINGS, ...fresh }; } catch(e){}
        return true;
      }
    }
  } catch(e){}
  return false;
}

document.getElementById('cartBtn').addEventListener('click', openCart);
function computeTotals(){
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  let discount = 0;
  if (appliedCoupon) {
    const cp = settings.coupons.find(c => c.code === appliedCoupon.code && c.active);
    if (cp) {
      const expired = cp.expiresAt && cp.expiresAt < Date.now();
      const limitReached = cp.maxUse > 0 && (cp.used || 0) >= cp.maxUse;
      const belowMin = cp.minOrder > 0 && subtotal < cp.minOrder;
      if (expired || limitReached || belowMin) { appliedCoupon = null; saveCoupon(); }
      else discount = cp.type === 'percent' ? Math.round(subtotal * cp.value / 100) : Math.min(cp.value, subtotal);
    } else { appliedCoupon = null; saveCoupon(); }
  }
  let delivery = Math.max(0, Number(settings.deliveryCharge) || 0);
  if (settings.freeDeliveryOn || (settings.freeDeliveryOver > 0 && subtotal >= settings.freeDeliveryOver)) delivery = 0;
  const total = Math.max(0, subtotal - discount) + delivery;
  return { subtotal, discount, delivery, total };
}
function cartItemHtml(item, index){
  const src = cartLineImage(item);
  const thumbHtml = src ? `<div class="cart-item-thumb"><img data-zoom="1" src="${escapeHtml(src)}" alt=""></div>` : `<div class="cart-item-thumb">${icFallback()}</div>`;
  const variantTxt = item.variant && item.variant.length > 0 ? `<div class="variant-txt">${item.variant.map(v => v.name + ': ' + v.value).join(' · ')}</div>` : '';
  return `<div class="cart-item">${thumbHtml}
      <div class="cart-item-info"><h4>${escapeHtml(item.name)}</h4>${variantTxt}<p class="cart-line"><span>৳${formatBn(item.price)} × ${formatBn(item.qty)}</span><span>=</span><b>৳${formatBn(item.price * item.qty)}</b></p>
      <div class="cart-qty"><button class="qty-btn qty-minus" data-idx="${index}" aria-label="−" title="${item.qty <= 1 ? t('deleteOneLabel') : '−'}">−</button><span class="qty-num">${formatBn(item.qty)}</span><button class="qty-btn qty-plus" data-idx="${index}" aria-label="+">+</button></div></div></div>`;
}
function deliveryEstimateText(ord){
  const cfg = (ord && ord.deliveryEstimate) || storeSettings.deliveryEstimate || {minDays:3,maxDays:5};
  const min = Number(cfg.minDays) || 0, max = Number(cfg.maxDays) || min;
  if (!min && !max) return '';
  const start = ord && ord.time ? new Date(ord.time + min*86400000) : new Date(Date.now() + min*86400000);
  const end = ord && ord.time ? new Date(ord.time + max*86400000) : new Date(Date.now() + max*86400000);
  const fmt = d => d.toLocaleDateString(currentLang === 'bn' ? 'bn-BD' : 'en-US', {day:'2-digit',month:'short',year:'numeric'});
  return currentLang === 'bn' ? `সম্ভাব্য ডেলিভারি: ${fmt(start)}${max !== min ? ' – ' + fmt(end) : ''}` : `Estimated delivery: ${fmt(start)}${max !== min ? ' – ' + fmt(end) : ''}`;
}
function deliveryEstimateHtml(ord){ const x = deliveryEstimateText(ord); return x ? `<div class=\"delivery-estimate\">🚚 ${escapeHtml(x)}</div>` : ''; }

function cartSummaryHtml(totals){
  const freeNow = settings.freeDeliveryOn || (settings.freeDeliveryOver > 0 && totals.subtotal >= settings.freeDeliveryOver);
  return `<div class="summary-row"><span>${t('subtotal')}</span><span>৳${formatBn(totals.subtotal)}</span></div>
      ${totals.discount > 0 ? `<div class="summary-row discount"><span>${t('discount')}</span><span>−৳${formatBn(totals.discount)}</span></div>` : ''}
      ${totals.delivery > 0 ? `<div class="summary-row"><span>${t('deliveryCharge')}</span><span>৳${formatBn(totals.delivery)}</span></div>` : (freeNow ? `<div class="summary-row discount"><span>${t('deliveryCharge')}</span><span>${t('freeDelivery')}</span></div>` : '')}
      ${deliveryEstimateHtml(null)}<div class="summary-row total"><span>${t('grandTotal')}</span><span>৳${formatBn(totals.total)}</span></div>`;
}
function couponRowHtml(){
  return appliedCoupon
    ? `<div class="coupon-applied"><span>✓ ${t('couponApplied', { code: escapeHtml(appliedCoupon.code) })}</span><button id="removeCouponBtn">✕</button></div>`
    : `<div class="coupon-row"><input type="text" id="couponInput" placeholder="${t('couponPlaceholder')}" maxlength="20"><button id="applyCouponBtn">${t('applyCoupon')}</button></div>`;
}
function paymentBrandHtml(id, logo){
  const image = safeImageUrl(logo);
  const letter = { bkash:'b', nagad:'N', rocket:'R' }[id] || '৳';
  const cls = { bkash:'bkash', nagad:'nagad', rocket:'rocket' }[id] || 'cod';
  if (image) return `<span class="payment-brand payment-brand-image"><img src="${escapeHtml(image)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'payment-brand payment-brand-${cls}',textContent:'${letter}'}))"></span>`;
  return `<span class="payment-brand payment-brand-${cls}" aria-hidden="true">${letter}</span>`;
}
function wireCartQty(){
  const list = document.getElementById('cartItemsList'); if (!list) return;
  list.querySelectorAll('.qty-minus').forEach(btn => btn.addEventListener('click', async () => {
    const idx = parseInt(btn.dataset.idx, 10);
    if (!cart[idx]) return;
    /* FIX: আইটেম-মোছার আলাদা ✕ আর নেই — ১টার সময় − চাপলে আইটেমটাই সরে যায় */
    if (cart[idx].qty <= 1) { cart.splice(idx, 1); await saveCart(); refreshCartUI(); showToast(t('itemRemoved'), 'success'); return; }
    cart[idx].qty--; await saveCart(); refreshCartUI();
  }));
  list.querySelectorAll('.qty-plus').forEach(btn => btn.addEventListener('click', async () => {
    const idx = parseInt(btn.dataset.idx, 10);
    if (!cart[idx]) return;
    const prod = products.find(p => p.id === cart[idx].productId);
    const cap = stockCapOf(prod);
    if (cart[idx].qty >= cap) { showToast(t('stockLow', { s: formatBn(cap) }), 'error'); return; }
    cart[idx].qty++; await saveCart(); refreshCartUI();
  }));
  /* (কার্টে এখন আলাদা ✕ নেই — − চাপে ১ হলে আইটেম সরে যায়; এই wiring ভবিষ্যতের জন্য রাখা) */
  list.querySelectorAll('.cart-rm').forEach(btn => btn.addEventListener('click', async () => {
    const idx = parseInt(btn.dataset.idx, 10);
    if (!cart[idx]) return;
    cart.splice(idx, 1); await saveCart(); refreshCartUI(); showToast(t('itemRemoved'), 'success');
  }));
}
function wireCouponRow(){
  const applyBtn = document.getElementById('applyCouponBtn');
  if (applyBtn) applyBtn.addEventListener('click', async () => {
    const code = document.getElementById('couponInput').value.trim().toUpperCase();
    if (!code) { showToast(t('enterCouponCode'), 'error'); return; }
    const cp = settings.coupons.find(c => c.code === code && c.active);
    if (!cp) { showToast(t('couponInvalid'), 'error'); return; }
    const expired = cp.expiresAt && cp.expiresAt < Date.now();
    if (expired) { showToast(t('couponInvalid'), 'error'); return; }
    const sub = cart.reduce((s, i) => s + i.price * i.qty, 0);
    if (cp.minOrder > 0 && sub < cp.minOrder) { showToast(currentLang === 'en' ? `Minimum ৳${cp.minOrder} required` : `সর্বনিম্ন ৳${cp.minOrder} অর্ডার লাগবে`, 'error'); return; }
    appliedCoupon = { code: cp.code }; await saveCoupon(); refreshCartUI(); showToast(t('couponApplied', { code: cp.code }), 'success');
  });
  const removeBtn = document.getElementById('removeCouponBtn');
  if (removeBtn) removeBtn.addEventListener('click', async () => { appliedCoupon = null; await saveCoupon(); refreshCartUI(); showToast(t('couponRemoved'), 'success'); });
}
function refreshCartUI(){
  if (cart.length === 0) { openCart(); return; }
  const list = document.getElementById('cartItemsList'); if (!list) return;
  list.innerHTML = cart.map((item, index) => cartItemHtml(item, index)).join('');
  wireCartQty();
  const box = document.getElementById('couponRowBox');
  if (box) { const ci = document.getElementById('couponInput'); const typed = ci ? ci.value : ''; box.innerHTML = couponRowHtml(); const ni = document.getElementById('couponInput'); if (ni && typed) ni.value = typed; }
  wireCouponRow();
  const totals = computeTotals();
  const sum = document.getElementById('cartSummaryBox'); if (sum) sum.innerHTML = cartSummaryHtml(totals);
  const cb = document.getElementById('confirmOrderBtn'); if (cb) cb.innerHTML = t('confirmOrder', { t: formatBn(totals.total) });
  renderCartBadge();
}
function compressPaymentScreenshot(file, maxW=1000, quality=.72){
  return new Promise((resolve,reject)=>{ const r=new FileReader(); r.onerror=reject; r.onload=()=>{ const im=new Image(); im.onload=()=>{ const scale=Math.min(1,maxW/im.width), c=document.createElement('canvas'); c.width=Math.round(im.width*scale); c.height=Math.round(im.height*scale); c.getContext('2d').drawImage(im,0,0,c.width,c.height); resolve(c.toDataURL('image/jpeg',quality)); }; im.onerror=reject; im.src=r.result; }; r.readAsDataURL(file); });
}

function openCart(){
  if (cart.length > 0) { const _ga = getMyAccount(); if (!_ga || !_ga.norm) { window._afterLogin = 'cart'; openAccount(); return; } }
  const root = document.getElementById('modalRoot');
  if (cart.length === 0) {
    root.innerHTML = `<div class="modal-overlay" onclick="if(event.target===this) closeModal()"><div class="modal-sheet" style="text-align:center;padding:40px 20px;max-width:400px;">
      <div style="margin-bottom:12px;opacity:.35;color:var(--primary);">${ICONS.cartBig}</div>
      <h2 style="justify-content:center;">${t('cartTitle')}</h2><p class="sub">${t('emptyCart')}</p>
      <button class="ghost-btn" id="closeEmptyCart" style="margin-top:16px;">${t('close')}</button></div></div>`;
    document.getElementById('closeEmptyCart').addEventListener('click', closeModal);
    return;
  }
  const totals = computeTotals();
  const activePayments = (settings.paymentMethods || []).filter(p => p.active);
  root.innerHTML = `<div class="modal-overlay" onclick="if(event.target===this) closeModal()"><div class="modal-sheet">
    <h2>${ICONS.cart} ${t('cartTitle')} <button class="modal-close" onclick="closeModal()">✕</button></h2>
    <div id="cartItemsList"></div>
    <div id="couponRowBox">${couponRowHtml()}</div>
    <div class="cart-summary" id="cartSummaryBox">${cartSummaryHtml(totals)}</div>
    ${activePayments.length > 0 ? `<div class="variant-section" style="margin-top:14px;">
      <label>${ICONS.card} ${t('paymentMethod')}</label>
      <div class="pay-methods">
        ${activePayments.map((pm, i) => `<label class="pay-opt${i === 0 ? ' active' : ''}">
            <input type="radio" name="payMethod" value="${escapeHtml(pm.id)}" ${i === 0 ? 'checked' : ''}>
            ${paymentBrandHtml(pm.id, pm.logo)}
            <div class="info"><b>${escapeHtml({cod:'Cash on Delivery',bkash:'bKash',nagad:'Nagad',rocket:'Rocket'}[pm.id] || pm.name)}${pm.accountType ? ' (' + escapeHtml(pm.accountType) + ')' : ''}</b>${pm.number ? `<small>${escapeHtml(pm.number)}</small>` : ''}</div>
          </label>`).join('')}
      </div>
    </div>` : ''}
    <div class="field hidden" id="paymentReferenceBox"><label>Payment transaction ID *</label><input type="text" id="paymentReference" placeholder="Enter your bKash/Nagad transaction ID"><label style="margin-top:10px;display:block;">Payment screenshot *</label><input type="file" id="paymentScreenshot" accept="image/*"><small>Upload the payment confirmation screenshot.</small></div>
    <div class="field" style="margin-top:14px;"><label>${t('yourName')}</label><input type="text" id="ordName" placeholder="${t('yourName')}"></div>
    <div class="field"><label>${t('phone')} <span style="color:var(--ink-soft);font-weight:400;font-size:12px;">(${t('optional')})</span></label><input type="text" id="ordPhone" placeholder="${t('phonePh')}"></div>
    <div class="field"><label>${t('deliveryAddress')}</label><textarea id="ordAddress" placeholder="${t('addressPlaceholder')}"></textarea></div>
    <div class="field"><label>${t('orderNotesLabel')}</label><textarea id="ordNotes" placeholder="${t('orderNotesPlaceholder')}" style="min-height:50px;"></textarea></div>
    <button class="primary-btn" id="confirmOrderBtn">${t('confirmOrder', { t: formatBn(totals.total) })}</button>
    <button class="wa-btn" id="waOrderBtn">${ICONS.wa} ${t('sendViaWhatsapp')}</button>
    <div class="modal-close-row" style="margin-top:8px;">
      <button class="danger-btn" id="clearCartBtn" style="flex:1;">${t('clearCart')}</button>
      <button class="ghost-btn" id="cancelCartBtn" style="flex:1;">${t('close')}</button>
    </div>
  </div></div>`;
  try { const _pa2 = getMyAccount(); if (_pa2 && _pa2.norm) { document.getElementById('ordName').value = _pa2.name || ''; document.getElementById('ordPhone').value = _pa2.phone || ''; } } catch(e){}
  const list = document.getElementById('cartItemsList');
  list.innerHTML = cart.map((item, index) => cartItemHtml(item, index)).join('');
  wireCartQty();
  document.getElementById('cancelCartBtn').addEventListener('click', closeModal);
  document.getElementById('clearCartBtn').addEventListener('click', async () => { cart = []; appliedCoupon = null; await saveCart(); await saveCoupon(); closeModal(); showToast(t('cartCleared'), 'success'); });
  const syncPaymentReference = () => {
    const selected = document.querySelector('input[name=\"payMethod\"]:checked');
    const box = document.getElementById('paymentReferenceBox');
    if (box) box.classList.toggle('hidden', !selected || selected.value === 'cod');
  };
  document.querySelectorAll('.pay-opt').forEach(opt => {
    opt.addEventListener('click', () => { document.querySelectorAll('.pay-opt').forEach(o => o.classList.remove('active')); opt.classList.add('active'); syncPaymentReference(); });
  });
  syncPaymentReference();
  wireCouponRow();
  try {
    const _acc = getMyAccount();
    if (_acc) {
      const _on = document.getElementById('ordName'), _op = document.getElementById('ordPhone');
      if (_on && !_on.value && _acc.name) _on.value = _acc.name;
      if (_op && !_op.value && _acc.phone) _op.value = _acc.phone;
    }
  } catch(e){}
  const collect = async () => ({
    customerName: document.getElementById('ordName').value.trim(),
    phone: document.getElementById('ordPhone').value.trim(),
    address: document.getElementById('ordAddress').value.trim(),
    notes: document.getElementById('ordNotes').value.trim(),
    payment: document.querySelector('input[name="payMethod"]:checked')?.value || 'cod',
    paymentReference: document.getElementById('paymentReference')?.value.trim() || '',
    paymentScreenshot: document.getElementById('paymentScreenshot')?.files?.[0] ? await compressPaymentScreenshot(document.getElementById('paymentScreenshot').files[0]) : ''
  });
  /* CHECKOUT-INTEGRITY FIX: the deduction used to be applied to this browser's
     copy of the catalogue and the whole array written back — so a product edit
     or a stock change the owner made in the meantime could be silently undone.
     It now starts from a freshly fetched copy every time. */
  /* ROUND-25 (স্টকের হিসাব): স্টক কাটা হয়েছে কি না সেটা অর্ডারের ভেতরেই লেখা
     থাকে — তাই পরে কনফার্ম/ডেলিভার/বাতিলের সময় ভুল হিসাব হয় না (না ডাবল কাটে,
     না না-কাটা স্টক ফেরত দেয়)। */
  const deductStock = async (ord) => {
    const list = await refreshProductsCloud();
    /* ROUND-9 FIX: সেটেল হওয়ার পরেই কার্ট খালি হয়ে যায় — তাই স্টক কাটার সময়
       অর্ডারে লেখা আইটেমগুলোই ধরা হয় (কার্ট নয়)। আগে কার্ট খালি হয়ে যাওয়ার
       পরে লুপ চলত, ফলে স্টক কাটা হতোই না অথচ অর্ডারে “কাটা হয়েছে” লেখা থাকত। */
    const _items = (ord && Array.isArray(ord.items) && ord.items.length) ? ord.items : cart;
    let _touched = false;
    for (const item of _items) {
      const prod = list.find(p => p && String(p.id) === String(item.productId));
      if (prod) {
        const have = (typeof prod.stockQty === 'number') ? prod.stockQty : 0;
        prod.stockQty = Math.max(0, have - item.qty);
        prod.inStock = prod.stockQty > 0;
        _touched = true;
      }
    }
    const saved = _touched ? await saveProducts() : false;
    if (ord && saved) { ord.stockDeducted = true; ord.stockReleased = false; updateOrderFresh(ord).catch(()=>{}); }
    try { renderStoreGrid(); renderCartBadge(); } catch(e){}
    return _touched && saved;
  };
  const createOrder = async (data) => {
    const tr = computeTotals();
    const no = await nextOrderNo();
    return { id: 'ORD-' + Date.now() + '-' + Math.floor(100 + Math.random() * 900), orderNo: no, serialNo: uniqueSerialNo(), items: [...cart], subtotal: tr.subtotal, discount: tr.discount, deliveryCharge: tr.delivery, total: tr.total, coupon: appliedCoupon ? appliedCoupon.code : null, customerName: data.customerName, phone: data.phone, address: data.address, notes: data.notes, payment: data.payment, paymentReference: data.paymentReference || '', paymentScreenshot: data.paymentScreenshot || '', time: Date.now(), deliveryEstimate: { ...(storeSettings.deliveryEstimate || {minDays:3,maxDays:5}) }, status: 'pending', seen: false, paymentStatus: data.payment === 'cod' ? 'unpaid' : 'pending_verification', stockDeducted: false, stockReleased: false };
  };
  /* Server-side order: one RPC transaction (price, stock, orderNo, coupon).
     Returns {ok,order,...} or null when RPC unavailable → caller falls back local. */
  const placeOrderCloud = async (data) => {
    if (!_sb) return null;
    try {
      const items = cart.map(i => ({
        productId: i.productId,
        qty: i.qty,
        variantKey: i.variantKey || '',
        variant: Array.isArray(i.variant) ? i.variant : []
      }));
      const { data: res, error } = await Promise.race([
        _sb.rpc('dib_place_order', {
          p_customer: {
            name: data.customerName,
            phone: data.phone,
            address: data.address,
            notes: data.notes || '',
            meta: {}
          },
          p_items: items,
          p_payment: {
            method: data.payment,
            reference: data.paymentReference || '',
            screenshot: data.paymentScreenshot || '',
            coupon: appliedCoupon ? appliedCoupon.code : ''
          }
        }),
        new Promise((_, _rej) => setTimeout(() => _rej(new Error('timeout')), 15000))
      ]);
      if (error) return null;
      if (res && res.ok) {
        try { if (res.token) localStorage.setItem('dibCustToken', res.token); } catch(e){}
        return res;
      }
      // Business rule reject (out_of_stock / blocked / …) — not a transport failure
      if (res && res.ok === false && res.error) return res;
      return null;
    } catch(e){ return null; }
  };
  const finishLocalOrder = async (data) => {
    const ord = await createOrder(data);
    await appendOrderFresh(ord);
    if (!await saveOrders()) { return { ok:false, local:true, ord:null }; }
    const stockUpdated = await deductStock(ord);
    if (!stockUpdated) showToast(currentLang === 'bn' ? 'অর্ডার হয়েছে, কিন্তু স্টক আপডেট করা যায়নি।' : 'Order placed, but stock could not be updated.', 'error');
    registerCustomer(data).catch(()=>{});
    if (data.phone) { try{saveMyAccount(data.phone, data.customerName); refreshAccountBtn();}catch(e){} }
    await bumpCouponUse(ord.coupon);
    return { ok:true, local:true, ord };
  };
  const finishOrder = async (data) => {
    const cloud = await placeOrderCloud(data);
    if (cloud && cloud.ok && cloud.order) {
      // RPC already saved orders/products/settings/customers + cut stock
      const ord = { ...cloud.order };
      if (data.paymentScreenshot) ord.paymentScreenshot = data.paymentScreenshot;
      await appendOrderFresh(ord);
      await saveOrders().catch(()=>{});
      await refreshProductsCloud().catch(()=>{});
      if (data.phone) { try{saveMyAccount(data.phone, data.customerName); refreshAccountBtn();}catch(e){} }
      registerCustomer(data).catch(()=>{});
      try { renderStoreGrid(); renderCartBadge(); } catch(e){}
      return { ok:true, local:false, ord };
    }
    if (cloud && cloud.ok === false && cloud.error) {
      return { ok:false, rpcError: cloud.error, local:false, ord:null };
    }
    return finishLocalOrder(data);
  };
  document.getElementById('confirmOrderBtn').addEventListener('click', async () => {
    if (window.__blocked) { showToast(t('blockedMsg'), 'error'); return; }
    const data = await collect();
    if (!data.customerName || !data.address) { showToast(t('fillAll'), 'error'); return; }
    const np1 = normPhone(data.phone);
    if (np1 && np1.length < 10) { showToast(t('accInvalidPhone'), 'error'); return; }
    if (data.payment !== 'cod' && (!data.paymentReference || !data.paymentScreenshot)) { showToast('For bKash/Nagad payment, transaction ID and screenshot are required.', 'error'); return; }
    if (window._orderLock) { showToast(t('orderProcessing'), 'error'); return; }
    window._orderLock = true;
    try { document.getElementById('confirmOrderBtn').disabled = true; document.getElementById('waOrderBtn').disabled = true; } catch(e){}
    const _st = await stockOkForCart();
    if (!_st.ok) { showToast(_st.name + ' — ' + t('stockLow', { s: formatBn(_st.have) }), 'error'); window._orderLock = false; try { document.getElementById('confirmOrderBtn').disabled = false; document.getElementById('waOrderBtn').disabled = false; } catch(e){} try { renderStoreGrid(); } catch(e){} return; }
    const res = await finishOrder(data);
    if (!res.ok) {
      window._orderLock = false;
      try { document.getElementById('confirmOrderBtn').disabled = false; document.getElementById('waOrderBtn').disabled = false; } catch(e){}
      if (res.rpcError === 'out_of_stock') showToast(t('stockLow', { s: '0' }), 'error');
      else if (res.rpcError === 'blocked') showToast(t('blockedMsg'), 'error');
      else if (res.rpcError) showToast(t('orderProcessing') + ' — ' + res.rpcError, 'error');
      return;
    }
    const ord = res.ord;
    if (data.phone) { try{saveMyAccount(data.phone, data.customerName); refreshAccountBtn();}catch(e){} }
    cart = []; appliedCoupon = null;
    saveCart().catch(()=>{}); saveCoupon().catch(()=>{});
    showToast(t('orderPlaced') + (orderNoText(ord) ? ' — ' + orderNoText(ord) : ''), 'success'); orderSuccessUI();
    
    /* Send confirmation email via EmailJS (free 200/month) */
    sendOrderConfirmationEmail(ord, data).catch(()=>{});
    
    setTimeout(()=>{window._orderLock=false;},10000);
  });
  document.getElementById('waOrderBtn').addEventListener('click', async () => {
    if (window.__blocked) { showToast(t('blockedMsg'), 'error'); return; }
    const data = await collect();
    if (!data.customerName || !data.address) { showToast(t('fillAll'), 'error'); return; }
    const np2 = normPhone(data.phone);
    if (np2 && np2.length < 10) { showToast(t('accInvalidPhone'), 'error'); return; }
    if (data.payment !== 'cod' && (!data.paymentReference || !data.paymentScreenshot)) { showToast('For bKash/Nagad payment, transaction ID and screenshot are required.', 'error'); return; }
    if (window._orderLock) { showToast(t('orderProcessing'), 'error'); return; }
    window._orderLock = true;
    try { document.getElementById('confirmOrderBtn').disabled = true; document.getElementById('waOrderBtn').disabled = true; } catch(e){}
    const _st = await stockOkForCart();
    if (!_st.ok) { showToast(_st.name + ' — ' + t('stockLow', { s: formatBn(_st.have) }), 'error'); window._orderLock = false; try { document.getElementById('confirmOrderBtn').disabled = false; document.getElementById('waOrderBtn').disabled = false; } catch(e){} try { renderStoreGrid(); } catch(e){} return; }
    const res = await finishOrder(data);
    if (!res.ok) {
      window._orderLock = false;
      try { document.getElementById('confirmOrderBtn').disabled = false; document.getElementById('waOrderBtn').disabled = false; } catch(e){}
      if (res.rpcError === 'out_of_stock') showToast(t('stockLow', { s: '0' }), 'error');
      else if (res.rpcError === 'blocked') showToast(t('blockedMsg'), 'error');
      else if (res.rpcError) showToast(t('orderProcessing') + ' — ' + res.rpcError, 'error');
      return;
    }
    const ord = res.ord;
    if (data.phone) { try{saveMyAccount(data.phone, data.customerName); refreshAccountBtn();}catch(e){} }
    const shop = (settings.shopNamePrefix || storeSettings.shopNamePrefix || 'Dear IT ').trimEnd() + ' ' + (settings.shopNameSuffix || storeSettings.shopNameSuffix || 'BD');
    let msg = `*${currentLang === 'bn' ? 'নতুন অর্ডার' : 'New Order'} — ${shop}*\n\n👤 ${data.customerName}\n`;
    if (data.phone) msg += `📱 ${data.phone}\n`;
    msg += `📍 ${data.address}\n`;
    if (data.notes) msg += `📝 ${data.notes}\n`;
    const payLabels = { cod:'Cash on Delivery', bkash: currentLang === 'en' ? 'bKash' : 'বিকাশ', nagad: currentLang === 'en' ? 'Nagad' : 'নগদ' };
    msg += `💳 ${payLabels[data.payment] || data.payment}\n\n`;
    cart.forEach(i => { msg += `▪️ ${i.name}`; if (i.variant && i.variant.length > 0) msg += ` (${i.variant.map(v=>v.name+':'+v.value).join(', ')})`; msg += ` × ${i.qty} = ৳${i.price * i.qty}\n`; });
    msg += `\n🧾 ${t('orderNoLabel')}: ${orderNoText(ord)}\n${ord.paymentReference ? 'Payment transaction ID: ' + ord.paymentReference + '\n' : ''}\n${t('subtotal')}: ৳${ord.subtotal}\n`;
    if (ord.discount > 0) msg += `${t('discount')}: −৳${ord.discount}\n`;
    if (ord.deliveryCharge > 0) msg += `${t('deliveryCharge')}: ৳${ord.deliveryCharge}\n`;
    msg += `*${t('grandTotal')}: ৳${ord.total}*`;
    cart = []; appliedCoupon = null;
    saveCart().catch(()=>{}); saveCoupon().catch(()=>{});
    showToast(t('orderPlaced') + (orderNoText(ord) ? ' — ' + orderNoText(ord) : ''), 'success'); orderSuccessUI();
    setTimeout(()=>{window._orderLock=false;},10000);
    
    /* Send confirmation email via EmailJS (free 200/month) */
    sendOrderConfirmationEmail(ord, data).catch(()=>{});
    
    const waNum = (settings.whatsappNumber || '').replace(/\D/g, '');
    window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`, '_blank');
  });
}
function closeModal(){ document.getElementById('modalRoot').innerHTML = ''; try { renderBrand(); } catch(e){} }

window.addEventListener('storage', (e) => {
  if (!e.key) return;
  if (e.key === 'cart' || e.key === 'coupon') {
    try {
      if (e.key === 'cart') { const v = localStorage.getItem('cart'); cart = (v ? JSON.parse(v) : []) || []; try { renderCartBadge(); } catch(e){} }
      if (e.key === 'coupon') { const v = localStorage.getItem('coupon'); appliedCoupon = v ? JSON.parse(v) : null; }
    } catch(e){}
    return;
  }
  if (['products','settings','lang','messages','store_settings','orders','customers'].includes(e.key)) loadAllOnce();
});
function _stableStr(v){
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(_stableStr).join(',') + ']';
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + _stableStr(v[k])).join(',') + '}';
}
function dataSig(){
  try{
    const s = _stableStr([products, orders, messages, settings, storeSettings, appliedCoupon, currentLang]);
    let h = 5381; for (let i=0;i<s.length;i++){ h = ((h<<5)+h+s.charCodeAt(i))|0; }
    return h;
  }catch(e){ return Math.random(); }
}
/* PERFORMANCE FIX: the old version of this fetched products + settings +
   store_settings *in full* every 3 seconds purely to compare them — that meant
   re-downloading every base64 product photo, on every open tab, for every
   visitor, all day (and it is what made the site feel slow on mobile data).
   Now only the tiny updated_at stamps are fetched; the full data is pulled
   only when a stamp actually changed. */
let __snapBusy = false;
async function snapshotKey(){
  try {
    if (window.storage && window.storage.headMany) {
      const h = await window.storage.headMany(['products', 'settings', 'store_settings']);
      if (h && Object.keys(h).some(k => h[k])) {
        return Object.keys(h).sort().map(k => k + '=' + h[k]).join('|');
      }
    }
  } catch(e){}
  const [p, s, ss] = await Promise.all([window.storage.get('products'), window.storage.get('settings'), window.storage.get('store_settings')]);
  return (p && p.value || '') + '|' + (s && s.value || '') + '|' + (ss && ss.value || '');
}
async function loadAllOnce(){
  if (window.__loadingAll) return false;
  window.__loadingAll = true;
  try { await loadAll(); return true; } finally { window.__loadingAll = false; }
}
async function syncTick(){
  if (__snapBusy) return;                                    /* never stack rounds on a slow link */
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;  /* nothing to update in a background tab */
  __snapBusy = true;
  try {
    const curr = await snapshotKey();
    if (curr !== window.__lastData) {
      const ok = await loadAllOnce();
      if (ok) window.__lastData = await snapshotKey();
    }
  } catch(e){} finally { __snapBusy = false; }
}
window.__syncTimer = setInterval(syncTick, 8000);
/* the moment the visitor comes back to the tab, catch up immediately instead
   of waiting for the next tick */
try { document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncTick(); }); } catch(e){}

function getMyAccount(){ try { const v = localStorage.getItem('myAccount'); return v ? JSON.parse(v) : null; } catch(e){ return null; } }
function saveMyAccount(phone, name){
  try {
    const prev = getMyAccount() || {};
    const acc = { phone: phone || prev.phone || '', name: name || prev.name || '', norm: normPhone(phone || prev.phone || '') };
    if (!acc.norm) return null;
    localStorage.setItem('myAccount', JSON.stringify(acc));
    try{localStorage.setItem('myPhone', acc.phone);}catch(e){}
    return acc;
  } catch(e){ return null; }
}
function refreshAccountBtn(){
  const b = document.getElementById('accountBtn'); if (!b) return;
  const acc = getMyAccount();
  if (acc && acc.norm) {
    b.innerHTML = '<span class="acc-initial">' + escapeHtml(firstLetter(acc.name || acc.phone)) + '</span>';
    b.classList.add('logged');
  } else {
    b.innerHTML = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
    b.classList.remove('logged');
  }
}
async function doAccountLogin(){
  const raw = (document.getElementById('accPhone').value || '').trim();
  const nm = (document.getElementById('accNameInput').value || '').trim();
  const ph = normPhone(raw);
  if (!ph || ph.length < 10) { showToast(t('accInvalidPhone'), 'error'); return; }
  saveMyAccount(raw, nm);
  registerCustomer({ phone: raw, customerName: nm, address: '' }).catch(()=>{});
  syncMyPresence().catch(()=>{});
  refreshAccountBtn();
  if (window._pendingAdd) { try { const _pa = window._pendingAdd; window._pendingAdd = null; const _pp = products.find(p => String(p.id) === String(_pa.id)); if (_pp) await addToCart(_pp, _pa.variant, _pa.qty); } catch(e){} }
  showToast(t('accSaved'), 'success');
  if (window._afterLogin === 'cart') { window._afterLogin = null; openCart(); }
  else if (window._afterLogin === 'chat') { window._afterLogin = null; closeModal(); try { cornerOpen('msgs'); renderChat(false); } catch(e){} }
  else openAccount();
}
async function openAccount(){
  const root = document.getElementById('modalRoot');
  const acc = getMyAccount();
  if (!acc || !acc.norm) {
    root.innerHTML = `<div class="modal-overlay" onclick="if(event.target===this) closeModal()"><div class="modal-sheet" style="max-width:420px;">`
      + `<button class="modal-close" onclick="closeModal()">✕</button>`
      + `<h2><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg> ${t('myAccount')}</h2>`
      + `<p class="sub">${t('accSub')}</p>`
      + (window._afterLogin === 'cart' ? `<div class="acc-notice">${t('accNeedReg')}</div>` : '')
      + `<div class="field"><label>${t('phone')}</label><input type="text" id="accPhone" placeholder="${t('phonePh')}"></div>`
      + `<div class="field"><label>${t('accName')}</label><input type="text" id="accNameInput" placeholder="${t('accNamePh')}"></div>`
      + `<button class="primary-btn" id="accLoginBtn" style="width:100%;margin-top:10px;">${t('accLoginBtn')}</button></div></div>`;
    document.getElementById('accLoginBtn').addEventListener('click', doAccountLogin);
    document.getElementById('accPhone').addEventListener('keydown', e => { if (e.key === 'Enter') doAccountLogin(); });
    return;
  }
  try { const _o = await window.storage.get(KEYS.orders); if (_o && _o.value) { const _ol = JSON.parse(_o.value); if (Array.isArray(_ol)) orders = _ol; } } catch(e){}
  const mine = orders.filter(o => normPhone(o.phone) === acc.norm).reverse();
  const sl = { pending:t('statusPending'), confirmed:t('statusConfirmed'), shipped:t('statusShipped'), delivered:t('statusDelivered'), cancelled:t('statusCancelled') };
  const itemsHtml = mine.length === 0
    ? `<div class="empty-state" style="padding:16px;"><i>${t('accNoOrders')}</i></div>`
    : mine.map(o => `<div class="track-item"><div class="head"><span>${orderNoText(o) ? t('orderNoLabel') + ' ' + orderNoText(o) + ' · ' : ''}${formatDate(o.time)}</span><span class="status-badge ${o.status || 'pending'}">${sl[o.status] || o.status}</span>${serialChipHtml(o)}</div>`
      + `<div>${(o.items || []).map(i => escapeHtml(i.name) + ' × ' + i.qty).join(', ')}</div>${deliveryEstimateHtml(o)}${parcelNoteHtml(o)}${statusUpdatedHtml(o)}`
      + `<div style="margin-top:4px;"><b>৳${formatBn(o.total)}</b></div>`
      + (o.status === 'pending' ? `<div style="margin-top:8px;"><button class="ghost-btn" style="color:var(--danger);border-color:var(--danger);" onclick="cancelMyOrder('${o.id}')">${t('cancelOrder')}</button></div>` : '')
      + `</div>`).join('');
  root.innerHTML = `<div class="modal-overlay" onclick="if(event.target===this) closeModal()"><div class="modal-sheet" style="max-width:520px;">`
    + `<button class="modal-close" onclick="closeModal()">✕</button>`
    + `<div class="acc-head"><div class="acc-avatar">${escapeHtml(firstLetter(acc.name || acc.phone))}</div>`
    + `<div style="flex:1;min-width:0;"><div style="font-weight:800;font-size:16px;">${escapeHtml(acc.name || t('myAccount'))}</div>`
    + `<div style="color:var(--ink-soft);font-size:13.5px;">${escapeHtml(acc.phone)}</div></div>`
    + `<button class="ghost-btn" id="accLogoutBtn">${t('accLogout')}</button></div>`
    + `<div class="acc-orders-title">${t('accMyOrders')} (${formatBn(mine.length)})</div>`
    + `<div id="accOrders">${itemsHtml}</div></div></div>`;
  document.getElementById('accLogoutBtn').addEventListener('click', () => { try{localStorage.removeItem('myAccount');}catch(e){} refreshAccountBtn(); closeModal(); showToast(t('accLoggedOut'), 'success'); });
}
document.getElementById('accountBtn').addEventListener('click', openAccount);
try{refreshAccountBtn();}catch(e){}
function switchCornerTab(name){
  document.querySelectorAll('.cp-tabs button[data-ct]').forEach(b => b.classList.toggle('on', b.dataset.ct === name));
  const _po = document.getElementById('ctab-orders'), _pm = document.getElementById('ctab-msgs');
  if (_po) _po.classList.toggle('on', name === 'orders');
  if (_pm) _pm.classList.toggle('on', name === 'msgs');
  if (name === 'msgs') { try { renderChat(false); chatPoll(); } catch(e){} }
}
function cornerClose(){
  const cp = document.getElementById('cornerPanel');
  if (cp && !cp.classList.contains('hidden')) {
    cp.classList.add('hidden');
    if (window._cornerPushed) { window._cornerPushed = false; popSafeBack(); }
  }
}
function cornerOpen(tab){
  const cp = document.getElementById('cornerPanel');
  if (!cp) return;
  const was = cp.classList.contains('hidden');
  cp.classList.remove('hidden');
  if (was && !window._cornerPushed) { window._cornerPushed = true; try { history.pushState({ __ov: 'corner' }, ''); } catch(e){} }
  if (tab) switchCornerTab(tab);
  if (tab === 'orders') { const i = document.getElementById('trackNo'); if (i) setTimeout(() => { try{i.focus();} catch(e){} }, 60); }
  if (tab === 'msgs') { try { renderChat(false); chatPoll(); } catch(e){} }
  try { if (document.getElementById('ctab-msgs').classList.contains('on')) { chatPoll(); renderChat(true); } } catch(e){}
}
function openCornerWidget(tab){ cornerOpen(tab); }
document.getElementById('cornerFab').addEventListener('click', () => { const cp = document.getElementById('cornerPanel'); if (cp.classList.contains('hidden')) cornerOpen(); else cornerClose(); });
document.getElementById('cornerX').addEventListener('click', cornerClose);
document.querySelectorAll('.cp-tabs button[data-ct]').forEach(b => b.addEventListener('click', () => switchCornerTab(b.dataset.ct)));
try {
  const _po = document.getElementById('ctab-orders'), _b1 = document.getElementById('trackBox');
  if (_po && _b1) _po.appendChild(_b1);
} catch(e){}
(function outsideClickClose(){
  let opened = 0;
  document.addEventListener('click', (e) => {
    if (Date.now() - opened < 300) return;
    const fab = document.getElementById('cornerFab');
    const cp = document.getElementById('cornerPanel');
    if (cp && !cp.classList.contains('hidden') && !cp.contains(e.target) && (!fab || !fab.contains(e.target))) cornerClose();
    const sp = document.getElementById('searchPage');
    if (sp && !sp.classList.contains('hidden') && !sp.contains(e.target)) spClose();
  }, true);
  const _poo = cornerOpen, _spo = spOpen;
  cornerOpen = function(tab){ opened = Date.now(); return _poo(tab); };
  spOpen = function(from){ opened = Date.now(); return _spo(from); };
})();

/* ===== ROUND-20: full-screen search page =====
   সার্চ বাক্সে চাপ দিলেই দারাজের মতো একটা পেজ খোলে:
     • Search History — এই ফোনে যা সার্চ করা হয়েছে, একটা একটা করে মুছুন বা "সব মুছুন"
     • টাইপ করার সাথে সাথে সাজেশন — keyword + পণ্য (ছবি ও দাম সহ)
     • "আপনি কি খুঁজছেন" — বানান ভুল হলে কাছাকাছি শব্দের সাজেশন
     • সাজেশনে চাপ দিলেই সার্চ হয়ে গ্রিডে নেমে যায় */
const SP_HIST_KEY = 'searchHistory';
const SP_DISC_KEY = 'spHideDiscovery';
const SP_MAX_HIST = 12;
let spHistoryCache = null;
let spKeywordCache = null, spKeywordSig = '';

function spLoadHistory(){
  if (spHistoryCache) return spHistoryCache;
  try {
    const raw = localStorage.getItem(SP_HIST_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    spHistoryCache = Array.isArray(arr) ? arr.filter(x => typeof x === 'string' && x.trim()).slice(0, SP_MAX_HIST) : [];
  } catch(e){ spHistoryCache = []; }
  return spHistoryCache;
}
function spSaveHistory(){ try { localStorage.setItem(SP_HIST_KEY, JSON.stringify(spHistoryCache || [])); } catch(e){} }
function spAddHistory(q){
  q = String(q || '').trim(); if (!q) return;
  spHistoryCache = [q, ...spLoadHistory().filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, SP_MAX_HIST);
  spSaveHistory();
}
function spRemoveHistory(q){
  spHistoryCache = spLoadHistory().filter(x => x !== q);
  spSaveHistory(); spRenderSearchBody();
}
function spClearHistory(){
  spHistoryCache = []; spSaveHistory(); spRenderSearchBody();
  showToast(t('historyCleared'), 'success');
}
function spDiscoveryHidden(){ try { return localStorage.getItem(SP_DISC_KEY) === '1'; } catch(e){ return false; } }
function spToggleDiscovery(){ try { localStorage.setItem(SP_DISC_KEY, spDiscoveryHidden() ? '0' : '1'); } catch(e){} spRenderSearchBody(); }

/* যা যা খোঁজা যায়: পণ্যের নাম, ক্যাটাগরি, ট্যাগ + আগের সার্চগুলো */
function spKeywordIndex(){
  const sig = products.length + ':' + (products[0] ? products[0].id : '') + ':' + ((products[products.length-1] || {}).id || '') + ':' + spLoadHistory().length;
  if (spKeywordCache && sig === spKeywordSig) return spKeywordCache;
  const set = new Set();
  products.forEach(p => {
    if (p && p.name) set.add(p.name);
    if (p && p.category) set.add(p.category);
    ((p && p.tags) || []).forEach(x => { if (x) set.add(x); });
  });
  spLoadHistory().forEach(x => set.add(x));
  spKeywordCache = Array.from(set); spKeywordSig = sig;
  return spKeywordCache;
}
function spKeywordMatches(q, limit){
  const ql = String(q || '').toLowerCase();
  if (!ql) return [];
  const hist = spLoadHistory().filter(h => h.toLowerCase().includes(ql));
  const starts = [], contains = [];
  spKeywordIndex().forEach(k => {
    const kl = k.toLowerCase();
    if (kl === ql) return;
    if (kl.startsWith(ql)) starts.push(k);
    else if (kl.includes(ql)) contains.push(k);
  });
  starts.sort((a,b) => a.length - b.length);
  contains.sort((a,b) => a.length - b.length);
  const seen = new Set(), out = [];
  [...hist, ...starts, ...contains].forEach(k => {
    const kl = k.toLowerCase();
    if (seen.has(kl)) return;
    seen.add(kl); out.push(k);
  });
  return out.slice(0, limit || 8);
}
/* পণ্য মেলানো: একাধিক শব্দ লিখলে সব শব্দ মিলতেই হবে (আগের সার্চের চেয়ে ভালো) */
function spProductMatches(q, limit){
  const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const out = products.filter(p => {
    if (!p) return false;
    const hay = [p.name, p.productCode, p.sku, p.category, p.desc, ...((p.tags || []))].filter(Boolean).join(' ').toLowerCase();
    return words.every(w => hay.includes(w));
  });
  out.sort((a,b) => ((b.featured ? 1 : 0) - (a.featured ? 1 : 0)) || ((b.createdAt || 0) - (a.createdAt || 0)));
  return out.slice(0, limit || 6);
}
function spLevenshtein(a, b){
  a = String(a); b = String(b);
  if (a === b) return 0;
  const al = a.length, bl = b.length;
  if (!al) return bl; if (!bl) return al;
  let prev = new Array(bl + 1), cur = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;
  for (let i = 1; i <= al; i++) {
    cur[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= bl; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    const t2 = prev; prev = cur; cur = t2;
  }
  return prev[bl];
}
/* বানান ভুল হলে কাছাকাছি শব্দ খোঁজা ("tshirt" -> "t-shirt") */
function spSpellSuggest(q){
  const ql = String(q || '').trim().toLowerCase();
  if (ql.length < 3) return null;
  const maxD = ql.length <= 4 ? 1 : (ql.length <= 7 ? 2 : 3);
  let best = null, bestD = Infinity;
  const words = ql.split(/\s+/).filter(Boolean);
  for (const k of spKeywordIndex()) {
    const kl = k.toLowerCase();
    if (kl === ql || kl.includes(ql)) continue;                 /* এটা তো মিলেই গেছে */
    if (Math.abs(kl.length - ql.length) > maxD + 2) continue;
    if (ql.length > 4 && kl.charAt(0) !== ql.charAt(0)) continue;
    const d = spLevenshtein(ql, kl);
    if (d < bestD) { bestD = d; best = k; }
  }
  /* এক শব্দেই না মিললে শব্দ ধরে ধরে দেখি (jersey tshrt -> jersey t shirt) */
  if (!best && words.length > 1) {
    const fixed = words.map(w => {
      if (w.length < 3) return w;
      let bw = null, bd = Infinity;
      for (const k of spKeywordIndex()) {
        const kl = k.toLowerCase();
        if (kl.includes(w) || w.includes(kl)) continue;
        if (Math.abs(kl.length - w.length) > 2 || kl.charAt(0) !== w.charAt(0)) continue;
        const d = spLevenshtein(w, kl);
        if (d < bd) { bd = d; bw = kl; }
      }
      return (bw && bd <= 2) ? bw : w;
    });
    const joined = fixed.join(' ');
    if (joined !== ql && spProductMatches(joined, 1).length) return joined;
  }
  return (best && bestD <= maxD) ? best : null;
}
function spHighlight(text, q){
  const str = String(text == null ? '' : text);
  const needle = String(q || '');
  if (!needle) return escapeHtml(str);
  const i = str.toLowerCase().indexOf(needle.toLowerCase());
  if (i < 0) return escapeHtml(str);
  return escapeHtml(str.slice(0, i)) + '<b>' + escapeHtml(str.slice(i, i + needle.length)) + '</b>' + escapeHtml(str.slice(i + needle.length));
}
function spTrendTerms(){
  const out = [];
  const push = (x) => {
    const s = String(x || '').trim();
    if (!s || s.length > 40) return;
    if (out.some(y => y.toLowerCase() === s.toLowerCase())) return;
    out.push(s);
  };
  spLoadHistory().forEach(push);
  products.forEach(p => { if (p) { push(p.category); ((p.tags) || []).forEach(push); } });
  return out.slice(0, 8);
}
function spDiscoveryTerms(){
  const out = [];
  const push = (x) => {
    const s = String(x || '').trim();
    if (!s || s.length > 40) return;
    if (out.some(y => y.toLowerCase() === s.toLowerCase())) return;
    out.push(s);
  };
  products.forEach(p => { if (p) { ((p.tags) || []).forEach(push); push(p.category); } });
  spLoadHistory().forEach(push);
  return out.slice(0, 12);
}
function spProductRow(p){
  const price = (p.salePrice > 0) ? p.salePrice : p.price;
  const old = (p.salePrice > 0) ? `<small>৳${formatBn(p.price)}</small>` : '';
  const img = (p.images && p.images[0]) ? `<img src="${escapeHtml(p.images[0])}" alt="" loading="lazy">` : icFallback();
  const stock = (!p.inStock || p.stockQty <= 0)
    ? `<span style="color:var(--danger);font-weight:700;"> · ${escapeHtml(t('outOfStock'))}</span>`
    : (typeof p.stockQty === 'number' ? `<span style="color:var(--green-dark);font-weight:700;"> · ${escapeHtml(t('stockLabel'))}: ${formatBn(p.stockQty)}</span>` : '');
  return `<div class="sp-row" data-act="prod" data-id="${escapeHtml(p.id)}">
      <div class="sp-thumb">${img}</div>
      <div class="sp-pinfo"><div class="sp-pname">${escapeHtml(p.name)}</div><div class="sp-pprice">৳${formatBn(price)}${old}${stock}</div></div>
      ${ICONS.arrowR}
    </div>`;
}
function spHistoryHtml(){
  const hist = spLoadHistory();
  if (!hist.length) return '';
  return `<div class="sp-sec">
      <div class="sp-sec-head">
        <h3>${escapeHtml(t('searchHistoryLabel'))}</h3>
        <button type="button" class="act" data-act="clearhist">${escapeHtml(t('clearAllLabel'))} ${ICONS.trashSm}</button>
      </div>
      <div class="sp-chips">
        ${hist.map(h => `<span class="sp-chip has-x" data-act="hist" data-q="${escapeHtml(h)}"><span>${escapeHtml(h)}</span><button type="button" class="x" data-act="delhist" data-q="${escapeHtml(h)}" aria-label="${escapeHtml(t('deleteOneLabel'))}">✕</button></span>`).join('')}
      </div>
    </div>`;
}
function spDiscoveryHtml(){
  if (spDiscoveryHidden()) {
    return `<div class="sp-sec"><div class="sp-sec-head"><h3>${escapeHtml(t('searchDiscoveryLabel'))}</h3><button type="button" class="act" data-act="toggledisc">${escapeHtml(t('showLabel'))} ${ICONS.eyeOff}</button></div></div>`;
  }
  const terms = spDiscoveryTerms();
  if (!terms.length) return '';
  return `<div class="sp-sec">
      <div class="sp-sec-head">
        <h3>${escapeHtml(t('searchDiscoveryLabel'))}</h3>
        <button type="button" class="act" data-act="toggledisc">${escapeHtml(t('hideLabel'))} ${ICONS.eyeOff}</button>
      </div>
      <div class="sp-chips">
        ${terms.map(k => `<span class="sp-chip" data-act="kw" data-q="${escapeHtml(k)}"><span>${escapeHtml(k)}</span></span>`).join('')}
      </div>
    </div>`;
}
function spSuggestHtml(q){
  const kws = spKeywordMatches(q, 8);
  const prods = spProductMatches(q, 6);
  const spell = prods.length ? null : spSpellSuggest(q);
  const altProds = spell ? spProductMatches(spell, 6) : [];
  let html = '';
  if (spell && altProds.length) {
    html += `<div class="sp-didyou" data-act="kw" data-q="${escapeHtml(spell)}">${ICONS.spark}<div>${escapeHtml(t('didYouMean'))}: <b>${escapeHtml(spell)}</b></div></div>`;
  }
  if (kws.length) {
    html += `<div class="sp-sec"><div class="sp-sec-head"><h3>${escapeHtml(t('suggestionLabel'))}</h3></div>
      ${kws.map(k => `<div class="sp-row" data-act="kw" data-q="${escapeHtml(k)}">${ICONS.searchSm}<div class="txt">${spHighlight(k, q)}</div></div>`).join('')}</div>`;
  }
  const showProds = prods.length ? prods : altProds;
  if (showProds.length) {
    html += `<div class="sp-sec"><div class="sp-sec-head"><h3>${escapeHtml(t('suggestionProducts'))} (${formatBn(showProds.length)})</h3></div>
      ${showProds.map(spProductRow).join('')}</div>`;
  }
  if (!html) html = `<div class="sp-empty">${escapeHtml(t('noSuggestion'))}</div>`;
  return html;
}
function spRenderSearchBody(){
  const body = document.getElementById('spBody'); if (!body) return;
  const inp = document.getElementById('spInput');
  const q = inp ? String(inp.value || '').trim() : '';
  const clr = document.getElementById('spClearInput');
  if (clr) clr.classList.toggle('hidden', !q);
  body.innerHTML = q ? spSuggestHtml(q) : (spHistoryHtml() + spDiscoveryHtml());
}
function spRenderTrend(){
  const el = document.getElementById('spTrend'); if (!el) return;
  const terms = spTrendTerms();
  if (!terms.length) { el.innerHTML = ''; el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.innerHTML = terms.map(k => `<a href="#" data-act="kw" data-q="${escapeHtml(k)}">${escapeHtml(k)}</a>`).join('');
}
function spCommit(q){
  if (q === undefined || q === null) q = (document.getElementById('spInput') || {}).value || '';
  q = String(q).trim();
  if (q) spAddHistory(q);
  const main = document.getElementById('searchInput');
  if (main) main.value = q;
  try { currentCategory = 'all'; if (typeof renderCategoryChips === 'function') renderCategoryChips(); } catch(e){}
  try { renderStoreGrid(); } catch(e){}
  spClose(false);
  try { const g = document.getElementById('productGrid'); if (g) g.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch(e){}
}
function spOpenProduct(id){
  const prod = products.find(p => p && String(p.id) === String(id));
  if (!prod) { showToast(t('noSearchResults'), 'error'); return; }
  spHidePanel();                                  /* history অক্ষত রেখে প্যানেল লুকাই */
  window.__spReopen = true;                       /* পপআপ বন্ধ হলে সার্চ পেজ আবার আসবে */
  setTimeout(() => { try { openGalleryModal(prod.id); } catch(e){} }, 60);
}
function spOpen(){
  const page = document.getElementById('searchPage'); if (!page) return;
  if (!page.classList.contains('hidden')) return;
  spLoadHistory();
  spRenderTrend();
  const inp = document.getElementById('spInput');
  const main = document.getElementById('searchInput');
  if (inp) inp.value = main ? (main.value || '') : '';
  spRenderSearchBody();
  page.classList.remove('hidden');
  page.setAttribute('aria-hidden', 'false');
  try { document.body.classList.add('lb-lock'); } catch(e){}
  if (!window._spPushed) { window._spPushed = true; try { history.pushState({ __ov: 'search' }, ''); } catch(e){} }
  if (inp) setTimeout(() => { try { inp.focus(); } catch(e){} }, 40);
}
function spHidePanel(){
  const page = document.getElementById('searchPage'); if (!page) return;
  page.classList.add('hidden');
  page.setAttribute('aria-hidden', 'true');
  try { document.body.classList.remove('lb-lock'); } catch(e){}
}
function spClose(fromBack){
  const page = document.getElementById('searchPage'); if (!page) return;
  if (page.classList.contains('hidden')) return;
  spHidePanel();
  if (!fromBack && window._spPushed) { window._spPushed = false; popSafeBack(); }
}
window.__backExtra = function(){
  const page = document.getElementById('searchPage');
  if (page && !page.classList.contains('hidden')) { window._spPushed = false; spClose(true); return true; }
  /* FIX: সার্চ → পণ্য দেখা → মোডাল বন্ধ → সার্চ-pushed state টা থেকে যায়।
     তার পর আরেকবার পিছাইলে আগে সত্যিকারের "ট্যাব ব্যাক" (আগের পেজ) হয়ে যেত।
     এখন সেটা ধরে সার্চ পেজ আবার খুলে দেয় — পিছিয়ে যাওয়া আর আসল পেজে গড়ায় না। */
  if (page && window._spPushed && page.classList.contains('hidden')) { spOpen(); return true; }
  return false;
};
(function spWire(){
  const page = document.getElementById('searchPage'); if (!page) return;
  page.addEventListener('click', (e) => {
    const el = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el || !page.contains(el)) return;
    const act = el.dataset.act, q = el.dataset.q || '';
    if (act === 'kw' || act === 'hist') { e.preventDefault(); spCommit(q); }
    else if (act === 'delhist') { e.preventDefault(); e.stopPropagation(); spRemoveHistory(q); }
    else if (act === 'clearhist') { e.preventDefault(); spClearHistory(); }
    else if (act === 'toggledisc') { e.preventDefault(); spToggleDiscovery(); }
    else if (act === 'prod') { e.preventDefault(); spOpenProduct(el.dataset.id); }
  });
  const inp = document.getElementById('spInput');
  if (inp) {
    inp.addEventListener('input', spRenderSearchBody);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); spCommit(); } });
  }
  const go = document.getElementById('spGo');
  if (go) go.addEventListener('click', () => spCommit());
  const back = document.getElementById('spBack');
  if (back) back.addEventListener('click', () => spClose(false));
  const clr = document.getElementById('spClearInput');
  if (clr) clr.addEventListener('click', () => { if (inp) { inp.value = ''; spRenderSearchBody(); inp.focus(); } });
})();

/* Bangladesh phone fields: keep the +880 prefix fixed — everywhere EXCEPT tracking inputs. */
(function wireFixedBdPhones(){
  const isPhone = (el) => el && el.tagName === 'INPUT' && (el.type === 'tel' || /phone|mobile|whatsapp/i.test((el.id || '') + ' ' + (el.name || ''))) && !/track/i.test((el.id || '') + ' ' + (el.name || ''));
  const ensure = (el) => {
    if (!isPhone(el)) return;
    el.type = 'tel'; el.inputMode = 'tel'; el.dataset.bdPrefix = '1';
    let v = String(el.value || '');
    if (!v.trim()) return;
    if (!v.startsWith('+880 ')) {
      const digits = v.replace(/^\+?880\s*/, '').replace(/\D/g, '').replace(/^0+/, '');
      el.value = '+880 ' + digits;
    } else {
      const rest = v.slice(5).replace(/\D/g, '').replace(/^0+/, '');
      el.value = '+880 ' + rest;
    }
  };
  const scan = () => document.querySelectorAll('input').forEach(ensure);
  document.addEventListener('focusin', e => ensure(e.target), true);
  document.addEventListener('input', e => { if (!isPhone(e.target)) return; const el=e.target; ensure(el); }, true);
  document.addEventListener('keydown', e => {
    const el=e.target; if (!isPhone(el)) return;
    const start=el.selectionStart || 0, end=el.selectionEnd || start;
    if ((e.key === 'Backspace' && start <= 5) || (e.key === 'Delete' && start < 5)) e.preventDefault();
    if ((e.key === '0' || e.key === '০') && String(el.value || '').startsWith('+880 ') && start === end && start === 5) e.preventDefault();
  }, true);
  scan();
  new MutationObserver(scan).observe(document.body, {childList:true, subtree:true});
})();

/* ===== EmailJS Integration for Order Confirmation (Free 200 emails/month) =====
   Setup: 
   1. Go to https://www.emailjs.com/ → Sign up free
   2. Create Email Service (Gmail/Outlook/SMTP)
   3. Create Email Template with variables: {{to_name}}, {{to_email}}, {{order_no}}, {{serial_no}}, {{items}}, {{total}}, {{address}}, {{payment}}, {{shop_name}}
   4. Get Public Key, Service ID, Template ID
   5. Add to env.js or set directly below
*/
const EMAILJS_CONFIG = {
  publicKey: 'YOUR_PUBLIC_KEY',      // Replace with your EmailJS Public Key
  serviceId: 'YOUR_SERVICE_ID',      // Replace with your EmailJS Service ID
  templateId: 'YOUR_TEMPLATE_ID'     // Replace with your EmailJS Template ID
};

async function sendOrderConfirmationEmail(order, data) {
  if (!EMAILJS_CONFIG.publicKey || EMAILJS_CONFIG.publicKey === 'YOUR_PUBLIC_KEY') {
    console.log('EmailJS not configured - skipping email');
    return;
  }
  
  try {
    // Load EmailJS SDK dynamically
    if (!window.emailjs) {
      await loadScript('https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js');
      emailjs.init(EMAILJS_CONFIG.publicKey);
    }
    
    const itemsHtml = (order.items || []).map(item => 
      `${item.name}${item.variant ? ' (' + item.variant.map(v => v.name + ': ' + v.value).join(', ') + ')' : ''} × ${item.qty} = ৳${item.price * item.qty}`
    ).join('<br>');
    
    const templateParams = {
      to_name: data.customerName,
      to_email: data.phone ? data.phone + '@customer.local' : 'customer@local', // EmailJS requires email format
      order_no: orderNoText(order),
      serial_no: order.serialNo,
      items: itemsHtml,
      total: '৳' + formatBn(order.total),
      address: data.address,
      payment: data.payment === 'cod' ? 'Cash on Delivery' : (data.payment === 'bkash' ? 'bKash' : data.payment === 'nagad' ? 'Nagad' : data.payment),
      shop_name: (settings.shopNamePrefix || storeSettings.shopNamePrefix || 'Dear IT ').trimEnd() + ' ' + (settings.shopNameSuffix || storeSettings.shopNameSuffix || 'BD'),
      order_date: formatDate(order.time)
    };
    
    await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, templateParams);
    console.log('Order confirmation email sent');
  } catch (err) {
    console.error('EmailJS error:', err);
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

try{loadCacheFirst();}catch(e){}
try{openDeepLink();}catch(e){}
loadAllOnce().then(async () => { window.__lastData = await snapshotKey(); try{ if (new URLSearchParams(location.search).get('p') && !document.querySelector('#modalRoot .modal-sheet')) openDeepLink(); }catch(e){} });

