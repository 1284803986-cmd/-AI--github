import React, { useEffect, useState } from "react";
import Taro from "@tarojs/taro";
import { Button, ScrollView, Text, View } from "@tarojs/components";
import { getAssignments } from "../../utils/api";
import "../../styles/common.scss";

export default function HomeworkListPage() {
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
      const data = await getAssignments();
      setItems(data.assignments || []);
    } catch (err) {
      console.error(err);
      setError("作业列表加载失败，请检查后端服务是否启动");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView className="page" scrollY>
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

        {items.map((item) => (
          <View className="question-card" key={item.id}>
            <Text className="question-text">{item.title}</Text>
            <Text className="muted">作业码：{item.code}</Text>
            <Text className="muted">创建时间：{new Date(item.createdAt).toLocaleString()}</Text>
            <Text className="muted">科目 / 年级：{item.subject} / {item.grade}</Text>
            <Text className="muted">学期 / 教材：{item.semester} / {item.textbook}</Text>
            <Text className="muted">知识点：{item.knowledgePoint}</Text>
            <Text className="muted">题目数量：{item.questionCount}</Text>
            <View className="button-row">
              <Button className="secondary-button" onClick={() => Taro.navigateTo({ url: `/pages/homework/detail?id=${item.id}` })}>查看作业</Button>
              <Button className="ghost-button" onClick={() => Taro.navigateTo({ url: `/pages/homework/submissions?id=${item.id}` })}>查看提交</Button>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
