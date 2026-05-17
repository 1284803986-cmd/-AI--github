import React, { useEffect, useState } from "react";
import Taro from "@tarojs/taro";
import { Button, ScrollView, Text, View } from "@tarojs/components";
import { AiNotice, PrimaryButton, TextareaField, validateRequired } from "../../components/form";
import { ResultView } from "../../components/result";
import { defaultSelection } from "../../utils/options";
import { generateWrongQuestion } from "../../utils/api";
import { getWrongBook, removeWrongQuestion } from "../../utils/wrongBook";
import "../../styles/common.scss";

export default function WrongPage() {
  const [meta, setMeta] = useState(defaultSelection);
  const [form, setForm] = useState({ originalQuestion: "计算：12.5 - 4.8 = ____", wrongAnswer: "8.7" });
  const [wrongItems, setWrongItems] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = Taro.getStorageSync("baseSelection");
    if (saved) setMeta({ ...defaultSelection, ...saved });
    setWrongItems(getWrongBook());
  }, []);

  async function submit(nextForm = form) {
    if (!validateRequired([{ label: "原题", value: nextForm.originalQuestion }])) return;
    setLoading(true);
    try {
      setResult(await generateWrongQuestion(nextForm));
      Taro.showToast({ title: "生成成功", icon: "success" });
    } catch {
      Taro.showToast({ title: "生成失败，请稍后再试", icon: "none" });
    } finally {
      setLoading(false);
    }
  }

  function useWrongItem(item) {
    const nextForm = { originalQuestion: item.question, wrongAnswer: item.userAnswer || "" };
    setForm(nextForm);
    submit(nextForm);
  }

  function removeItem(item) {
    setWrongItems(removeWrongQuestion(item));
    Taro.showToast({ title: "已移除错题", icon: "success" });
  }

  return (
    <ScrollView className="page" scrollY>
      <View className="hero">
        <Text className="hero-title">错题本</Text>
        <Text className="hero-subtitle">练习或学生作业做错的题，会自动收进这里。</Text>
      </View>
      <AiNotice />

      <View className="card">
        <Text className="section-title">我的错题</Text>
        <Text className="muted">同一道题只保留一条；以后做对了，会自动从错题本移除。</Text>
        {wrongItems.length ? (
          wrongItems.map((item, index) => (
            <View className="question-card" key={item.id || `${item.question}-${index}`}>
              <View className="tag-row">
                <Text className="tag">{item.source || "错题"}</Text>
                {item.question_type ? <Text className="tag">{item.question_type}</Text> : null}
              </View>
              <Text className="question-text">{index + 1}. {item.question}</Text>
              <Text className="answer-text">上次答案：{item.userAnswer || "未填写"}</Text>
              <Text className="answer-text">参考答案：{item.answer || "暂无"}</Text>
              <View className="button-row">
                <Button className="secondary-button" onClick={() => useWrongItem(item)}>生成同类题</Button>
                <Button className="ghost-button" onClick={() => removeItem(item)}>移除</Button>
              </View>
            </View>
          ))
        ) : (
          <View className="question-card">
            <Text className="muted">现在还没有错题。做练习或学生作业时，答错的题会自动出现在这里。</Text>
          </View>
        )}
      </View>

      <View className="card">
        <Text className="section-title">手动输入错题</Text>
        <TextareaField label="原题" value={form.originalQuestion} onInput={(originalQuestion) => setForm({ ...form, originalQuestion })} />
        <TextareaField label="学生错误答案（可选）" value={form.wrongAnswer} onInput={(wrongAnswer) => setForm({ ...form, wrongAnswer })} />
        <PrimaryButton loading={loading} onClick={() => submit()}>分析并生成</PrimaryButton>
      </View>

      <ResultView result={result} meta={{ ...meta, knowledgePoint: result?.knowledge_point || meta.knowledgePoint }} type="错题同类题" onBack={() => setResult(null)} onRegenerate={() => submit()} />
    </ScrollView>
  );
}
