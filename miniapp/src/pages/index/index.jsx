import React, { useEffect, useState } from "react";
import Taro from "@tarojs/taro";
import { Button, Image, Text, View } from "@tarojs/components";
import "../../styles/common.scss";
import "./index.scss";

const asset = (name) => `/assets/generated/${name}`;

const roleCards = [
  {
    key: "student",
    title: "我是学生",
    desc: "做作业、练习和错题巩固",
    image: asset("icon-student-homework.png"),
    tone: "teal"
  },
  {
    key: "teacher",
    title: "我是老师",
    desc: "布置作业、组卷和查看提交",
    image: asset("icon-teacher-homework.png"),
    tone: "green"
  }
];

const studentCards = [
  { key: "studentHomework", title: "学生作业", desc: "输入作业码", image: asset("icon-student-homework.png"), url: "/pages/student/index", tone: "teal" },
  { key: "practice", title: "练习", desc: "生成练习题", image: asset("icon-practice.png"), url: "/pages/practice/index", tone: "blue" },
  { key: "wrong", title: "错题", desc: "错题巩固", image: asset("icon-wrong.png"), url: "/pages/wrong/index", tone: "red" },
  { key: "history", title: "历史记录", desc: "查看记录", image: asset("icon-history.png"), url: "/pages/history/index", tone: "sky" }
];

const teacherCards = [
  { key: "homework", title: "老师作业", desc: "布置与查看", image: asset("icon-teacher-homework.png"), url: "/pages/homework/index", tone: "green" },
  { key: "paper", title: "组卷", desc: "生成试卷", image: asset("icon-paper.png"), url: "/pages/paper/index", tone: "purple" },
  { key: "history", title: "历史记录", desc: "查看记录", image: asset("icon-history.png"), url: "/pages/history/index", tone: "sky" }
];

export default function IndexPage() {
  const [role, setRole] = useState(null);

  useEffect(() => {
    const saved = Taro.getStorageSync("homeRole");
    if (saved === "student" || saved === "teacher") setRole(saved);
  }, []);

  function chooseRole(nextRole) {
    setRole(nextRole);
    Taro.setStorageSync("homeRole", nextRole);
  }

  function switchRole() {
    setRole(null);
    Taro.removeStorageSync("homeRole");
  }

  const activeCards = role === "student" ? studentCards : teacherCards;
  const roleTitle = role === "student" ? "学生功能" : "老师功能";
  const roleDesc = role === "student" ? "做作业、生成练习题，也可以进行错题巩固。" : "布置作业、生成试卷，并查看学生提交。";

  return (
    <View className="page">
      <View className="top-title">小学 AI 出题助手</View>

      <View className="hero home-hero visual-hero">
        <Image className="hero-bg" src={asset("banner-home.png")} mode="aspectFill" />
        <View className="hero-overlay" />
        <View className="hero-content">
          <Text className="hero-title">小学 AI 出题助手</Text>
          <Text className="hero-subtitle">给学生、家长和老师使用的练习生成工具</Text>
          <View className="hero-tags">
            <Text className="hero-tag">智能生成</Text>
            <Text className="hero-tag">分身份使用</Text>
            <Text className="hero-tag">高效省时</Text>
          </View>
        </View>
      </View>

      <View className="notice">
        <Text className="notice-icon">!</Text>
        <Text>AI 内容仅供辅助，请家长或老师审核后使用。</Text>
      </View>

      {!role && (
        <View className="card">
          <Text className="section-title">请选择身份</Text>
          <Text className="section-desc">选择后会自动记住，下次打开小程序不用重复选择。</Text>
          <View className="role-grid">
            {roleCards.map((item) => (
              <Button key={item.key} className={`role-card ${item.tone}`} onClick={() => chooseRole(item.key)}>
                <Image className="role-icon-img" src={item.image} mode="aspectFit" />
                <Text className="role-title">{item.title}</Text>
                <Text className="role-desc">{item.desc}</Text>
              </Button>
            ))}
          </View>
        </View>
      )}

      {role && (
        <View className="card">
          <View className="panel-head">
            <View className="panel-title-wrap">
              <Text className="section-title">{roleTitle}</Text>
              <Text className="panel-desc">{roleDesc}</Text>
            </View>
            <Button className="switch-button" onClick={switchRole}>切换身份</Button>
          </View>
          <View className="feature-grid">
            {activeCards.map((item) => (
              <Button key={item.key} className={`feature-card ${item.tone}`} onClick={() => Taro.navigateTo({ url: item.url })}>
                <Image className="feature-icon-img" src={item.image} mode="aspectFit" />
                <View className="feature-copy">
                  <Text className="feature-title">{item.title}</Text>
                  <Text className="feature-desc">{item.desc}</Text>
                </View>
              </Button>
            ))}
          </View>
        </View>
      )}

      <View className="footer-links">
        <Button className="link-button" onClick={() => Taro.navigateTo({ url: "/pages/privacy/index" })}>隐私说明</Button>
        <Text className="footer-divider">|</Text>
        <Button className="link-button" onClick={() => Taro.navigateTo({ url: "/pages/about/index" })}>关于</Button>
      </View>
    </View>
  );
}
