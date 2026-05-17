import React, { useEffect, useState } from "react";
import Taro from "@tarojs/taro";
import { ScrollView, Text, View } from "@tarojs/components";
import { AiNotice, InputField, PrimaryButton, SelectField } from "../../components/form";
import { ResultView } from "../../components/result";
import { defaultSelection, knowledgeOptions } from "../../utils/options";
import { generatePaper } from "../../utils/api";
import "../../styles/common.scss";

export default function PaperPage() {
  const [form, setForm] = useState({ ...defaultSelection, count: 12, totalScore: 100, difficultyRatio: "基础 60%，提高 30%，拔高 10%" });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = Taro.getStorageSync("baseSelection");
    if (saved) setForm((old) => ({ ...old, ...saved }));
  }, []);

  async function submit() {
    setLoading(true);
    try {
      setResult(await generatePaper({ ...form, unitRange: form.knowledgePoint }));
      Taro.showToast({ title: "生成成功", icon: "success" });
    } catch {
      Taro.showToast({ title: "生成失败，请稍后再试", icon: "none" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView className="page" scrollY>
      <View className="hero"><Text className="hero-title">组试卷</Text><Text className="hero-subtitle">生成单元测试 / 模拟练习卷</Text></View>
      <AiNotice />
      <View className="card">
        <SelectField label="知识点范围" value={form.knowledgePoint} options={knowledgeOptions} onChange={(knowledgePoint) => setForm({ ...form, knowledgePoint })} />
        <InputField label="总题量" type="number" value={form.count} onInput={(count) => setForm({ ...form, count: Number(count) || 1 })} />
        <InputField label="总分" type="number" value={form.totalScore} onInput={(totalScore) => setForm({ ...form, totalScore: Number(totalScore) || 100 })} />
        <InputField label="难度比例" value={form.difficultyRatio} onInput={(difficultyRatio) => setForm({ ...form, difficultyRatio })} />
        <PrimaryButton loading={loading} onClick={submit}>生成试卷</PrimaryButton>
      </View>
      <ResultView result={result} meta={form} type="试卷" onBack={() => setResult(null)} onRegenerate={submit} />
    </ScrollView>
  );
}
