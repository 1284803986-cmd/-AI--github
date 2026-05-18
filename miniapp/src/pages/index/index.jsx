import React, { useEffect, useState } from "react";
import Taro from "@tarojs/taro";
import { Button, Image, Picker, Text, View } from "@tarojs/components";
import { gradeOptions, semesterOptions } from "../../utils/options";
import "../../styles/common.scss";
import "./index.scss";

const asset = (name) => `/assets/generated/${name}`;

const tabs = ["首页", "语文", "数学", "英语"];

const quickEntries = [
  { title: "章节练习", desc: "按课本章节刷题", image: asset("icon-practice.png"), action: "practice" },
  { title: "错题本", desc: "复习做错的题", image: asset("icon-wrong.png"), url: "/pages/wrong/index", tab: true },
  { title: "学生作业", desc: "输入作业码完成作业", image: asset("icon-student-homework.png"), url: "/pages/student/index" },
  { title: "历史记录", desc: "查看生成和练习记录", image: asset("icon-history.png"), url: "/pages/history/index" }
];

const subjectMeta = {
  语文: {
    icon: "文",
    title: "语文学习",
    desc: "字词、阅读、表达内容正在整理中。",
    tone: "red"
  },
  数学: {
    icon: "数",
    title: "数学章节练习",
    desc: "已导入内容的年级和上下册，会显示章节、题型和进度。",
    tone: "blue"
  },
  英语: {
    icon: "英",
    title: "英语学习",
    desc: "单词、句型、阅读内容正在整理中。",
    tone: "green"
  }
};

export default function IndexPage() {
  const [grade, setGrade] = useState("二年级");
  const [semester, setSemester] = useState("下册");
  const [activeTab, setActiveTab] = useState("首页");

  useEffect(() => {
    const savedGrade = Taro.getStorageSync("homeGrade");
    const savedSemester = Taro.getStorageSync("homeSemester");
    if (savedGrade) setGrade(savedGrade);
    if (savedSemester) setSemester(savedSemester);
  }, []);

  function saveBaseSelection(nextGrade = grade, nextSemester = semester) {
    Taro.setStorageSync("homeGrade", nextGrade);
    Taro.setStorageSync("homeSemester", nextSemester);
    Taro.setStorageSync("baseSelection", {
      grade: nextGrade,
      subject: "数学",
      semester: nextSemester,
      textbook: "人教版"
    });
  }

  function updateGrade(nextGrade) {
    setGrade(nextGrade);
    saveBaseSelection(nextGrade, semester);
  }

  function updateSemester(nextSemester) {
    setSemester(nextSemester);
    saveBaseSelection(grade, nextSemester);
  }

  function openPractice(subject = "数学") {
    Taro.setStorageSync("practiceEntrySelection", {
      grade,
      subject,
      semester,
      textbook: "人教版"
    });
    Taro.switchTab({ url: "/pages/practice/index" });
  }

  function openEntry(item) {
    if (item.action === "practice") {
      openPractice("数学");
      return;
    }
    if (item.tab) {
      Taro.switchTab({ url: item.url });
      return;
    }
    Taro.navigateTo({ url: item.url });
  }

  const subject = subjectMeta[activeTab];

  return (
    <View className="page home-page">
      <View className="home-top">
        <View className="term-selectors">
          <Picker mode="selector" range={gradeOptions} value={Math.max(0, gradeOptions.indexOf(grade))} onChange={(event) => updateGrade(gradeOptions[event.detail.value])}>
            <View className="grade-pill">{grade} ▾</View>
          </Picker>
          <Picker mode="selector" range={semesterOptions} value={Math.max(0, semesterOptions.indexOf(semester))} onChange={(event) => updateSemester(semesterOptions[event.detail.value])}>
            <View className="semester-pill">{semester} ▾</View>
          </Picker>
        </View>
        <Button className="teacher-link" onClick={() => Taro.navigateTo({ url: "/pages/homework/index" })}>老师入口</Button>
      </View>

      <View className="home-tabs">
        {tabs.map((tab) => (
          <Button key={tab} className={activeTab === tab ? "home-tab active" : "home-tab"} onClick={() => setActiveTab(tab)}>
            {tab}
          </Button>
        ))}
      </View>

      {activeTab === "首页" ? (
        <>
          <View className="hero home-hero visual-hero">
            <Image className="hero-bg" src={asset("banner-home.png")} mode="aspectFill" />
            <View className="hero-overlay" />
            <View className="hero-content">
              <Text className="hero-title">小学学习练习</Text>
              <Text className="hero-subtitle">按年级、学期、学科、章节练习，错题会自动沉淀到错题本。</Text>
              <View className="hero-tags">
                <Text className="hero-tag">章节刷题</Text>
                <Text className="hero-tag">错题巩固</Text>
                <Text className="hero-tag">作业练习</Text>
              </View>
            </View>
          </View>

          <View className="card">
            <Text className="section-title">常用入口</Text>
            <View className="feature-grid">
              {quickEntries.map((item) => (
                <Button key={item.title} className="feature-card blue" onClick={() => openEntry(item)}>
                  <Image className="feature-icon-img" src={item.image} mode="aspectFit" />
                  <View className="feature-copy">
                    <Text className="feature-title">{item.title}</Text>
                    <Text className="feature-desc">{item.desc}</Text>
                  </View>
                </Button>
              ))}
            </View>
          </View>
        </>
      ) : (
        <View className="subject-panel">
          <View className={`subject-hero ${subject.tone}`}>
            <View className={`subject-icon ${subject.tone}`}>
              <Text>{subject.icon}</Text>
            </View>
            <View className="subject-hero-copy">
              <Text className="subject-hero-title">{grade}{semester}{subject.title}</Text>
              <Text className="subject-hero-desc">{subject.desc}</Text>
            </View>
          </View>
          {activeTab === "数学" ? (
            <View className="card">
              <Text className="section-title">{grade}数学{semester}</Text>
              <Text className="section-desc">只有当前年级、数学、当前上下册已有内容包时，才会显示章节题目；没有导入的组合会显示暂无。</Text>
              <Button className="primary-button full-button" onClick={() => openPractice("数学")}>进入数学章节练习</Button>
            </View>
          ) : (
            <View className="card">
              <Text className="section-title">内容整理中</Text>
              <Text className="section-desc">当前先完成数学章节刷题。后续导入{activeTab}内容后，这里会显示对应章节。</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
