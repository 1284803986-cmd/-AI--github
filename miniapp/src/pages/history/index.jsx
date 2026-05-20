import React, { useEffect, useState } from "react";
import Taro from "@tarojs/taro";
import { Button, ScrollView, Text, View } from "@tarojs/components";
import { BackButton } from "../../components/navigation";
import { deleteHistory, exportFile, getHistory } from "../../utils/api";
import "../../styles/common.scss";

export default function HistoryPage() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const data = await getHistory();
      setItems(data.items || []);
    } catch {
      Taro.showToast({ title: "历史文件加载失败", icon: "none" });
    }
  }

  async function remove(id) {
    const confirm = await Taro.showModal({ title: "删除文件", content: "确定删除这条历史文件吗？" });
    if (!confirm.confirm) return;
    try {
      await deleteHistory(id);
      await load();
      Taro.showToast({ title: "已删除", icon: "success" });
    } catch {
      Taro.showToast({ title: "删除失败", icon: "none" });
    }
  }

  async function exportBy(format, payload) {
    if (format === "pdf") {
      Taro.showModal({ title: "PDF 导出说明", content: "体验版已保留 PDF 按钮，当前请先使用 Word 导出。", showCancel: false });
      return;
    }
    try {
      const data = await exportFile(format, payload);
      const fs = Taro.getFileSystemManager();
      const filePath = `${Taro.env.USER_DATA_PATH}/${data.fileName}`;
      await new Promise((resolve, reject) => fs.writeFile({ filePath, data: data.base64, encoding: "base64", success: resolve, fail: reject }));
      await Taro.openDocument({ filePath, showMenu: true });
    } catch {
      Taro.showToast({ title: "导出失败", icon: "none" });
    }
  }

  return (
    <ScrollView className="page" scrollY>
      <BackButton />
      <View className="hero"><Text className="hero-title">历史文件</Text><Text className="hero-subtitle">查看、删除和导出已保存内容</Text></View>
      <View className="card">
        <Button className="secondary-button full-button" onClick={load}>刷新历史文件</Button>
        {items.length === 0 ? <Text className="muted">暂无历史文件</Text> : items.map((item) => {
          const p = item.payload || {};
          return (
            <View className="question-card" key={item.id}>
              <Text className="section-title">{p.fileName || p.title || item.type}</Text>
              <View className="tag-row">
                <Text className="tag">{item.type}</Text>
                <Text className="tag">{p.grade || "四年级"}</Text>
                <Text className="tag">{p.subject || "数学"}</Text>
              </View>
              <Text className="muted">知识点：{p.knowledgePoint || p.unit || "小数加减法"}</Text>
              <Text className="muted">题目数量：{p.questionCount || p.result?.questions?.length || 0}</Text>
              <Text className="muted">创建时间：{new Date(item.createdAt).toLocaleString()}</Text>
              <View className="button-row">
                <Button className="ghost-button" onClick={() => Taro.showModal({ title: p.fileName || p.title || "历史文件", content: "详情请导出 Word 查看完整题目。", showCancel: false })}>查看</Button>
                <Button className="ghost-button" onClick={() => Taro.showToast({ title: "请回到对应功能页重新生成", icon: "none" })}>重新生成</Button>
                <Button className="secondary-button" onClick={() => exportBy("word", p)}>导出 Word</Button>
                <Button className="ghost-button" onClick={() => exportBy("pdf", p)}>导出 PDF</Button>
                <Button className="danger-button" onClick={() => remove(item.id)}>删除</Button>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
