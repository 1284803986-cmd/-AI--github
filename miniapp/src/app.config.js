export default defineAppConfig({
  pages: [
    "pages/index/index",
    "pages/practice/index",
    "pages/practice/do/index",
    "pages/photo-search/index",
    "pages/wrong/index",
    "pages/me/index",
    "pages/stats/index",
    "pages/homework/index",
    "pages/homework/create",
    "pages/homework/list",
    "pages/homework/archive",
    "pages/homework/detail",
    "pages/homework/submissions",
    "pages/student/index",
    "pages/student/work",
    "pages/paper/index",
    "pages/history/index",
    "pages/privacy/index",
    "pages/about/index"
  ],
  window: {
    backgroundTextStyle: "light",
    navigationBarBackgroundColor: "#2563eb",
    navigationBarTitleText: "小学学习练习",
    navigationBarTextStyle: "white"
  },
  tabBar: {
    color: "#64748b",
    selectedColor: "#2563eb",
    backgroundColor: "#ffffff",
    borderStyle: "white",
    list: [
      {
        pagePath: "pages/index/index",
        text: "首页",
        iconPath: "assets/generated/tab-home.png",
        selectedIconPath: "assets/generated/tab-home-active.png"
      },
      {
        pagePath: "pages/practice/index",
        text: "练习",
        iconPath: "assets/generated/tab-practice.png",
        selectedIconPath: "assets/generated/tab-practice-active.png"
      },
      {
        pagePath: "pages/wrong/index",
        text: "错题",
        iconPath: "assets/generated/tab-wrong.png",
        selectedIconPath: "assets/generated/tab-wrong-active.png"
      },
      {
        pagePath: "pages/me/index",
        text: "我的",
        iconPath: "assets/generated/tab-me.png",
        selectedIconPath: "assets/generated/tab-me-active.png"
      }
    ]
  }
});
