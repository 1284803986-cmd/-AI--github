import React from "react";
import { ScrollView, Text, View } from "@tarojs/components";
import "../../styles/common.scss";

export default function PrivacyPage() {
  return (
    <ScrollView className="page" scrollY>
      <View className="hero">
        <Text className="hero-title">隐私说明</Text>
        <Text className="hero-subtitle">请放心使用，当前 MVP 不做登录和账号系统</Text>
      </View>
      <View className="card">
        <Text className="paragraph">本小程序用于生成小学数学练习题，不提供登录、支付、班级管理等功能。</Text>
        <Text className="paragraph">请不要输入学生真实姓名、手机号、身份证号、家庭住址等敏感信息。</Text>
        <Text className="paragraph">你输入的题目内容仅用于生成练习和错题同类题。配置 API Key 后，后端会调用大模型服务生成内容；小程序前端不会保存或展示 API Key。</Text>
        <Text className="paragraph">AI 生成内容仅供辅助，建议家长或老师审核后使用。</Text>
      </View>
    </ScrollView>
  );
}
