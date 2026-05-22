import React, { useEffect, useState } from "react";
import Taro from "@tarojs/taro";
import { Button, ScrollView, Text, View } from "@tarojs/components";
import { BackButton } from "../../components/navigation";
import { getArchivedAssignments, restoreAssignment } from "../../utils/api";
import { navigateToPage } from "../../utils/navigation";
import { debugWarn } from "../../utils/debug";
import "../../styles/common.scss";

export default function HomeworkArchivePage() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await getArchivedAssignments();
      setItems(data.assignments || []);
    } catch (err) {
      debugWarn("[作业归档调试] load failed", err);
      setError("归档列表加载失败，请检查后端服务是否启动");
    } finally {
      setLoading(false);
    }
  }

  async function restoreItem(id) {
    try {
      await restoreAssignment(id);
      Taro.showToast({ title: "已恢复", icon: "success" });
      load();
    } catch (err) {
      Taro.showToast({ title: err.message || "恢复失败", icon: "none" });
    }
  }

  return (
    <ScrollView className="page homework-page page-shell safe-bottom-space" scrollY>
      <BackButton />
      <View className="hero hero-card hero-card--blue homework-hero archive-hero">
        <View className="homework-hero-copy">
          <Text className="hero-title">归档作业</Text>
          <Text className="hero-subtitle">已完成的作业，可查看或恢复。</Text>
          <View className="homework-hero-tags">
            <Text className="homework-hero-tag">作业归档</Text>
            <Text className="homework-hero-tag">历史任务</Text>
          </View>
        </View>
        <View className="homework-hero-illus">
          <View className="homework-board" />
          <View className="homework-bell" />
          <View className="homework-check-star" />
        </View>
      </View>

      <View className="card study-card homework-card">
        <View className="card-title-row">
          <View>
            <Text className="section-title">归档列表</Text>
            <Text className="section-subtitle">已归档的作业会保存在这里。</Text>
          </View>
        </View>
        {loading ? <Text className="muted">正在加载...</Text> : null}
        {error ? <Text className="tip-text">{error}</Text> : null}
        {!loading && !error && !items.length ? (
          <View className="empty-card homework-empty-card">
            <Text className="empty-illustration">✓</Text>
            <Text className="empty-title">暂无归档作业</Text>
          </View>
        ) : null}

        {items.map((item) => (
          <View className="assignment-row study-card homework-assignment-card" key={item.id}>
            <View className="assignment-main">
              <Text className="assignment-title">{item.title}</Text>
              <Text className="assignment-meta">{formatTime(item.createdAt)} · {item.grade} · {item.knowledgePoint}</Text>
              <Text className="assignment-code">作业码：{item.code}</Text>
            </View>
            <View className="assignment-actions">
              <Button className="assignment-detail-button" onClick={() => navigateToPage(`/pages/homework/detail?id=${item.id}`)}>查看详情</Button>
              <Button className="assignment-archive-button" onClick={() => restoreItem(item.id)}>恢复</Button>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
