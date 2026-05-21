import React, { useEffect, useMemo, useState } from "react";
import Taro, { useDidShow, useTabItemTap } from "@tarojs/taro";
import { Button, ScrollView, Text, View } from "@tarojs/components";
import { AiNotice, SelectField } from "../../components/form";
import { defaultSelection, gradeOptions, subjectCards } from "../../utils/options";
import { generateTextbook, getContentPackage } from "../../utils/api";
import { createPracticeSession, findDoingPracticeSession, getSessionProgress, hasSessionProgress, savePracticeSession } from "../../utils/practiceSession";
import { navigateToPage, switchToTab } from "../../utils/navigation";
import "../../styles/common.scss";

const ENTRY_KEY = "practiceEntrySelection";
const HOME_RESTORE_KEY = "homePracticeReturnState";
const PRACTICE_RESET_KEY = "practiceResetToHome";
const QUESTIONS_PER_POINT = 5;
const MAX_TYPE_QUESTIONS = 50;

export default function PracticePage() {
  const [form, setForm] = useState({ ...defaultSelection, type: "填空题", difficulty: "基础", count: 5 });
  const [catalog, setCatalog] = useState(null);
  const [pendingEntry, setPendingEntry] = useState(null);
  const [entrySource, setEntrySource] = useState("practice");
  const [mode, setMode] = useState("selector");
  const [activeUnitId, setActiveUnitId] = useState("");
  const [activeType, setActiveType] = useState("");
  const [progressVersion, setProgressVersion] = useState(0);
  const [loading, setLoading] = useState(false);

  const activePackage = useMemo(() => selectPackage(catalog, form), [catalog, form]);
  const units = activePackage?.options?.units || [];
  const activeUnit = units.find((item) => item.id === activeUnitId || item.name === form.unit) || units[0];
  const typeSummaries = useMemo(() => buildTypeSummaries(activePackage, activeUnit, form, progressVersion), [activePackage, activeUnit, form, progressVersion]);
  const unitSummaries = useMemo(() => buildUnitSummaries(activePackage, form, progressVersion), [activePackage, form, progressVersion]);
  useEffect(() => {
    const saved = Taro.getStorageSync("baseSelection");
    const homeGrade = Taro.getStorageSync("homeGrade");
    const homeSemester = Taro.getStorageSync("homeSemester");
    if (saved || homeGrade || homeSemester) {
      setForm((old) => ({
        ...old,
        ...saved,
        grade: homeGrade || saved?.grade || old.grade,
        semester: homeSemester || saved?.semester || old.semester,
        type: saved?.type || old.type,
        difficulty: saved?.difficulty || old.difficulty
      }));
    }
    getContentPackage()
      .then((data) => {
        setCatalog(data);
        setForm((old) => normalizeSelection(old, data));
      })
      .catch(() => setCatalog(null));
  }, []);

  useEffect(() => {
    if (!catalog || !pendingEntry) return;
    const next = normalizeSelection({ ...form, ...pendingEntry }, catalog);
    const pkg = selectPackage(catalog, next);
    const unit = findUnit(pkg, next.unit);
    setForm(next);
    setActiveUnitId(unit?.id || "");
    setActiveType(next.type || "");
    setEntrySource(pendingEntry.source || "practice");
    setPendingEntry(null);
    if (pendingEntry.autoStart && unit && next.type) {
      generatePractice(next);
    } else if (pendingEntry.targetMode === "types" && unit) {
      setMode("types");
    } else {
      setMode("chapters");
    }
  }, [catalog, pendingEntry]);

  useDidShow(() => {
    setProgressVersion((value) => value + 1);
    const entry = Taro.getStorageSync(ENTRY_KEY);
    if (entry) {
      Taro.removeStorageSync(ENTRY_KEY);
      setPendingEntry(entry);
      return;
    }
    const reset = Taro.getStorageSync(PRACTICE_RESET_KEY);
    if (reset) {
      Taro.removeStorageSync(PRACTICE_RESET_KEY);
      resetPracticeHome(reset);
    }
  });

  useTabItemTap(() => {
    Taro.removeStorageSync(ENTRY_KEY);
    resetPracticeHome();
  });

  function updateSelection(patch) {
    const next = normalizeSelection({ ...form, ...patch }, catalog);
    setForm(next);
    Taro.setStorageSync("baseSelection", next);
  }

  function resetPracticeHome(reset = {}) {
    Taro.removeStorageSync(HOME_RESTORE_KEY);
    setPendingEntry(null);
    setEntrySource("practice");
    setMode("selector");
    setActiveUnitId("");
    setActiveType("");
    setForm((old) => normalizeSelection({ ...old, ...reset }, catalog));
  }

  function startBySubject(subject) {
    setEntrySource("practice");
    updateSelection({ subject });
    setMode("chapters");
  }

  function openUnit(unit) {
    setActiveUnitId(unit.id);
    setForm((old) => ({ ...old, unit: unit.name }));
    setMode("types");
  }

  async function openType(summary) {
    if (!activeUnit) return;
    const type = typeof summary === "string" ? summary : summary.type;
    const total = typeof summary === "string" ? getTypeTotal(activePackage, activeUnit, type) : summary.total;
    const point = findPointForType(activePackage, activeUnit, type);
    if (!point) {
      Taro.showToast({ title: "这个题型暂时没有题目", icon: "none" });
      return;
    }
    const nextForm = normalizeSelection({
      ...form,
      unit: activeUnit.name,
      lesson: findLessonName(activeUnit, point),
      knowledgePoint: point.name,
      type,
      count: Math.min(MAX_TYPE_QUESTIONS, Math.max(1, Number(total) || 5))
    }, catalog);
    setForm(nextForm);
    setActiveType(type);
    const oldSession = findDoingPracticeSession(nextForm);
    if (oldSession) {
      if (!hasSessionProgress(oldSession)) {
        navigateToSession(oldSession.sessionId, entrySource);
        return;
      }
      const choice = await Taro.showModal({
        title: "继续未完成练习",
        content: "这个题型还有未完成的练习，要继续吗？",
        confirmText: "继续练习",
        cancelText: "重新开始"
      });
      if (choice.confirm) {
        navigateToSession(oldSession.sessionId, entrySource);
        return;
      }
      const restart = await Taro.showModal({
        title: "确认重新开始",
        content: "重新开始会清空当前这组练习进度，确定继续吗？",
        confirmText: "确定",
        cancelText: "取消"
      });
      if (!restart.confirm) return;
      savePracticeSession({ ...oldSession, status: "abandoned" });
    }
    await generatePractice(nextForm);
  }

  async function generatePractice(nextForm = form) {
    if (!selectPackage(catalog, nextForm)) {
      setMode("empty");
      return;
    }

    setLoading(true);
    try {
      const data = await generateTextbook({ ...nextForm, count: Number(nextForm.count) || 5 });
      const nextQuestions = normalizeGeneratedQuestions(getPracticeQuestions(data), nextForm.type);
      if (!nextQuestions.length) {
        Taro.showToast({ title: "题目数据为空，请重新开始。", icon: "none" });
        return;
      }
      const session = createPracticeSession(nextForm, nextQuestions);
      Taro.setStorageSync("baseSelection", nextForm);
      Taro.showToast({ title: "题目生成成功", icon: "success" });
      navigateToSession(session.sessionId, entrySource);
    } catch {
      Taro.showToast({ title: "生成失败，请确认后端已启动", icon: "none" });
    } finally {
      setLoading(false);
    }
  }

  function navigateToSession(nextSessionId, source = "practice") {
    if (!nextSessionId) {
      Taro.showToast({ title: "练习数据异常，请重新开始。", icon: "none" });
      return;
    }
    navigateToPage(`/pages/practice/do/index?sessionId=${encodeURIComponent(nextSessionId)}&source=${source || "practice"}`);
  }

  function backToPrevious() {
    if (mode === "types") {
      if (entrySource === "home") {
        Taro.setStorageSync(HOME_RESTORE_KEY, {
          grade: form.grade,
          semester: form.semester,
          subject: form.subject,
          unit: activeUnit?.name || form.unit
        });
        switchToTab("/pages/index/index");
        return;
      }
      setMode("chapters");
      return;
    }
    if (mode === "chapters" || mode === "empty") {
      setMode("selector");
      return;
    }
    Taro.navigateBack();
  }

  return (
    <ScrollView className="page practice-page" scrollY>
      {mode !== "selector" ? <PracticeTopBack title={buildBackTitle(mode, activeUnit)} onBack={backToPrevious} /> : null}

      {mode === "selector" ? (
        <>
          <View className="hero">
            <Text className="hero-title">章节刷题</Text>
            <Text className="hero-subtitle">先选学科，再按章节、题型一步步练习。</Text>
          </View>
          <AiNotice />
          <View className="card">
            <Text className="section-title">练习条件</Text>
            <Text className="section-desc">年级和上册/下册已经统一放在首页左上角。这里选择学科即可，减少重复操作。</Text>
            <SelectField label="年级" value={form.grade} options={gradeOptions} onChange={(grade) => updateSelection({ grade })} />
          </View>
          <View className="subject-grid">
            {subjectCards.map((item) => (
              <Button key={item.key} className={`subject-card ${item.tone}`} onClick={() => startBySubject(item.key)}>
                <View className={`subject-icon ${item.tone}`}>
                  <Text>{item.icon}</Text>
                </View>
                <View className="subject-copy">
                  <Text className="subject-title">{item.title}</Text>
                  <Text className="subject-desc">{item.desc}</Text>
                </View>
              </Button>
            ))}
          </View>
        </>
      ) : null}

      {mode === "chapters" ? (
        <>
          <View className="hero">
            <Text className="hero-title">{form.grade}{form.subject}{form.semester}</Text>
            <Text className="hero-subtitle">选择章节，查看每章题量和完成进度。</Text>
          </View>
          {unitSummaries.length ? unitSummaries.map((item, index) => (
            <Button key={item.unit.id} className="chapter-card" onClick={() => openUnit(item.unit)}>
              <View className="chapter-main">
                <Text className="chapter-index">第 {index + 1} 章</Text>
                <Text className="chapter-title">{item.unit.name}</Text>
                <Text className="chapter-meta">{item.lessonCount} 个课时 · {item.pointCount} 个知识点 · {item.typeCount} 类题型</Text>
                <ProgressBar done={item.done} total={item.total} />
              </View>
              <Text className="chapter-count">已做 {item.done} / {item.total}</Text>
            </Button>
          )) : (
            <EmptyPackage />
          )}
        </>
      ) : null}

      {mode === "types" && activeUnit ? (
        <>
          <View className="hero">
            <Text className="hero-title">{activeUnit.name}</Text>
            <Text className="hero-subtitle">选择题型后直接开始做题。</Text>
          </View>
          <View className="type-list">
            {typeSummaries.map((item) => (
              <Button key={item.type} className="type-card" loading={loading && activeType === item.type} disabled={loading} onClick={() => openType(item)}>
                <View className="type-icon"><Text>{typeIcon(item.type)}</Text></View>
                <View className="type-copy">
                  <Text className="type-title">{item.type}</Text>
                  <Text className="type-desc">{item.pointCount} 个知识点 · 已做 {item.done} / {item.total}</Text>
                  <ProgressBar done={item.done} total={item.total} />
                </View>
              </Button>
            ))}
          </View>
        </>
      ) : null}

      {mode === "empty" ? (
        <View className="hero">
          <Text className="hero-title">{form.subject}内容整理中</Text>
          <Text className="hero-subtitle">当前选择的年级、学科和上下册暂无题目内容。请等导入对应内容包后再练习。</Text>
        </View>
      ) : null}

    </ScrollView>
  );
}

