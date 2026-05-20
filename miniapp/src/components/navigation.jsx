import React from "react";
import Taro from "@tarojs/taro";
import { Button, View } from "@tarojs/components";

export function BackButton({ fallback = "/pages/index/index" }) {
  function handleBack() {
    const pages = typeof getCurrentPages === "function" ? getCurrentPages() : [];
    if (pages.length > 1) {
      Taro.navigateBack();
      return;
    }
    Taro.switchTab({ url: fallback });
  }

  return (
    <View className="back-bar">
      <Button className="back-button" onClick={handleBack}>‹ 返回</Button>
    </View>
  );
}
