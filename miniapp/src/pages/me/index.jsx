import React, { useEffect, useState } from "react";
import Taro from "@tarojs/taro";
import { Button, Text, View } from "@tarojs/components";
import { navigateToPage } from "../../utils/navigation";
import "../../styles/common.scss";

export default function MePage() {
  const [role, setRole] = useState("学生");
  const [grade, setGrade] = useState("二年级");

  useEffect(() => {
    const savedRole = Taro.getStorageSync("homeRole");
    const savedGrade = Taro.getStorageSync("homeGrade");
    setRole(savedRole === "teacher" ? "老师" : "学生");
    if (savedGrade) setGrade(savedGrade);
  }, []);

  function switchRole() {
    const nextRole = role === "学生" ? "老师" : "学生";
    setRole(nextRole);
    Taro.setStorageSync("homeRole", nextRole === "老师" ? "teacher" : "student");
    Taro.showToast({ title: `已切换为${nextRole}`, icon: "none" });
  }

  return (
    <View className="page">
      <View className="hero">
        <Text className="hero-title">我的</Text>
        <Text className="hero-subtitle">管理身份、年级、历史记录和基础说明。</Text>
      </View>

      <View className="card">
        <Text className="section-title">当前信息</Text>
        <View className="profile-row">
          <Text className="profile-label">身份</Text>
          <Text className="profile-value">{role}</Text>
        </View>
        <View className="profile-row">
          <Text className="profile-label">首页年级</Text>
          <Text className="profile-value">{grade}</Text>
        </View>
        <Button className="secondary-button full-button" onClick={switchRole}>切换身份</Button>
      </View>

      <View className="card">
        <Text className="section-title">常用功能</Text>
        <View className="entry-grid">
          <Button className="entry-card" onClick={() => navigateToPage("/pages/history/index")}>
            <View className="entry-copy no-image">
              <Text className="entry-title">历史记录</Text>
              <Text className="entry-desc">查看生成和练习记录</Text>
            </View>
          </Button>
          <Button className="entry-card" onClick={() => navigateToPage("/pages/privacy/index")}>
            <View className="entry-copy no-image">
              <Text className="entry-title">隐私说明</Text>
              <Text className="entry-desc">查看本地数据说明</Text>
            </View>
          </Button>
          <Button className="entry-card" onClick={() => navigateToPage("/pages/about/index")}>
            <View className="entry-copy no-image">
              <Text className="entry-title">关于小程序</Text>
              <Text className="entry-desc">查看版本和用途</Text>
            </View>
          </Button>
          <Button className="entry-card" onClick={() => navigateToPage("/pages/homework/index")}>
            <View className="entry-copy no-image">
              <Text className="entry-title">作业中心</Text>
              <Text className="entry-desc">学生作业和老师布置</Text>
            </View>
          </Button>
        </View>
      </View>
    </View>
  );
}