function PracticeTopBack({ title, onBack }) {
  return (
    <View className="practice-nav">
      <Button className="practice-nav-button" onClick={onBack}>‹</Button>
      <Text className="practice-nav-title">{title}</Text>
    </View>
  );
}

function buildBackTitle(mode, activeUnit) {
  if (mode === "types") return activeUnit?.name || "题型";
  if (mode === "empty") return "暂无内容";
  return "章节";
}

function EmptyPackage() {
  return (
    <View className="card">
      <Text className="section-title">内容整理中</Text>
      <Text className="muted">当前年级、学科或上下册暂无题目内容。只有已导入内容包的组合才会显示章节和题型。</Text>
    </View>
  );
}

function ProgressBar({ done, total }) {
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <View className="progress-wrap">
      <View className="progress-fill" style={{ width: `${percent}%` }} />
    </View>
  );
}

function normalizeSelection(selection, catalog) {
  const active = selectPackage(catalog, selection);
  const firstUnit = active?.options?.units?.[0];
  const firstPoint = firstUnit?.lessons?.[0]?.knowledgePoints?.[0];
  return {
    ...selection,
    textbook: active?.scope?.textbook || selection.textbook || "人教版",
    unit: selection.unit || firstUnit?.name || "",
    knowledgePoint: selection.knowledgePoint || firstPoint?.name || "",
    type: selection.type || "填空题",
    difficulty: selection.difficulty || "基础",
    count: Number(selection.count) || 5
  };
}

