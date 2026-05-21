import Taro from "@tarojs/taro";

const TAB_PAGES = new Set([
  "/pages/index/index",
  "/pages/practice/index",
  "/pages/wrong/index",
  "/pages/me/index"
]);

function normalizeUrl(url) {
  return url?.startsWith("/") ? url : `/${url || ""}`;
}

function getPagePath(url) {
  return normalizeUrl(url).split("?")[0];
}

export function isTabPage(url) {
  return TAB_PAGES.has(getPagePath(url));
}

export function switchToTab(url, options = {}) {
  return Taro.switchTab({ ...options, url: getPagePath(url) });
}

export function navigateToPage(url, options = {}) {
  const normalizedUrl = normalizeUrl(url);
  const pagePath = getPagePath(normalizedUrl);

  if (TAB_PAGES.has(pagePath)) {
    return Taro.switchTab({ ...options, url: pagePath });
  }

  return Taro.navigateTo({
    ...options,
    url: normalizedUrl,
    fail(error) {
      if (String(error?.errMsg || "").includes("can not navigateTo a tabbar page")) {
        Taro.switchTab({ url: pagePath });
        return;
      }
      options.fail?.(error);
    }
  });
}
