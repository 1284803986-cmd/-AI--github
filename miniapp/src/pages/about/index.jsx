import React from "react";
import { ScrollView, Text, View } from "@tarojs/components";
import { BackButton } from "../../components/navigation";
import "../../styles/common.scss";

export default function AboutPage() {
  return (
    <ScrollView className="page" scrollY>
      <BackButton />
      <View className="hero">
        <Text className="hero-title">关于</Text>
        <Text className="hero-subtitle">小学 AI 出题助手</Text>
      </View>
      <View className="card">
        <Text className="paragraph">这是一个微信小程序 MVP，当前优先支持四年级数学下册“小数加减法”。</Text>
        <Text className="paragraph">核心功能包括练习题生成、错题生成同类题、组家庭作业、组试卷和历史文件。</Text>
        <Text className="paragraph">暂不包含登录、支付、OCR、班级系统、老师后台和云同步。</Text>
      </View>
    </ScrollView>
  );
}
