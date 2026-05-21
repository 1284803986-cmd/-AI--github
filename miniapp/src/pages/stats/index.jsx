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

  return (
    <ScrollView className="page stats-page" scrollY>
      <BackButton />
      <View className="hero">
        <Text className="hero-title">学习统计</Text>
        <Text className="hero-subtitle">查看练习数量、正确率、错题掌握情况和薄弱知识点。</Text>
      </View>

      {!hasRecords ? (
        <View className="card empty-state">
          <Text className="empty-title">还没有练习记录，先去做几道题吧。</Text>
          <Button className="primary-button full-button" onClick={() => switchToTab("/pages/practice/index")}>去章节练习</Button>
        </View>
      ) : null}

      <View className="card">
        <Text className="section-title">学习概况</Text>
        <View className="stats-grid">
          <StatBox label="今日练习" value={stats.summary.todayTotal} />
          <StatBox label="累计练习" value={stats.summary.total} />
          <StatBox label="正确题数" value={stats.summary.correct} />
          <StatBox label="错误题数" value={stats.summary.wrong} />
          <StatBox label="正确率" value={`${stats.summary.accuracy}%`} />
          <StatBox label="错题总数" value={stats.summary.wrongBookTotal} />
          <StatBox label="已掌握错题" value={stats.summary.masteredWrong} />
          <StatBox label="未掌握错题" value={stats.summary.unmasteredWrong} />
        </View>
        <Text className="muted stats-recent">最近练习：{formatTime(stats.summary.recentPracticeAt)}</Text>
      </View>

      <View className="card">
        <View className="card-title-row">
          <Text className="section-title">按维度统计</Text>
          <Picker mode="selector" range={dimensionOptions.map((item) => item.label)} value={Math.max(0, dimensionOptions.findIndex((item) => item.key === dimension))} onChange={(event) => setDimension(dimensionOptions[event.detail.value]?.key || "unit")}>
            <View className="small-picker">{currentDimension.label} ▾</View>
          </Picker>
        </View>
        {dimensionRows.length ? dimensionRows.slice(0, 12).map((item) => (
          <View className="stat-row-card" key={item.key}>
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

      <View className="card">
        <Text className="section-title">薄弱知识点</Text>
        {stats.weakPoints.length ? stats.weakPoints.map((item) => (
          <View className="weak-card" key={item.key}>
            <Text className="stat-row-title">{item.knowledgePoint}</Text>
            <Text className="muted">{item.unit} · {item.type}</Text>
            <Text className="muted">错误次数 {item.wrongCount} · 未掌握 {item.unmastered} · 正确率 {item.accuracy}%</Text>
            <Button className="secondary-button" onClick={() => switchToTab("/pages/wrong/index")}>去错题重练</Button>
          </View>
        )) : (
          <View className="empty-state">
            <Text className="empty-title">暂时没有明显薄弱点，继续保持！</Text>
          </View>
        )}
      </View>

      <View className="card">
        <Text className="section-title">最近练习记录</Text>
        {stats.recentRecords.length ? stats.recentRecords.map((item) => (
          <View className="record-row" key={item.id}>
            <Text className="record-title">{item.grade} / {item.subject} / {item.semester}</Text>
            <Text className="muted">{item.unit} · {item.type} · {item.isCorrect ? "答对" : "答错"}</Text>
            <Text className="muted">{item.source === "wrongBook" ? "来自错题重练" : "来自章节练习"} · {formatTime(item.updatedAt)}</Text>
          </View>
        )) : (
          <Text className="muted">还没有练习记录，先去做几道题吧。</Text>
        )}
      </View>
    </ScrollView>
  );
}

function StatBox({ label, value }) {
  return (
    <View className="stat-box">
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
