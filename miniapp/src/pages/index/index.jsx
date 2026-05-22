import React, { useEffect, useState } from "react";
import Taro, { useDidShow, useTabItemTap } from "@tarojs/taro";
import { Button, Picker, Text, View } from "@tarojs/components";
import { gradeOptions, semesterOptions } from "../../utils/options";
import { getContentPackage } from "../../utils/api";
import { getTodayStats } from "../../utils/practiceStats";
import { getLatestDoingPracticeSession, getSessionProgress } from "../../utils/practiceSession";
import { getWrongBook } from "../../utils/wrongBook";
import { navigateToPage, switchToTab } from "../../utils/navigation";
import { debugLog, debugWarn } from "../../utils/debug";
import "../../styles/common.scss";
import "./index.scss";

const tabs = ["首页", "语文", "数学", "英语"];
const PROGRESS_KEY = "chapterPracticeProgress";
const HOME_RESTORE_KEY = "homePracticeReturnState";
const PRACTICE_RESET_KEY = "practiceResetToHome";
const QUESTIONS_PER_POINT = 5;

const quickEntries = [
  { title: "章节练习", desc: "同步章节刷题", icon: "✎", tone: "practice", action: "practice" },
  { title: "错题本", desc: "巩固薄弱知识", icon: "✕", tone: "wrong", url: "/pages/wrong/index" },
  { title: "学习统计", desc: "学习情况分析", icon: "↗", tone: "stats", url: "/pages/stats/index" },
  { title: "作业中心", desc: "查看作业任务", icon: "!", tone: "homework", url: "/pages/student/index" }
];

