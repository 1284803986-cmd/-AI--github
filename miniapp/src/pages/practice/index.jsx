import React, { useEffect, useState } from "react";
import Taro from "@tarojs/taro";
import { ScrollView, Text, View } from "@tarojs/components";
import { AiNotice, InputField, PrimaryButton, SelectField, validateRequired } from "../../components/form";
import { ResultView } from "../../components/result";
import { defaultSelection, difficultyOptions, knowledgeOptions, questionTypeOptions } from "../../utils/options";
import { generateTextbook } from "../../utils/api";
import "../../styles/common.scss";

export default function PracticePage() {
  const [form, setForm] = useState({ ...defaultSelection, type: "计算题", difficulty: "基础", count: 5 });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = Taro.getStorageSync("baseSelection");
    if (saved) setForm((old) => ({ ...old, ...saved }));
  }, []);

  async function submit() {
    if (!validateRequired([
      { label: "知识点", value: form.knowledgePoint },
      { label: "题目数量", value: form.count }
    ])) return;
    setLoading(true);
    try {
      setResult(await generateTextbook(form));
      Taro.showToast({ title: "生成成功", icon: "success" });
    } catch {
      Taro.showToast({ title: "生成失败，请稍后再试", icon: "none" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView className="page" scrollY>
      <View className="hero"><Text className="hero-title">生成练习题</Text><Text className="hero-subtitle">按知识点生成日常练习</Text></View>
      <AiNotice />
      <View className="card">
        <SelectField label="知识点" value={form.knowledgePoint} options={knowledgeOptions} onChange={(knowledgePoint) => setForm({ ...form, knowledgePoint })} />
        <SelectField label="题型" value={form.type} options={questionTypeOptions} onChange={(type) => setForm({ ...form, type })} />
        <SelectField label="难度" value={form.difficulty} options={difficultyOptions} onChange={(difficulty) => setForm({ ...form, difficulty })} />
        <InputField label="题目数量" type="number" value={form.count} onInput={(count) => setForm({ ...form, count: Number(count) || 1 })} />
        <PrimaryButton loading={loading} onClick={submit}>生成题目</PrimaryButton>
      </View>
      <ResultView result={result} meta={form} type="练习题" onBack={() => setResult(null)} onRegenerate={submit} />
    </ScrollView>
  );
}
