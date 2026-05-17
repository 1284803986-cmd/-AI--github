import React, { useEffect, useState } from "react";
import Taro from "@tarojs/taro";
import { ScrollView, Text, View } from "@tarojs/components";
import { AiNotice, PrimaryButton, TextareaField, validateRequired } from "../../components/form";
import { ResultView } from "../../components/result";
import { defaultSelection } from "../../utils/options";
import { generateWrongQuestion } from "../../utils/api";
import "../../styles/common.scss";

export default function WrongPage() {
  const [meta, setMeta] = useState(defaultSelection);
  const [form, setForm] = useState({ originalQuestion: "计算：12.5 - 4.8 = ____", wrongAnswer: "8.7" });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = Taro.getStorageSync("baseSelection");
    if (saved) setMeta({ ...defaultSelection, ...saved });
  }, []);

  async function submit() {
    if (!validateRequired([{ label: "原题", value: form.originalQuestion }])) return;
    setLoading(true);
    try {
      setResult(await generateWrongQuestion(form));
      Taro.showToast({ title: "生成成功", icon: "success" });
    } catch {
      Taro.showToast({ title: "生成失败，请稍后再试", icon: "none" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView className="page" scrollY>
      <View className="hero"><Text className="hero-title">错题同类题</Text><Text className="hero-subtitle">输入错题，生成同类型巩固题</Text></View>
      <AiNotice />
      <View className="card">
        <TextareaField label="原题" value={form.originalQuestion} onInput={(originalQuestion) => setForm({ ...form, originalQuestion })} />
        <TextareaField label="学生错误答案（可选）" value={form.wrongAnswer} onInput={(wrongAnswer) => setForm({ ...form, wrongAnswer })} />
        <PrimaryButton loading={loading} onClick={submit}>分析并生成</PrimaryButton>
      </View>
      <ResultView result={result} meta={{ ...meta, knowledgePoint: result?.knowledge_point || meta.knowledgePoint }} type="错题同类题" onBack={() => setResult(null)} onRegenerate={submit} />
    </ScrollView>
  );
}
