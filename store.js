// 存储层：优先 Supabase 云端实时同步，否则浏览器 localStorage
(function(){
  "use strict";
  var cfg = window.APP_CONFIG;
  var state = null;
  var sb = null;
  var listeners = [];
  var saveTimer = null;

  function loadSdk(){
    function inject(src, timeoutMs){
      return new Promise(function(resolve){
        var s = document.createElement("script");
        s.src = src;
        s.async = true;
        var done = false;
        function finish(ok){ if (done) return; done = true; resolve(ok); }
        var t = setTimeout(function(){ finish(false); }, timeoutMs);
        s.onload = function(){ clearTimeout(t); finish(!!(window.supabase && window.supabase.createClient)); };
        s.onerror = function(){ clearTimeout(t); finish(false); };
        document.head.appendChild(s);
      });
    }
    if (window.supabase && window.supabase.createClient) return Promise.resolve(true);
    // 先加载本地打包好的 SDK（国内也能用），失败再退回 CDN
    return inject("assets/supabase.min.js", 8000).then(function(ok){
      if (ok) return true;
      return inject("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js", 8000);
    });
  }

  async function initSupabase(){
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return;
    var ok = await loadSdk();
    if (!ok) return;
    try { sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey); }
    catch(e){ sb = null; }
  }
  function isCloud(){ return !!sb; }

  function loadLocal(){
    try {
      var raw = localStorage.getItem("trip:" + cfg.tripId);
      return raw ? JSON.parse(raw) : null;
    } catch(e){ return null; }
  }
  function saveLocal(s){
    try { localStorage.setItem("trip:" + cfg.tripId, JSON.stringify(s)); return true; }
    catch(e){ console.warn("本地存储写入失败（可能空间满了）", e); return false; }
  }
  function emit(){ listeners.forEach(function(fn){ try{ fn(state); }catch(e){} }); }

  function normalize(s){
    var base = defaultState();
    if (!s) return base;
    s.trip = Object.assign({}, base.trip, s.trip || {});
    ["days","places","flights","reminders","checklist","expenses"].forEach(function(k){
      if (!Array.isArray(s[k])) s[k] = base[k];
    });
    s.places.forEach(function(p){
      if (typeof p.photo !== "string") p.photo = "";
    });
    return s;
  }

  async function upsertRemote(s){
    if (!sb) return;
    try {
      await sb.from("trips").upsert({ id: cfg.tripId, data: s, updated_at: new Date().toISOString() });
    } catch(e){ console.warn("云端同步失败", e); }
  }

  async function load(){
    var local = loadLocal();
    if (sb){
      try {
        var res = await sb.from("trips").select("*").eq("id", cfg.tripId).maybeSingle();
        if (res && res.data && res.data.data){
          state = normalize(res.data.data);
        } else if (local){
          state = normalize(local);
          await upsertRemote(state);
        } else {
          state = defaultState();
          await upsertRemote(state);
        }
        saveLocal(state);
        sb.channel("trip-" + cfg.tripId)
          .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, function(payload){
            if (payload.new && payload.new.id === cfg.tripId && payload.new.data){
              state = normalize(payload.new.data);
              saveLocal(state);
              emit();
            }
          })
          .subscribe();
      } catch(e){
        console.warn("云端不可用，退回本地模式", e);
        sb = null;
        state = normalize(local);
        saveLocal(state);
      }
    } else {
      state = normalize(local);
      saveLocal(state);
    }
    emit();
  }

  function update(mutator){
    mutator(state);
    state.trip.updatedAt = new Date().toISOString();
    var ok = saveLocal(state);
    emit();
    if (sb){
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function(){ upsertRemote(state); }, 400);
    }
    return ok;
  }

  function getState(){ return state; }
  function subscribe(fn){ listeners.push(fn); }

  window.Store = { initSupabase: initSupabase, isCloud: isCloud, load: load, update: update, getState: getState, subscribe: subscribe };
})();
