import React, { useMemo, useState } from "react";
import { useDidShow } from "@tarojs/taro";
import { Button, Picker, ScrollView, Text, View } from "@tarojs/components";
import { BackButton } from "../../components/navigation";
import { getLearningStats } from "../../utils/practiceStats";
import { switchToTab } from "../../utils/navigation";
import "../../styles/common.scss";

const dimensionOptions = [
  { key: "unit", label: "章节" },
  { key: "knowledgePoint", label: "知识点" },
  { key: "type", label: "题型" },
  { key: "grade", label: "年级" },
  { key: "subject", label: "学科" },
  { key: "semester", label: "上下册" }
];

export default function StatsPage() {
  const [stats, setStats] = useState(() => getLearningStats());
  const [dimension, setDimension] = useState("unit");

  useDidShow(() => {
    setStats(getLearningStats());
  });

  const currentDimension = useMemo(() => dimensionOptions.find((item) => item.key === dimension) || dimensionOptions[0], [dimension]);
  const dimensionRows = stats.dimensions?.[dimension] || [];
  const hasRecords = stats.summary.total > 0;
  const masteredTotal = (stats.summary.masteredWrong || 0) + (stats.summary.unmasteredWrong || 0);
  const masteredPercent = masteredTotal ? Math.round(((stats.summary.masteredWrong || 0) / masteredTotal) * 100) : 0;
  const accuracyText = stats.summary.total ? `${stats.summary.accuracy || 0}%` : "--";

  return (
    <ScrollView className="page stats-page page-shell safe-bottom-space" scrollY>
      <BackButton />
      <View className="hero hero-card hero-card--blue stats-hero">
        <View className="stats-hero-copy">
          <Text className="hero-title">学习统计</Text>
          <Text className="hero-subtitle">查看练习表现、错题掌握和薄弱知识点。</Text>
          <View className="stats-hero-tags">
            <Text className="stats-hero-tag">成长报告</Text>
            <Text className="stats-hero-tag">错题掌握</Text>
          </View>
        </View>
        <View className="stats-hero-illus">
          <View className="stats-chart-bar bar-a" />
          <View className="stats-chart-bar bar-b" />
          <View className="stats-chart-bar bar-c" />
          <View className="stats-chart-line" />
          <View className="stats-trophy">★</View>
        </View>
      </View>

      {!hasRecords ? (
        <View className="card empty-card">
          <Text className="empty-title">还没有练习记录，先去做几道题吧。</Text>
          <Button className="primary-button btn-primary full-button" onClick={() => switchToTab("/pages/practice/index")}>去章节练习</Button>
        </View>
      ) : null}

      <View className="card study-card stats-overview-card">
        <Text className="section-title">学习概览</Text>
        <View className="stats-grid stat-grid stats-overview-grid">
          <StatBox icon="📝" tone="blue" label="今日做题" value={stats.summary.todayTotal} />
          <StatBox icon="📚" tone="purple" label="累计做题" value={stats.summary.total} />
          <StatBox icon="🎯" tone="green" label="正确率" value={accuracyText} />
          <StatBox icon="📒" tone="orange" label="错题数" value={stats.summary.wrongBookTotal} />
        </View>
        <Text className="muted stats-recent">最近练习：{formatTime(stats.summary.recentPracticeAt)}</Text>
      </View>

      <View className="card study-card learning-path-card stats-mastery-card">
        <View className="card-title-row">
          <View>
            <Text className="section-title">错题掌握</Text>
            <Text className="section-subtitle">看错题是否已经真正掌握。</Text>
          </View>
          <Text className="mastery-percent">{masteredPercent}%</Text>
        </View>
        <View className="stat-grid mastery-grid">
          <View className="stat-card mastery-stat mastered">
            <Text className="stat-value">{stats.summary.masteredWrong || 0}</Text>
            <Text className="stat-label">已掌握</Text>
          </View>
          <View className="stat-card mastery-stat unmastered">
            <Text className="stat-value">{stats.summary.unmasteredWrong || 0}</Text>
            <Text className="stat-label">未掌握</Text>
          </View>
        </View>
        <View className="progress-track">
          <View className="progress-bar" style={{ width: `${masteredPercent}%` }} />
        </View>
      </View>

      <View className="card study-card stats-dimension-card">
        <View className="card-title-row">
          <Text className="section-title">按维度统计</Text>
          <Picker mode="selector" range={dimensionOptions.map((item) => item.label)} value={Math.max(0, dimensionOptions.findIndex((item) => item.key === dimension))} onChange={(event) => setDimension(dimensionOptions[event.detail.value]?.key || "unit")}>
            <View className="small-picker">{currentDimension.label} ▾</View>
          </Picker>
        </View>
        {dimensionRows.length ? dimensionRows.slice(0, 12).map((item) => (
          <View className="stat-row-card study-card report-row-card" key={item.key}>
            <View className="card-title-row">
              <Text className="stat-row-title">{item.label || "未记录"}</Text>
              <Text className="tag">{item.accuracy}%</Text>
            </View>
            <Text className="muted">练习 {item.total} · 正确 {item.correct} · 错误 {item.wrong}</Text>
            <Text className="muted">错题 {item.wrongBook} · 已掌握 {item.mastered} · 未掌握 {item.unmastered}</Text>
          </View>
        )) : (
          <Text className="muted">暂无可统计的数据。</Text>
        )}
      </View>

      <View className="card study-card weak-section-card">
        <View className="card-title-row">
          <View>
            <Text className="section-title">薄弱知识点</Text>
            <Text className="section-subtitle">优先复习错误次数多、正确率低的内容。</Text>
          </View>
        </View>
        {stats.weakPoints.length ? stats.weakPoints.map((item) => (
          <View className="weak-card study-card weak-report-card" key={item.key}>
            <View className="weak-rank-icon">弱</View>
            <View className="weak-report-copy">
              <Text className="stat-row-title">{item.knowledgePoint}</Text>
              <Text className="muted">{item.unit} · {item.type}</Text>
              <View className="weak-meta-row">
                <Text className="wrong-info-chip wrong-info-chip--orange">错误 {item.wrongCount} 次</Text>
                <Text className="wrong-info-chip">未掌握 {item.unmastered}</Text>
                <Text className="wrong-info-chip">正确率 {item.accuracy}%</Text>
              </View>
            </View>
            <Button className="secondary-button btn-secondary" onClick={() => switchToTab("/pages/wrong/index")}>去错题重练</Button>
          </View>
        )) : (
          <View className="empty-card">
            <Text className="empty-title">暂时没有明显薄弱点，继续保持！</Text>
          </View>
        )}
      </View>

      <View className="card study-card recent-report-card">
        <Text className="section-title">最近练习记录</Text>
        {stats.recentRecords.length ? stats.recentRecords.map((item) => (
          <View className="record-row record-report-row" key={item.id}>
            <View className="record-source-icon">{item.source === "wrongBook" ? "错" : "练"}</View>
            <View className="record-copy">
              <Text className="record-title">{item.grade} / {item.subject} / {item.semester}</Text>
              <Text className="muted">{item.unit} · {item.type} · {item.isCorrect ? "答对" : "答错"}</Text>
              <Text className="muted">{item.source === "wrongBook" ? "来自错题重练" : "来自章节练习"} · {formatTime(item.updatedAt)}</Text>
            </View>
          </View>
        )) : (
          <Text className="muted">还没有练习记录，先去做几道题吧。</Text>
        )}
      </View>
    </ScrollView>
  );
}

function StatBox({ label, value, icon = "•", tone = "blue" }) {
  return (
    <View className={`stat-box stat-card report-stat-card ${tone}`}>
      <Text className="report-stat-icon">{icon}</Text>
      <Text className="stat-value">{value ?? 0}</Text>
      <Text className="stat-label">{label}</Text>
    </View>
  );
}

function formatTime(value) {
  if (!value) return "暂无";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "暂无";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hour}:${minute}`;
}
