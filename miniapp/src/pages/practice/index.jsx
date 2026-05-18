import React, { useEffect, useMemo, useState } from "react";
import Taro, { useDidShow } from "@tarojs/taro";
import { Button, Input, ScrollView, Text, View } from "@tarojs/components";
import { AiNotice, SelectField } from "../../components/form";
import {
  defaultSelection,
  difficultyOptions,
  gradeOptions,
  subjectCards,
  subjectOptions
} from "../../utils/options";
import { generateTextbook, getContentPackage } from "../../utils/api";
import { hasWrongQuestion, isAnswerCorrect, updateWrongBookByAnswer } from "../../utils/wrongBook";
import "../../styles/common.scss";

const PROGRESS_KEY = "chapterPracticeProgress";
const ENTRY_KEY = "practiceEntrySelection";
const QUESTIONS_PER_POINT = 5;

export default function PracticePage() {
  const [form, setForm] = useState({ ...defaultSelection, type: "填空题", difficulty: "基础", count: 5 });
  const [catalog, setCatalog] = useState(null);
  const [mode, setMode] = useState("selector");
  const [activeUnitId, setActiveUnitId] = useState("");
  const [activeType, setActiveType] = useState("");
  const [progressVersion, setProgressVersion] = useState(0);
  const [result, setResult] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [checks, setChecks] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const activePackage = useMemo(() => selectPackage(catalog, form), [catalog, form]);
  const units = activePackage?.options?.units || [];
  const activeUnit = units.find((item) => item.id === activeUnitId) || units[0];
  const typeSummaries = useMemo(() => buildTypeSummaries(activePackage, activeUnit, form, progressVersion), [activePackage, activeUnit, form, progressVersion]);
  const unitSummaries = useMemo(() => buildUnitSummaries(activePackage, form, progressVersion), [activePackage, form, progressVersion]);
  const questions = useMemo(() => getPracticeQuestions(result), [result]);
  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentIndex] || "";
  const currentCheck = checks[currentIndex];
  const currentInWrongBook = currentQuestion ? hasWrongQuestion(currentQuestion) : false;

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

  useDidShow(() => {
    const entry = Taro.getStorageSync(ENTRY_KEY);
    if (entry) {
      Taro.removeStorageSync(ENTRY_KEY);
      setForm((old) => normalizeSelection({ ...old, ...entry }, catalog));
      setMode("chapters");
    }
  });

  function updateSelection(patch) {
    const next = normalizeSelection({ ...form, ...patch }, catalog);
    setForm(next);
    Taro.setStorageSync("baseSelection", next);
  }

  function startBySubject(subject) {
    updateSelection({ subject });
    setMode("chapters");
  }

  function openUnit(unit) {
    setActiveUnitId(unit.id);
    setMode("types");
  }

  async function openType(type) {
    if (!activeUnit) return;
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
      count: 5
    }, catalog);
    setForm(nextForm);
    setActiveType(type);
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
      const nextQuestions = getPracticeQuestions(data);
      setResult(data);
      setAnswers(nextQuestions.map(() => ""));
      setChecks(nextQuestions.map(() => undefined));
      setCurrentIndex(0);
      setMode("practice");
      Taro.setStorageSync("baseSelection", nextForm);
      Taro.showToast({ title: "题目生成成功", icon: "success" });
    } catch {
      Taro.showToast({ title: "生成失败，请确认后端已启动", icon: "none" });
    } finally {
      setLoading(false);
    }
  }

  function updateAnswer(value) {
    const next = [...answers];
    next[currentIndex] = value;
    setAnswers(next);
  }

  function submitCurrentAnswer() {
    if (!currentQuestion) return;
    if (!currentAnswer.trim()) {
      Taro.showToast({ title: "请先填写答案", icon: "none" });
      return;
    }

    const wasInWrongBook = hasWrongQuestion(currentQuestion);
    const correct = isAnswerCorrect(currentAnswer, currentQuestion.answer);
    updateWrongBookByAnswer(currentQuestion, currentAnswer, "练习");

    const nextChecks = [...checks];
    const alreadyRecorded = Boolean(nextChecks[currentIndex]?.recorded);
    nextChecks[currentIndex] = { correct, removedFromWrongBook: correct && wasInWrongBook, recorded: true };
    setChecks(nextChecks);

    if (!alreadyRecorded) {
      recordProgress(form, currentQuestion, correct);
      setProgressVersion((value) => value + 1);
    }

    if (correct) {
      Taro.showToast({ title: wasInWrongBook ? "答对了，已从错题本移除" : "答对了", icon: "none" });
      if (currentIndex < questions.length - 1) {
        setTimeout(() => {
          setCurrentIndex((oldIndex) => Math.min(oldIndex + 1, questions.length - 1));
          Taro.pageScrollTo({ scrollTop: 0, duration: 150 });
        }, 850);
      }
      return;
    }

    Taro.showToast({ title: "答错了，已加入错题本", icon: "none" });
  }

  function goPrevious() {
    if (currentIndex <= 0) {
      Taro.showToast({ title: "已经是第一题", icon: "none" });
      return;
    }
    setCurrentIndex(currentIndex - 1);
    Taro.pageScrollTo({ scrollTop: 0, duration: 150 });
  }

  function goNext() {
    if (currentIndex >= questions.length - 1) {
      Taro.showToast({ title: "已经是最后一题", icon: "none" });
      return;
    }
    setCurrentIndex(currentIndex + 1);
    Taro.pageScrollTo({ scrollTop: 0, duration: 150 });
  }

  function backToPrevious() {
    if (mode === "types") {
      setMode("chapters");
      return;
    }
    if (mode === "practice") {
      setMode("types");
      setResult(null);
      return;
    }
    if (mode === "chapters" || mode === "empty") {
      setMode("selector");
      return;
    }
    Taro.navigateBack();
  }

  function reshuffleCurrentQuestions() {
    if (!questions.length) {
      generatePractice();
      return;
    }
    const shuffled = shuffle(questions);
    setResult({ ...result, questions: shuffled });
    setAnswers(shuffled.map(() => ""));
    setChecks(shuffled.map(() => undefined));
    setCurrentIndex(0);
    Taro.showToast({ title: "已随机换题", icon: "success" });
  }

  return (
    <ScrollView className="page practice-page" scrollY>
      {mode !== "selector" ? <PracticeTopBack title={buildBackTitle(mode, activeUnit)} onBack={backToPrevious} /> : null}

      {mode === "selector" ? (
        <>
          <View className="hero">
            <Text className="hero-title">章节刷题</Text>
            <Text className="hero-subtitle">先选年级和学科，再按章节、题型一步步练习。</Text>
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
              <Button key={item.type} className="type-card" loading={loading && activeType === item.type} disabled={loading} onClick={() => openType(item.type)}>
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
        <>
          <View className="hero">
            <Text className="hero-title">{form.subject}内容整理中</Text>
            <Text className="hero-subtitle">当前选择的年级、学科和上下册暂无题目内容。请等朋友导入对应内容包后再练习。</Text>
          </View>
        </>
      ) : null}

      {mode === "practice" && currentQuestion ? (
        <View className="result-card single-question-card">
          <View className="practice-head">
            <Text className="section-title">第 {currentIndex + 1} 题 / 共 {questions.length} 题</Text>
            <Text className="muted">{[form.subject, form.grade, form.unit, form.lesson, form.knowledgePoint].filter(Boolean).join(" · ")}</Text>
          </View>

          <View className="question-card">
            <View className="tag-row">
              <Text className="tag">{currentQuestion.question_type || currentQuestion.type || form.type}</Text>
              <Text className="tag">{currentQuestion.difficulty || form.difficulty}</Text>
              {currentInWrongBook ? <Text className="tag warning-tag">错题本内</Text> : null}
            </View>
            <Text className="question-text">{currentQuestion.question}</Text>
            {currentInWrongBook ? <Text className="tip-text">这道题在错题本里，答对后会自动移除。</Text> : null}
            {renderAnswerControl(currentQuestion, currentAnswer, updateAnswer)}

            {currentCheck !== undefined ? (
              <View className="answer-panel">
                <Text className={currentCheck.correct ? "answer-correct" : "answer-wrong"}>{buildCheckText(currentCheck)}</Text>
                <Text className="answer-text">我的答案：{currentAnswer || "未填写"}</Text>
                <Text className="answer-text">参考答案：{currentQuestion.answer}</Text>
                <Text className="answer-text">解析：{currentQuestion.explanation}</Text>
              </View>
            ) : null}
          </View>

          <View className="button-row">
            <Button className="secondary-button full-button" loading={loading} disabled={loading} onClick={reshuffleCurrentQuestions}>重新生成</Button>
          </View>

          <View className="practice-bottom-actions">
            <Button className="ghost-button practice-action" onClick={goPrevious}>上一题</Button>
            <Button className="primary-button practice-action" onClick={submitCurrentAnswer}>提交答案</Button>
            <Button className="ghost-button practice-action" onClick={goNext}>下一题</Button>
          </View>
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
  if (mode === "practice") return "做题";
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
  const packages = catalog?.packages || [];
  const exact = packages.find((item) =>
    item.scope?.grade === selection.grade &&
    item.scope?.subject === selection.subject &&
    item.scope?.semester === selection.semester
  );
  const active = exact || null;
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
    const total = Math.max(QUESTIONS_PER_POINT, pointCount * QUESTIONS_PER_POINT);
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

function progressKey(form) {
  return [form.grade, form.subject, form.semester, form.unit, form.type].filter(Boolean).join("|");
}

function readProgress() {
  return Taro.getStorageSync(PROGRESS_KEY) || {};
}

function getProgressCount(form) {
  return readProgress()[progressKey(form)]?.done || 0;
}

function recordProgress(form, question, correct) {
  const data = readProgress();
  const key = progressKey(form);
  const old = data[key] || { done: 0, correct: 0, wrong: 0 };
  data[key] = {
    done: old.done + 1,
    correct: old.correct + (correct ? 1 : 0),
    wrong: old.wrong + (correct ? 0 : 1),
    lastQuestion: question?.question || "",
    updatedAt: Date.now()
  };
  Taro.setStorageSync(PROGRESS_KEY, data);
}

function renderAnswerControl(question, value, onChange) {
  const type = question.question_type || question.type || "";
  if (type.includes("判断")) {
    return (
      <View className="choice-row">
        {["正确", "错误"].map((option) => (
          <Button key={option} className={value === option ? "choice-button active" : "choice-button"} onClick={() => onChange(option)}>
            {option}
          </Button>
        ))}
      </View>
    );
  }

  if (Array.isArray(question.options) && question.options.length) {
    return (
      <View className="choice-list">
        {question.options.map((option) => (
          <Button key={option} className={value === option ? "choice-button active" : "choice-button"} onClick={() => onChange(option)}>
            {option}
          </Button>
        ))}
      </View>
    );
  }

  return (
    <View className="field">
      <Text className="field-label">我的答案</Text>
      <Input className="input" value={value} placeholder="在这里填写答案" onInput={(event) => onChange(event.detail.value)} />
    </View>
  );
}

function getPracticeQuestions(result) {
  if (!result) return [];
  return result.questions || [...(result.similar_questions || []), ...(result.variation_questions || [])];
}

function buildCheckText(check) {
  if (!check) return "";
  if (!check.correct) return "答错了，已加入错题本";
  return check.removedFromWrongBook ? "答对了，已从错题本移除" : "答对了";
}

function typeIcon(type) {
  if (type.includes("选择")) return "选";
  if (type.includes("判断")) return "判";
  if (type.includes("计算")) return "算";
  if (type.includes("应用")) return "用";
  if (type.includes("变式")) return "变";
  return "填";
}

function shuffle(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
}
