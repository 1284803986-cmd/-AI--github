import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from "@tarojs/taro";

const DEFAULT_SHARE = {
  title: "小智练题 - 小学同步练习工具",
  path: "/pages/index/index"
};

export function usePageShare(config) {
  const readConfig = () => normalizeConfig(typeof config === "function" ? config() : config);

  useShareAppMessage(() => readConfig());

  useShareTimeline(() => {
    const next = readConfig();
    return {
      title: next.title,
      query: getQuery(next.path),
      imageUrl: next.imageUrl
    };
  });

  useDidShow(() => {
    try {
      Taro.showShareMenu({
        withShareTicket: true,
        menus: ["shareAppMessage", "shareTimeline"]
      });
    } catch {
      // Some devtool/runtime versions do not expose showShareMenu. The share hooks above still enable forwarding.
    }
  });
}

function normalizeConfig(config = {}) {
  return {
    ...DEFAULT_SHARE,
    ...config
  };
}

function getQuery(path = "") {
  const query = String(path).split("?")[1] || "";
  return query;
}
