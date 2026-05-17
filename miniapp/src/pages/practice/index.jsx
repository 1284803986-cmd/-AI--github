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
import { generateTextbook } from "../../utils/api";
import { hasWrongQuestion, isAnswerCorrect, updateWrongBookByAnswer } from "../../utils/wrongBook";
import "../../styles/common.scss";

export default function PracticePage() {
  const [form, setForm] = useState({ ...defaultSelection, type: defaultQuestionType(defaultSelection.subject), difficulty: "基础", count: 5 });
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
  const knowledgeOptions = getKnowledgeOptions(form.subject);
  const questionTypeOptions = getQuestionTypeOptions(form.subject);

  useEffect(() => {
    const saved = Taro.getStorageSync("baseSelection");
    if (saved) {
      setForm((old) => ({
        ...old,
        ...saved,
        knowledgePoint: saved.knowledgePoint || defaultKnowledgePoint(saved.subject || old.subject),
        type: saved.type || defaultQuestionType(saved.subject || old.subject)
      }));
    }
  }, []);

  function chooseSubject(subject) {
    setForm((old) => ({
      ...old,
      subject,
      knowledgePoint: defaultKnowledgePoint(subject),
      type: defaultQuestionType(subject)
    }));
    setMode("form");
  }

  async function generatePractice() {
    if (!form.subject) {
      Taro.showToast({ title: "请选择学科", icon: "none" });
      return;
    }
    if (!form.grade) {
      Taro.showToast({ title: "请选择年级", icon: "none" });
      return;
    }
    if (!form.knowledgePoint) {
      Taro.showToast({ title: "请选择知识点", icon: "none" });
      return;
    }
    if (!form.count || form.count < 1) {
      Taro.showToast({ title: "请输入题目数量", icon: "none" });
      return;
    }

    setLoading(true);
    try {
      const data = await generateTextbook(form);
      const nextQuestions = getPracticeQuestions(data);
      setResult(data);
      setAnswers(nextQuestions.map(() => ""));
      setChecks(nextQuestions.map(() => undefined));
      setCurrentIndex(0);
      setMode("practice");
      Taro.setStorageSync("baseSelection", {
        grade: form.grade,
        subject: form.subject,
        textbook: form.textbook,
        semester: form.semester,
        unit: form.unit,
        knowledgePoint: form.knowledgePoint,
        type: form.type
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
            <Text className="hero-subtitle">选择年级、知识点、题型、难度和题目数量。</Text>
          </View>
          <AiNotice />
          <View className="card">
            <SelectField label="年级" value={form.grade} options={gradeOptions} onChange={(grade) => setForm({ ...form, grade })} />
            <SelectField label="知识点" value={form.knowledgePoint} options={knowledgeOptions} onChange={(knowledgePoint) => setForm({ ...form, knowledgePoint })} />
            <SelectField label="题型" value={form.type} options={questionTypeOptions} onChange={(type) => setForm({ ...form, type })} />
            <SelectField label="难度" value={form.difficulty} options={difficultyOptions} onChange={(difficulty) => setForm({ ...form, difficulty })} />
            <InputField label="题目数量" type="number" value={form.count} onInput={(count) => setForm({ ...form, count: Number(count) || 1 })} />
            <PrimaryButton loading={loading} onClick={generatePractice}>生成并开始做题</PrimaryButton>
          </View>
        </>
      ) : null}

      {mode === "practice" && currentQuestion ? (
        <View className="result-card single-question-card">
          <Button className="page-back-button" onClick={backToPrevious}>‹ 返回</Button>
          <View className="practice-head">
            <Text className="section-title">第 {currentIndex + 1} 题 / 共 {questions.length} 题</Text>
            <Text className="muted">{form.subject} · {form.grade} · {form.knowledgePoint}</Text>
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
