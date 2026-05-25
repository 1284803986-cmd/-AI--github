import React, { useEffect, useState } from "react";
import Taro, { useDidShow } from "@tarojs/taro";
import { Button, Text, View } from "@tarojs/components";
import { navigateToPage } from "../../utils/navigation";
import { getLearningStats } from "../../utils/practiceStats";
import "../../styles/common.scss";

export default function MePage() {
  const [role, setRole] = useState("学生");
  const [grade, setGrade] = useState("一年级");
  const [stats, setStats] = useState(() => getLearningStats());

  useEffect(() => {
    refreshProfile();
  }, []);

  useDidShow(() => {
    refreshProfile();
  });

  function refreshProfile() {
    const savedRole = Taro.getStorageSync("homeRole");
    const savedGrade = Taro.getStorageSync("homeGrade");
    setRole(savedRole === "teacher" ? "老师" : "学生");
    if (savedGrade) setGrade(savedGrade);
    setStats(getLearningStats());
  }

  function switchRole() {
    const nextRole = role === "学生" ? "老师" : "学生";
    setRole(nextRole);
    Taro.setStorageSync("homeRole", nextRole === "老师" ? "teacher" : "student");
    Taro.showToast({ title: `已切换为${nextRole}`, icon: "none" });
  }

  const summary = stats.summary || {};
  const accuracyText = summary.total ? `${summary.accuracy || 0}%` : "--";

  return (
    <View className="page me-page page-shell safe-bottom-space">
      <View className="hero hero-card hero-card--blue me-hero">
        <View className="me-hero-copy">
          <Text className="hero-title">我的</Text>
          <Text className="hero-subtitle">管理身份、年级和学习记录。</Text>
          <View className="me-hero-badges">
            <Text className="me-hero-badge">学习档案</Text>
            <Text className="me-hero-badge">成长记录</Text>
          </View>
        </View>
        <View className="me-avatar-illus">
          <Text className="me-avatar-face">学</Text>
          <View className="me-avatar-book" />
          <View className="me-avatar-star" />
        </View>
      </View>

      <View className="card study-card profile-center-card">
        <View className="card-title-row">
          <View>
            <Text className="section-title">当前信息</Text>
            <Text className="section-subtitle">学习身份和首页年级会影响默认学习入口。</Text>
          </View>
        </View>
        <View className="profile-info-grid">
          <View className="profile-info-item">
            <Text className="profile-info-icon">👤</Text>
            <View>
              <Text className="profile-label">身份</Text>
              <Text className="profile-value">{role}</Text>
            </View>
          </View>
          <View className="profile-info-item">
            <Text className="profile-info-icon">📘</Text>
            <View>
              <Text className="profile-label">首页年级</Text>
              <Text className="profile-value">{grade}</Text>
            </View>
          </View>
        </View>
        <Button className="secondary-button btn-secondary full-button profile-switch-button" onClick={switchRole}>切换身份</Button>
      </View>

      <View className="card study-card profile-report-card">
        <Text className="section-title">学习概况</Text>
        <View className="stat-grid profile-stat-grid">
          <View className="stat-card profile-stat-card blue">
            <Text className="profile-stat-icon">📝</Text>
            <Text className="stat-value">{summary.total || 0}</Text>
            <Text className="stat-label">累计做题</Text>
          </View>
          <View className="stat-card profile-stat-card green">
            <Text className="profile-stat-icon">🎯</Text>
            <Text className="stat-value">{accuracyText}</Text>
            <Text className="stat-label">正确率</Text>
          </View>
          <View className="stat-card profile-stat-card orange">
            <Text className="profile-stat-icon">📒</Text>
            <Text className="stat-value">{summary.wrongBookTotal || 0}</Text>
            <Text className="stat-label">错题数</Text>
          </View>
          <View className="stat-card profile-stat-card purple">
            <Text className="profile-stat-icon">🏅</Text>
            <Text className="stat-value">{summary.masteredWrong || 0}</Text>
            <Text className="stat-label">已掌握</Text>
          </View>
        </View>
      </View>

      <View className="card study-card profile-entry-section">
        <Text className="section-title">常用功能</Text>
        <View className="entry-grid learning-entry-grid">
          <Button className="entry-card learning-entry-card profile-entry-card stats-entry" onClick={() => navigateToPage("/pages/stats/index")}>
            <Text className="profile-entry-icon">📊</Text>
            <View className="entry-copy no-image">
              <Text className="entry-title">学习统计</Text>
              <Text className="entry-desc">查看练习数量、正确率和薄弱点</Text>
            </View>
          </Button>
          <Button className="entry-card learning-entry-card profile-entry-card history-entry" onClick={() => navigateToPage("/pages/history/index")}>
            <Text className="profile-entry-icon">🕘</Text>
            <View className="entry-copy no-image">
              <Text className="entry-title">历史记录</Text>
              <Text className="entry-desc">查看生成和练习记录</Text>
            </View>
          </Button>
          <Button className="entry-card learning-entry-card profile-entry-card homework-entry" onClick={() => navigateToPage("/pages/homework/index")}>
            <Text className="profile-entry-icon">📋</Text>
            <View className="entry-copy no-image">
              <Text className="entry-title">作业中心</Text>
              <Text className="entry-desc">学生作业和老师布置</Text>
            </View>
          </Button>
          <Button className="entry-card learning-entry-card profile-entry-card privacy-entry" onClick={() => navigateToPage("/pages/privacy/index")}>
            <Text className="profile-entry-icon">🛡</Text>
            <View className="entry-copy no-image">
              <Text className="entry-title">隐私说明</Text>
              <Text className="entry-desc">查看本地数据说明</Text>
            </View>
          </Button>
          <Button className="entry-card learning-entry-card profile-entry-card about-entry" onClick={() => navigateToPage("/pages/about/index")}>
            <Text className="profile-entry-icon">✨</Text>
            <View className="entry-copy no-image">
              <Text className="entry-title">关于小程序</Text>
              <Text className="entry-desc">查看版本和用途</Text>
            </View>
          </Button>
        </View>
      </View>
    </View>
  );
}
