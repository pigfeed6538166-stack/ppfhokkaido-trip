// 存储层：GitHub 仓库（国内可用） > LeanCloud > Supabase > 本地
(function(){
  "use strict";
  var cfg = window.APP_CONFIG;
  var state = null;
  var listeners = [];
  var saveTimer = null;
  var active = "local";              // local | github | leancloud | supabase
  var ghOk = false, lcOk = false, sbOk = false;

  // GitHub
  var ghSha = null, ghTimer = null, ghPushing = false, ghTriedPhotos = {};
  // LeanCloud
  var AV = null, lcObj = null, lcSubscribed = false;
  // Supabase
  var sb = null, subscribed = false;

  /* ---------------- 基础 ---------------- */
  function loadLocal(){
    try { var raw = localStorage.getItem("trip:" + cfg.tripId); return raw ? JSON.parse(raw) : null; }
    catch(e){ return null; }
  }
  function saveLocal(s){
    try { localStorage.setItem("trip:" + cfg.tripId, JSON.stringify(s)); return true; }
    catch(e){ console.warn("本地存储写入失败", e); return false; }
  }
  function emit(){ listeners.forEach(function(fn){ try{ fn(state); }catch(e){} }); }
  function normalize(s){
    var base = defaultState();
    if (!s) return base;
    s.trip = Object.assign({}, base.trip, s.trip || {});
    // 标题 / 首页文案 / 日期 以代码（data.js）为准，改了立刻生效；
    // 汇率和更新时间保留用户自己的。
    s.trip.title = base.trip.title;
    s.trip.hero = base.trip.hero;
    s.trip.startDate = base.trip.startDate;
    s.trip.endDate = base.trip.endDate;
    ["days","places","flights","reminders","checklist","expenses"].forEach(function(k){
      if (!Array.isArray(s[k])) s[k] = base[k];
    });
    s.places.forEach(function(p){ if (typeof p.photo !== "string") p.photo = ""; });
    return s;
  }
  function isCloud(){ return ghOk || lcOk || sbOk; }
  function cloudName(){ return ghOk ? "GitHub" : (lcOk ? "LeanCloud" : (sbOk ? "Supabase" : "")); }
  function tsOf(s){ return (s && s.trip && s.trip.updatedAt) ? Date.parse(s.trip.updatedAt) : 0; }

  function inject(src, ms){
    return new Promise(function(resolve){
      var s = document.createElement("script");
      s.src = src; s.async = true;
      var done = false;
      function finish(ok){ if (done) return; done = true; resolve(ok); }
      var t = setTimeout(function(){ finish(false); }, ms);
      s.onload = function(){ clearTimeout(t); finish(true); };
      s.onerror = function(){ clearTimeout(t); finish(false); };
      document.head.appendChild(s);
    });
  }

  /* ---------------- 编码 ---------------- */
  function toB64(str){
    var bytes = new TextEncoder().encode(str);
    var bin = "", i;
    for (i = 0; i < bytes.length; i += 0x8000){
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }
  function fromB64(b64){
    var bin = atob(String(b64).replace(/[\r\n\s]/g, ""));
    var bytes = new Uint8Array(bin.length), i;
    for (i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function stripPhotos(s){
    var c = JSON.parse(JSON.stringify(s));
    c.places.forEach(function(p){ p.photo = ""; });
    return c;
  }

  /* ---------------- GitHub ---------------- */
  function ghCfg(){
    var g = cfg.github || {};
    return (g.owner && g.repo) ? g : null;
  }
  function ghToken(){ try { return localStorage.getItem("gh_pat") || ""; } catch(e){ return ""; } }
  function ghHeaders(extra){
    var h = Object.assign({ "Accept": "application/vnd.github+json" }, extra || {});
    var t = ghToken();
    if (t) h["Authorization"] = "Bearer " + t;
    return h;
  }
  function ghBase(){
    var g = cfg.github;
    return "https://api.github.com/repos/" + g.owner + "/" + g.repo + "/contents/";
  }
  async function ghGetFile(p){
    var g = cfg.github;
    var r = await fetch(ghBase() + p + "?ref=" + encodeURIComponent(g.branch || "main"), {
      headers: ghHeaders(), cache: "no-store"
    });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error("GitHub 读取 " + r.status);
    return await r.json();
  }
  async function ghPutFile(p, b64, message){
    var g = cfg.github;
    var body = { message: message, content: b64, branch: g.branch || "main" };
    if (p === g.path && ghSha) body.sha = ghSha;
    var r = await fetch(ghBase() + p, {
      method: "PUT",
      headers: ghHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body)
    });
    if (r.status === 409 || r.status === 422) return { conflict: true };
    if (!r.ok) throw new Error("GitHub 写入 " + r.status);
    return await r.json();
  }

  async function ghPushState(){
    if (ghPushing) return;
    var g = cfg.github;
    ghPushing = true;
    try {
      var res = await ghPutFile(g.path, toB64(JSON.stringify(stripPhotos(state))), "update trip " + new Date().toISOString());
      if (res && res.conflict){
        var fresh = await ghGetFile(g.path);
        if (fresh && fresh.sha) ghSha = fresh.sha;
        res = await ghPutFile(g.path, toB64(JSON.stringify(stripPhotos(state))), "update trip (retry)");
      }
      if (res && res.content && res.content.sha) ghSha = res.content.sha;
      ghOk = true;
      emit();
    } catch(e){ console.warn("GitHub 推送失败", e); }
    finally { ghPushing = false; }
  }

  async function ghPull(){
    var g = cfg.github;
    try {
      var file = await ghGetFile(g.path);
      if (!file || !file.content) return;
      if (file.sha === ghSha) return;
      ghSha = file.sha;
      var remote = null;
      try { remote = JSON.parse(fromB64(file.content)); } catch(e){ return; }
      if (!remote) return;
      var merged = normalize(remote);
      // 照片只在本机：如果本地有照片而云端没有，保留本地的
      merged.places.forEach(function(p){
        if (!p.photo){
          var lp = state.places.find(function(x){ return x.id === p.id; });
          if (lp && lp.photo) p.photo = lp.photo;
        }
      });
      if (tsOf(merged) >= tsOf(state)){
        state = merged;
        ghOk = true;
        saveLocal(state);
        emit();
      }
    } catch(e){ console.warn("GitHub 拉取失败", e); }
  }

  function ghStartPolling(){
    if (ghTimer) clearInterval(ghTimer);
    ghTimer = setInterval(function(){ if (!document.hidden) ghPull(); }, 8000);
  }

  async function loadGitHub(local){
    active = "github";
    var g = cfg.github;
    var file = await ghGetFile(g.path);
    if (file && file.content){
      ghSha = file.sha;
      var remote = JSON.parse(fromB64(file.content));
      var remoteTs = tsOf(remote), localTs = tsOf(local);
      if (local && localTs > remoteTs){
        state = normalize(local);
        await ghPushState();
      } else {
        var merged = normalize(remote);
        merged.places.forEach(function(p){
          if (!p.photo && local){
            var lp = (local.places || []).find(function(x){ return x.id === p.id; });
            if (lp && lp.photo) p.photo = lp.photo;
          }
        });
        state = merged;
        ghOk = true;
      }
    } else {
      ghSha = null;
      state = local ? normalize(local) : defaultState();
      await ghPushState();
    }
    saveLocal(state);
    ghStartPolling();
  }

  /* ---------------- LeanCloud ---------------- */
  function lcCfg(){
    var lc = cfg.leancloud || {};
    return (lc.appId && lc.appKey && lc.serverURL) ? lc : null;
  }
  async function initLeanCloud(){
    var lc = lcCfg();
    if (!lc) return false;
    if (!window.AV){ var ok = await inject("av-live-query-min.js", 8000); if (!ok) return false; }
    AV = window.AV;
    try { AV.init({ appId: lc.appId, appKey: lc.appKey, serverURL: lc.serverURL }); }
    catch(e){ return false; }
    active = "leancloud";
    return true;
  }
  async function lcQueryFirst(){
    var q = new AV.Query("Trip");
    q.equalTo("tripId", cfg.tripId);
    try { return await q.first(); } catch(e){ return null; }
  }
  async function lcUpsert(s){
    if (!AV) return;
    try {
      if (!lcObj) lcObj = await lcQueryFirst();
      if (!lcObj){
        lcObj = new AV.Object("Trip");
        lcObj.set("tripId", cfg.tripId);
        try {
          var acl = new AV.ACL();
          acl.setPublicReadAccess(true);
          acl.setPublicWriteAccess(true);
          lcObj.setACL(acl);
        } catch(e){}
      }
      lcObj.set("payload", JSON.stringify(s));
      await lcObj.save();
      lcOk = true; emit();
    } catch(e){ console.warn("LeanCloud 保存失败", e); }
  }
  async function lcSubscribe(){
    if (!AV || lcSubscribed) return;
    lcSubscribed = true;
    try {
      var q = new AV.Query("Trip");
      q.equalTo("tripId", cfg.tripId);
      var live = await q.subscribe();
      function apply(obj){
        try {
          var s = JSON.parse(obj.get("payload"));
          if (!s) return;
          state = normalize(s); saveLocal(state); lcOk = true; emit();
        } catch(e){}
      }
      live.on("create", apply);
      live.on("update", apply);
    } catch(e){ console.warn("LiveQuery 订阅失败", e); }
  }
  async function loadLeanCloud(local){
    var existing = await lcQueryFirst();
    if (existing){
      lcObj = existing;
      var remote = null;
      try { remote = JSON.parse(existing.get("payload")); } catch(e){}
      if (remote && tsOf(remote) >= tsOf(local)){ state = normalize(remote); lcOk = true; }
      else { state = local ? normalize(local) : defaultState(); await lcUpsert(state); }
    } else {
      state = local ? normalize(local) : defaultState();
      await lcUpsert(state);
    }
    saveLocal(state);
    await lcSubscribe();
  }

  /* ---------------- Supabase ---------------- */
  async function initSupabase(){
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return false;
    if (!window.supabase || !window.supabase.createClient){
      var ok = await inject("supabase.min.js", 5000);
      if (!ok) return false;
    }
    try { sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey); }
    catch(e){ return false; }
    active = "supabase";
    return true;
  }
  async function sbUpsert(s){
    if (!sb) return;
    try {
      await sb.from("trips").upsert({ id: cfg.tripId, data: s, updated_at: new Date().toISOString() });
      sbOk = true; emit();
    } catch(e){ console.warn("Supabase 同步失败", e); }
  }
  async function loadSupabase(local){
    var res = await sb.from("trips").select("*").eq("id", cfg.tripId).maybeSingle();
    if (res && res.data && res.data.data){
      sbOk = true;
      if (tsOf(res.data.data) >= tsOf(local)) state = normalize(res.data.data);
      else { state = normalize(local); await sbUpsert(state); }
    } else {
      state = local ? normalize(local) : defaultState();
      await sbUpsert(state);
    }
    if (!subscribed){
      subscribed = true;
      sb.channel("trip-" + cfg.tripId)
        .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, function(payload){
          if (payload.new && payload.new.id === cfg.tripId && payload.new.data){
            state = normalize(payload.new.data); saveLocal(state); sbOk = true; emit();
          }
        })
        .subscribe();
    }
    saveLocal(state);
  }

  /* ---------------- 对外 ---------------- */
  async function load(){
    var local = loadLocal();
    state = normalize(local);
    saveLocal(state);
    emit();

    // 1) GitHub（填了令牌才启用）
    if (ghCfg() && ghToken()){
      try { await loadGitHub(local); emit(); return; }
      catch(e){ console.warn("GitHub 不可用，退回本地", e); active = "local"; }
    }
    // 2) LeanCloud
    if (lcCfg()){
      try {
        if (await initLeanCloud()){ await loadLeanCloud(local); emit(); return; }
      } catch(e){ console.warn("LeanCloud 不可用", e); active = "local"; }
    }
    // 3) Supabase
    if (cfg.supabaseUrl && cfg.supabaseAnonKey){
      try {
        if (await initSupabase()){ await loadSupabase(local); emit(); return; }
      } catch(e){ console.warn("Supabase 不可用", e); active = "local"; }
    }
    active = "local";
    emit();
  }

  function update(mutator){
    mutator(state);
    state.trip.updatedAt = new Date().toISOString();
    var ok = saveLocal(state);
    emit();
    clearTimeout(saveTimer);
    if (active === "github"){
      saveTimer = setTimeout(function(){ ghPushState(); }, 700);
    } else if (active === "leancloud"){
      saveTimer = setTimeout(function(){ lcUpsert(state); }, 500);
    } else if (active === "supabase"){
      saveTimer = setTimeout(function(){ sbUpsert(state); }, 400);
    }
    return ok;
  }

  document.addEventListener("visibilitychange", function(){
    if (!document.hidden && active === "github") ghPull();
  });

  function getState(){ return state; }
  function subscribe(fn){ listeners.push(fn); }

  window.Store = {
    load: load, update: update, getState: getState, subscribe: subscribe,
    isCloud: isCloud, cloudName: cloudName, mode: function(){ return active; }
  };
})();
