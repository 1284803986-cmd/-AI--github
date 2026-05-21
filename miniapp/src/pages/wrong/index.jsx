import React, { useMemo, useState } from "react";
import Taro, { useDidShow } from "@tarojs/taro";
import { Button, Picker, ScrollView, Text, View } from "@tarojs/components";
import { gradeOptions, semesterOptions } from "../../utils/options";
import { createPracticeSession } from "../../utils/practiceSession";
import { getWrongBook, markWrongQuestionMastered, toPracticeQuestion } from "../../utils/wrongBook";
import { navigateToPage } from "../../utils/navigation";
import "../../styles/common.scss";

const ALL = "全部";
const subjectOptions = [ALL, "语文", "数学", "英语"];
const masteredOptions = [ALL, "未掌握", "已掌握"];

export default function WrongPage() {
  const [wrongItems, setWrongItems] = useState([]);
  const [filters, setFilters] = useState({
    grade: ALL,
    subject: ALL,
    semester: ALL,
    unit: ALL,
    type: ALL,
    mastered: ALL
  });

  useDidShow(() => {
    setWrongItems(getWrongBook());
  });

  const unitOptions = useMemo(() => buildOptions(wrongItems, "unit"), [wrongItems]);
  const typeOptions = useMemo(() => buildOptions(wrongItems, "type"), [wrongItems]);
  const filteredItems = useMemo(() => filterWrongItems(wrongItems, filters), [wrongItems, filters]);

  function updateFilter(key, value) {
    setFilters((old) => ({ ...old, [key]: value }));
  }

  function startReview(item) {
    const question = toPracticeQuestion(item);
    const session = createPracticeSession({
      packageId: item.packageId,
      grade: item.grade || "二年级",
      subject: item.subject || "数学",
      semester: item.semester || "下册",
      textbook: item.textbook || "人教版",
      unitId: item.unitId,
      unit: item.unit || "错题重练",
      lesson: item.lesson,
      knowledgePointId: item.knowledgePointId,
      knowledgePoint: item.knowledge_point,
      typeId: item.typeId || item.type,
      type: item.type || item.question_type || "错题",
      difficulty: item.difficulty || "基础"
    }, [question]);
    navigateToPage(`/pages/practice/do/index?sessionId=${encodeURIComponent(session.sessionId)}&source=wrongBook`);
  }

  function toggleMastered(item) {
    const next = markWrongQuestionMastered(item, !item.mastered);
    setWrongItems(next);
    Taro.showToast({ title: item.mastered ? "已改为未掌握" : "已标记掌握", icon: "none" });
  }

  const hasWrongItems = wrongItems.length > 0;

  return (
    <ScrollView className="page wrong-page" scrollY>
      <View className="hero">
        <Text className="hero-title">错题本</Text>
        <Text className="hero-subtitle">练习和作业里做错的题会自动收进来，做对后会标记为已掌握。</Text>
      </View>

      <View className="card">
        <Text className="section-title">筛选错题</Text>
        <View className="filter-grid">
          <FilterPicker label="年级" value={filters.grade} options={[ALL, ...gradeOptions]} onChange={(value) => updateFilter("grade", value)} />
          <FilterPicker label="学科" value={filters.subject} options={subjectOptions} onChange={(value) => updateFilter("subject", value)} />
          <FilterPicker label="上下册" value={filters.semester} options={[ALL, ...semesterOptions]} onChange={(value) => updateFilter("semester", value)} />
          <FilterPicker label="章节" value={filters.unit} options={unitOptions} onChange={(value) => updateFilter("unit", value)} />
          <FilterPicker label="题型" value={filters.type} options={typeOptions} onChange={(value) => updateFilter("type", value)} />
          <FilterPicker label="掌握" value={filters.mastered} options={masteredOptions} onChange={(value) => updateFilter("mastered", value)} />
        </View>
      </View>

      <View className="card">
        <View className="card-title-row">
          <Text className="section-title">我的错题</Text>
          <Text className="muted">{filteredItems.length} / {wrongItems.length}</Text>
        </View>

        {!hasWrongItems ? (
          <View className="empty-state">
            <Text className="empty-title">暂无错题，继续保持！</Text>
            <Text className="muted">做章节练习或学生作业时，答错的题会自动出现在这里。</Text>
          </View>
        ) : filteredItems.length ? (
          filteredItems.map((item) => (
            <View className="wrong-card" key={item.id}>
              <View className="tag-row">
                <Text className="tag">{item.grade || "年级未记录"}</Text>
                <Text className="tag">{item.subject || "学科未记录"}</Text>
                {item.type ? <Text className="tag">{item.type}</Text> : null}
                <Text className={item.mastered ? "tag mastered-tag" : "tag warning-tag"}>{item.mastered ? "已掌握" : "未掌握"}</Text>
              </View>
              <Text className="question-text">{shortText(item.question, 72)}</Text>
              <View className="wrong-meta-grid">
                <Text className="muted">章节：{item.unit || "未记录"}</Text>
                <Text className="muted">错误次数：{item.wrongCount || 1}</Text>
                <Text className="muted">最近答错：{formatTime(item.lastWrongAt)}</Text>
              </View>
              <Text className="answer-text">我的答案：{item.userAnswer || "未填写"}</Text>
              <Text className="answer-text">参考答案：{item.correctAnswer || item.answer || "暂无"}</Text>
              <View className="button-row">
                <Button className="primary-button" onClick={() => startReview(item)}>错题重练</Button>
                <Button className="ghost-button" onClick={() => toggleMastered(item)}>{item.mastered ? "标为未掌握" : "标记掌握"}</Button>
              </View>
            </View>
          ))
        ) : (
          <View className="empty-state">
            <Text className="empty-title">当前筛选条件下暂无错题。</Text>
            <Text className="muted">可以调整年级、章节、题型或掌握状态再看看。</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function FilterPicker({ label, value, options, onChange }) {
  const safeOptions = options.length ? options : [ALL];
  const index = Math.max(0, safeOptions.indexOf(value));
  return (
    <Picker mode="selector" range={safeOptions} value={index} onChange={(event) => onChange(safeOptions[event.detail.value])}>
      <View className="filter-pill">
        <Text className="filter-label">{label}</Text>
        <Text className="filter-value">{value}</Text>
      </View>
    </Picker>
  );
}

function buildOptions(items, key) {
  return [ALL, ...new Set(items.map((item) => item[key]).filter(Boolean))];
}

function filterWrongItems(items, filters) {
  return items.filter((item) => {
    if (filters.grade !== ALL && item.grade !== filters.grade) return false;
    if (filters.subject !== ALL && item.subject !== filters.subject) return false;
    if (filters.semester !== ALL && item.semester !== filters.semester) return false;
    if (filters.unit !== ALL && item.unit !== filters.unit) return false;
    if (filters.type !== ALL && item.type !== filters.type) return false;
    if (filters.mastered === "已掌握" && !item.mastered) return false;
    if (filters.mastered === "未掌握" && item.mastered) return false;
    return true;
  });
}

function shortText(text, maxLength) {
  const value = String(text || "");
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function formatTime(value) {
  if (!value) return "暂无";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "暂无";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hour}:${minute}`;
}
