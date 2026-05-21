import React, { useEffect, useState } from "react";
import Taro, { useRouter } from "@tarojs/taro";
import { Button, ScrollView, Text, View } from "@tarojs/components";
import { BackButton } from "../../components/navigation";
import { exportAssignment, getAssignment } from "../../utils/api";
import { navigateToPage } from "../../utils/navigation";
import "../../styles/common.scss";

export default function HomeworkDetailPage() {
  const router = useRouter();
  const [assignment, setAssignment] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const data = await getAssignment(router.params.id);
      setAssignment(data.assignment);
    } catch (error) {
      Taro.showToast({ title: error.message || "加载失败", icon: "none" });
    }
  }

  async function exportBy(format, type) {
    try {
      const data = await exportAssignment(assignment.id, format, type);
      await openBase64File(data);
    } catch (error) {
      Taro.showToast({ title: error.message || "导出失败", icon: "none" });
    }
  }

  if (!assignment) return <View className="page"><BackButton /><Text className="muted">正在加载...</Text></View>;

  return (
    <ScrollView className="page" scrollY>
      <BackButton />
      <View className="hero">
        <Text className="hero-title">作业发布页</Text>
        <Text className="hero-subtitle">作业码：{assignment.code}</Text>
      </View>
      <View className="card">
        <Text className="section-title">{assignment.title}</Text>
        <Text className="muted">科目 / 年级：{assignment.subject} / {assignment.grade}</Text>
        <Text className="muted">学期 / 教材：{assignment.semester} / {assignment.textbook}</Text>
        {assignment.unit ? <Text className="muted">单元：{assignment.unit}</Text> : null}
        {assignment.lesson ? <Text className="muted">课时：{assignment.lesson}</Text> : null}
        <Text className="muted">知识点：{assignment.knowledgePoint}</Text>
        {assignment.type ? <Text className="muted">题型：{assignment.type}</Text> : null}
        <Text className="muted">题目数量：{assignment.questionCount}</Text>
        <Text className="muted">创建时间：{new Date(assignment.createdAt).toLocaleString()}</Text>
        <View className="question-card">
          <Text className="question-text">作业码：{assignment.code}</Text>
          <Text className="tip-text">请把作业码发给学生，学生可从“作业中心 - 学生做作业”进入。</Text>
        </View>
        <View className="button-row">
          <Button className="secondary-button" onClick={() => navigateToPage(`/pages/homework/submissions?id=${assignment.id}`)}>查看学生提交</Button>
          <Button className="ghost-button" onClick={() => Taro.showToast({ title: "已发布，可分享作业码", icon: "success" })}>发布作业</Button>
        </View>
      </View>

      <View className="card">
        <Text className="section-title">查看作业</Text>
        {assignment.questions.map((item, index) => (
          <View className="question-card" key={`${item.question}-${index}`}>
            <Text className="question-text">{index + 1}. {item.question}</Text>
            <Text className="answer-text">答案：{item.answer}</Text>
            <Text className="answer-text">解析：{item.explanation}</Text>
          </View>
        ))}
      </View>

      <View className="card">
        <Text className="section-title">下载导出</Text>
        <View className="button-row">
          <Button className="secondary-button" onClick={() => exportBy("word", "student")}>学生版 Word</Button>
          <Button className="secondary-button" onClick={() => exportBy("word", "teacher")}>教师版 Word</Button>
          <Button className="ghost-button" onClick={() => exportBy("pdf", "student")}>学生版 PDF</Button>
          <Button className="ghost-button" onClick={() => exportBy("pdf", "teacher")}>教师版 PDF</Button>
        </View>
      </View>
    </ScrollView>
  );
}

async function openBase64File(data) {
  const fs = Taro.getFileSystemManager();
  const filePath = `${Taro.env.USER_DATA_PATH}/${data.fileName}`;
  await new Promise((resolve, reject) => {
    fs.writeFile({ filePath, data: data.base64, encoding: "base64", success: resolve, fail: reject });
  });
  await Taro.openDocument({ filePath, showMenu: true });
}
