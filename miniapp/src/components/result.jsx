import React, { useEffect, useState } from "react";
import Taro from "@tarojs/taro";
import { Button, Input, Text, View } from "@tarojs/components";
import { exportFile, saveHistory } from "../utils/api";
import { defaultFileName } from "../utils/options";

export function ResultView({ result, meta, type, onBack, onRegenerate, onSaved }) {
  const [fileName, setFileName] = useState(defaultFileName(meta));
  const [showSave, setShowSave] = useState(false);

  useEffect(() => {
    if (result) {
      setFileName(defaultFileName(meta));
      setShowSave(true);
    }
  }, [result]);

  if (!result) return null;

  const questions = getQuestions(result);

  async function save() {
    try {
      const payload = buildPayload(result, meta, type, fileName);
      await saveHistory(type, payload);
      Taro.showToast({ title: "已保存到历史文件", icon: "success" });
      setShowSave(false);
      onSaved?.();
    } catch {
      Taro.showToast({ title: "保存失败，请稍后再试", icon: "none" });
    }
  }

  async function exportBy(format) {
    if (format === "pdf") {
      Taro.showModal({
        title: "PDF 导出说明",
        content: "体验版已保留 PDF 按钮，正式上线前接入完整 PDF 模板。当前请先使用 Word 导出。",
        showCancel: false
      });
      return;
    }
    try {
      const payload = buildPayload(result, meta, type, fileName);
      const data = await exportFile(format, payload);
      await openBase64File(data);
    } catch {
      Taro.showToast({ title: "导出失败，请稍后再试", icon: "none" });
    }
  }

  return (
    <View className="result-card">
      <Text className="section-title">{result.title || "生成结果"}</Text>
      <Text className="muted">AI 内容仅供辅助，请家长或老师审核后使用。</Text>

      <View className="button-row">
        <Button className="secondary-button" onClick={() => setShowSave(true)}>保存 / 导出</Button>
        <Button className="ghost-button" onClick={onRegenerate}>重新生成</Button>
      </View>

      {questions.map((item, index) => (
        <View className="question-card" key={`${item.question}-${index}`}>
          <View className="tag-row">
            <Text className="tag">{item.question_type || item.type}</Text>
            <Text className="tag">{item.difficulty}</Text>
            <Text className="tag">{item.knowledge_point}</Text>
          </View>
          <Text className="question-text">{index + 1}. {item.question}</Text>
          <Text className="answer-text">答案：{item.answer}</Text>
          <Text className="answer-text">解析：{item.explanation}</Text>
          {item.common_mistake ? <Text className="tip-text">易错点：{item.common_mistake}</Text> : null}
          {item.parent_tip ? <Text className="tip-text">家长提示：{item.parent_tip}</Text> : null}
        </View>
      ))}

      <View className="button-row">
        <Button className="ghost-button" onClick={onBack}>返回修改</Button>
        <Button className="secondary-button" onClick={() => Taro.navigateTo({ url: "/pages/history/index" })}>查看历史</Button>
      </View>

      {showSave ? (
        <View className="save-mask">
          <View className="save-sheet">
            <Text className="section-title">保存结果</Text>
            <View className="save-meta">
              <Text className="muted">本次生成：{questions.length} 道题</Text>
              <Text className="muted">科目 / 年级：{meta.subject} / {meta.grade}</Text>
              <Text className="muted">学期 / 教材：{meta.semester} / {meta.textbook}</Text>
              <Text className="muted">知识点：{meta.knowledgePoint || result.knowledge_point || meta.unit}</Text>
              <Text className="muted">题型 / 难度：{meta.type || type} / {meta.difficulty || "综合"}</Text>
              <Text className="muted">生成时间：{new Date().toLocaleString()}</Text>
            </View>
            <View className="field">
              <Text className="field-label">文件名</Text>
              <Input className="input" value={fileName} onInput={(event) => setFileName(event.detail.value)} />
            </View>
            <View className="button-row">
              <Button className="ghost-button" onClick={() => setShowSave(false)}>仅查看</Button>
              <Button className="secondary-button" onClick={save}>保存到历史</Button>
              <Button className="secondary-button" onClick={() => exportBy("word")}>导出 Word</Button>
              <Button className="ghost-button" onClick={() => exportBy("pdf")}>导出 PDF</Button>
            </View>
            <View className="button-row">
              <Button className="secondary-button" onClick={() => Taro.navigateTo({ url: "/pages/history/index" })}>查看历史</Button>
              <Button className="ghost-button" onClick={onRegenerate}>继续生成</Button>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function getQuestions(result) {
  return result.questions || [...(result.similar_questions || []), ...(result.variation_questions || [])];
}

export function buildPayload(result, meta, type, fileName) {
  const questions = getQuestions(result);
  return {
    fileName,
    type,
    title: result.title || fileName,
    grade: meta.grade || result.grade || result.grade_guess,
    subject: meta.subject || result.subject,
    textbook: meta.textbook || result.textbook,
    semester: meta.semester,
    unit: meta.unit || result.unit,
    knowledgePoint: meta.knowledgePoint || result.knowledge_point || meta.unit,
    difficulty: meta.difficulty,
    questionType: meta.type,
    questionCount: questions.length,
    createdAt: new Date().toISOString(),
    result
  };
}

async function openBase64File(data) {
  const fs = Taro.getFileSystemManager();
  const filePath = `${Taro.env.USER_DATA_PATH}/${data.fileName}`;
  await new Promise((resolve, reject) => {
    fs.writeFile({ filePath, data: data.base64, encoding: "base64", success: resolve, fail: reject });
  });
  await Taro.openDocument({ filePath, showMenu: true });
}
