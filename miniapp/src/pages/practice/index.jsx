import React, { useEffect, useMemo, useState } from "react";
import Taro, { useDidShow, useTabItemTap } from "@tarojs/taro";
import { Button, ScrollView, Text, View } from "@tarojs/components";
import { AiNotice, SelectField } from "../../components/form";
import { defaultSelection, gradeOptions, subjectCards } from "../../utils/options";
import { generateTextbook, getContentPackage } from "../../utils/api";
import { createPracticeSession, findDoingPracticeSession, getSessionProgress, hasSessionProgress, savePracticeSession } from "../../utils/practiceSession";
import { getTypeProgress } from "../../utils/practiceStats";
import { navigateToPage, switchToTab } from "../../utils/navigation";
import { debugLog, debugWarn } from "../../utils/debug";
import { getPracticeQuestions, normalizeQuestionType, normalizeQuestions } from "../../utils/question";
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
  const [entryError, setEntryError] = useState("");

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
    const missing = validateEntry(pendingEntry);
    debugLog("[练习页链路调试] received entry", { pendingEntry, missing });
    if (missing.length) {
      debugWarn("[练习页链路调试] 入口参数缺失", { missing, pendingEntry });
      setEntryError("练习入口信息不完整，请返回首页重新进入。");
      setPendingEntry(null);
      setMode("empty");
      return;
    }
    const next = normalizeSelection({ ...form, ...pendingEntry }, catalog);
    const pkg = selectPackage(catalog, next);
    const unit = findUnit(pkg, next.unitId || next.unit);
    debugLog("[练习页链路调试] resolved entry", {
      filter: {
        packageId: next.packageId,
        unitId: next.unitId,
        grade: next.grade,
        subject: next.subject,
        semester: next.semester,
        unit: next.unit
      },
      matchedPackageId: pkg?.package_id || null,
      matchedScope: pkg?.scope || null,
      matchedUnit: unit ? { id: unit.id, name: unit.name } : null,
      unitCount: pkg?.options?.units?.length || 0,
      knowledgePointCount: pkg?.options?.knowledgePoints?.length || 0
    });
    if (!pkg || !unit) {
      setEntryError("练习入口信息不完整，请返回首页重新进入。");
      setPendingEntry(null);
      setMode("empty");
      return;
    }
    setEntryError("");
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

  useEffect(() => {
    if (mode !== "types" || !activeUnit) return;
    debugLog("[练习页链路调试] type summaries", {
      packageId: activePackage?.package_id || null,
      unitId: activeUnit.id,
      unitName: activeUnit.name,
      typeCount: typeSummaries.length,
      types: typeSummaries.map((item) => ({
        type: item.type,
        pointCount: item.pointCount,
        total: item.total,
        done: item.done
      }))
    });
  }, [mode, activePackage, activeUnit, typeSummaries]);

  useTabItemTap(() => {
    Taro.removeStorageSync(ENTRY_KEY);
    resetPracticeHome();
  });

  function updateSelection(patch) {
    const shouldResetPackage = ["grade", "subject", "semester"].some((key) => patch[key] && patch[key] !== form[key]);
    const next = normalizeSelection({
      ...form,
      ...(shouldResetPackage ? {
        packageId: "",
        unitId: "",
        unit: "",
        knowledgePointId: "",
        knowledgePoint: "",
        typeId: "",
        type: ""
      } : {}),
      ...patch
    }, catalog);
    setForm(next);
    Taro.setStorageSync("baseSelection", next);
  }

  function resetPracticeHome(reset = {}) {
    Taro.removeStorageSync(HOME_RESTORE_KEY);
    setPendingEntry(null);
    setEntryError("");
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
    const type = normalizeQuestionType(typeof summary === "string" ? summary : summary.type);
    const total = typeof summary === "string" ? getTypeTotal(activePackage, activeUnit, type) : summary.total;
    const point = findPointForType(activePackage, activeUnit, type);
    if (!point) {
      Taro.showToast({ title: "该题型暂无题目", icon: "none" });
      return;
    }
    const nextForm = normalizeSelection({
      ...form,
      packageId: activePackage?.package_id || form.packageId,
      unitId: activeUnit.id,
      unit: activeUnit.name,
      lesson: findLessonName(activeUnit, point),
      knowledgePointId: point.id,
      knowledgePoint: point.name,
      type,
      typeId: type,
      count: Math.min(MAX_TYPE_QUESTIONS, Math.max(1, Number(total) || 5))
    }, catalog);
    debugLog("[练习页题型调试] type selected", {
      packageId: nextForm.packageId,
      unitId: nextForm.unitId,
      unit: nextForm.unit,
      grade: nextForm.grade,
      subject: nextForm.subject,
      semester: nextForm.semester,
      knowledgePointId: nextForm.knowledgePointId,
      knowledgePoint: nextForm.knowledgePoint,
      typeId: nextForm.typeId,
      type: nextForm.type,
      total: nextForm.count
    });
    setForm(nextForm);
    setActiveType(type);
    const oldSession = findDoingPracticeSession(nextForm);
    const completedHistory = getTypeProgress(nextForm).done >= nextForm.count;
    if (oldSession) {
      if (!hasSessionProgress(oldSession) && !completedHistory) {
        navigateToSession(oldSession.sessionId, entrySource);
        return;
      }
      const choice = await Taro.showModal({
        title: "继续未完成练习",
        content: "这个题型还有未完成的练习，要继续吗？",
        confirmText: "继续练习",
        cancelText: "重新练习"
      });
      if (choice.confirm) {
        navigateToSession(oldSession.sessionId, entrySource);
        return;
      }
      const restart = await Taro.showModal({
        title: "确认重新练习",
        content: completedHistory ? "重新练习会开启一轮新题，但不会清除历史完成进度。" : "重新练习会清空当前这组未完成练习，确定继续吗？",
        confirmText: "重新练习",
        cancelText: "取消"
      });
      if (!restart.confirm) return;
      savePracticeSession({ ...oldSession, status: "abandoned" });
    } else if (completedHistory) {
      const retry = await Taro.showModal({
        title: "重新练习",
        content: "该题型已完成，重新练习不会清除历史进度。",
        confirmText: "重新练习",
        cancelText: "取消"
      });
      if (!retry.confirm) return;
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
      const queryParams = { ...nextForm, count: Number(nextForm.count) || 5 };
      debugLog("[练习页题目调试] question query params", queryParams);
      const data = await generateTextbook(queryParams);
      const nextQuestions = normalizeQuestions(getPracticeQuestions(data), nextForm.type);
      debugLog("[练习页题目调试] question list result", {
        packageId: nextForm.packageId,
        unitId: nextForm.unitId,
        knowledgePointId: nextForm.knowledgePointId,
        typeId: nextForm.typeId,
        count: nextQuestions.length,
        sample: nextQuestions[0] || null
      });
      if (!nextQuestions.length) {
        Taro.showToast({ title: "该题型暂无题目", icon: "none" });
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
            {typeSummaries.length ? typeSummaries.map((item) => (
              <Button key={item.type} className="type-card" loading={loading && activeType === item.type} disabled={loading} onClick={() => openType(item)}>
                <View className="type-icon"><Text>{typeIcon(item.type)}</Text></View>
                <View className="type-copy">
                  <Text className="type-title">{item.type}</Text>
                  <Text className="type-desc">{item.pointCount} 个知识点 · 已做 {item.done} / {item.total}</Text>
                  <ProgressBar done={item.done} total={item.total} />
                </View>
              </Button>
            )) : (
              <View className="card">
                <Text className="section-title">该章节暂无题目</Text>
                <Text className="muted">这个章节已经存在，但还没有配置可练习的题型或题目模板。</Text>
              </View>
            )}
          </View>
        </>
      ) : null}

      {mode === "empty" ? (
        <View className="hero">
          <Text className="hero-title">{entryError || `${form.subject}内容整理中`}</Text>
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
  const hasCatalog = Boolean(catalog);
  return {
    ...selection,
    packageId: active?.package_id || (hasCatalog ? "" : selection.packageId || ""),
    textbook: active?.scope?.textbook || selection.textbook || "人教版",
    unitId: active ? selection.unitId || firstUnit?.id || "" : "",
    unit: active ? selection.unit || firstUnit?.name || "" : "",
    knowledgePointId: active ? selection.knowledgePointId || firstPoint?.id || "" : "",
    knowledgePoint: active ? selection.knowledgePoint || firstPoint?.name || "" : "",
    type: selection.type || "填空题",
    difficulty: selection.difficulty || "基础",
    count: Number(selection.count) || 5
  };
}

function selectPackage(catalog, form) {
  const packages = catalog?.packages || [];
  if (!packages.length) return null;
  const target = normalizeFilter(form);
  if (form.packageId) {
    const byId = packages.find((item) => item.package_id === form.packageId);
    if (
      byId &&
      normalizeGrade(byId.scope?.grade) === target.grade &&
      normalizeSubject(byId.scope?.subject) === target.subject &&
      normalizeSemester(byId.scope?.semester) === target.semester
    ) return byId;
  }
  return packages.find((item) =>
    normalizeGrade(item.scope?.grade) === target.grade &&
    normalizeSubject(item.scope?.subject) === target.subject &&
    normalizeSemester(item.scope?.semester) === target.semester
  ) || null;
}

function findUnit(activePackage, unitNameOrId) {
  return (activePackage?.options?.units || []).find((unit) => unit.id === unitNameOrId || unit.name === unitNameOrId);
}

function validateEntry(entry) {
  if (!entry || entry.source !== "home") return [];
  return ["packageId", "unitId", "grade", "subject", "semester"].filter((key) => !entry[key]);
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
  const types = [...new Set(points.flatMap((point) => point.recommendedQuestionTypes || []).map(normalizeQuestionType).filter(Boolean))];
  return types.map((type) => {
    const pointCount = points.filter((point) => (point.recommendedQuestionTypes || []).map(normalizeQuestionType).includes(type)).length;
    const total = Math.min(MAX_TYPE_QUESTIONS, Math.max(QUESTIONS_PER_POINT, pointCount * QUESTIONS_PER_POINT));
    const done = getProgressCount({ ...form, unitId: unit.id, unit: unit.name, typeId: type, type });
    return {
      type,
      pointCount,
      total,
      done: Math.min(total, done)
    };
  });
}

function getUnitPoints(activePackage, unit) {
  const ids = new Set((unit.lessons || []).flatMap((lesson) => lesson.knowledgePoints || []).map((point) => point.id));
  return (activePackage?.options?.knowledgePoints || []).filter((point) => ids.has(point.id));
}

function findPointForType(activePackage, unit, type) {
  const normalizedType = normalizeQuestionType(type);
  return getUnitPoints(activePackage, unit).find((point) => (point.recommendedQuestionTypes || []).map(normalizeQuestionType).includes(normalizedType)) || getUnitPoints(activePackage, unit)[0];
}

function findLessonName(unit, point) {
  return (unit.lessons || []).find((lesson) => (lesson.knowledgePoints || []).some((item) => item.id === point.id))?.name || "";
}

function getProgressCount(form) {
  const session = findDoingPracticeSession(form);
  const sessionDone = session ? getSessionProgress(session).done : 0;
  return Math.max(sessionDone, getTypeProgress(form).done);
}

function getTypeTotal(activePackage, unit, type) {
  if (!unit) return 0;
  const points = getUnitPoints(activePackage, unit);
  const normalizedType = normalizeQuestionType(type);
  const pointCount = points.filter((point) => (point.recommendedQuestionTypes || []).map(normalizeQuestionType).includes(normalizedType)).length;
  return Math.min(MAX_TYPE_QUESTIONS, Math.max(QUESTIONS_PER_POINT, pointCount * QUESTIONS_PER_POINT));
}

function typeIcon(type) {
  if (type.includes("选择")) return "选";
  if (type.includes("判断")) return "判";
  if (type.includes("计算")) return "算";
  if (type.includes("应用")) return "用";
  if (type.includes("变式")) return "变";
  return "填";
}
