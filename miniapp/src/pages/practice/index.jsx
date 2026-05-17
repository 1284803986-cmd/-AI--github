import React, { useEffect, useMemo, useState } from "react";
import Taro from "@tarojs/taro";
import { Button, Input, ScrollView, Text, View } from "@tarojs/components";
import { AiNotice, InputField, PrimaryButton, SelectField } from "../../components/form";
import {
  defaultKnowledgePoint,
  defaultQuestionType,
  defaultSelection,
  difficultyOptions,
  getKnowledgeOptions,
  getQuestionTypeOptions,
  gradeOptions,
  subjectCards
} from "../../utils/options";
import { generateTextbook, getContentPackage } from "../../utils/api";
import { hasWrongQuestion, isAnswerCorrect, updateWrongBookByAnswer } from "../../utils/wrongBook";
import "../../styles/common.scss";

export default function PracticePage() {
  const [form, setForm] = useState({ ...defaultSelection, lesson: "", type: defaultQuestionType(defaultSelection.subject), difficulty: "基础", count: 5 });
  const [contentPackage, setContentPackage] = useState(null);
  const [result, setResult] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [checks, setChecks] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState("subject");
  const [loading, setLoading] = useState(false);

  const questions = useMemo(() => getPracticeQuestions(result), [result]);
  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentIndex] || "";
  const currentCheck = checks[currentIndex];
  const currentInWrongBook = currentQuestion ? hasWrongQuestion(currentQuestion) : false;
  const contentSelection = useMemo(() => buildContentSelection(contentPackage, form), [contentPackage, form]);
  const knowledgeOptions = contentSelection.knowledgeOptions.length ? contentSelection.knowledgeOptions : getKnowledgeOptions(form.subject);
  const questionTypeOptions = contentSelection.questionTypeOptions.length ? contentSelection.questionTypeOptions : getQuestionTypeOptions(form.subject);
  const currentDifficultyOptions = contentSelection.difficultyOptions.length ? contentSelection.difficultyOptions : difficultyOptions;

  useEffect(() => {
    const saved = Taro.getStorageSync("baseSelection");
    if (saved) {
      setForm((old) => ({
        ...old,
        ...saved,
        lesson: saved.lesson || old.lesson,
        knowledgePoint: saved.knowledgePoint || defaultKnowledgePoint(saved.subject || old.subject),
        type: saved.type || defaultQuestionType(saved.subject || old.subject)
      }));
    }
  }, []);

  useEffect(() => {
    getContentPackage()
      .then((data) => {
        setContentPackage(data);
        setForm((old) => normalizeFormByContentPackage(old, data));
      })
      .catch(() => {
        setContentPackage(null);
      });
  }, []);

  function chooseSubject(subject) {
    setForm((old) => normalizeFormByContentPackage({
      ...old,
      subject,
      knowledgePoint: defaultKnowledgePoint(subject),
      type: defaultQuestionType(subject)
    }, contentPackage));
    setMode("form");
  }

  function updateUnit(unit) {
    const next = normalizeFormByContentPackage({ ...form, unit, lesson: "", knowledgePoint: "" }, contentPackage);
    setForm({ ...next, type: firstOrCurrent(next.type, getQuestionTypesForSelection(contentPackage, next), next.type) });
  }

  function updateLesson(lesson) {
    const next = normalizeFormByContentPackage({ ...form, lesson, knowledgePoint: "" }, contentPackage);
    setForm({ ...next, type: firstOrCurrent(next.type, getQuestionTypesForSelection(contentPackage, next), next.type) });
  }

  function updateKnowledgePoint(knowledgePoint) {
    const next = normalizeFormByContentPackage({ ...form, knowledgePoint }, contentPackage);
    setForm({ ...next, type: firstOrCurrent(form.type, getQuestionTypesForSelection(contentPackage, next), form.type) });
  }

  function updateGrade(grade) {
    setForm((old) => normalizeFormByContentPackage({ ...old, grade, unit: "", lesson: "", knowledgePoint: "" }, contentPackage));
  }

  async function generatePractice() {
    const nextForm = normalizeFormByContentPackage(form, contentPackage);
    const count = Number(nextForm.count);
    setForm(nextForm);
    if (!nextForm.subject) {
      Taro.showToast({ title: "请选择学科", icon: "none" });
      return;
    }
    if (!nextForm.grade) {
      Taro.showToast({ title: "请选择年级", icon: "none" });
      return;
    }
    if (!nextForm.knowledgePoint) {
      Taro.showToast({ title: "请选择知识点", icon: "none" });
      return;
    }
    if (!String(nextForm.count ?? "").trim()) {
      Taro.showToast({ title: "请输入题目数量", icon: "none" });
      return;
    }
    if (!Number.isFinite(count) || count < 1) {
      Taro.showToast({ title: "题目数量不能小于 1", icon: "none" });
      return;
    }

    setLoading(true);
    try {
      const data = await generateTextbook({ ...nextForm, count });
      const nextQuestions = getPracticeQuestions(data);
      setResult(data);
      setAnswers(nextQuestions.map(() => ""));
      setChecks(nextQuestions.map(() => undefined));
      setCurrentIndex(0);
      setMode("practice");
      Taro.setStorageSync("baseSelection", {
        grade: nextForm.grade,
        subject: nextForm.subject,
        textbook: nextForm.textbook,
        semester: nextForm.semester,
        unit: nextForm.unit,
        lesson: nextForm.lesson,
        knowledgePoint: nextForm.knowledgePoint,
        type: nextForm.type
      });
      Taro.showToast({ title: "题目生成成功", icon: "success" });
    } catch {
      Taro.showToast({ title: "生成失败，请稍后再试", icon: "none" });
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
    nextChecks[currentIndex] = { correct, removedFromWrongBook: correct && wasInWrongBook };
    setChecks(nextChecks);

    if (correct) {
      Taro.showToast({ title: wasInWrongBook ? "答对了，已移出错题本" : "答对了", icon: "none" });
      if (currentIndex < questions.length - 1) {
        setTimeout(() => {
          setCurrentIndex((oldIndex) => Math.min(oldIndex + 1, questions.length - 1));
          Taro.pageScrollTo({ scrollTop: 0, duration: 150 });
        }, 900);
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
    if (mode === "form") {
      setMode("subject");
      return;
    }
    Taro.navigateBack({
      fail: () => {
        setMode("form");
        setResult(null);
        setAnswers([]);
        setChecks([]);
        setCurrentIndex(0);
      }
    });
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
      {mode === "subject" ? (
        <>
          <View className="hero">
            <Text className="hero-title">选择练习学科</Text>
            <Text className="hero-subtitle">先选择语文、数学或英语，再设置年级和题目要求。</Text>
          </View>
          <AiNotice />
          <View className="subject-grid">
            {subjectCards.map((item) => (
              <Button key={item.key} className={`subject-card ${item.tone}`} onClick={() => chooseSubject(item.key)}>
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

      {mode === "form" ? (
        <>
          <View className="hero">
            <Text className="hero-title">{form.subject}练习设置</Text>
            <Text className="hero-subtitle">选择年级、单元、课时、知识点、题型和题目数量。</Text>
          </View>
          <AiNotice />
          <View className="card">
            <SelectField label="年级" value={form.grade} options={gradeOptions} onChange={updateGrade} />
            {contentSelection.unitOptions.length ? <SelectField label="单元" value={contentSelection.unitName} options={contentSelection.unitOptions} onChange={updateUnit} /> : null}
            {contentSelection.lessonOptions.length ? <SelectField label="课时" value={contentSelection.lessonName} options={contentSelection.lessonOptions} onChange={updateLesson} /> : null}
            <SelectField label="知识点" value={form.knowledgePoint} options={knowledgeOptions} onChange={updateKnowledgePoint} />
            <SelectField label="题型" value={form.type} options={questionTypeOptions} onChange={(type) => setForm({ ...form, type })} />
            <SelectField label="难度" value={form.difficulty} options={currentDifficultyOptions} onChange={(difficulty) => setForm({ ...form, difficulty })} />
            <InputField label="题目数量" value={form.count} onInput={(count) => setForm({ ...form, count: digitsOnly(count) })} />
            <PrimaryButton loading={loading} onClick={generatePractice}>生成并开始做题</PrimaryButton>
          </View>
        </>
      ) : null}

      {mode === "practice" && currentQuestion ? (
        <View className="result-card single-question-card">
          <Button className="page-back-button" onClick={backToPrevious}>‹ 返回</Button>
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

function normalizeFormByContentPackage(form, contentPackage) {
  const activePackage = selectContentPackage(contentPackage, form);
  const units = activePackage?.options?.units || [];
  if (!units.length || form.subject !== activePackage?.scope?.subject) return form;

  const unit = units.find((item) => item.name === form.unit) || units[0];
  const lesson = unit.lessons?.find((item) => item.name === form.lesson) || unit.lessons?.[0];
  const knowledgePoint = lesson?.knowledgePoints?.find((item) => item.name === form.knowledgePoint) || lesson?.knowledgePoints?.[0];
  const next = {
    ...form,
    grade: activePackage.scope?.grade || form.grade,
    semester: activePackage.scope?.semester || form.semester,
    subject: activePackage.scope?.subject || form.subject,
    textbook: activePackage.scope?.textbook || form.textbook,
    unit: unit?.name || form.unit,
    lesson: lesson?.name || form.lesson,
    knowledgePoint: knowledgePoint?.name || form.knowledgePoint
  };
  const questionTypes = getQuestionTypesForSelection(contentPackage, next);
  const difficulties = getDifficultiesForSelection(contentPackage, next);
  return {
    ...next,
    type: firstOrCurrent(next.type, questionTypes, defaultQuestionType(next.subject)),
    difficulty: firstOrCurrent(next.difficulty, difficulties, "基础")
  };
}

function buildContentSelection(contentPackage, form) {
  const activePackage = selectContentPackage(contentPackage, form);
  const units = activePackage?.options?.units || [];
  if (!units.length || form.subject !== activePackage?.scope?.subject) {
    return { unitOptions: [], lessonOptions: [], knowledgeOptions: [], questionTypeOptions: [], difficultyOptions: [] };
  }

  const unit = units.find((item) => item.name === form.unit) || units[0];
  const lesson = unit.lessons?.find((item) => item.name === form.lesson) || unit.lessons?.[0];
  return {
    unitName: unit?.name || "",
    lessonName: lesson?.name || "",
    unitOptions: units.map((item) => item.name),
    lessonOptions: (unit?.lessons || []).map((item) => item.name),
    knowledgeOptions: (lesson?.knowledgePoints || []).map((item) => item.name),
    questionTypeOptions: getQuestionTypesForSelection(contentPackage, form),
    difficultyOptions: getDifficultiesForSelection(contentPackage, form)
  };
}

function getQuestionTypesForSelection(contentPackage, form) {
  const point = findPoint(selectContentPackage(contentPackage, form), form.knowledgePoint);
  return point?.recommendedQuestionTypes || [];
}

function getDifficultiesForSelection(contentPackage, form) {
  const point = findPoint(selectContentPackage(contentPackage, form), form.knowledgePoint);
  return point?.difficultyLevels || [];
}

function findPoint(contentPackage, knowledgePoint) {
  return contentPackage?.options?.knowledgePoints?.find((item) => item.name === knowledgePoint || item.id === knowledgePoint);
}

function selectContentPackage(contentPackage, form) {
  const packages = contentPackage?.packages || [];
  if (!packages.length) return contentPackage;
  return packages.find((item) => findPoint(item, form.knowledgePoint))
    || packages.find((item) => (item.options?.units || []).some((unit) => unit.name === form.unit))
    || packages.find((item) => item.scope?.grade === form.grade && item.scope?.subject === form.subject && item.scope?.semester === form.semester)
    || packages.find((item) => item.scope?.grade === form.grade && item.scope?.subject === form.subject)
    || packages.find((item) => item.scope?.subject === form.subject)
    || packages[0];
}

function firstOrCurrent(current, options, fallback) {
  if (options.includes(current)) return current;
  return options[0] || fallback;
}

function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
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

function shuffle(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
}
