// ============================================================
//  旅行记录 · 配置文件（部署前一般只需改这里）
// ============================================================
window.APP_CONFIG = {
  // 行程标识 —— 分享链接 ?trip=猪猪饲料 用的就是它
  tripId: "猪猪饲料",

  // 进入网站需要输入的密码（改这里就能换密码）
  accessPassword: "lu123321",

  // ---- 云端实时同步（方案B）----
  // publishable key 是「可以公开」的密钥，放在前端是安全的（前提是你开了 RLS，
  // schema.sql 里已经开了）。secret key 绝对不要写在这里。
  supabaseUrl: "",                                              // ← 还需要你的 Project URL
  supabaseAnonKey: "sb_publishable_TYO7K_e-OIzlp3740ffXQQ_qiBljO8c",

  // ---- Google 地图 ----
  googleMapsApiKey: "",

  // 汇率：1 日元 = 多少人民币（记账汇总用，也可在「记账」页直接改）
  fxRate: 0.048
};