function selectPackage(catalog, form) {
  const packages = catalog?.packages || [];
  if (!packages.length) return null;
  return packages.find((item) =>
    item.scope?.grade === form.grade &&
    item.scope?.subject === form.subject &&
    item.scope?.semester === form.semester
  ) || null;
}

function findUnit(activePackage, unitNameOrId) {
  return (activePackage?.options?.units || []).find((unit) => unit.id === unitNameOrId || unit.name === unitNameOrId);
}

function buildUnitSummaries(activePackage, form, version) {
  void version;
  const units = activePackage?.options?.units || [];
  return units.map((unit) => {
    const summaries = buildTypeSummaries(activePackage, unit, form, version);
    return {
      unit,
      lessonCount: unit.lessons?.length || 0,
      pointCount: getUnitPoints(activePackage, unit).length,
      typeCount: summaries.length,
      done: summaries.reduce((sum, item) => sum + item.done, 0),
      total: summaries.reduce((sum, item) => sum + item.total, 0)
    };
  });
}

function buildTypeSummaries(activePackage, unit, form, version) {
  void version;
  if (!unit) return [];
  const points = getUnitPoints(activePackage, unit);
  const types = [...new Set(points.flatMap((point) => point.recommendedQuestionTypes || []))];
  return types.map((type) => {
    const pointCount = points.filter((point) => (point.recommendedQuestionTypes || []).includes(type)).length;
    const total = Math.min(MAX_TYPE_QUESTIONS, Math.max(QUESTIONS_PER_POINT, pointCount * QUESTIONS_PER_POINT));
    return {
      type,
      pointCount,
      total,
      done: getProgressCount({ ...form, unit: unit.name, type })
    };
  });
}

