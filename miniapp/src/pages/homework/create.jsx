import React, { useEffect, useState } from "react";
import Taro from "@tarojs/taro";
import { ScrollView, Text, View } from "@tarojs/components";
import { AiNotice, InputField, PrimaryButton, SelectField } from "../../components/form";
import { createAssignment } from "../../utils/api";
import { defaultSelection, difficultyOptions, knowledgeOptions } from "../../utils/options";
import "../../styles/common.scss";

export default function HomeworkCreatePage() {
  const [form, setForm] = useState({ ...defaultSelection, count: 10, difficulty: "基础" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = Taro.getStorageSync("baseSelection");
    if (saved) setForm((old) => ({ ...old, ...saved }));
  }, []);

  async function submit() {
    setLoading(true);
    try {
      const data = await createAssignment({
        ...form,
        unit: form.knowledgePoint,
        type: "计算题",
        count: Number(form.count) || 10
      });
      Taro.showToast({ title: "作业已生成", icon: "success" });
      Taro.redirectTo({ url: `/pages/homework/detail?id=${data.assignment.id}` });
    } catch (error) {
      Taro.showToast({ title: error.message || "生成失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView className="page" scrollY>
      <View className="hero">
        <Text className="hero-title">布置作业</Text>
        <Text className="hero-subtitle">生成作业后自动得到作业码，学生可用作业码提交。</Text>
      </View>
      <AiNotice />
      <View className="card">
        <Text className="section-title">作业参数</Text>
        <SelectField label="科目" value={form.subject} options={["数学", "语文", "英语"]} onChange={(subject) => setForm({ ...form, subject })} />
        <SelectField label="年级" value={form.grade} options={["一年级", "二年级", "三年级", "四年级", "五年级", "六年级"]} onChange={(grade) => setForm({ ...form, grade })} />
        <SelectField label="学期" value={form.semester} options={["上册", "下册"]} onChange={(semester) => setForm({ ...form, semester })} />
        <SelectField label="教材" value={form.textbook} options={["人教版", "北师大版", "苏教版"]} onChange={(textbook) => setForm({ ...form, textbook })} />
        <SelectField label="知识点" value={form.knowledgePoint} options={knowledgeOptions} onChange={(knowledgePoint) => setForm({ ...form, knowledgePoint })} />
        <InputField label="题目数量" type="number" value={form.count} onInput={(count) => setForm({ ...form, count: Number(count) || 1 })} />
        <SelectField label="难度" value={form.difficulty} options={difficultyOptions} onChange={(difficulty) => setForm({ ...form, difficulty })} />
        <PrimaryButton loading={loading} onClick={submit}>生成作业</PrimaryButton>
      </View>
    </ScrollView>
  );
}
