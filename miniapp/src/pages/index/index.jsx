import React, { useEffect, useState } from "react";
import Taro, { useDidShow, useTabItemTap } from "@tarojs/taro";
import { Button, Image, Picker, Text, View } from "@tarojs/components";
import { gradeOptions, semesterOptions } from "../../utils/options";
import { getContentPackage } from "../../utils/api";
import { getTodayStats } from "../../utils/practiceStats";
import { getLatestDoingPracticeSession, getSessionProgress } from "../../utils/practiceSession";
import { getWrongBook } from "../../utils/wrongBook";
import { navigateToPage, switchToTab } from "../../utils/navigation";
import "../../styles/common.scss";
import "./index.scss";

const asset = (name) => `/assets/generated/${name}`;

const tabs = ["首页", "语文", "数学", "英语"];
const PROGRESS_KEY = "chapterPracticeProgress";
const HOME_RESTORE_KEY = "homePracticeReturnState";
const PRACTICE_RESET_KEY = "practiceResetToHome";
const QUESTIONS_PER_POINT = 5;

const quickEntries = [
  { title: "章节练习", desc: "按课本章节刷题", image: asset("icon-practice.png"), action: "practice" },
  { title: "错题本", desc: "复习做错的题", image: asset("icon-wrong.png"), url: "/pages/wrong/index", tab: true },
  { title: "学生作业", desc: "输入作业码完成作业", image: asset("icon-student-homework.png"), url: "/pages/student/index" },
  { title: "拍照搜题", desc: "拍照或输入题目看解析", image: asset("icon-history.png"), url: "/pages/photo-search/index" }
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
  const [todayStats, setTodayStats] = useState({ total: 0, correct: 0, accuracy: 0 });
  const [lastPractice, setLastPractice] = useState(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [catalog, setCatalog] = useState(null);
  const [showMathChapters, setShowMathChapters] = useState(false);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [isResuming, setIsResuming] = useState(false);

  useEffect(() => {
    const savedGrade = Taro.getStorageSync("homeGrade");
    const savedSemester = Taro.getStorageSync("homeSemester");
    if (savedGrade) setGrade(savedGrade);
    if (savedSemester) setSemester(savedSemester);
    refreshLearningData();
  }, []);

  useDidShow(() => {
    if (restoreHomePracticeState()) {
      refreshLearningData();
      return;
    }
    resetHomeState();
    refreshLearningData();
  });

  useTabItemTap(() => {
    resetHomeState();
    refreshLearningData();
  });

  function resetHomeState() {
    setActiveTab("首页");
    setCatalog(null);
    setShowMathChapters(false);
    setChapterLoading(false);
  }

  function restoreHomePracticeState() {
    const restore = Taro.getStorageSync(HOME_RESTORE_KEY);
    if (!restore) return false;
    Taro.removeStorageSync(HOME_RESTORE_KEY);
    if (restore.grade) setGrade(restore.grade);
    if (restore.semester) setSemester(restore.semester);
    setActiveTab("数学");
    setShowMathChapters(true);
    setChapterLoading(true);
    loadCatalog().finally(() => setChapterLoading(false));
    return true;
  }

  function refreshLearningData() {
    setTodayStats(getTodayStats());
    setLastPractice(formatContinueSession(getLatestDoingPracticeSession()));
    setWrongCount(getWrongBook().length);
  }

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
    setShowMathChapters(activeTab === "数学");
    saveBaseSelection(nextGrade, semester);
    if (activeTab === "数学" && !catalog && !chapterLoading) {
      setChapterLoading(true);
      loadCatalog().finally(() => setChapterLoading(false));
    }
  }

  function updateSemester(nextSemester) {
    setSemester(nextSemester);
    setShowMathChapters(activeTab === "数学");
    saveBaseSelection(grade, nextSemester);
    if (activeTab === "数学" && !catalog && !chapterLoading) {
      setChapterLoading(true);
      loadCatalog().finally(() => setChapterLoading(false));
    }
  }

  function openPractice(subject = "数学") {
    Taro.removeStorageSync("practiceEntrySelection");
    Taro.removeStorageSync(HOME_RESTORE_KEY);
    Taro.setStorageSync(PRACTICE_RESET_KEY, {
      grade,
      subject,
      semester,
      textbook: "人教版"
    });
    switchToTab("/pages/practice/index");
  }

  function stopEvent(event) {
    event?.stopPropagation?.();
  }

  function switchHomeTab(tab, event) {
    stopEvent(event);
    if (tab === "首页") {
      resetHomeState();
      return;
    }
    setActiveTab(tab);
    if (tab === "数学") {
      setShowMathChapters(true);
      if (!catalog && !chapterLoading) {
        setChapterLoading(true);
        loadCatalog().finally(() => setChapterLoading(false));
      }
      return;
    }
    setShowMathChapters(false);
  }

  async function loadCatalog() {
    try {
      const data = await getContentPackage();
      setCatalog(data);
      return data;
    } catch {
      setCatalog(null);
      return null;
    }
  }

  function continuePractice(event) {
    stopEvent(event);
    if (isResuming) return;
    const session = getLatestDoingPracticeSession();
    if (session?.sessionId) {
      Taro.removeStorageSync(PRACTICE_RESET_KEY);
      setIsResuming(true);
      navigateToPage(
        `/pages/practice/do/index?sessionId=${encodeURIComponent(session.sessionId)}&source=homeResume`,
        {
          complete: () => setIsResuming(false)
        }
      );
      return;
    }
    if (!lastPractice) {
      Taro.showToast({ title: "暂无继续学习，请先开始章节练习", icon: "none" });
      return;
    }
    Taro.showToast({ title: "暂无继续学习，请先开始章节练习", icon: "none" });
  }

  function openEntry(item, event) {
    stopEvent(event);
    if (item.action === "practice") {
      openPractice("数学");
      return;
    }
    navigateToPage(item.url);
  }

  function openTeacher(event) {
    stopEvent(event);
    navigateToPage("/pages/homework/index");
  }

  function openChapter(unit, event) {
    stopEvent(event);
    Taro.setStorageSync("practiceEntrySelection", {
      grade,
      subject: "数学",
      semester,
      textbook: "人教版",
      unit: unit.name,
      targetMode: "types",
      source: "home"
    });
    switchToTab("/pages/practice/index");
  }

  const subject = subjectMeta[activeTab];
  const mathPackage = selectPackage(catalog, { grade, subject: "数学", semester });
  const mathUnits = buildUnitSummaries(mathPackage, { grade, subject: "数学", semester });

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
        <Button className="teacher-link" onClick={openTeacher}>老师入口</Button>
      </View>

      <View className="home-tabs">
        {tabs.map((tab) => (
          <View key={tab} className={activeTab === tab ? "home-tab active" : "home-tab"} onClick={(event) => switchHomeTab(tab, event)}>
            {tab}
          </View>
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

          <View className="card continue-card" onClick={continuePractice}>
            <View className="card-title-row">
              <Text className="section-title">继续学习</Text>
              {lastPractice ? <Text className="continue-action">继续</Text> : <Text className="continue-action">去练习</Text>}
            </View>
            {lastPractice ? (
              <>
                <Text className="continue-title">{lastPractice.grade}{lastPractice.subject}{lastPractice.semester}</Text>
                <Text className="continue-meta">{lastPractice.unit || "章节练习"} · {lastPractice.type || "题型练习"}</Text>
                <View className="continue-progress">
                  <View className="continue-bar">
                    <View className="continue-bar-inner" style={{ width: `${Math.min(100, Math.round(((lastPractice.done || 0) / Math.max(1, lastPractice.total || 1)) * 100))}%` }} />
                  </View>
                  <Text className="continue-count">{lastPractice.done || 0}/{lastPractice.total || 0}</Text>
                </View>
              </>
            ) : (
              <Text className="continue-empty">还没有练习记录，去开始章节练习吧</Text>
            )}
          </View>

          <View className="card">
            <Text className="section-title">今日学习概况</Text>
            <View className="summary-grid">
              <View className="summary-card">
                <Text className="summary-number">{todayStats.total || 0}</Text>
                <Text className="summary-label">今日做题</Text>
              </View>
              <View className="summary-card">
                <Text className="summary-number">{todayStats.total ? `${todayStats.accuracy}%` : "--"}</Text>
                <Text className="summary-label">正确率</Text>
              </View>
              <View className="summary-card">
                <Text className="summary-number">{wrongCount}</Text>
                <Text className="summary-label">错题数量</Text>
              </View>
            </View>
          </View>

          <View className="card">
            <Text className="section-title">常用入口</Text>
            <View className="feature-grid">
              {quickEntries.map((item) => (
                <Button key={item.title} className="feature-card blue" onClick={(event) => openEntry(item, event)}>
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
            <>
              <View className="card">
                <Text className="section-title">{grade}数学{semester}</Text>
                <Text className="section-desc">只有当前年级、数学、当前上下册已有内容包时，才会显示章节题目；没有导入的组合会显示暂无。</Text>
              </View>
              {showMathChapters ? <View className="home-chapter-list">
                {chapterLoading ? (
                  <View className="card">
                    <Text className="section-title">章节加载中</Text>
                    <Text className="section-desc">正在读取当前年级和上下册的章节内容。</Text>
                  </View>
                ) : mathUnits.length ? mathUnits.map((item, index) => (
                  <Button key={item.unit.id || item.unit.name} className="home-chapter-card" onClick={(event) => openChapter(item.unit, event)}>
                    <View className="home-chapter-main">
                      <Text className="home-chapter-index">第 {index + 1} 章</Text>
                      <Text className="home-chapter-title">{item.unit.name}</Text>
                      <Text className="home-chapter-meta">{item.lessonCount} 个课时 · {item.pointCount} 个知识点 · {item.typeCount} 类题型</Text>
                      <ProgressBar done={item.done} total={item.total} />
                    </View>
                    <Text className="home-chapter-count">已做 {item.done} / {item.total}</Text>
                  </Button>
                )) : (
                  <View className="card">
                    <Text className="section-title">暂无内容</Text>
                    <Text className="section-desc">当前选择的年级、数学和上下册还没有导入题库。请选择二年级数学下册或四年级数学下册。</Text>
                  </View>
                )}
              </View> : null}
            </>
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

function selectPackage(catalog, form) {
  const packages = catalog?.packages || [];
  return packages.find((item) =>
    item.scope?.grade === form.grade &&
    item.scope?.subject === form.subject &&
    item.scope?.semester === form.semester
  ) || null;
}

function buildUnitSummaries(activePackage, form) {
  const units = activePackage?.options?.units || [];
  return units.map((unit) => {
    const points = getUnitPoints(activePackage, unit);
    const types = [...new Set(points.flatMap((point) => point.recommendedQuestionTypes || []))];
    const total = types.reduce((sum, type) => {
      const pointCount = points.filter((point) => (point.recommendedQuestionTypes || []).includes(type)).length;
      return sum + Math.max(QUESTIONS_PER_POINT, pointCount * QUESTIONS_PER_POINT);
    }, 0);
    const done = types.reduce((sum, type) => sum + getProgressCount({ ...form, unit: unit.name, type }), 0);
    return {
      unit,
      lessonCount: unit.lessons?.length || 0,
      pointCount: points.length,
      typeCount: types.length,
      done,
      total
    };
  });
}

function getUnitPoints(activePackage, unit) {
  const ids = new Set((unit.lessons || []).flatMap((lesson) => lesson.knowledgePoints || []).map((point) => point.id));
  return (activePackage?.options?.knowledgePoints || []).filter((point) => ids.has(point.id));
}

function getProgressCount(form) {
  const data = Taro.getStorageSync(PROGRESS_KEY) || {};
  const key = [form.grade, form.subject, form.semester, form.unit, form.type].filter(Boolean).join("|");
  return data[key]?.done || 0;
}

function formatContinueSession(session) {
  if (!session) return null;
  const progress = getSessionProgress(session);
  return {
    sessionId: session.sessionId,
    grade: session.grade,
    subject: session.subject,
    semester: session.semester || session.term,
    unit: session.chapterName,
    type: session.questionType,
    done: progress.done,
    total: progress.total,
    updatedAt: session.updatedAt
  };
}

function ProgressBar({ done, total }) {
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <View className="home-progress-wrap">
      <View className="home-progress-fill" style={{ width: `${percent}%` }} />
    </View>
  );
}
