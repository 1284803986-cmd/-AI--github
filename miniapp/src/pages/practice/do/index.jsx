import React, { useEffect, useMemo, useState } from "react";
import Taro, { useRouter } from "@tarojs/taro";
import { Button, Input, ScrollView, Text, Textarea, View } from "@tarojs/components";
import { evaluateAnswer, hasWrongQuestion, updateWrongBookByAnswer } from "../../../utils/wrongBook";
import { recordPracticeAnswer } from "../../../utils/practiceStats";
import { buildSessionPatch, getPracticeSession, getSessionProgress, removePracticeSession, updatePracticeSession } from "../../../utils/practiceSession";
import "../../../styles/common.scss";

const PROGRESS_KEY = "chapterPracticeProgress";

export default function PracticeDoPage() {
  const router = useRouter();
  const sessionId = router?.params?.sessionId || "";
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
    const answerResult = evaluateAnswer(currentAnswer, currentQuestion.answer, currentQuestion);
    const correct = answerResult.correct;
    updateWrongBookByAnswer(currentQuestion, currentAnswer, "练习");

    const nextChecks = [...checks];
    const alreadyRecorded = Boolean(nextChecks[currentIndex]?.recorded);
    nextChecks[currentIndex] = {
      correct,
      status: answerResult.status,
      formatWarning: answerResult.formatWarning,
      removedFromWrongBook: correct && wasInWrongBook,
      recorded: true
    };
    setChecks(nextChecks);
    saveSession({ checks: nextChecks });

    if (!alreadyRecorded) {
      const meta = sessionToMeta(session);
      const progress = recordProgress(meta, currentQuestion, correct);
      const sessionProgress = getSessionProgress({ ...session, checks: nextChecks, submittedMap: buildSessionPatch({ currentIndex, answers, checks: nextChecks }).submittedMap });
      recordPracticeAnswer(meta, currentQuestion, correct, { done: progress.done || sessionProgress.done, total: session.totalCount || sessionProgress.total });
    }

    if (correct) {
      Taro.showToast({ title: answerResult.formatWarning ? "结果是对的，注意单位" : wasInWrongBook ? "答对了，已从错题本移除" : "答对了", icon: "none" });
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
    Taro.switchTab({ url: "/pages/practice/index" });
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
            <Text className={`question-type-tag ${getQuestionTypeTone(currentQuestion.question_type || currentQuestion.type || session.questionType)}`}>
              {getQuestionTypeLabel(currentQuestion.question_type || currentQuestion.type || session.questionType)}
            </Text>
            <Text className="difficulty-tag">{currentQuestion.difficulty || session.difficulty}</Text>
            {currentInWrongBook ? <Text className="tag warning-tag">错题本内</Text> : null}
          </View>
          <Text className="question-text">{currentQuestion.question}</Text>
          {currentInWrongBook ? <Text className="tip-text">这道题在错题本里，答对后会自动移除。</Text> : null}
          {renderAnswerControl(currentQuestion, currentAnswer, updateAnswer, currentCheck)}

          {currentCheck !== undefined ? (
            <View className="answer-panel">
              <Text className={currentCheck.correct ? "answer-correct" : "answer-wrong"}>{buildCheckText(currentCheck)}</Text>
              <Text className="answer-text">我的答案：{currentAnswer || "未填写"}</Text>
              <Text className="answer-text">{currentCheck.formatWarning ? "参考写法" : "参考答案"}：{currentQuestion.answer}</Text>
              <Text className="answer-text">解析：{currentQuestion.explanation}</Text>
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

function sessionToMeta(session) {
  return {
    grade: session.grade,
    subject: session.subject,
    semester: session.semester || session.term,
    textbook: session.textbook,
    unit: session.chapterName,
    lesson: session.lesson,
    knowledgePoint: session.knowledgePoint,
    type: session.questionType,
    difficulty: session.difficulty
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
    lastQuestion: question?.question || "",
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
  const type = question.question_type || question.type || "";
  if (type.includes("判断")) {
    return (
      <View className="choice-row judge-choice-row">
        {["正确", "错误"].map((option) => (
          <Button key={option} className={getOptionClassName({ value, optionValue: option, rightAnswer: question.answer, check, baseClass: "judge-option" })} onClick={() => onChange(option)}>
            <Text className="judge-mark">{option === "正确" ? "✓" : "✕"}</Text>
            <Text>{option}</Text>
          </Button>
        ))}
      </View>
    );
  }

  const options = getChoiceOptions(question);
  if (type.includes("选择") && options.length) {
    return (
      <View className="choice-list">
        {options.map((option, index) => {
          const optionValue = optionAnswerValue(option, question);
          const parsed = parseChoiceOption(option, index);
          return (
            <Button key={option} className={getOptionClassName({ value, optionValue, rightAnswer: question.answer, check, baseClass: "choice-option" })} onClick={() => onChange(optionValue)}>
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

function optionAnswerValue(option, question) {
  if (["A", "B", "C", "D"].includes(String(question.answer || "").trim())) {
    return String(option).trim().slice(0, 1);
  }
  return String(option).replace(/^[A-D][.、]\s*/, "").trim();
}

function buildCheckText(check) {
  if (!check) return "";
  if (!check.correct) return "答错了，已加入错题本";
  if (check.formatWarning) return "结果是对的，注意表达更完整。";
  return check.removedFromWrongBook ? "答对了，已从错题本移除" : "答对了";
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
