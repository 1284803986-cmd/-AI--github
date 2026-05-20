import React, { useEffect, useState } from "react";
import Taro, { useRouter } from "@tarojs/taro";
import { Button, Image, Input, ScrollView, Text, Textarea, View } from "@tarojs/components";
import { BackButton } from "../../components/navigation";
import { getAssignment, submitAssignment, uploadAssignmentImages } from "../../utils/api";
import { isAnswerCorrect, updateWrongBookByAnswer } from "../../utils/wrongBook";
import "../../styles/common.scss";

export default function StudentWorkPage() {
  const router = useRouter();
  const [assignment, setAssignment] = useState(null);
  const [studentName, setStudentName] = useState("");
  const [answers, setAnswers] = useState([]);
  const [checks, setChecks] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const data = await getAssignment(router.params.id);
      setAssignment(data.assignment);
      setAnswers((data.assignment.questions || []).map(() => ""));
      setChecks([]);
    } catch (error) {
      Taro.showToast({ title: error.message || "加载失败", icon: "none" });
    }
  }

  function updateAnswer(index, value) {
    const next = [...answers];
    next[index] = value;
    setAnswers(next);
  }

  async function chooseImages() {
    const res = await Taro.chooseImage({ count: 6, sizeType: ["compressed"], sourceType: ["album", "camera"] });
    setImages(res.tempFilePaths || []);
  }

  async function submitOnline() {
    if (!studentName.trim()) return Taro.showToast({ title: "请填写学生姓名", icon: "none" });
    const nextChecks = (assignment.questions || []).map((question, index) => {
      const userAnswer = answers[index] || "";
      const correct = isAnswerCorrect(userAnswer, question.answer);
      updateWrongBookByAnswer(question, userAnswer, "学生作业");
      return correct;
    });
    setChecks(nextChecks);

    setLoading(true);
    try {
      await submitAssignment(assignment.id, {
        studentName,
        submitType: "在线答题",
        answers: answers.map((answer, index) => ({ questionIndex: index + 1, answer }))
      });
      Taro.showModal({ title: "已提交", content: `${assignment.title}\n提交时间：${new Date().toLocaleString()}`, showCancel: false });
    } catch (error) {
      Taro.showToast({ title: error.message || "提交失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  }

  async function submitImages() {
    if (!studentName.trim()) return Taro.showToast({ title: "请填写学生姓名", icon: "none" });
    if (!images.length) return Taro.showToast({ title: "请先选择图片", icon: "none" });
    setLoading(true);
    try {
      const imagePayload = await Promise.all(images.slice(0, 6).map(readImageBase64));
      await uploadAssignmentImages(assignment.id, { studentName, images: imagePayload });
      Taro.showModal({ title: "已提交", content: `${assignment.title}\n提交时间：${new Date().toLocaleString()}`, showCancel: false });
    } catch (error) {
      Taro.showToast({ title: error.message || "图片提交失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  }

  if (!assignment) return <View className="page"><BackButton /><Text className="muted">正在加载...</Text></View>;

  return (
    <ScrollView className="page" scrollY>
      <BackButton />
      <View className="hero">
        <Text className="hero-title">{assignment.title}</Text>
        <Text className="hero-subtitle">作业码：{assignment.code}</Text>
      </View>

      <View className="card">
        <Text className="section-title">学生信息</Text>
        <View className="field">
          <Text className="field-label">学生姓名</Text>
          <Input className="input" value={studentName} placeholder="只填写姓名或昵称即可" onInput={(event) => setStudentName(event.detail.value)} />
        </View>
      </View>

      <View className="card">
        <Text className="section-title">在线答题</Text>
        <Text className="muted">提交后，做错的题会自动加入错题本；做对的题会从错题本移除。</Text>
        {assignment.questions.map((item, index) => (
          <View className="question-card" key={`${item.question}-${index}`}>
            <Text className="question-text">{index + 1}. {item.question}</Text>
            {checks[index] !== undefined ? <Text className={checks[index] ? "answer-correct" : "answer-wrong"}>{checks[index] ? "答对了，已从错题本移除" : "答错了，已加入错题本"}</Text> : null}
            <Textarea className="textarea" value={answers[index]} placeholder="在这里填写答案" onInput={(event) => updateAnswer(index, event.detail.value)} />
          </View>
        ))}
        <Button className="primary-button full-button" loading={loading} disabled={loading} onClick={submitOnline}>提交在线答案</Button>
      </View>

      <View className="card">
        <Text className="section-title">上传纸质作业</Text>
        <Text className="muted">支持 1-6 张图片，暂不做 OCR 和自动批改。</Text>
        <View className="button-row">
          <Button className="secondary-button" onClick={chooseImages}>选择图片</Button>
          <Button className="primary-button" loading={loading} disabled={loading} onClick={submitImages}>提交图片</Button>
        </View>
        {images.map((path) => <Image key={path} src={path} mode="aspectFill" style="width: 160px; height: 160px; margin: 12px; border-radius: 8px;" />)}
      </View>
    </ScrollView>
  );
}

async function readImageBase64(path) {
  const fs = Taro.getFileSystemManager();
  const base64 = await new Promise((resolve, reject) => {
    fs.readFile({ filePath: path, encoding: "base64", success: (res) => resolve(res.data), fail: reject });
  });
  return { name: path.split("/").pop() || "homework.jpg", base64 };
}
