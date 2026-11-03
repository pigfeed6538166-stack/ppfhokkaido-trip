// 默认行程数据（首次打开时初始化，之后以云端/本地存储为准）
function defaultState(){
  var cfg = window.APP_CONFIG;
  var trip = {
    id: cfg.tripId,
    title: "北海道 × 猪猪饲料",
    startDate: "2027-01-30",
    endDate: "2027-02-04",
    currencies: ["JPY","CNY"],
    fxRate: cfg.fxRate,
    hero: {
      kicker: "HOKKAIDO · WINTER JOURNEY",
      coverTitle: "北海道 × 猪猪饲料",
      coverLine: "六日，从雪里穿过",
      cities: "Sapporo · Asahikawa · Biei · Otaru · Zenibako · Jōzankei",
      dates: "2027.01.30 — 02.04",
      poem: "落地札幌，雪就落了下来。向北是旭川的旷野与美瑛的丘陵，向南是小樽的运河与钱函的海。定山溪的温泉蒸起白雾，把一整天的寒意慢慢化开；再回到札幌，薄野的灯火与狸小路的雪，把六天走成一封寄给冬天的手写信。",
      stats: ["六日", "六站", "一场温泉", "一路雪"],
      sectionTitle: "一条路，六站",
      sectionSub: "从新千岁启程，向北走进旭川与美瑛的雪色，再向南漫游小樽、钱函，最后赴定山溪寻一场温泉，回到札幌，为这段旅程收尾——六站风景，一场只属于我们的北海道冬日之约。"
    }
  };
  var days = [
    { id:"d1", date:"2027-01-30", dayIndex:1, title:"出发日 · 航班", en:"DEPARTURE", summary:"" },
    { id:"d2", date:"2027-01-31", dayIndex:2, title:"旭川 · 美瑛", en:"ASAHIKAWA / BIEI", summary:"" },
    { id:"d3", date:"2027-02-01", dayIndex:3, title:"小樽 · 钱函站", en:"OTARU / ZENIBAKO", summary:"" },
    { id:"d4", date:"2027-02-02", dayIndex:4, title:"定山溪温泉", en:"JOZANKEI ONSEN", summary:"" },
    { id:"d5", date:"2027-02-03", dayIndex:5, title:"札幌 · 市区", en:"SAPPORO", summary:"" },
    { id:"d6", date:"2027-02-04", dayIndex:6, title:"返程日 · 航班", en:"RETURN", summary:"" }
  ];
  var places = [
    { id:"p1", dayId:"d2", order:1, name:"旭川", nameJa:"旭川", category:"sight", lat:43.7639, lng:142.3586, googlePlaceId:"", address:"", startTime:"", endTime:"", visited:false, notes:"", photo:"" },
    { id:"p2", dayId:"d2", order:2, name:"美瑛", nameJa:"美瑛", category:"sight", lat:43.5910, lng:142.4616, googlePlaceId:"", address:"", startTime:"", endTime:"", visited:false, notes:"", photo:"" },
    { id:"p3", dayId:"d3", order:1, name:"小樽", nameJa:"小樽", category:"sight", lat:43.1907, lng:141.0022, googlePlaceId:"", address:"", startTime:"", endTime:"", visited:false, notes:"", photo:"" },
    { id:"p4", dayId:"d3", order:2, name:"钱函站", nameJa:"銭函駅", category:"station", lat:43.1587, lng:141.1593, googlePlaceId:"", address:"", startTime:"", endTime:"", visited:false, notes:"", photo:"" },
    { id:"p5", dayId:"d4", order:1, name:"定山溪温泉", nameJa:"定山渓温泉", category:"onsen", lat:42.9680, lng:141.1655, googlePlaceId:"", address:"", startTime:"", endTime:"", visited:false, notes:"", photo:"" },
    { id:"p6", dayId:"d5", order:1, name:"札幌", nameJa:"札幌", category:"sight", lat:43.0618, lng:141.3545, googlePlaceId:"", address:"", startTime:"", endTime:"", visited:false, notes:"", photo:"" },
    { id:"p7", dayId:"d5", order:2, name:"大丸百货", nameJa:"大丸札幌店", category:"shopping", lat:43.0680, lng:141.3505, googlePlaceId:"", address:"", startTime:"", endTime:"", visited:false, notes:"", photo:"" },
    { id:"p8", dayId:"d5", order:3, name:"Stellar Place", nameJa:"ステラプレイス", category:"shopping", lat:43.0670, lng:141.3508, googlePlaceId:"", address:"", startTime:"", endTime:"", visited:false, notes:"", photo:"" },
    { id:"p9", dayId:"d5", order:4, name:"薄野", nameJa:"すすきの", category:"sight", lat:43.0549, lng:141.3537, googlePlaceId:"", address:"", startTime:"", endTime:"", visited:false, notes:"", photo:"" },
    { id:"p10", dayId:"d5", order:5, name:"狸小路", nameJa:"狸小路商店街", category:"shopping", lat:43.0567, lng:141.3515, googlePlaceId:"", address:"", startTime:"", endTime:"", visited:false, notes:"", photo:"" },
    { id:"p11", dayId:"d5", order:6, name:"大通公园", nameJa:"大通公園", category:"sight", lat:43.0594, lng:141.3465, googlePlaceId:"", address:"", startTime:"", endTime:"", visited:false, notes:"", photo:"" }
  ];
  var flights = [
    { id:"f1", direction:"outbound", airline:"", flightNo:"", fromAirport:"北京 (PEK)", toAirport:"新千岁 (CTS)", departureTime:"2027-01-30T09:00", arrivalTime:"2027-01-30T14:00", terminal:"", gate:"", seat:"", bookingRef:"", baggage:"", notes:"航班信息待填写" },
    { id:"f2", direction:"return", airline:"", flightNo:"", fromAirport:"新千岁 (CTS)", toAirport:"北京 (PEK)", departureTime:"2027-02-04T15:00", arrivalTime:"2027-02-04T19:00", terminal:"", gate:"", seat:"", bookingRef:"", baggage:"", notes:"航班信息待填写" }
  ];
  var reminders = [
    { id:"r1", placeId:"p5", title:"提前购买定山溪温泉日归券", type:"ticket", dueAt:"2027-02-01T09:00", status:"pending", url:"", amount:0, notes:"" },
    { id:"r2", placeId:"", title:"确认返程航班 / 在线值机", type:"other", dueAt:"2027-02-03T12:00", status:"pending", url:"", amount:0, notes:"" }
  ];
  var checklist = [
    { id:"c1", category:"证件", content:"护照", checked:false, order:1 },
    { id:"c2", category:"证件", content:"JR Pass / 交通券", checked:false, order:2 },
    { id:"c3", category:"电子", content:"手机 + 充电器 + 充电宝", checked:false, order:1 },
    { id:"c4", category:"电子", content:"转换插头 / 移动WiFi / 流量卡", checked:false, order:2 },
    { id:"c5", category:"衣物", content:"羽绒服 / 保暖内衣 / 手套帽子", checked:false, order:1 },
    { id:"c6", category:"药品", content:"常用药 / 感冒药 / 暖宝宝", checked:false, order:1 },
    { id:"c7", category:"其他", content:"现金（日元）+ 银行卡", checked:false, order:1 }
  ];
  var expenses = [];
  return { schemaVersion:2, trip: trip, days: days, places: places, flights: flights, reminders: reminders, checklist: checklist, expenses: expenses };
}
