import React, { useEffect, useState } from "react";
import Taro from "@tarojs/taro";
import { Button, Image, ScrollView, Text, View } from "@tarojs/components";
import { BackButton } from "../../components/navigation";
import { archiveAssignment, getAssignments } from "../../utils/api";
import "../../styles/common.scss";

const asset = (name) => `/assets/generated/${name}`;

export default function HomeworkListPage() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await getAssignments();
      const activeAssignments = (data.assignments || []).filter((item) => item.status !== "archived");
      setItems(activeAssignments);
      setSelectedIds((old) => old.filter((id) => activeAssignments.some((item) => item.id === id)));
    } catch (err) {
      console.error(err);
      setError("作业列表加载失败，请检查后端服务是否启动");
    } finally {
      setLoading(false);
    }
  }

  function toggleSelected(id) {
    setSelectedIds((old) => old.includes(id) ? old.filter((item) => item !== id) : [...old, id]);
  }

  function selectAll() {
    setSelectedIds(items.map((item) => item.id));
  }

  function invertSelection() {
    setSelectedIds((old) => items.filter((item) => !old.includes(item.id)).map((item) => item.id));
  }

  async function archiveSelected() {
    if (!selectedIds.length) {
      Taro.showToast({ title: "请先选择作业", icon: "none" });
      return;
    }

    const confirm = await Taro.showModal({
      title: "批量归档",
      content: `确定归档 ${selectedIds.length} 条作业吗？`,
      confirmText: "归档"
    });
    if (!confirm.confirm) return;

    const ids = [...selectedIds];
    try {
      await Promise.all(ids.map((id) => archiveAssignment(id)));
      setItems((old) => old.filter((item) => !ids.includes(item.id)));
      setSelectedIds([]);
      Taro.showToast({ title: "已归档", icon: "success" });
      load();
    } catch (err) {
      Taro.showToast({ title: err.message || "批量归档失败", icon: "none" });
      load();
    }
  }

  async function archiveItem(id) {
    const confirm = await Taro.showModal({
      title: "归档作业",
      content: "归档后会从当前列表隐藏，可在归档入口查看。",
      confirmText: "归档"
    });
    if (!confirm.confirm) return;

    try {
      await archiveAssignment(id);
      setItems((old) => old.filter((item) => item.id !== id));
      setSelectedIds((old) => old.filter((item) => item !== id));
      Taro.showToast({ title: "已归档", icon: "success" });
      load();
    } catch (err) {
      Taro.showToast({ title: err.message || "归档失败", icon: "none" });
    }
  }

  return (
    <ScrollView className="page" scrollY>
      <BackButton />
      <View className="hero">
        <Text className="hero-title">已布置作业</Text>
        <Text className="hero-subtitle">重新进入作业详情，查看学生提交。</Text>
      </View>

      <View className="card">
        <Text className="section-title">作业列表</Text>
        {loading ? <Text className="muted">正在加载...</Text> : null}
        {error ? <Text className="tip-text">{error}</Text> : null}
        {!loading && !error && !items.length ? (
          <View className="question-card">
            <Text className="muted">暂无已布置作业</Text>
            <Button className="primary-button full-button" onClick={() => Taro.navigateTo({ url: "/pages/homework/create" })}>去布置作业</Button>
          </View>
        ) : null}

        {!loading && !error && items.length ? (
          <View className="bulk-toolbar">
            <Text className="bulk-count">已选 {selectedIds.length} 条</Text>
            <Button className="bulk-button" onClick={selectAll}>全选</Button>
            <Button className="bulk-button" onClick={invertSelection}>反选</Button>
            <Button className="bulk-primary-button" onClick={archiveSelected}>批量归档</Button>
          </View>
        ) : null}

        {items.map((item) => (
          <View className="assignment-row" key={item.id}>
            <View className={selectedIds.includes(item.id) ? "assignment-check active" : "assignment-check"} onClick={() => toggleSelected(item.id)}>
              <Text>{selectedIds.includes(item.id) ? "✓" : ""}</Text>
            </View>
            <View className="assignment-main">
              <Text className="assignment-title">{item.title}</Text>
              <Text className="assignment-meta">{formatTime(item.createdAt)} · {item.grade} · {item.knowledgePoint}</Text>
              <Text className="assignment-code">作业码：{item.code}</Text>
            </View>
            <View className="assignment-actions">
              <Button className="assignment-detail-button" onClick={() => Taro.navigateTo({ url: `/pages/homework/detail?id=${item.id}` })}>查看详情</Button>
              <Button className="assignment-archive-button" onClick={() => archiveItem(item.id)}>归档</Button>
            </View>
          </View>
        ))}

        <View className="archive-entry" onClick={() => Taro.navigateTo({ url: "/pages/homework/archive" })}>
          <Image className="archive-entry-icon" src={asset("icon-archive.png")} mode="aspectFit" />
          <View className="archive-entry-copy">
            <Text className="archive-entry-title">查看归档作业</Text>
            <Text className="archive-entry-desc">已完成的作业放在这里</Text>
          </View>
        </View>
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
