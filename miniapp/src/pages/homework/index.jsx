import React from "react";
import Taro from "@tarojs/taro";
import { Button, Image, Text, View } from "@tarojs/components";
import { BackButton } from "../../components/navigation";
import "../../styles/common.scss";

const asset = (name) => `/assets/generated/${name}`;

export default function HomeworkCenterPage() {
  return (
    <View className="page">
      <BackButton />
      <View className="hero visual-hero">
        <Image className="hero-bg" src={asset("banner-homework.png")} mode="aspectFill" />
        <View className="hero-overlay" />
        <View className="hero-content">
          <Text className="hero-title">老师作业中心</Text>
          <Text className="hero-subtitle">布置作业，查看学生提交</Text>
        </View>
      </View>
      <View className="notice">
        <Text className="notice-icon">!</Text>
        <Text>体验版不需要登录，请不要填写手机号、身份证等敏感信息。</Text>
      </View>
      <View className="card">
        <Text className="section-title">老师功能</Text>
        <View className="entry-grid">
          <Button className="entry-card" onClick={() => Taro.navigateTo({ url: "/pages/homework/create" })}>
            <Image className="entry-icon-img" src={asset("icon-homework-create.png")} mode="aspectFit" />
            <View className="entry-copy">
              <Text className="entry-title">布置作业</Text>
              <Text className="entry-desc">生成作业码</Text>
            </View>
          </Button>
          <Button className="entry-card" onClick={() => Taro.navigateTo({ url: "/pages/homework/list" })}>
            <Image className="entry-icon-img" src={asset("icon-homework-list.png")} mode="aspectFit" />
            <View className="entry-copy">
              <Text className="entry-title">已布置作业</Text>
              <Text className="entry-desc">查看提交</Text>
            </View>
          </Button>
        </View>
      </View>
    </View>
  );
}