function getUnitPoints(activePackage, unit) {
  const ids = new Set((unit.lessons || []).flatMap((lesson) => lesson.knowledgePoints || []).map((point) => point.id));
  return (activePackage?.options?.knowledgePoints || []).filter((point) => ids.has(point.id));
}

function findPointForType(activePackage, unit, type) {
  return getUnitPoints(activePackage, unit).find((point) => (point.recommendedQuestionTypes || []).includes(type)) || getUnitPoints(activePackage, unit)[0];
}

function findLessonName(unit, point) {
  return (unit.lessons || []).find((lesson) => (lesson.knowledgePoints || []).some((item) => item.id === point.id))?.name || "";
}

function getProgressCount(form) {
  const session = findDoingPracticeSession(form);
  return session ? getSessionProgress(session).done : 0;
}

function getTypeTotal(activePackage, unit, type) {
  if (!unit) return 0;
  const points = getUnitPoints(activePackage, unit);
  const pointCount = points.filter((point) => (point.recommendedQuestionTypes || []).includes(type)).length;
  return Math.min(MAX_TYPE_QUESTIONS, Math.max(QUESTIONS_PER_POINT, pointCount * QUESTIONS_PER_POINT));
}

function getChoiceOptions(question) {
  if (Array.isArray(question.options) && question.options.length) return question.options;
  const right = String(question.answer || "").trim();
  if (["A", "B", "C", "D"].includes(right)) {
    return ["A. 选项A", "B. 选项B", "C. 选项C", "D. 选项D"];
  }
  if (!right) return [];
  const number = Number(right.replace(/[^\d.-]/g, ""));
  if (Number.isFinite(number)) {
    const values = [];
    for (const item of [number, number + 1, Math.max(0, number - 1), number + 2, number + 3, number + 4]) {
      const text = Number(item.toFixed(2)).toString();
      if (!values.includes(text)) values.push(text);
      if (values.length >= 4) break;
    }
    return values.map((item, index) => `${["A", "B", "C", "D"][index]}. ${item}`);
  }
  return [`A. ${right}`, "B. 以上都不对", "C. 无法确定", "D. 题目条件不足"];
}

function normalizeGeneratedQuestions(items, selectedType) {
  return items.map((item, index) => normalizeGeneratedQuestion(item, selectedType, index));
}

function normalizeGeneratedQuestion(question, selectedType, index) {
  const type = selectedType || question.question_type || question.type || "填空题";
  const next = {
    ...question,
    question_type: type,
    type
  };

  if (type.includes("选择")) {
    next.options = getChoiceOptions(next);
  }

  if (type.includes("判断") && !["正确", "错误"].includes(String(next.answer || "").trim())) {
    next.question = `判断：${question.question} 的参考答案是“${question.answer}”，这个说法是否正确？`;
    next.answer = "正确";
    next.id = question.id || index + 1;
  }

  return next;
}

function getPracticeQuestions(result) {
  if (!result) return [];
  return result.questions || [...(result.similar_questions || []), ...(result.variation_questions || [])];
}

function typeIcon(type) {
  if (type.includes("选择")) return "选";
  if (type.includes("判断")) return "判";
  if (type.includes("计算")) return "算";
  if (type.includes("应用")) return "用";
  if (type.includes("变式")) return "变";
  return "填";
}
