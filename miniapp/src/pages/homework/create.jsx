import React, { useEffect, useMemo, useState } from "react";
import Taro from "@tarojs/taro";
import { ScrollView, Text, View } from "@tarojs/components";
import { AiNotice, InputField, PrimaryButton, SelectField } from "../../components/form";
import { createAssignment, getContentPackage } from "../../utils/api";
import { defaultQuestionType, defaultSelection, difficultyOptions, getKnowledgeOptions, getQuestionTypeOptions, gradeOptions, semesterOptions, subjectOptions, textbookOptions } from "../../utils/options";
import "../../styles/common.scss";

export default function HomeworkCreatePage() {
  const [form, setForm] = useState({ ...defaultSelection, lesson: "", type: defaultQuestionType(defaultSelection.subject), count: 10, difficulty: "基础" });
  const [contentPackage, setContentPackage] = useState(null);
  const [loading, setLoading] = useState(false);
  const contentSelection = useMemo(() => buildContentSelection(contentPackage, form), [contentPackage, form]);
  const knowledgeOptions = contentSelection.knowledgeOptions.length ? contentSelection.knowledgeOptions : getKnowledgeOptions(form.subject);
  const questionTypeOptions = contentSelection.questionTypeOptions.length ? contentSelection.questionTypeOptions : getQuestionTypeOptions(form.subject);
  const currentDifficultyOptions = contentSelection.difficultyOptions.length ? contentSelection.difficultyOptions : difficultyOptions;

  useEffect(() => {
    const saved = Taro.getStorageSync("baseSelection");
    if (saved) setForm((old) => ({ ...old, ...saved, lesson: saved.lesson || old.lesson, type: saved.type || old.type }));
  }, []);

  useEffect(() => {
    getContentPackage()
      .then((data) => {
        setContentPackage(data);
        setForm((old) => normalizeFormByContentPackage(old, data));
      })
      .catch(() => setContentPackage(null));
  }, []);

  function updateSubject(subject) {
    setForm((old) => normalizeFormByContentPackage({ ...old, subject, unit: "", lesson: "", knowledgePoint: "", type: defaultQuestionType(subject) }, contentPackage));
  }

  function updateGrade(grade) {
    setForm((old) => normalizeFormByContentPackage({ ...old, grade, unit: "", lesson: "", knowledgePoint: "" }, contentPackage));
  }

  function updateSemester(semester) {
    setForm((old) => normalizeFormByContentPackage({ ...old, semester, unit: "", lesson: "", knowledgePoint: "" }, contentPackage));
  }

  function updateTextbook(textbook) {
    setForm((old) => normalizeFormByContentPackage({ ...old, textbook, unit: "", lesson: "", knowledgePoint: "" }, contentPackage));
  }

  function updateUnit(unit) {
    setForm(normalizeFormByContentPackage({ ...form, unit, lesson: "", knowledgePoint: "" }, contentPackage));
  }

  function updateLesson(lesson) {
    setForm(normalizeFormByContentPackage({ ...form, lesson, knowledgePoint: "" }, contentPackage));
  }

  function updateKnowledgePoint(knowledgePoint) {
    const next = normalizeFormByContentPackage({ ...form, knowledgePoint }, contentPackage);
    setForm({ ...next, type: firstOrCurrent(next.type, getQuestionTypesForSelection(contentPackage, next), next.type) });
  }

  async function submit() {
    const nextForm = normalizeFormByContentPackage(form, contentPackage);
    const count = Number(nextForm.count);
    setForm(nextForm);
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
      const data = await createAssignment({
        ...nextForm,
        type: nextForm.type,
        count
      });
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
      Taro.showToast({ title: "作业已生成", icon: "success" });
      Taro.redirectTo({ url: `/pages/homework/detail?id=${data.assignment.id}` });
    } catch (error) {
      Taro.showToast({ title: error.message || "生成失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView className="page" scrollY>
      <View className="hero">
        <Text className="hero-title">布置作业</Text>
        <Text className="hero-subtitle">生成作业后自动得到作业码，学生可用作业码提交。</Text>
      </View>
      <AiNotice />
      <View className="card">
        <Text className="section-title">作业参数</Text>
        <SelectField label="科目" value={form.subject} options={subjectOptions} onChange={updateSubject} />
        <SelectField label="年级" value={form.grade} options={gradeOptions} onChange={updateGrade} />
        <SelectField label="学期" value={form.semester} options={semesterOptions} onChange={updateSemester} />
        <SelectField label="教材" value={form.textbook} options={textbookOptions} onChange={updateTextbook} />
        {contentSelection.unitOptions.length ? <SelectField label="单元" value={contentSelection.unitName} options={contentSelection.unitOptions} onChange={updateUnit} /> : null}
        {contentSelection.lessonOptions.length ? <SelectField label="课时" value={contentSelection.lessonName} options={contentSelection.lessonOptions} onChange={updateLesson} /> : null}
        <SelectField label="知识点" value={form.knowledgePoint} options={knowledgeOptions} onChange={updateKnowledgePoint} />
        <SelectField label="题型" value={form.type} options={questionTypeOptions} onChange={(type) => setForm({ ...form, type })} />
        <InputField label="题目数量" value={form.count} onInput={(count) => setForm({ ...form, count: digitsOnly(count) })} />
        <SelectField label="难度" value={form.difficulty} options={currentDifficultyOptions} onChange={(difficulty) => setForm({ ...form, difficulty })} />
        <PrimaryButton loading={loading} onClick={submit}>生成作业</PrimaryButton>
      </View>
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
