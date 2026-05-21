import React, { useMemo, useState } from "react";
import Taro, { useDidShow } from "@tarojs/taro";
import { Button, Picker, ScrollView, Text, View } from "@tarojs/components";
import { gradeOptions, semesterOptions } from "../../utils/options";
import {
  createWrongBookPracticeSession,
  getWrongBook,
  getWrongBookChapterSummary,
  getWrongBookFilterOptions,
  getWrongBookItemsByChapter,
  markWrongQuestionMastered,
  toPracticeQuestion
} from "../../utils/wrongBook";
import { navigateToPage } from "../../utils/navigation";
import "../../styles/common.scss";

const ALL = "全部";
const subjectOptions = [ALL, "语文", "数学", "英语"];
const masteredOptions = [ALL, "未掌握", "已掌握"];

export default function WrongPage() {
  const [wrongItems, setWrongItems] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [filters, setFilters] = useState({
    grade: ALL,
    subject: ALL,
    semester: ALL,
    mastered: ALL,
    type: ALL,
    knowledgePoint: ALL
  });

  useDidShow(() => {
    setWrongItems(getWrongBook());
  });

  const baseFilters = useMemo(() => ({
    grade: filters.grade,
    subject: filters.subject,
    semester: filters.semester,
    mastered: filters.mastered
  }), [filters.grade, filters.subject, filters.semester, filters.mastered]);

  const chapterSummaries = useMemo(() => getWrongBookChapterSummary(baseFilters), [wrongItems, baseFilters]);
  const filterOptions = useMemo(() => getWrongBookFilterOptions(wrongItems, {
    ...baseFilters,
    unit: selectedChapter?.key || ALL
  }), [wrongItems, baseFilters, selectedChapter]);
  const detailItems = useMemo(() => {
    if (!selectedChapter) return [];
    return getWrongBookItemsByChapter(selectedChapter.key, {
      ...baseFilters,
      type: filters.type,
      knowledgePoint: filters.knowledgePoint
    });
  }, [selectedChapter, filters, baseFilters, wrongItems]);

  function updateFilter(key, value) {
    setFilters((old) => ({ ...old, [key]: value }));
    if (["grade", "subject", "semester", "mastered"].includes(key)) {
      setSelectedChapter(null);
    }
  }

  function openChapter(chapter) {
    setSelectedChapter(chapter);
    setFilters((old) => ({ ...old, type: ALL, knowledgePoint: ALL }));
  }

  async function startChapterReview(chapter) {
    const chapterItems = getWrongBookItemsByChapter(chapter.key, baseFilters);
    const unmasteredItems = chapterItems.filter((item) => !item.mastered);
    let reviewItems = unmasteredItems;
    if (!reviewItems.length && chapterItems.length) {
      const confirm = await Taro.showModal({
        title: "本章错题已全部掌握",
        content: "本章错题已全部掌握，可以重新练习全部错题。",
        confirmText: "重新练习",
        cancelText: "取消"
      });
      if (!confirm.confirm) return;
      reviewItems = chapterItems;
    }
    if (!reviewItems.length) {
      Taro.showToast({ title: "该章节暂无错题", icon: "none" });
      return;
    }
    const session = createWrongBookPracticeSession(reviewItems, chapter);
    if (!session?.sessionId) {
      Taro.showToast({ title: "错题数据异常，请稍后再试", icon: "none" });
      return;
    }
    navigateToPage(`/pages/practice/do/index?sessionId=${encodeURIComponent(session.sessionId)}&source=wrongBook`);
  }

  function startReview(item) {
    const question = toPracticeQuestion(item);
    const session = createWrongBookPracticeSession([{ ...item, ...question }], { unit: item.unit, unitId: item.unitId });
    if (!session?.sessionId) {
      Taro.showToast({ title: "错题数据异常，请稍后再试", icon: "none" });
      return;
    }
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
        <Text className="hero-subtitle">先看章节错题分布，再进入章节集中重练。</Text>
      </View>

      <View className="card">
        <Text className="section-title">基础筛选</Text>
        <View className="filter-grid">
          <FilterPicker label="年级" value={filters.grade} options={[ALL, ...gradeOptions]} onChange={(value) => updateFilter("grade", value)} />
          <FilterPicker label="学科" value={filters.subject} options={subjectOptions} onChange={(value) => updateFilter("subject", value)} />
          <FilterPicker label="上下册" value={filters.semester} options={[ALL, ...semesterOptions]} onChange={(value) => updateFilter("semester", value)} />
          <FilterPicker label="掌握" value={filters.mastered} options={masteredOptions} onChange={(value) => updateFilter("mastered", value)} />
        </View>
      </View>

      {!selectedChapter ? (
        <View className="card">
          <View className="card-title-row">
            <Text className="section-title">章节错题</Text>
            <Text className="muted">{chapterSummaries.length} 个章节</Text>
          </View>

          {!hasWrongItems ? (
            <EmptyState title="暂无错题，继续保持！" desc="练习或作业里答错的题会自动进入这里。" />
          ) : chapterSummaries.length ? (
            chapterSummaries.map((chapter) => (
              <View key={chapter.key} className="wrong-chapter-card">
                <View className="tag-row">
                  {[chapter.grade, chapter.subject, chapter.semester].filter(Boolean).map((label) => (
                    <Text className="tag" key={label}>{label}</Text>
                  ))}
                  {chapter.textbook ? <Text className="tag">{chapter.textbook}</Text> : null}
                </View>
                <View className="card-title-row">
                  <Text className="wrong-chapter-title">{chapter.unit}</Text>
                  <Text className="muted">最近答错 {formatTime(chapter.lastWrongAt)}</Text>
                </View>
                <Text className="wrong-chapter-desc">共 {chapter.total} 道错题 · 未掌握 {chapter.unmastered} 道 · 已掌握 {chapter.mastered} 道</Text>
                <View className="wrong-summary-grid">
                  <SummaryItem label="总错题" value={chapter.total} />
                  <SummaryItem label="未掌握" value={chapter.unmastered} />
                  <SummaryItem label="已掌握" value={chapter.mastered} />
                  <SummaryItem label="错误次数" value={chapter.wrongCount} />
                </View>
                <View className="wrong-progress-wrap">
                  <View className="wrong-progress-fill" style={{ width: `${chapter.progress}%` }} />
                </View>
                <Text className="muted">掌握进度：{chapter.mastered} / {chapter.total}</Text>
                <Text className="weak-type-row">
                  主要薄弱题型：{chapter.weakTypes.length ? chapter.weakTypes.slice(0, 3).map((item) => `${item.type} ${item.count}道`).join("｜") : "暂无"}
                </Text>
                <View className="button-row wrong-chapter-actions">
                  <Button className="primary-button" onClick={() => startChapterReview(chapter)}>开始重练</Button>
                  <Button className="ghost-button" onClick={() => openChapter(chapter)}>查看错题</Button>
                </View>
              </View>
            ))
          ) : (
            <EmptyState title="当前筛选条件下暂无错题。" desc="可以调整年级、学科、上下册或掌握状态再看看。" />
          )}
        </View>
      ) : (
        <View className="card">
          <View className="wrong-detail-head">
            <Button className="ghost-button small-button" onClick={() => setSelectedChapter(null)}>返回章节</Button>
            <View className="detail-title-wrap">
              <Text className="section-title">{selectedChapter.unit}</Text>
              <Text className="muted">{[selectedChapter.grade, selectedChapter.subject, selectedChapter.semester, selectedChapter.unit].filter(Boolean).join("｜")}</Text>
              <Text className="muted">本章 {detailItems.length} 道错题</Text>
            </View>
          </View>

          <View className="filter-grid">
            <FilterPicker label="题型" value={filters.type} options={[ALL, ...filterOptions.types]} onChange={(value) => updateFilter("type", value)} />
            <FilterPicker label="知识点" value={filters.knowledgePoint} options={[ALL, ...filterOptions.knowledgePoints]} onChange={(value) => updateFilter("knowledgePoint", value)} />
            <FilterPicker label="掌握" value={filters.mastered} options={masteredOptions} onChange={(value) => updateFilter("mastered", value)} />
          </View>

          {detailItems.length ? (
            detailItems.map((item) => (
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
            <EmptyState title="该章节暂无错题。" desc="可以调整题型、知识点或掌握状态。" />
          )}
        </View>
      )}
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

function SummaryItem({ label, value }) {
  return (
    <View className="wrong-summary-item">
      <Text className="wrong-summary-value">{Number(value) || 0}</Text>
      <Text className="wrong-summary-label">{label}</Text>
    </View>
  );
}

function EmptyState({ title, desc }) {
  return (
    <View className="empty-state">
      <Text className="empty-title">{title}</Text>
      <Text className="muted">{desc}</Text>
    </View>
  );
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
