export default defineAppConfig({
  pages: [
    "pages/index/index",
    "pages/practice/index",
    "pages/wrong/index",
    "pages/me/index",
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
        iconPath: "assets/generated/icon-history.png",
        selectedIconPath: "assets/generated/icon-history.png"
      },
      {
        pagePath: "pages/practice/index",
        text: "练习",
        iconPath: "assets/generated/icon-practice.png",
        selectedIconPath: "assets/generated/icon-practice.png"
      },
      {
        pagePath: "pages/wrong/index",
        text: "错题",
        iconPath: "assets/generated/icon-wrong.png",
        selectedIconPath: "assets/generated/icon-wrong.png"
      },
      {
        pagePath: "pages/me/index",
        text: "我的",
        iconPath: "assets/generated/icon-student-homework.png",
        selectedIconPath: "assets/generated/icon-student-homework.png"
      }
    ]
  }
});
