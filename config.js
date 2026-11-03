window.APP_CONFIG = {
  tripId: "猪猪饲料",
  accessPassword: "lu123321",

  // ---- 云端实时同步：用你自己的 GitHub 仓库当数据库（免费、国内可直连）----
  // 令牌不写在这里，而是在页面里填一次，只存在你自己设备上。
  github: {
    owner: "pigfeed6538166-stack",
    repo: "ppfhokkaido-trip",
    branch: "main",
    path: "trip-data.json"
  },

  // ---- 备用（国内不可用，可留空）----
  leancloud: { appId: "", appKey: "", serverURL: "" },
  supabaseUrl: "",
  supabaseAnonKey: "",

  googleMapsApiKey: "",
  fxRate: 0.048
};
