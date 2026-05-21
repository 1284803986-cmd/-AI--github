import React, { useEffect, useState } from "react";
import Taro from "@tarojs/taro";
import { Button, ScrollView, Text, View } from "@tarojs/components";
import { BackButton } from "../../components/navigation";
import { getArchivedAssignments, restoreAssignment } from "../../utils/api";
import { navigateToPage } from "../../utils/navigation";
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
      console.error(err);
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
    <ScrollView className="page" scrollY>
      <BackButton />
      <View className="hero">
        <Text className="hero-title">归档作业</Text>
        <Text className="hero-subtitle">已完成的作业，可查看或恢复。</Text>
      </View>

      <View className="card">
        <Text className="section-title">归档列表</Text>
        {loading ? <Text className="muted">正在加载...</Text> : null}
        {error ? <Text className="tip-text">{error}</Text> : null}
        {!loading && !error && !items.length ? <Text className="muted">暂无归档作业</Text> : null}

        {items.map((item) => (
          <View className="assignment-row" key={item.id}>
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