const tabIcons = {
  首页: "⌂",
  语文: "文",
  数学: "△",
  英语: "A"
};

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
    if (savedGrade) setGrade(normalizeGrade(savedGrade));
    if (savedSemester) setSemester(normalizeSemester(savedSemester));
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
    const safeGrade = normalizeGrade(nextGrade);
    const safeSemester = normalizeSemester(nextSemester);
    Taro.setStorageSync("homeGrade", safeGrade);
    Taro.setStorageSync("homeSemester", safeSemester);
    Taro.setStorageSync("baseSelection", {
      grade: safeGrade,
      subject: "数学",
      semester: safeSemester,
      textbook: "人教版"
    });
  }

  function updateGrade(nextGrade) {
    const safeGrade = normalizeGrade(nextGrade);
    setGrade(safeGrade);
    setShowMathChapters(activeTab === "数学");
    saveBaseSelection(safeGrade, semester);
    if (activeTab === "数学" && !catalog && !chapterLoading) {
      setChapterLoading(true);
      loadCatalog().finally(() => setChapterLoading(false));
    }
  }

  function updateSemester(nextSemester) {
    const safeSemester = normalizeSemester(nextSemester);
    setSemester(safeSemester);
    setShowMathChapters(activeTab === "数学");
    saveBaseSelection(grade, safeSemester);
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
      debugLog("[首页题库调试] content-package loaded", {
        packageCount: data?.packages?.length || 0,
        scopes: (data?.packages || []).map((item) => item.scope)
      });
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
    const entry = {
      packageId: mathPackage?.package_id,
      unitId: unit.id,
      grade: mathFilter.grade,
      subject: mathFilter.subject,
      semester: mathFilter.semester,
      textbook: mathPackage?.scope?.textbook || "人教版",
      unit: unit.name,
      targetMode: "types",
      source: "home"
    };
    const missing = ["packageId", "unitId", "grade", "subject", "semester"].filter((key) => !entry[key]);
    debugLog("[首页章节链路调试] openChapter", { entry, missing });
    if (missing.length) {
      debugWarn("[首页章节链路调试] 缺少必要跳转参数", { missing, entry });
      Taro.showToast({ title: "章节入口数据异常，请重新进入首页", icon: "none" });
      return;
    }
    Taro.setStorageSync("practiceEntrySelection", {
      ...entry
    });
    switchToTab("/pages/practice/index");
  }

  const subject = subjectMeta[activeTab];
  const mathFilter = { grade: normalizeGrade(grade), subject: "数学", semester: normalizeSemester(semester) };
  const mathPackage = selectPackage(catalog, mathFilter);
  const mathUnits = buildUnitSummaries(mathPackage, mathFilter);
  const mathContentState = getMathContentState(mathPackage, mathUnits);

  useEffect(() => {
    debugLog("[首页题库调试] math filter result", {
      selectedGrade: grade,
      selectedSemester: semester,
      selectedSubject: "数学",
      normalizedFilter: mathFilter,
      matchedPackageId: mathPackage?.package_id || null,
      matchedScope: mathPackage?.scope || null,
      unitCount: mathPackage?.options?.units?.length || 0,
      knowledgePointCount: mathPackage?.options?.knowledgePoints?.length || 0,
      questionTypeCount: mathPackage?.options?.questionTypes?.length || 0,
      chapterCardCount: mathUnits.length,
      contentState: mathContentState
    });
  }, [grade, semester, catalog, mathPackage, mathUnits.length, mathContentState]);

  return (
    <View className="page home-page page-shell safe-bottom-space">
      <View className="home-top">
        <View className="term-selectors">
          <Picker mode="selector" range={gradeOptions} value={Math.max(0, gradeOptions.indexOf(grade))} onChange={(event) => updateGrade(gradeOptions[event.detail.value])}>
            <View className="grade-pill">{grade}<Text className="pill-arrow">▾</Text></View>
          </Picker>
          <Picker mode="selector" range={semesterOptions} value={Math.max(0, semesterOptions.indexOf(semester))} onChange={(event) => updateSemester(semesterOptions[event.detail.value])}>
            <View className="semester-pill">{semester}<Text className="pill-arrow">▾</Text></View>
          </Picker>
        </View>
        <Button className="teacher-link" onClick={openTeacher}><Text className="teacher-avatar">👨‍🏫</Text>老师入口 ›</Button>
      </View>

      <View className="home-tabs">
        {tabs.map((tab) => (
          <View key={tab} className={activeTab === tab ? "home-tab active" : "home-tab"} onClick={(event) => switchHomeTab(tab, event)}>
            <Text className={`home-tab-icon ${tab === "语文" ? "red" : tab === "英语" ? "green" : "blue"}`}>{tabIcons[tab]}</Text>
            <Text>{tab}</Text>
          </View>
        ))}
      </View>

      {activeTab === "首页" ? (
        <>
          <View className="hero home-hero visual-hero hero-card hero-card--blue">
            <View className="hero-content">
              <Text className="hero-title">小学学习练习</Text>
              <Text className="hero-subtitle">同步教材，巩固知识，快乐提升每一步</Text>
              <View className="hero-tags">
                <Text className="hero-tag">章节刷题</Text>
                <Text className="hero-tag">错题巩固</Text>
                <Text className="hero-tag">学习统计</Text>
              </View>
            </View>
            <View className="home-hero-illustration">
              <Text className="confetti confetti-a">◆</Text>
              <Text className="confetti confetti-b">★</Text>
              <Text className="confetti confetti-c">~</Text>
              <View className="book-illus">
                <View className="book-page left" />
                <View className="book-page right" />
                <View className="pencil-illus" />
              </View>
              <View className="trophy-illus"><Text>★</Text></View>
              <View className="cloud cloud-a" />
              <View className="cloud cloud-b" />
            </View>
          </View>

          <View className="card continue-card study-card learning-path-card" onClick={continuePractice}>
            <Text className="continue-ribbon">继续学习 ▶</Text>
            {lastPractice ? (
              <>
                <View className="continue-book-icon"><Text>数</Text></View>
                <View className="continue-copy">
                  <Text className="continue-title">{lastPractice.grade}{lastPractice.subject}{lastPractice.semester}</Text>
                  <Text className="continue-meta">当前章节：{lastPractice.unit || "章节练习"}</Text>
                  <Text className="continue-meta">当前题型：{lastPractice.type || "题型练习"}</Text>
                  <View className="continue-progress">
                    <Text className="continue-done">已做 {lastPractice.done || 0} / {lastPractice.total || 0} 题</Text>
                    <View className="continue-bar progress-track">
                      <View className="continue-bar-inner progress-bar" style={{ width: `${Math.min(100, Math.round(((lastPractice.done || 0) / Math.max(1, lastPractice.total || 1)) * 100))}%` }} />
                    </View>
                    <Text className="continue-percent">{Math.min(100, Math.round(((lastPractice.done || 0) / Math.max(1, lastPractice.total || 1)) * 100))}%</Text>
                  </View>
                </View>
                <Text className="continue-arrow">›</Text>
              </>
            ) : (
              <>
                <View className="continue-book-icon"><Text>学</Text></View>
                <View className="continue-copy">
                  <Text className="continue-title">{grade}数学{semester}</Text>
                  <Text className="continue-empty">还没有练习记录，去开始章节练习吧</Text>
                </View>
                <Text className="continue-arrow">›</Text>
              </>
            )}
          </View>

          <View className="card study-card">
            <Text className="section-title">今日学习概况</Text>
            <View className="summary-grid stat-grid">
              <View className="summary-card stat-card summary-practice">
                <Text className="summary-icon">☑</Text>
                <Text className="summary-number stat-value">{todayStats.total || 0}</Text>
                <Text className="summary-label stat-label">今日做题</Text>
              </View>
              <View className="summary-card stat-card summary-accuracy">
                <Text className="summary-icon">◎</Text>
                <Text className="summary-number stat-value">{todayStats.total ? `${todayStats.accuracy}%` : "--"}</Text>
                <Text className="summary-label stat-label">正确率</Text>
              </View>
              <View className="summary-card stat-card summary-wrong">
                <Text className="summary-icon">★</Text>
                <Text className="summary-number stat-value">{wrongCount}</Text>
                <Text className="summary-label stat-label">错题数量</Text>
              </View>
            </View>
          </View>

          <View className="card study-card">
            <Text className="section-title">常用入口</Text>
            <View className="feature-grid learning-entry-grid">
              {quickEntries.map((item) => (
                <Button key={item.title} className={`feature-card learning-entry-card ${item.tone}`} onClick={(event) => openEntry(item, event)}>
                  <View className="feature-illus">
                    <Text>{item.icon}</Text>
                  </View>
                  <View className="feature-copy">
                    <Text className="feature-title learning-entry-title">{item.title}</Text>
                    <Text className="feature-desc learning-entry-desc">{item.desc}</Text>
                  </View>
                  <Text className="feature-arrow">›</Text>
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
              <View className="card study-card home-math-guide-card">
                <View className="home-math-guide-icon">
                  <Text>数</Text>
                </View>
                <View className="home-math-guide-copy">
                  <Text className="section-title">{grade}数学{semester}</Text>
                  <Text className="section-desc">已导入内容会显示章节、题型和进度；没有导入的组合会显示暂无。</Text>
                </View>
              </View>
              {showMathChapters ? <View className="home-chapter-list">
                {chapterLoading ? (
                  <View className="card">
                    <Text className="section-title">章节加载中</Text>
                    <Text className="section-desc">正在读取当前年级和上下册的章节内容。</Text>
                  </View>
                ) : mathContentState === "ready" ? mathUnits.map((item, index) => (
                  <Button key={item.unit.id || item.unit.name} className="chapter-card course-chapter-card study-card home-course-chapter-card" onClick={(event) => openChapter(item.unit, event)}>
                    <View className="chapter-visual">
                      <Text className={`chapter-index chapter-index-${(index % 4) + 1}`}>第 {index + 1} 章</Text>
                      <View className={`chapter-visual-icon icon-${(index % 6) + 1}`}>
                        <Text>{chapterVisualIcon(item.unit.name)}</Text>
                      </View>
                    </View>
                    <View className="chapter-main">
                      <Text className="chapter-title">{item.unit.name}</Text>
                      <Text className="chapter-meta">{item.lessonCount} 个课时 · {item.pointCount} 个知识点 · {item.typeCount} 类题型</Text>
                      <View className="chapter-progress-row">
                        <ProgressBar done={item.done} total={item.total} />
                        <Text className="chapter-count">已做 {item.done} / {item.total}</Text>
                      </View>
                    </View>
                    <View className="chapter-entry">
                      <Text className="chapter-entry-arrow">›</Text>
                      <Text className="chapter-entry-text">开始学习</Text>
                    </View>
                  </Button>
                )) : (
                  <View className="card">
                    <Text className="section-title">{mathContentState === "empty-package" ? "题库整理中" : "暂无内容"}</Text>
                    <Text className="section-desc">
                      {mathContentState === "empty-package"
                        ? "该内容包已创建，但还没有导入章节。"
                        : "当前选择的年级、学科和上下册还没有导入题库。"}
                    </Text>
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
  const target = normalizeFilter(form);
  return packages.find((item) =>
    normalizeGrade(item.scope?.grade) === target.grade &&
    normalizeSubject(item.scope?.subject) === target.subject &&
    normalizeSemester(item.scope?.semester) === target.semester
  ) || null;
}

function normalizeFilter(form) {
  return {
    ...form,
    grade: normalizeGrade(form.grade),
    subject: normalizeSubject(form.subject),
    semester: normalizeSemester(form.semester)
  };
}

function normalizeGrade(value) {
  const text = String(value || "").trim();
  const map = {
    grade1: "一年级",
    g1: "一年级",
    "1": "一年级",
    "1年级": "一年级",
    grade2: "二年级",
    g2: "二年级",
    "2": "二年级",
    "2年级": "二年级",
    grade3: "三年级",
    g3: "三年级",
    "3": "三年级",
    "3年级": "三年级",
    grade4: "四年级",
    g4: "四年级",
    "4": "四年级",
    "4年级": "四年级",
    grade5: "五年级",
    g5: "五年级",
    "5": "五年级",
    "5年级": "五年级",
    grade6: "六年级",
    g6: "六年级",
    "6": "六年级",
    "6年级": "六年级"
  };
  return map[text] || text || "二年级";
}

function normalizeSemester(value) {
  const text = String(value || "").trim();
  const map = {
    first: "上册",
    up: "上册",
    upper: "上册",
    "1": "上册",
    second: "下册",
    down: "下册",
    lower: "下册",
    "2": "下册"
  };
  return map[text] || text || "下册";
}

function normalizeSubject(value) {
  const text = String(value || "").trim();
  const map = {
    chinese: "语文",
    cn: "语文",
    yuwen: "语文",
    math: "数学",
    maths: "数学",
    mathematics: "数学",
    english: "英语",
    en: "英语"
  };
  return map[text] || text || "数学";
}

function getMathContentState(activePackage, units) {
  if (!activePackage) return "missing-package";
  if (!units.length) return "empty-package";
  const hasQuestionStructure = units.some((item) => item.pointCount > 0 && item.typeCount > 0 && item.total > 0);
  return hasQuestionStructure ? "ready" : "empty-package";
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

function chapterVisualIcon(name = "") {
  if (name.includes("时间")) return "⏰";
  if (name.includes("余数") || name.includes("除法")) return "123";
  if (name.includes("乘除")) return "▦";
  if (name.includes("万以内数")) return "△";
  if (name.includes("加法") || name.includes("减法")) return "🧮";
  if (name.includes("图形")) return "◔";
  if (name.includes("解决")) return "?";
  return "📘";
}

function ProgressBar({ done, total }) {
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <View className="progress-wrap">
      <View className="progress-fill" style={{ width: `${percent}%` }} />
    </View>
  );
}
