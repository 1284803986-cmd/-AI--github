import React, { useEffect, useState } from "react";
import Taro, { useRouter } from "@tarojs/taro";
import { Button, Image, ScrollView, Text, Textarea, View } from "@tarojs/components";
import { BackButton } from "../../components/navigation";
import { getAssignment, getAssignmentSubmissions, markSubmissionViewed } from "../../utils/api";
import "../../styles/common.scss";

const API_BASE = "http://127.0.0.1:8787";

export default function HomeworkSubmissionsPage() {
  const router = useRouter();
  const [assignment, setAssignment] = useState(null);
  const [items, setItems] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [assignmentData, submissionData] = await Promise.all([
        getAssignment(router.params.id),
        getAssignmentSubmissions(router.params.id)
      ]);
      setAssignment(assignmentData.assignment);
      setItems(submissionData.items || []);
    } catch (error) {
      Taro.showToast({ title: error.message || "加载失败", icon: "none" });
    }
  }

  async function viewed(id) {
    try {
      await markSubmissionViewed(id);
      await load();
      Taro.showToast({ title: "已标记", icon: "success" });
    } catch (error) {
      Taro.showToast({ title: error.message || "操作失败", icon: "none" });
    }
  }

  return (
    <ScrollView className="page" scrollY>
      <BackButton />
      <View className="hero">
        <Text className="hero-title">学生提交</Text>
        <Text className="hero-subtitle">{assignment?.title || "作业提交列表"}</Text>
      </View>
      <View className="card">
        <Text className="section-title">提交列表</Text>
        {!items.length ? <Text className="muted">暂时还没有学生提交。</Text> : null}
        {items.map((item) => (
          <View className="question-card" key={item.id}>
            <Text className="question-text">{item.studentName}</Text>
            <Text className="muted">提交方式：{item.submitType}</Text>
            <Text className="muted">提交时间：{new Date(item.submittedAt).toLocaleString()}</Text>
            <Text className="muted">状态：{item.status}</Text>
            {item.answers?.length ? (
              <View>
                <Text className="field-label">在线答案</Text>
                {item.answers.map((answer) => (
                  <Text className="answer-text" key={answer.questionIndex}>{answer.questionIndex}. {answer.answer || "未填写"}</Text>
                ))}
              </View>
            ) : null}
            {item.imagePaths?.length ? (
              <View>
                <Text className="field-label">上传图片</Text>
                {item.imagePaths.map((path) => (
                  <Image key={path} src={`${API_BASE}${path}`} mode="aspectFill" style="width: 180px; height: 180px; margin: 10px; border-radius: 8px;" />
                ))}
              </View>
            ) : null}
            <View className="field">
              <Text className="field-label">老师备注</Text>
              <Textarea className="textarea" value={item.teacherComment || ""} placeholder="体验版先本地查看，备注保存后续完善" disabled />
            </View>
            <View className="button-row">
              <Button className="secondary-button" onClick={() => viewed(item.id)}>标记已查看</Button>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
