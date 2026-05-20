import React, { useState } from "react";
import Taro from "@tarojs/taro";
import { Input, ScrollView, Text, View } from "@tarojs/components";
import { PrimaryButton } from "../../components/form";
import { BackButton } from "../../components/navigation";
import { getAssignmentByCode } from "../../utils/api";
import "../../styles/common.scss";

export default function StudentIndexPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!code.trim()) {
      Taro.showToast({ title: "请输入作业码", icon: "none" });
      return;
    }
    setLoading(true);
    try {
      const data = await getAssignmentByCode(code);
      Taro.navigateTo({ url: `/pages/student/work?id=${data.assignment.id}` });
    } catch (error) {
      Taro.showToast({ title: error.message || "未找到作业", icon: "none" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView className="page" scrollY>
      <BackButton />
      <View className="hero">
        <Text className="hero-title">学生做作业</Text>
        <Text className="hero-subtitle">输入老师提供的作业码，在线答题或上传纸质作业。</Text>
      </View>
      <View className="card">
        <Text className="section-title">输入作业码</Text>
        <View className="field">
          <Text className="field-label">作业码</Text>
          <Input className="input" value={code} placeholder="例如 ABC123" onInput={(event) => setCode(event.detail.value.toUpperCase())} />
        </View>
        <PrimaryButton loading={loading} onClick={submit}>进入作业</PrimaryButton>
      </View>
    </ScrollView>
  );
}
