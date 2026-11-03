// 界面与交互逻辑
(function(){
  "use strict";
  var Store = window.Store;
  var cfg = window.APP_CONFIG;
  var qs = new URLSearchParams(location.search);
  if (qs.get("trip")) cfg.tripId = qs.get("trip");
  // 应急入口：地址栏加 ?open=1 或 #open 可跳过密码（自己着急用时）
  var forceOpen = (qs.get("open") === "1") || (location.hash === "#open");

  var activeTab = "itinerary";
  var selectedDayId = null;
  var view = "lock";

  function $(sel, el){ return (el || document).querySelector(sel); }
  function $$(sel, el){ return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function S(){ return Store.getState(); }

  var PLACE_CAT = { sight:"景点", shopping:"购物", food:"美食", onsen:"温泉", station:"车站", other:"其他" };
  var EXP_CAT = { transport:"交通", hotel:"住宿", food:"餐饮", ticket:"门票", shopping:"购物", onsen:"温泉", other:"其他" };
  var PAY = { cash:"现金", credit:"信用卡", wechat:"微信", alipay:"支付宝", ic_card:"交通卡" };
  var NAV_ITEMS = [
    { tab:"home", label:"总览" },
    { tab:"itinerary", label:"行程" },
    { tab:"map", label:"地图" },
    { tab:"reminder", label:"清单" },
    { tab:"expense", label:"记账" }
  ];

  window.addEventListener("error", function(e){
    try {
      if (view !== "lock") return;
      var le = $("#lockErr");
      if (le && !le.textContent) le.textContent = "脚本出错：" + (e && e.message ? e.message : "未知错误");
    } catch(x){}
  });

  function esc(s){
    s = (s == null ? "" : String(s));
    return s.replace(/[&<>"']/g, function(c){
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c];
    });
  }
  function uid(){ return "id_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function fmtDate(d){
    if (!d) return "";
    var dt = new Date(d + "T00:00:00");
    if (isNaN(dt)) return d;
    return (dt.getMonth() + 1) + "." + dt.getDate() + " 周" + "日一二三四五六".charAt(dt.getDay());
  }
  function fmtDateShort(d){
    if (!d) return "";
    var dt = new Date(d + "T00:00:00");
    if (isNaN(dt)) return d;
    return (dt.getMonth() + 1) + "." + dt.getDate();
  }
  function fmtDT(s){
    if (!s) return "";
    var dt = new Date(s);
    if (isNaN(dt)) return s;
    function p(n){ return (n < 10 ? "0" : "") + n; }
    return (dt.getMonth() + 1) + "." + dt.getDate() + " " + p(dt.getHours()) + ":" + p(dt.getMinutes());
  }
  function toLocalVal(s){ return s ? String(s).slice(0, 16) : ""; }
  function todayStr(){
    var d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  function catEmoji(c){
    return { transport:"🚄", hotel:"🏨", food:"🍜", ticket:"🎫", shopping:"🛍️", onsen:"♨️", other:"📌" }[c] || "📌";
  }
  function catOptions(map){
    return Object.keys(map).map(function(v){ return { value: v, label: map[v] }; });
  }
  function googleMapsUrl(p){
    if (p.lat != null && p.lng != null) return "https://www.google.com/maps/search/?api=1&query=" + p.lat + "," + p.lng;
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(p.nameJa || p.name);
  }

  // ---------- 弹窗 ----------
  function openModal(opts){
    var root = $("#modalRoot");
    var fieldsHtml = (opts.fields || []).map(function(f){
      var val = (f.value != null) ? f.value : "";
      if (f.type === "note"){
        return '<p class="field-note">' + esc(f.text || "") + '</p>';
      }
      if (f.type === "select"){
        var o = (f.options || []).map(function(opt){
          var sel = (String(opt.value) === String(val)) ? "selected" : "";
          return '<option value="' + esc(opt.value) + '" ' + sel + '>' + esc(opt.label) + '</option>';
        }).join("");
        return '<label class="field"><span class="field-label">' + esc(f.label) + '</span><select name="' + f.name + '">' + o + '</select></label>';
      }
      if (f.type === "textarea"){
        return '<label class="field"><span class="field-label">' + esc(f.label) + '</span><textarea name="' + f.name + '" rows="2" placeholder="' + esc(f.placeholder || "") + '">' + esc(val) + '</textarea></label>';
      }
      return '<label class="field"><span class="field-label">' + esc(f.label) + '</span><input type="' + (f.type || "text") + '" name="' + f.name + '" value="' + esc(val) + '" placeholder="' + esc(f.placeholder || "") + '" step="' + (f.step || "") + '"></label>';
    }).join("");

    root.innerHTML = [
      '<div class="modal-backdrop"><div class="modal-card">',
      '<div class="modal-head"><h3>', esc(opts.title), '</h3><button class="modal-close" data-act="close">✕</button></div>',
      '<form class="modal-body" id="modalForm" autocomplete="off">', fieldsHtml, '</form>',
      '<div class="modal-foot">',
      '<button class="btn ghost" data-act="close">取消</button>',
      '<button class="btn primary" data-act="save">保存</button>',
      '</div></div></div>'
    ].join("");

    var form = $("#modalForm");
    function doSave(){
      var data = {};
      (opts.fields || []).forEach(function(f){
        if (f.type === "note") return;
        var el = form.elements[f.name];
        if (!el){ data[f.name] = ""; return; }
        if (f.type === "number") data[f.name] = (el.value === "") ? "" : Number(el.value);
        else data[f.name] = el.value;
      });
      closeModal();
      if (opts.onSubmit) opts.onSubmit(data);
    }
    form.addEventListener("submit", function(e){ e.preventDefault(); doSave(); });

    root.onclick = function(e){
      if (e.target.classList && e.target.classList.contains("modal-backdrop")){ closeModal(); return; }
      var t = e.target.closest ? e.target.closest("[data-act]") : null;
      if (!t) return;
      var a = t.getAttribute("data-act");
      if (a === "close") closeModal();
      else if (a === "save") doSave();
    };
  }
  function closeModal(){ $("#modalRoot").innerHTML = ""; }

  function toast(msg){
    var t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._tm);
    t._tm = setTimeout(function(){ t.classList.remove("show"); }, 1900);
  }

  // ---------- 密码门禁 ----------
  function lockKey(){ return "trip:" + cfg.tripId + ":unlocked"; }
  function isUnlocked(){
    try { return sessionStorage.getItem(lockKey()) === "1"; } catch(e){ return false; }
  }
  function setUnlocked(v){
    try {
      if (v) sessionStorage.setItem(lockKey(), "1");
      else sessionStorage.removeItem(lockKey());
    } catch(e){}
  }
  function doUnlock(ev){
    if (ev && ev.preventDefault) ev.preventDefault();
    var input = $("#lockInput");
    var val = (input && input.value ? input.value : "").trim();
    var pass = String(cfg.accessPassword || "").trim().toLowerCase();
    if (val && val.toLowerCase() === pass){
      setUnlocked(true);
      showView("home");
    } else {
      var err = $("#lockErr");
      if (err) err.textContent = "密码不对，再试一次";
      var inner = $(".lock-inner");
      if (inner){ inner.classList.remove("shake"); void inner.offsetWidth; inner.classList.add("shake"); }
      if (input){ input.value = ""; input.focus(); }
    }
  }

  // ---------- 视图切换 ----------
  function showView(name){
    view = name;
    $("#lockScreen").classList.toggle("hidden", name !== "lock");
    $("#homeScreen").classList.toggle("hidden", name !== "home");
    $("#appScreen").classList.toggle("hidden", name !== "app");
    $("#bottomNav").classList.toggle("hidden", name === "lock");
    if (name === "lock"){
      var li = $("#lockInput");
      if (li) li.value = "";
      var le = $("#lockErr");
      if (le) le.textContent = "";
    }
    if (name === "home") renderHome();
    else if (name === "app") render();
    syncNav();
  }

  function syncNav(){
    $$("#bottomNav .nav-item").forEach(function(b){
      var tab = b.getAttribute("data-tab");
      var on = (view === "home" && tab === "home") || (view === "app" && tab === activeTab);
      b.classList.toggle("active", on);
    });
  }

  function refresh(){
    if (view === "app") render();
    else if (view === "home") renderHome();
  }

  // ---------- 首页 ----------
  function renderHome(){
    var st = S();
    if (!st){
      $("#homeScreen").innerHTML = '<div class="home-loading">正在打开雪国…</div>';
      return;
    }
    var hero = st.trip.hero || {};
    var chips = NAV_ITEMS.map(function(n){
      var cls = (n.tab === "home") ? "home-item active" : "home-item";
      return '<button class="' + cls + '" data-act="goto" data-target="' + n.tab + '" type="button">' + n.label + '</button>';
    }).join("");

    var cards = st.days.map(function(d){
      var places = st.places.filter(function(p){ return p.dayId === d.id; }).sort(function(a, b){ return (a.order || 0) - (b.order || 0); });
      var names = places.map(function(p){ return p.name; }).join(" · ");
      if (!names) names = d.title;
      var parts = String(d.title || "").split("·");
      var big = (parts[0] || "").trim();
      var sub = parts.length > 1 ? parts.slice(1).join("·").trim() : "";
      return [
        '<button class="day-card" data-act="open-day" data-id="', d.id, '" type="button">',
        '<div class="day-num">DAY ', d.dayIndex, ' · ', fmtDateShort(d.date), '</div>',
        '<div class="day-name">', esc(big), '</div>',
        d.en ? '<div class="day-en">' + esc(d.en) + '</div>' : '',
        sub ? '<div class="day-sub">' + esc(sub) + '</div>' : '',
        '<div class="day-places">', esc(names), '</div>',
        '</button>'
      ].join("");
    }).join("");

    var stats = (hero.stats || []).map(function(s){ return '<span>' + esc(s) + '</span>'; }).join('<i></i>');

    $("#homeScreen").innerHTML = [
      '<div class="home">',
      '<nav class="home-nav">',
      '<div class="home-brand">', esc(st.trip.title), '</div>',
      '<div class="home-nav-items">', chips, '</div>',
      '</nav>',
      '<header class="hero">',
      '<div class="hero-kicker">', esc(hero.kicker || "HOKKAIDO · WINTER JOURNEY"), '</div>',
      '<h1 class="hero-title">', esc(hero.coverTitle || st.trip.title), '</h1>',
      '<div class="hero-line">', esc(hero.coverLine || ""), '</div>',
      '<div class="hero-cities">', esc(hero.cities || ""), '</div>',
      '<div class="hero-date">', esc(hero.dates || ""), '</div>',
      '<p class="hero-poem">', esc(hero.poem || ""), '</p>',
      '<div class="hero-stats">', stats, '</div>',
      '<button class="hero-cta" data-act="scroll-days" type="button">进入手册 <span>↓</span></button>',
      '</header>',
      '<section class="home-section" id="homeDays">',
      '<div class="sec-caps">01</div>',
      '<h2 class="sec-title">', esc(hero.sectionTitle || "一条路"), '</h2>',
      '<p class="sec-sub">', esc(hero.sectionSub || ""), '</p>',
      '<div class="day-grid">', cards, '</div>',
      '</section>',
      '<section class="home-section">',
      '<button class="home-open-btn" data-act="goto" data-target="itinerary" type="button">打开行程手册 →</button>',
      '</section>',
      '<section class="home-section">', syncSectionHtml(), '</section>',
      '<section class="home-section">',
      '<div class="backup-row">',
      '<button class="backup-btn" data-act="export-data" type="button">⬇ 导出备份</button>',
      '<button class="backup-btn" data-act="import-data" type="button">⬆ 导入备份</button>',
      '</div>',
      '<p class="backup-hint">没有云端时，把导出的文件用微信发给对方，对方点「导入备份」即可看到你的全部改动；对方改完再导出给你。</p>',
      '</section>',
      '<footer class="home-foot">雪会融化，但这些日子不会。<br>2027.01.30 — 02.04 · 北海道</footer>',
      '</div>'
    ].join("");
    syncNav();
  }

  // ---------- 云端同步（GitHub 仓库当数据库） ----------
  function syncSectionHtml(){
    var g = cfg.github || {};
    var repoName = (g.owner && g.repo) ? (g.owner + "/" + g.repo) : "未配置仓库";
    var hasToken = false;
    try { hasToken = !!localStorage.getItem("gh_pat"); } catch(e){}
    if (Store.isCloud() && Store.cloudName() === "GitHub"){
      return [
        '<div class="sync-card on">',
        '<div class="sync-title">☁ 云端实时同步已开启</div>',
        '<div class="sync-sub">', esc(repoName), ' · 每 8 秒自动刷新</div>',
        '<button class="mini-btn" data-act="sync-off" type="button">断开同步</button>',
        '</div>'
      ].join("");
    }
    return [
      '<div class="sync-card">',
      '<div class="sync-title">让两个人实时看到同一份行程</div>',
      '<div class="sync-sub">用你自己的 GitHub 仓库当同步空间 · 免费 · 国内可直连</div>',
      hasToken ? '<div class="sync-sub">令牌已保存，正在连接…（连不上就检查令牌有没有 repo 权限）</div>' : '',
      '<button class="home-open-btn" data-act="sync-on" type="button">',
      (hasToken ? "重新输入令牌" : "开启云端同步 →"),
      '</button>',
      '<p class="backup-hint">怎么拿令牌：GitHub 网页 → 头像 → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic) → 勾选 repo → Generate → 复制 ghp_ 开头那串。令牌只保存在你这台设备上，不会写进网页。</p>',
      '</div>'
    ].join("");
  }

  function openSyncModal(){
    var cur = "";
    try { cur = localStorage.getItem("gh_pat") || ""; } catch(e){}
    openModal({
      title: "开启云端同步",
      fields: [
        { type:"note", text:"粘贴你在 GitHub 生成的令牌（ghp_ 开头）。只保存在这台设备。" },
        { name:"token", label:"GitHub 令牌", type:"text", value: cur, placeholder:"ghp_xxxxxxxxxxxx" }
      ],
      onSubmit: function(d){
        var v = String(d.token || "").trim();
        try { if (v) localStorage.setItem("gh_pat", v); else localStorage.removeItem("gh_pat"); } catch(e){}
        toast(v ? "令牌已保存，正在连接…" : "已清除令牌");
        setTimeout(function(){ location.reload(); }, 500);
      }
    });
  }

  // ---------- App 渲染 ----------
  function render(){
    if (view !== "app") return;
    var st = S();
    if (!st) return;
    $("#tripTitle").textContent = st.trip.title;
    $("#tripDate").textContent = fmtDate(st.trip.startDate) + " – " + fmtDate(st.trip.endDate);
    $("#syncBadge").textContent = Store.isCloud() ? "☁ 实时同步" : "本地";
    syncNav();
    var main = $("#main");
    if (activeTab === "itinerary") renderItinerary(main, st);
    else if (activeTab === "map") renderMap(main, st);
    else if (activeTab === "reminder" || activeTab === "checklist") renderLists(main, st);
    else if (activeTab === "expense") renderExpense(main, st);
  }

  function currentDayId(st){
    if (selectedDayId && st.days.some(function(d){ return d.id === selectedDayId; })) return selectedDayId;
    var today = todayStr();
    var day = st.days.find(function(d){ return d.date === today; }) || st.days.find(function(d){ return d.dayIndex === 2; }) || st.days[0];
    return day ? day.id : null;
  }

  function dayChips(st){
    return st.days.map(function(d){
      var cls = (d.id === selectedDayId) ? "day-chip active" : "day-chip";
      return '<button class="' + cls + '" data-act="day" data-id="' + d.id + '" type="button">' + fmtDateShort(d.date) + '<span>' + esc(d.title) + '</span></button>';
    }).join("");
  }

  function flightCard(f){
    var dirLabel = (f.direction === "return") ? "返程" : "去程";
    return [
      '<div class="card flight">',
      '<div class="flight-dir">', dirLabel, '</div>',
      '<div class="flight-route">',
      '<div class="ap"><b>', esc(f.fromAirport || "—"), '</b><span>', f.departureTime ? fmtDT(f.departureTime) : "时间待填", '</span></div>',
      '<div class="plane">✈</div>',
      '<div class="ap right"><b>', esc(f.toAirport || "—"), '</b><span>', f.arrivalTime ? fmtDT(f.arrivalTime) : "时间待填", '</span></div>',
      '</div>',
      '<div class="flight-meta">', esc((f.airline ? f.airline + " " : "") + (f.flightNo || "")), f.bookingRef ? " · 订单:" + esc(f.bookingRef) : "", '</div>',
      '<div class="flight-actions">',
      '<button class="mini-btn" data-act="edit-flight" data-id="', f.id, '" type="button">编辑</button>',
      '<button class="mini-btn danger" data-act="del-flight" data-id="', f.id, '" type="button">删除</button>',
      '</div></div>'
    ].join("");
  }

  function placeItem(p, idx){
    var tag = PLACE_CAT[p.category] ? '<span class="tag">' + PLACE_CAT[p.category] + '</span>' : "";
    var cover = p.photo ? '<div class="place-cover" data-act="photo" data-id="' + p.id + '"><img src="' + esc(p.photo) + '" alt=""></div>' : "";
    var addPhoto = p.photo ? "" : '<button class="place-addphoto" data-act="photo" data-id="' + p.id + '" type="button">＋ 给这里加一张图片</button>';
    return [
      '<div class="card place', p.visited ? ' visited' : '', '">',
      cover,
      '<div class="place-row">',
      '<div class="place-idx">', (idx + 1), '</div>',
      '<div class="place-main" data-act="edit-place" data-id="', p.id, '">',
      '<div class="place-name">', esc(p.name), tag, '</div>',
      p.nameJa ? '<div class="place-ja">' + esc(p.nameJa) + '</div>' : "",
      (p.startTime || p.endTime) ? '<div class="place-time">' + (p.startTime || "") + ((p.startTime && p.endTime) ? " – " : "") + (p.endTime || "") + '</div>' : "",
      '</div>',
      '<div class="place-actions">',
      '<button class="round-btn', p.visited ? ' checked' : '', '" data-act="toggle-place" data-id="', p.id, '" type="button" title="打卡">', p.visited ? "✅" : "⬜", '</button>',
      '<button class="round-btn" data-act="map-place" data-id="', p.id, '" type="button" title="地图">📍</button>',
      '</div>',
      '</div>',
      addPhoto,
      '</div>'
    ].join("");
  }

  function renderItinerary(main, st){
    selectedDayId = currentDayId(st);
    var flights = st.flights.map(flightCard).join("");
    var chips = dayChips(st);
    var day = st.days.find(function(d){ return d.id === selectedDayId; }) || st.days[0];
    var places = st.places.filter(function(p){ return p.dayId === selectedDayId; }).sort(function(a, b){ return (a.order || 0) - (b.order || 0); });
    var placeHtml = places.map(function(p, i){ return placeItem(p, i); }).join("");
    main.innerHTML = [
      '<section class="section">',
      '<h2 class="section-title">🛫 航班信息</h2>',
      flights || '<div class="empty">还没有航班信息</div>',
      '<button class="btn-ghost-line" data-act="add-flight" type="button">+ 添加航班</button>',
      '</section>',
      '<section class="section"><div class="day-chips">', chips, '</div></section>',
      '<section class="section">',
      '<h2 class="section-title">📍 ', esc(day ? day.title : ""), ' <span class="muted">', fmtDate(day ? day.date : ""), '</span></h2>',
      '<div class="place-list">', placeHtml || '<div class="empty">这一天还没有打卡点</div>', '</div>',
      '<button class="btn-ghost-line" data-act="add-place" type="button">+ 添加打卡点</button>',
      '</section>'
    ].join("");
  }

  function renderMap(main, st){
    selectedDayId = currentDayId(st);
    var chips = dayChips(st);
    var day = st.days.find(function(d){ return d.id === selectedDayId; }) || st.days[0];
    var places = st.places.filter(function(p){ return p.dayId === selectedDayId; }).sort(function(a, b){ return (a.order || 0) - (b.order || 0); });
    var withCoords = places.filter(function(p){ return p.lat != null && p.lng != null; });
    var lat, lng;
    if (withCoords.length){
      lat = withCoords.reduce(function(s, p){ return s + Number(p.lat); }, 0) / withCoords.length;
      lng = withCoords.reduce(function(s, p){ return s + Number(p.lng); }, 0) / withCoords.length;
    } else {
      lat = 43.06; lng = 141.35;
    }
    var mapSrc = "https://maps.google.com/maps?q=" + lat + "," + lng + "&z=13&output=embed&hl=zh-CN";
    var pins = withCoords.map(function(p){
      return '<button class="place-pin-btn" data-act="map-pin" data-id="' + p.id + '" type="button">📍 ' + esc(p.name) + '</button>';
    }).join("");
    main.innerHTML = [
      '<section class="section"><div class="day-chips">', chips, '</div></section>',
      '<section class="map-wrap">',
      '<iframe class="map-frame" id="mapFrame" src="', mapSrc, '" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>',
      '<div class="map-note">地图加载失败时，可用下方按钮跳转 Google Maps</div>',
      '</section>',
      '<section class="section">',
      '<h2 class="section-title">', esc(day ? day.title : ""), ' 的地点</h2>',
      '<div class="pin-btns">', pins || '<div class="empty">这一天没有带坐标的地点</div>', '</div>',
      '<a class="btn primary block" target="_blank" rel="noopener" href="https://www.google.com/maps/search/', encodeURIComponent((day ? day.title : "北海道") + " 北海道"), '">在 Google Maps 中打开「', esc(day ? day.title : ""), '」</a>',
      '</section>'
    ].join("");
  }

  function buildReminders(st){
    var rows = st.reminders.slice().sort(function(a, b){
      var ad = (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0);
      if (ad !== 0) return ad;
      return (a.dueAt || "").localeCompare(b.dueAt || "");
    }).map(function(r){
      return [
        '<div class="card reminder', r.status === "done" ? ' done' : '', '">',
        '<div class="reminder-main">',
        '<button class="round-btn', r.status === "done" ? ' checked' : '', '" data-act="toggle-reminder" data-id="', r.id, '" type="button">', r.status === "done" ? "✓" : "", '</button>',
        '<div class="reminder-info" data-act="edit-reminder" data-id="', r.id, '">',
        '<div class="reminder-title">', esc(r.title), '</div>',
        '<div class="reminder-meta">', r.dueAt ? "⏰ " + fmtDT(r.dueAt) : "", r.amount ? "　¥" + Number(r.amount) : "", '</div>',
        '</div>',
        '</div>',
        '<div class="reminder-actions">',
        r.url ? '<a class="mini-btn" target="_blank" rel="noopener" href="' + esc(r.url) + '">链接</a>' : "",
        '<button class="mini-btn danger" data-act="del-reminder" data-id="', r.id, '" type="button">✕</button>',
        '</div></div>'
      ].join("");
    }).join("");
    return '<div class="list">' + (rows || '<div class="empty">还没有提醒</div>') + '</div>';
  }

  function buildChecklist(st){
    var cats = [];
    st.checklist.forEach(function(c){ if (cats.indexOf(c.category) < 0) cats.push(c.category); });
    var groups = cats.map(function(cat){
      var items = st.checklist.filter(function(c){ return c.category === cat; }).sort(function(a, b){ return (a.order || 0) - (b.order || 0); });
      var done = items.filter(function(i){ return i.checked; }).length;
      var rows = items.map(function(i){
        return [
          '<div class="check-row', i.checked ? ' done' : '', '">',
          '<button class="round-btn', i.checked ? ' checked' : '', '" data-act="toggle-check" data-id="', i.id, '" type="button">', i.checked ? "✓" : "", '</button>',
          '<span class="check-content" data-act="edit-check" data-id="', i.id, '">', esc(i.content), '</span>',
          '<button class="mini-btn danger" data-act="del-check" data-id="', i.id, '" type="button">✕</button>',
          '</div>'
        ].join("");
      }).join("");
      return '<div class="check-group"><div class="check-group-head">' + esc(cat) + ' <span class="muted">' + done + '/' + items.length + '</span></div>' + rows + '</div>';
    }).join("");
    return '<div class="check-groups">' + (groups || '<div class="empty">还没有清单，点下面添加</div>') + '</div>';
  }

  function renderLists(main, st){
    main.innerHTML = [
      '<section class="section">',
      '<h2 class="section-title">⏰ 提醒 <span class="muted">购票 · 预约</span></h2>',
      buildReminders(st),
      '<button class="btn-ghost-line" data-act="add-reminder" type="button">+ 添加一条提醒</button>',
      '</section>',
      '<section class="section">',
      '<h2 class="section-title">🎒 准备 <span class="muted">行李 · 待办</span></h2>',
      buildChecklist(st),
      '<button class="btn-ghost-line" data-act="add-check" type="button">+ 添加一个条目</button>',
      '</section>'
    ].join("");
  }

  function expenseSummary(st){
    var jpy = 0, cny = 0;
    (st.expenses || []).forEach(function(e){
      var a = Number(e.amount) || 0;
      if (e.currency === "CNY") cny += a; else jpy += a;
    });
    var rate = Number(st.trip.fxRate) || 0;
    return { jpy: jpy, cny: cny, rate: rate, totalCny: cny + jpy * rate };
  }

  function renderExpense(main, st){
    var sum = expenseSummary(st);
    var rows = st.expenses.slice().sort(function(a, b){ return (b.date || "").localeCompare(a.date || ""); }).map(function(e){
      return [
        '<div class="expense-row">',
        '<div class="expense-cat">', catEmoji(e.category), '</div>',
        '<div class="expense-main" data-act="edit-expense" data-id="', e.id, '">',
        '<div class="expense-desc">', esc(e.description || EXP_CAT[e.category] || "开销"), '</div>',
        '<div class="expense-meta">', fmtDate(e.date), " · ", EXP_CAT[e.category] || e.category, e.paymentMethod ? " · " + (PAY[e.paymentMethod] || e.paymentMethod) : "", '</div>',
        '</div>',
        '<div class="expense-amt', e.currency === "CNY" ? ' cny' : '', '">', e.currency === "CNY" ? "￥" : "¥", (Number(e.amount) || 0).toLocaleString(), '</div>',
        '<button class="mini-btn danger" data-act="del-expense" data-id="', e.id, '" type="button">✕</button>',
        '</div>'
      ].join("");
    }).join("");
    var totalRounded = Math.round(sum.totalCny * 100) / 100;
    main.innerHTML = [
      '<section class="section">',
      '<h2 class="section-title">💰 花销开支</h2>',
      '<div class="summary-card">',
      '<div class="sum-row"><span>日元合计</span><b>¥', sum.jpy.toLocaleString(), '</b></div>',
      '<div class="sum-row"><span>人民币合计</span><b>￥', sum.cny.toLocaleString(), '</b></div>',
      '<div class="sum-row total"><span>折算总额（人民币）</span><b>≈￥', totalRounded.toLocaleString(), '</b></div>',
      '<div class="fx-row">汇率 1 JPY = <input type="number" step="0.001" id="fxInput" value="', st.trip.fxRate, '"> CNY <button class="mini-btn" data-act="save-fx" type="button">保存</button></div>',
      '</div>',
      '</section>',
      '<section class="section">',
      '<div class="list">', rows || '<div class="empty">还没有记账，点下方记一笔</div>', '</div>',
      '<button class="btn-ghost-line" data-act="add-expense" type="button">+ 记一笔</button>',
      '</section>'
    ].join("");
  }

  // ---------- 表单 ----------
  function placeForm(p){
    var isEdit = !!p;
    var day = S().days.find(function(d){ return d.id === selectedDayId; });
    openModal({
      title: isEdit ? "编辑打卡点" : ("添加打卡点 · " + (day ? day.title : "")),
      fields: [
        { name:"name", label:"名称", type:"text", value: isEdit ? p.name : "", placeholder:"如：旭川" },
        { name:"nameJa", label:"日语名（可选）", type:"text", value: isEdit ? p.nameJa : "" },
        { name:"category", label:"分类", type:"select", value: isEdit ? p.category : "sight", options: catOptions(PLACE_CAT) },
        { name:"order", label:"顺序", type:"number", value: isEdit ? p.order : (S().places.filter(function(x){ return x.dayId === selectedDayId; }).length + 1) },
        { name:"lat", label:"纬度（可选）", type:"number", step:"0.0001", value: isEdit ? (p.lat != null ? p.lat : "") : "" },
        { name:"lng", label:"经度（可选）", type:"number", step:"0.0001", value: isEdit ? (p.lng != null ? p.lng : "") : "" },
        { name:"startTime", label:"到达时间（可选）", type:"time", value: isEdit ? p.startTime : "" },
        { name:"endTime", label:"离开时间（可选）", type:"time", value: isEdit ? p.endTime : "" },
        { name:"notes", label:"备注", type:"textarea", value: isEdit ? p.notes : "" }
      ],
      onSubmit: function(d){
        var lat = (d.lat === "" || d.lat == null) ? null : Number(d.lat);
        var lng = (d.lng === "" || d.lng == null) ? null : Number(d.lng);
        if (isEdit){
          Store.update(function(s){
            var t = s.places.find(function(x){ return x.id === p.id; });
            if (t) Object.assign(t, { name:d.name, nameJa:d.nameJa, category:d.category, order:Number(d.order)||0, lat:lat, lng:lng, startTime:d.startTime, endTime:d.endTime, notes:d.notes });
          });
        } else {
          Store.update(function(s){
            s.places.push({ id:uid(), dayId:selectedDayId, order:Number(d.order)||0, name:d.name||"未命名", nameJa:d.nameJa, category:d.category, lat:lat, lng:lng, googlePlaceId:"", address:"", startTime:d.startTime, endTime:d.endTime, visited:false, notes:d.notes, photo:"" });
          });
        }
        refresh();
      }
    });
  }

  function flightForm(f){
    var isEdit = !!f;
    openModal({
      title: isEdit ? "编辑航班" : "添加航班",
      fields: [
        { name:"direction", label:"方向", type:"select", value: isEdit ? f.direction : "outbound", options: [{ value:"outbound", label:"去程" }, { value:"return", label:"返程" }] },
        { name:"airline", label:"航空公司", type:"text", value: isEdit ? f.airline : "" },
        { name:"flightNo", label:"航班号", type:"text", value: isEdit ? f.flightNo : "" },
        { name:"fromAirport", label:"出发机场", type:"text", value: isEdit ? f.fromAirport : "" },
        { name:"toAirport", label:"到达机场", type:"text", value: isEdit ? f.toAirport : "" },
        { name:"departureTime", label:"起飞时间", type:"datetime-local", value: isEdit ? toLocalVal(f.departureTime) : "" },
        { name:"arrivalTime", label:"到达时间", type:"datetime-local", value: isEdit ? toLocalVal(f.arrivalTime) : "" },
        { name:"terminal", label:"航站楼", type:"text", value: isEdit ? f.terminal : "" },
        { name:"gate", label:"登机口", type:"text", value: isEdit ? f.gate : "" },
        { name:"seat", label:"座位", type:"text", value: isEdit ? f.seat : "" },
        { name:"bookingRef", label:"订单号 / PNR", type:"text", value: isEdit ? f.bookingRef : "" },
        { name:"baggage", label:"行李额", type:"text", value: isEdit ? f.baggage : "" },
        { name:"notes", label:"备注", type:"textarea", value: isEdit ? f.notes : "" }
      ],
      onSubmit: function(d){
        if (isEdit){
          Store.update(function(s){
            var t = s.flights.find(function(x){ return x.id === f.id; });
            if (t) Object.assign(t, d);
          });
        } else {
          Store.update(function(s){ s.flights.push(Object.assign({ id:uid() }, d)); });
        }
        refresh();
      }
    });
  }

  function reminderForm(r){
    var isEdit = !!r;
    openModal({
      title: isEdit ? "编辑提醒" : "添加提醒",
      fields: [
        { name:"title", label:"标题", type:"text", value: isEdit ? r.title : "" },
        { name:"type", label:"类型", type:"select", value: isEdit ? r.type : "ticket", options: [{ value:"ticket", label:"购票" }, { value:"reservation", label:"预约" }, { value:"other", label:"其他" }] },
        { name:"dueAt", label:"提醒时间", type:"datetime-local", value: isEdit ? toLocalVal(r.dueAt) : "" },
        { name:"url", label:"购票 / 预约链接（可选）", type:"text", value: isEdit ? r.url : "" },
        { name:"amount", label:"参考价格（可选）", type:"number", step:"0.01", value: isEdit ? (r.amount || "") : "" },
        { name:"notes", label:"备注", type:"textarea", value: isEdit ? r.notes : "" }
      ],
      onSubmit: function(d){
        if (isEdit){
          Store.update(function(s){
            var t = s.reminders.find(function(x){ return x.id === r.id; });
            if (t) Object.assign(t, { title:d.title, type:d.type, dueAt:d.dueAt, url:d.url, amount:Number(d.amount)||0, notes:d.notes });
          });
        } else {
          Store.update(function(s){
            s.reminders.push({ id:uid(), placeId:"", title:d.title||"提醒", type:d.type, dueAt:d.dueAt, status:"pending", url:d.url, amount:Number(d.amount)||0, notes:d.notes });
          });
        }
        refresh();
      }
    });
  }

  function checkForm(c){
    var isEdit = !!c;
    var cats = ["证件", "衣物", "电子", "药品", "其他"];
    S().checklist.forEach(function(x){ if (cats.indexOf(x.category) < 0) cats.push(x.category); });
    openModal({
      title: isEdit ? "编辑条目" : "添加条目",
      fields: [
        { name:"category", label:"分类", type:"select", value: isEdit ? c.category : cats[0], options: cats.map(function(v){ return { value:v, label:v }; }) },
        { name:"content", label:"内容", type:"text", value: isEdit ? c.content : "" },
        { name:"order", label:"排序", type:"number", value: isEdit ? c.order : 1 }
      ],
      onSubmit: function(d){
        if (isEdit){
          Store.update(function(s){
            var t = s.checklist.find(function(x){ return x.id === c.id; });
            if (t){ t.category = d.category; t.content = d.content; t.order = Number(d.order) || 0; }
          });
        } else {
          Store.update(function(s){
            s.checklist.push({ id:uid(), category:d.category||"其他", content:d.content||"新条目", checked:false, order:Number(d.order)||0 });
          });
        }
        refresh();
      }
    });
  }

  function expenseForm(e){
    var isEdit = !!e;
    var places = S().places;
    var day = S().days.find(function(x){ return x.id === selectedDayId; });
    openModal({
      title: isEdit ? "编辑开销" : "记一笔",
      fields: [
        { name:"date", label:"日期", type:"date", value: isEdit ? e.date : (day ? day.date : todayStr()) },
        { name:"category", label:"分类", type:"select", value: isEdit ? e.category : "food", options: catOptions(EXP_CAT) },
        { name:"amount", label:"金额", type:"number", step:"0.01", value: isEdit ? e.amount : "" },
        { name:"currency", label:"币种", type:"select", value: isEdit ? e.currency : "JPY", options: [{ value:"JPY", label:"日元 ¥" }, { value:"CNY", label:"人民币 ￥" }] },
        { name:"description", label:"说明", type:"text", value: isEdit ? e.description : "" },
        { name:"paymentMethod", label:"支付方式", type:"select", value: isEdit ? e.paymentMethod : "cash", options: [{ value:"", label:"—" }, { value:"cash", label:"现金" }, { value:"credit", label:"信用卡" }, { value:"wechat", label:"微信" }, { value:"alipay", label:"支付宝" }, { value:"ic_card", label:"交通卡" }] },
        { name:"placeId", label:"关联地点（可选）", type:"select", value: isEdit ? (e.placeId || "") : "", options: [{ value:"", label:"—" }].concat(places.map(function(p){ return { value:p.id, label:p.name }; })) }
      ],
      onSubmit: function(d){
        if (isEdit){
          Store.update(function(s){
            var t = s.expenses.find(function(x){ return x.id === e.id; });
            if (t) Object.assign(t, { date:d.date, category:d.category, amount:Number(d.amount)||0, currency:d.currency, description:d.description, paymentMethod:d.paymentMethod, placeId:d.placeId });
          });
        } else {
          Store.update(function(s){
            s.expenses.push({ id:uid(), date:d.date, category:d.category, amount:Number(d.amount)||0, currency:d.currency, description:d.description, placeId:d.placeId, paymentMethod:d.paymentMethod, createdAt:new Date().toISOString() });
          });
        }
        refresh();
      }
    });
  }

  // ---------- 景点图片 ----------
  function compressImage(file, maxSize, quality){
    return new Promise(function(resolve, reject){
      var reader = new FileReader();
      reader.onload = function(){
        var img = new Image();
        img.onload = function(){
          try {
            var w = img.width, h = img.height;
            var scale = Math.min(1, maxSize / Math.max(w, h));
            var cw = Math.max(1, Math.round(w * scale));
            var ch = Math.max(1, Math.round(h * scale));
            var canvas = document.createElement("canvas");
            canvas.width = cw; canvas.height = ch;
            var ctx = canvas.getContext("2d");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, cw, ch);
            ctx.drawImage(img, 0, 0, cw, ch);
            resolve(canvas.toDataURL("image/jpeg", quality));
          } catch(err){ reject(err); }
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function pickPhoto(placeId){
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = function(){
      var file = input.files && input.files[0];
      if (!file) return;
      toast("正在处理图片…");
      compressImage(file, 1100, 0.72).then(function(dataUrl){
        var ok = Store.update(function(s){
          var p = s.places.find(function(x){ return x.id === placeId; });
          if (p) p.photo = dataUrl;
        });
        refresh();
        toast(ok ? "图片已保存" : "本地空间快满了，图片可能没存下");
      }, function(){
        toast("这张图处理失败，换一张试试");
      });
    };
    input.click();
  }

  function openPhoto(placeId){
    var st = S();
    var p = st.places.find(function(x){ return x.id === placeId; });
    if (!p) return;
    if (!p.photo){ pickPhoto(placeId); return; }
    var root = $("#modalRoot");
    root.innerHTML = [
      '<div class="modal-backdrop"><div class="modal-card photo-card">',
      '<div class="modal-head"><h3>', esc(p.name), '</h3><button class="modal-close" data-act="close">✕</button></div>',
      '<div class="photo-view"><img src="', esc(p.photo), '" alt=""></div>',
      '<div class="modal-foot">',
      '<button class="btn ghost" data-act="photo-remove" data-id="', p.id, '" type="button">删除图片</button>',
      '<button class="btn primary" data-act="photo-change" data-id="', p.id, '" type="button">换一张</button>',
      '</div></div></div>'
    ].join("");
    root.onclick = function(e){
      if (e.target.classList && e.target.classList.contains("modal-backdrop")){ closeModal(); return; }
      var t = e.target.closest ? e.target.closest("[data-act]") : null;
      if (!t) return;
      var a = t.getAttribute("data-act");
      var id = t.getAttribute("data-id");
      if (a === "close") closeModal();
      else if (a === "photo-change"){ closeModal(); pickPhoto(id); }
      else if (a === "photo-remove"){
        Store.update(function(s){
          var pp = s.places.find(function(x){ return x.id === id; });
          if (pp) pp.photo = "";
        });
        closeModal();
        refresh();
        toast("已删除图片");
      }
    };
  }

  // ---------- 全局点击 ----------
  function onClick(e){
    var t = e.target.closest ? e.target.closest("[data-act]") : null;
    if (!t) return;
    var act = t.getAttribute("data-act");
    var id = t.getAttribute("data-id");
    var st = S();

    if (act === "goto"){
      var target = t.getAttribute("data-target");
      if (target === "home"){ showView("home"); }
      else { activeTab = target; showView("app"); }
    }
    else if (act === "scroll-days"){
      var el = $("#homeDays");
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior:"smooth", block:"start" });
    }
    else if (act === "open-day"){
      selectedDayId = id;
      activeTab = "itinerary";
      showView("app");
    }
    else if (act === "lock"){ setUnlocked(false); showView("lock"); }
    else if (act === "photo"){ openPhoto(id); }
    else if (act === "add-flight") flightForm(null);
    else if (act === "edit-flight") flightForm(st.flights.find(function(x){ return x.id === id; }));
    else if (act === "del-flight"){ if (confirm("删除该航班？")){ Store.update(function(s){ s.flights = s.flights.filter(function(x){ return x.id !== id; }); }); refresh(); } }
    else if (act === "add-place") placeForm(null);
    else if (act === "edit-place") placeForm(st.places.find(function(x){ return x.id === id; }));
    else if (act === "toggle-place"){ Store.update(function(s){ var p = s.places.find(function(x){ return x.id === id; }); if (p) p.visited = !p.visited; }); refresh(); }
    else if (act === "map-place"){ var p = st.places.find(function(x){ return x.id === id; }); if (p) window.open(googleMapsUrl(p), "_blank"); }
    else if (act === "day"){ selectedDayId = id; refresh(); }
    else if (act === "map-pin"){ var pp = st.places.find(function(x){ return x.id === id; }); var f = $("#mapFrame"); if (pp && f && pp.lat != null && pp.lng != null){ f.src = "https://maps.google.com/maps?q=" + pp.lat + "," + pp.lng + "&z=15&output=embed&hl=zh-CN"; } }
    else if (act === "add-reminder") reminderForm(null);
    else if (act === "edit-reminder") reminderForm(st.reminders.find(function(x){ return x.id === id; }));
    else if (act === "toggle-reminder"){ Store.update(function(s){ var r = s.reminders.find(function(x){ return x.id === id; }); if (r) r.status = (r.status === "done" ? "pending" : "done"); }); refresh(); }
    else if (act === "del-reminder"){ if (confirm("删除该提醒？")){ Store.update(function(s){ s.reminders = s.reminders.filter(function(x){ return x.id !== id; }); }); refresh(); } }
    else if (act === "add-check") checkForm(null);
    else if (act === "edit-check") checkForm(st.checklist.find(function(x){ return x.id === id; }));
    else if (act === "toggle-check"){ Store.update(function(s){ var c = s.checklist.find(function(x){ return x.id === id; }); if (c) c.checked = !c.checked; }); refresh(); }
    else if (act === "del-check"){ if (confirm("删除该条目？")){ Store.update(function(s){ s.checklist = s.checklist.filter(function(x){ return x.id !== id; }); }); refresh(); } }
    else if (act === "add-expense") expenseForm(null);
    else if (act === "edit-expense") expenseForm(st.expenses.find(function(x){ return x.id === id; }));
    else if (act === "del-expense"){ if (confirm("删除这笔开销？")){ Store.update(function(s){ s.expenses = s.expenses.filter(function(x){ return x.id !== id; }); }); refresh(); } }
    else if (act === "sync-on") openSyncModal();
    else if (act === "sync-off"){ try { localStorage.removeItem("gh_pat"); } catch(e){} toast("已断开同步"); setTimeout(function(){ location.reload(); }, 400); }
    else if (act === "export-data") exportData();
    else if (act === "import-data") importData();
    else if (act === "save-fx"){ var v = parseFloat($("#fxInput").value); Store.update(function(s){ s.trip.fxRate = (isNaN(v) ? 0 : v); }); refresh(); toast("汇率已更新"); }
  }

  // ---------- 备份：导出 / 导入 ----------
  function exportData(){
    var st = S();
    if (!st) return;
    try {
      var blob = new Blob([JSON.stringify(st, null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "北海道-" + cfg.tripId + "-备份.json";
      document.body.appendChild(a);
      a.click();
      setTimeout(function(){ URL.revokeObjectURL(url); if (a.parentNode) a.parentNode.removeChild(a); }, 1500);
      toast("已导出备份文件");
    } catch(e){ toast("导出失败：" + e.message); }
  }

  function importData(){
    var input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = function(){
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(){
        try {
          var data = JSON.parse(String(reader.result));
          if (!data || !data.days || !data.places) throw new Error("不是有效的备份文件");
          if (!confirm("导入会覆盖当前所有内容，确定吗？")) return;
          Store.update(function(s){
            ["trip","days","places","flights","reminders","checklist","expenses"].forEach(function(k){
              if (data[k] !== undefined) s[k] = data[k];
            });
          });
          refresh();
          toast("导入成功");
        } catch(err){
          toast("导入失败：" + (err && err.message ? err.message : "文件格式不对"));
        }
      };
      reader.onerror = function(){ toast("读取文件失败"); };
      reader.readAsText(file, "utf-8");
    };
    input.click();
  }

  // ---------- 分享 ----------
  function share(){
    if (location.protocol === "file:"){
      toast("请先部署到 GitHub Pages 再分享");
      return;
    }
    var url = location.origin + location.pathname + "?trip=" + encodeURIComponent(cfg.tripId);
    function fallback(){ window.prompt("复制链接分享给对方：", url); }
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(url).then(function(){ toast("链接已复制，发给对方即可"); }, fallback);
    } else {
      fallback();
    }
  }

  // ---------- 雪 ----------
  function buildSnowflakes(){
    var wrap = $("#snowflakes");
    if (!wrap) return;
    var html = [];
    for (var i = 0; i < 24; i++){
      var left = Math.round(Math.random() * 100);
      var size = 2 + Math.round(Math.random() * 4);
      var dur = 9 + Math.round(Math.random() * 15);
      var delay = -Math.round(Math.random() * 22);
      var op = (0.22 + Math.random() * 0.45).toFixed(2);
      html.push('<span style="left:' + left + '%;width:' + size + 'px;height:' + size + 'px;animation-duration:' + dur + 's;animation-delay:' + delay + 's;opacity:' + op + '"></span>');
    }
    wrap.innerHTML = html.join("");
  }

  // ---------- 启动 ----------
  function init(){
    try {
      buildSnowflakes();
      Store.subscribe(refresh);

    var lf = $("#lockForm");
    if (lf) lf.addEventListener("submit", doUnlock);
    var bs = $("#btnShare");
    if (bs) bs.addEventListener("click", share);
    var bl = $("#btnLock");
    if (bl) bl.addEventListener("click", function(){ setUnlocked(false); showView("lock"); });
    var hl = $("#homeLink");
    if (hl) hl.addEventListener("click", function(){ showView("home"); });
    var bn = $("#bottomNav");
    if (bn){
      bn.addEventListener("click", function(e){
        var b = e.target.closest ? e.target.closest(".nav-item") : null;
        if (!b) return;
        var tab = b.getAttribute("data-tab");
        if (tab === "home"){ showView("home"); return; }
        activeTab = tab;
        showView("app");
      });
    }
    document.addEventListener("click", onClick);
    window.__gateBound = true;

    if (isUnlocked() || forceOpen){
      $("#lockScreen").classList.add("hidden");
    } else {
      showView("lock");
    }
      window.__appReady = true;
      // 先用本地数据秒开，云端在后台尝试（连不上完全不影响使用）
      Store.load().then(function(){
        if ((isUnlocked() || forceOpen) && view === "lock") showView("home");
        else refresh();
      }).catch(function(err){
        console.warn(err);
        if ((isUnlocked() || forceOpen) && view === "lock") showView("home");
      });
      // 云端由 Store.load() 内部自动尝试（LeanCloud > Supabase > 本地）
    } catch(err){
      window.__appReady = true;
      var le = $("#lockErr");
      if (le) le.textContent = "页面初始化出错：" + (err && err.message ? err.message : err);
      var dd = $("#diagLine");
      if (dd) dd.textContent = "诊断：APP_CONFIG=" + (window.APP_CONFIG ? "已加载" : "缺失") + " · Store=" + (window.Store ? "已加载" : "缺失");
    }
  }

  init();
})();
