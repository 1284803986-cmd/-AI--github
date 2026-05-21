import React, { useEffect, useMemo, useState } from "react";
import Taro, { useRouter } from "@tarojs/taro";
import { Button, Image, Input, ScrollView, Text, Textarea, View } from "@tarojs/components";
import { evaluateAnswer, hasWrongQuestion, updateWrongBookByAnswer } from "../../../utils/wrongBook";
import { recordPracticeAnswer } from "../../../utils/practiceStats";
import { buildSessionPatch, getPracticeSession, getSessionProgress, removePracticeSession, updatePracticeSession } from "../../../utils/practiceSession";
import { switchToTab } from "../../../utils/navigation";
import { debugLog } from "../../../utils/debug";
import { getQuestionAnswer, getQuestionExplanation, getQuestionId, getQuestionImage, getQuestionStem, getQuestionType, normalizeOptions } from "../../../utils/question";
import "../../../styles/common.scss";

const PROGRESS_KEY = "chapterPracticeProgress";

export default function PracticeDoPage() {
  const router = useRouter();
  const sessionId = router?.params?.sessionId || "";
  const source = router?.params?.source || "practice";
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [answers, setAnswers] = useState([]);
  const [checks, setChecks] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswerSheet, setShowAnswerSheet] = useState(false);

  const questions = useMemo(() => session?.questions || [], [session]);
  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentIndex] || "";
  const currentCheck = checks[currentIndex];
  const currentInWrongBook = currentQuestion ? hasWrongQuestion(currentQuestion) : false;

  useEffect(() => {
    hidePracticeTabBar();
    loadSession();
    return () => showPracticeTabBar();
  }, [sessionId]);

  function loadSession() {
    setLoading(true);
    if (!sessionId) {
      setSession(null);
      setLoadError("练习数据异常，请重新开始。");
      setLoading(false);
      return;
    }
    const next = getPracticeSession(sessionId);
    if (!isValidPracticeSession(next)) {
      if (sessionId) removePracticeSession(sessionId);
      setSession(null);
      setLoadError("练习数据异常，请重新开始。");
      setLoading(false);
      return;
    }
    const safeIndex = Math.max(0, Math.min(Number(next.currentIndex) || 0, next.questions.length - 1));
    const safeAnswers = normalizeList(next.answers, next.questions.length, "");
    const safeChecks = normalizeList(next.checks, next.questions.length, undefined);
    setSession(next);
    setAnswers(safeAnswers);
    setChecks(safeChecks);
    setCurrentIndex(safeIndex);
    setLoadError("");
    setLoading(false);
    hidePracticeTabBar();
    debugLog("[练习页题目调试] question list result", {
      sessionId: next.sessionId,
      packageId: next.packageId,
      unitId: next.unitId || next.chapterId,
      knowledgePointId: next.knowledgePointId,
      typeId: next.typeId || next.questionType,
      count: next.questions.length,
      currentIndex: safeIndex,
      currentQuestion: next.questions[safeIndex] || null
    });
  }

  function saveSession(patch = {}) {
    if (!session?.sessionId) return;
    const nextAnswers = patch.answers || answers;
    const nextChecks = patch.checks || checks;
    const nextIndex = patch.currentIndex ?? currentIndex;
    const finished = questions.length > 0 && nextChecks.filter((item) => item?.recorded).length >= questions.length;
    const updated = updatePracticeSession(session.sessionId, {
      ...buildSessionPatch({ currentIndex: nextIndex, answers: nextAnswers, checks: nextChecks }),
      status: patch.status || (finished ? "finished" : "doing")
    });
    if (updated) setSession(updated);
  }

  function updateAnswer(value) {
    const next = [...answers];
    next[currentIndex] = value;
    setAnswers(next);
    saveSession({ answers: next });
  }

  function submitCurrentAnswer() {
    if (!currentQuestion) return;
    if (!currentAnswer.trim()) {
      Taro.showToast({ title: "请先填写答案", icon: "none" });
      return;
    }

    const wasInWrongBook = hasWrongQuestion(currentQuestion);
    const rightAnswer = getQuestionAnswer(currentQuestion);
    const answerResult = evaluateAnswer(currentAnswer, rightAnswer, currentQuestion);
    const correct = answerResult.correct;
    const wrongBookResult = updateWrongBookByAnswer(currentQuestion, currentAnswer, source === "wrongBook" ? "错题重练" : "练习");
    debugLog("[练习页答题调试] answer submitted", {
      sessionId: session?.sessionId,
      packageId: session?.packageId,
      unitId: session?.unitId || session?.chapterId,
      knowledgePointId: session?.knowledgePointId,
      questionId: getQuestionId(currentQuestion, currentIndex),
      index: currentIndex,
      type: getQuestionType(currentQuestion, session?.questionType),
      studentAnswer: currentAnswer,
      correctAnswer: rightAnswer,
      isCorrect: correct,
      status: answerResult.status
    });

    const nextChecks = [...checks];
    const alreadyRecorded = Boolean(nextChecks[currentIndex]?.recorded);
    nextChecks[currentIndex] = {
      correct,
      status: answerResult.status,
      formatWarning: answerResult.formatWarning,
      masteredWrongBook: correct && (wasInWrongBook || wrongBookResult.mastered),
      recorded: true
    };
    setChecks(nextChecks);
    saveSession({ checks: nextChecks });

    if (!alreadyRecorded) {
      const meta = sessionToMeta(session, source);
      const progress = recordProgress(meta, currentQuestion, correct);
      const sessionProgress = getSessionProgress({ ...session, checks: nextChecks, submittedMap: buildSessionPatch({ currentIndex, answers, checks: nextChecks }).submittedMap });
      recordPracticeAnswer(meta, currentQuestion, correct, { done: progress.done || sessionProgress.done, total: session.totalCount || sessionProgress.total });
      debugLog("[练习页进度调试] progress saved", {
        sessionId: session?.sessionId,
        packageId: meta.packageId,
        unitId: meta.unitId,
        knowledgePointId: meta.knowledgePointId,
        questionId: getQuestionId(currentQuestion, currentIndex),
        isCorrect: correct,
        progress: { done: progress.done || sessionProgress.done, total: session.totalCount || sessionProgress.total }
      });
    }

    if (correct) {
      Taro.showToast({ title: answerResult.formatWarning ? "结果是对的，注意单位" : wasInWrongBook ? "答对了，已标记掌握" : "答对了", icon: "none" });
      if (currentIndex < questions.length - 1) {
        setTimeout(() => {
          const nextIndex = Math.min(currentIndex + 1, questions.length - 1);
          setCurrentIndex(nextIndex);
          saveSession({ currentIndex: nextIndex, checks: nextChecks });
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
    jumpToQuestion(currentIndex - 1);
  }

  function goNext() {
    if (currentIndex >= questions.length - 1) {
      Taro.showToast({ title: "已经是最后一题", icon: "none" });
      return;
    }
    jumpToQuestion(currentIndex + 1);
  }

  function jumpToQuestion(index) {
    setCurrentIndex(index);
    setShowAnswerSheet(false);
    saveSession({ currentIndex: index });
    hidePracticeTabBar();
    Taro.pageScrollTo({ scrollTop: 0, duration: 150 });
  }

  function handleBack() {
    saveSession();
    const pages = Taro.getCurrentPages ? Taro.getCurrentPages() : [];
    if (pages.length > 1) {
      Taro.navigateBack();
      return;
    }
    switchToTab("/pages/practice/index");
  }

  if (loading) {
    return (
      <View className="page practice-page">
        <PracticeTopBack title="做题" onBack={handleBack} />
        <View className="card">
          <Text className="section-title">加载中...</Text>
          <Text className="muted">正在读取本次练习题目。</Text>
        </View>
      </View>
    );
  }

  if (loadError) {
    return (
      <View className="page practice-page">
        <PracticeTopBack title="做题" onBack={handleBack} />
        <View className="card">
          <Text className="section-title">{loadError}</Text>
          <Text className="muted">请返回练习页，重新选择章节和题型。</Text>
        </View>
      </View>
    );
  }

  if (!currentQuestion) {
    return (
      <View className="page practice-page">
        <PracticeTopBack title="做题" onBack={handleBack} />
        <View className="card">
          <Text className="section-title">题目数据为空，请重新开始。</Text>
          <Text className="muted">这次练习没有读取到题目。</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView className="page practice-page" scrollY>
      <PracticeTopBack title="做题" onBack={handleBack} />
      <View className="result-card single-question-card">
        <View className="practice-head">
          <View className="practice-title-row">
            <Text className="section-title">第 {currentIndex + 1} 题 / 共 {questions.length} 题</Text>
            <Button className="answer-sheet-button" onClick={() => setShowAnswerSheet(true)}>答题卡</Button>
          </View>
          <Text className="muted">{[session.subject, session.grade, session.chapterName, session.lesson, session.knowledgePoint].filter(Boolean).join(" · ")}</Text>
        </View>

        <View className="question-card">
          <View className="tag-row">
            <Text className={`question-type-tag ${getQuestionTypeTone(getQuestionType(currentQuestion, session.questionType))}`}>
              {getQuestionTypeLabel(getQuestionType(currentQuestion, session.questionType))}
            </Text>
            <Text className="difficulty-tag">{currentQuestion.difficulty || session.difficulty}</Text>
            {currentInWrongBook ? <Text className="tag warning-tag">错题本内</Text> : null}
          </View>
          <Text className="question-text">{getQuestionStem(currentQuestion)}</Text>
          {getQuestionImage(currentQuestion) ? <Image className="question-image" src={getQuestionImage(currentQuestion)} mode="widthFix" /> : null}
          {currentInWrongBook ? <Text className="tip-text">这道题在错题本里，答对后会自动标记为已掌握。</Text> : null}
          {renderAnswerControl(currentQuestion, currentAnswer, updateAnswer, currentCheck)}

          {currentCheck !== undefined ? (
            <View className="answer-panel">
              <Text className={currentCheck.correct ? "answer-correct" : "answer-wrong"}>{buildCheckText(currentCheck)}</Text>
              <Text className="answer-text">我的答案：{currentAnswer || "未填写"}</Text>
              <Text className="answer-text">{currentCheck.formatWarning ? "参考写法" : "参考答案"}：{getQuestionAnswer(currentQuestion)}</Text>
              <Text className="answer-text">解析：{getQuestionExplanation(currentQuestion) || "暂无解析"}</Text>
            </View>
          ) : null}
        </View>

        <View className="practice-bottom-actions">
          <Button className="ghost-button practice-action" onClick={goPrevious}>上一题</Button>
          <Button className="primary-button practice-action" onClick={submitCurrentAnswer}>提交答案</Button>
          <Button className="ghost-button practice-action" onClick={goNext}>下一题</Button>
        </View>

        {showAnswerSheet ? (
          <View className="answer-sheet-mask" onClick={() => setShowAnswerSheet(false)}>
            <View className="answer-sheet-panel" onClick={(event) => event.stopPropagation?.()}>
              <View className="answer-sheet-handle" />
              <View className="answer-sheet-title-row">
                <Text className="section-title">题目目录</Text>
                <Text className="answer-sheet-count">已做 {getAnsweredCount(checks)} / {questions.length}</Text>
              </View>
              <View className="answer-sheet-legend">
                <Text className="legend-item"><Text className="legend-dot current" />当前题</Text>
                <Text className="legend-item"><Text className="legend-dot correct" />答对</Text>
                <Text className="legend-item"><Text className="legend-dot wrong" />答错</Text>
                <Text className="legend-item"><Text className="legend-dot empty" />未做</Text>
              </View>
              <ScrollView className="answer-sheet-scroll" scrollY>
                <View className="answer-sheet-grid">
                  {questions.map((item, index) => (
                    <Button key={`${item.id || index}-${index}`} className={getAnswerSheetClass(index, currentIndex, checks)} onClick={() => jumpToQuestion(index)}>
                      {index + 1}
                    </Button>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        ) : null}
      </View>
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

function sessionToMeta(session, source = "practice") {
  return {
    grade: session.grade,
    packageId: session.packageId,
    subject: session.subject,
    semester: session.semester || session.term,
    textbook: session.textbook,
    unitId: session.unitId || session.chapterId,
    unit: session.chapterName,
    lesson: session.lesson,
    knowledgePointId: session.knowledgePointId,
    knowledgePoint: session.knowledgePoint,
    typeId: session.typeId || session.questionType,
    type: session.questionType,
    difficulty: session.difficulty,
    source
  };
}

function normalizeList(list, length, fallback) {
  const source = Array.isArray(list) ? list : [];
  return Array.from({ length }, (_, index) => source[index] ?? fallback);
}

function progressKey(form) {
  return [form.grade, form.subject, form.semester, form.unit, form.type].filter(Boolean).join("|");
}

function readProgress() {
  return Taro.getStorageSync(PROGRESS_KEY) || {};
}

function recordProgress(form, question, correct) {
  const data = readProgress();
  const key = progressKey(form);
  const old = data[key] || { done: 0, correct: 0, wrong: 0 };
  const next = {
    done: old.done + 1,
    correct: old.correct + (correct ? 1 : 0),
    wrong: old.wrong + (correct ? 0 : 1),
    lastQuestion: getQuestionStem(question),
    packageId: form.packageId,
    unitId: form.unitId,
    knowledgePointId: form.knowledgePointId,
    questionId: getQuestionId(question),
    isCorrect: correct,
    updatedAt: Date.now()
  };
  data[key] = next;
  Taro.setStorageSync(PROGRESS_KEY, data);
  return next;
}

function isValidPracticeSession(session) {
  return Boolean(
    session?.sessionId &&
    session?.questionType &&
    session?.chapterName &&
    Array.isArray(session.questions) &&
    session.questions.length > 0 &&
    Number(session.currentIndex || 0) >= 0
  );
}

function renderAnswerControl(question, value, onChange, check) {
  const type = getQuestionType(question);
  if (type.includes("判断")) {
    return (
      <View className="choice-row judge-choice-row">
        {["正确", "错误"].map((option) => (
          <Button key={option} className={getOptionClassName({ value, optionValue: option, rightAnswer: getQuestionAnswer(question), check, baseClass: "judge-option" })} onClick={() => onChange(option)}>
            <Text className="judge-mark">{option === "正确" ? "✓" : "✕"}</Text>
            <Text>{option}</Text>
          </Button>
        ))}
      </View>
    );
  }

  const options = normalizeOptions(question);
  if (type.includes("选择") && options.length) {
    return (
      <View className="choice-list">
        {options.map((option, index) => {
          const optionValue = optionAnswerValue(option, question);
          const parsed = parseChoiceOption(option, index);
          return (
            <Button key={option} className={getOptionClassName({ value, optionValue, rightAnswer: getQuestionAnswer(question), check, baseClass: "choice-option" })} onClick={() => onChange(optionValue)}>
              <Text className="choice-letter">{parsed.letter}</Text>
              <Text className="choice-copy">{parsed.text}</Text>
            </Button>
          );
        })}
      </View>
    );
  }

  if (type.includes("应用")) {
    return (
      <View className="field">
        <Text className="field-label">我的解答</Text>
        <Textarea className="textarea" value={value} placeholder="可以写算式、过程和答案" onInput={(event) => onChange(event.detail.value)} />
      </View>
    );
  }

  return (
    <View className="field">
      <Text className="field-label answer-field-label"><Text className="field-label-icon">✎</Text>我的答案</Text>
      <Input className="input answer-input" value={value} placeholder={type.includes("计算") ? "填写计算结果" : "请填写横线处的答案"} onInput={(event) => onChange(event.detail.value)} />
    </View>
  );
}

function getQuestionTypeLabel(type) {
  if (type.includes("判断")) return "✓ 判断题";
  if (type.includes("选择")) return "A 选择题";
  if (type.includes("填空")) return "✎ 填空题";
  return type;
}

function getQuestionTypeTone(type) {
  if (type.includes("判断")) return "judge";
  if (type.includes("选择")) return "choice";
  if (type.includes("填空")) return "fill";
  return "default";
}

function parseChoiceOption(option, index) {
  const text = String(option);
  const match = text.match(/^([A-D])[.、]\s*(.*)$/);
  return {
    letter: match?.[1] || ["A", "B", "C", "D"][index] || "",
    text: match?.[2] || text
  };
}

function getOptionClassName({ value, optionValue, rightAnswer, check, baseClass }) {
  const classes = [baseClass];
  const selected = value === optionValue;
  const correct = normalizeOptionAnswer(optionValue) === normalizeOptionAnswer(rightAnswer);
  if (selected) classes.push("active");
  if (check !== undefined && correct) classes.push("correct");
  if (check !== undefined && selected && !correct) classes.push("wrong");
  return classes.join(" ");
}

function getAnswerSheetClass(index, currentIndex, checks) {
  const classes = ["answer-sheet-item"];
  if (index === currentIndex) classes.push("current");
  const check = checks[index];
  if (check?.recorded && check.correct) classes.push("correct");
  if (check?.recorded && !check.correct) classes.push("wrong");
  return classes.join(" ");
}

function getAnsweredCount(checks) {
  return checks.filter((item) => item?.recorded).length;
}

function normalizeOptionAnswer(value) {
  return String(value ?? "").trim().replace(/\s+/g, "").toLowerCase();
}

function optionAnswerValue(option, question) {
  if (["A", "B", "C", "D"].includes(String(getQuestionAnswer(question) || "").trim())) {
    return String(option).trim().slice(0, 1);
  }
  return String(option).replace(/^[A-D][.、]\s*/, "").trim();
}

function buildCheckText(check) {
  if (!check) return "";
  if (!check.correct) return "答错了，已加入错题本";
  if (check.formatWarning) return "结果是对的，注意表达更完整。";
  return check.masteredWrongBook ? "答对了，已标记掌握" : "答对了";
}

function hidePracticeTabBar() {
  try {
    Taro.hideTabBar({ animation: false, fail: () => {} });
    Taro.nextTick?.(() => Taro.hideTabBar({ animation: false, fail: () => {} }));
    setTimeout(() => Taro.hideTabBar({ animation: false, fail: () => {} }), 80);
  } catch {
    // Non-tabBar pages may reject this API in some runtimes; the page is already non-tab.
  }
}

function showPracticeTabBar() {
  try {
    Taro.showTabBar({ animation: false, fail: () => {} });
    Taro.nextTick?.(() => Taro.showTabBar({ animation: false, fail: () => {} }));
  } catch {
    // Ignore when leaving a non-tabBar page.
  }
}
