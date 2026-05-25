import React, { useMemo, useState } from "react";
import Taro, { useDidShow } from "@tarojs/taro";
import { Button, Picker, ScrollView, Text, View } from "@tarojs/components";
import { defaultSelection } from "../../utils/options";
import {
  createWrongBookPracticeSession,
  getWrongBook,
  getWrongBookChapterSummary,
  getWrongBookFilterOptions,
  getWrongBookItemsByChapter,
  markWrongQuestionMastered,
  toPracticeQuestion
} from "../../utils/wrongBook";
import { normalizeQuestionStem } from "../../utils/question";
import { navigateToPage } from "../../utils/navigation";
import "../../styles/common.scss";
import "./index.scss";

const ALL = "全部";
const subjectOptions = ["语文", "数学", "英语"];
const detailModeLabels = {
  all: "全部错题",
  unmastered: "未掌握",
  mastered: "已掌握",
  frequent: "高频错题"
};

export default function WrongPage() {
  const [wrongItems, setWrongItems] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [detailMode, setDetailMode] = useState("all");
  const [filters, setFilters] = useState({
    grade: defaultSelection.grade,
    subject: "数学",
    semester: defaultSelection.semester,
    type: ALL,
    knowledgePoint: ALL
  });

  useDidShow(() => {
    setWrongItems(getWrongBook());
    syncHomeScope();
  });

  const baseFilters = useMemo(() => ({
    grade: filters.grade,
    subject: filters.subject,
    semester: filters.semester
  }), [filters.grade, filters.subject, filters.semester]);

  const chapterSummaries = useMemo(() => getWrongBookChapterSummary(baseFilters), [wrongItems, baseFilters]);
  const filterOptions = useMemo(() => getWrongBookFilterOptions(wrongItems, {
    ...baseFilters,
    unit: selectedChapter?.key || ALL
  }), [wrongItems, baseFilters, selectedChapter]);
  const detailItems = useMemo(() => {
    if (!selectedChapter) return [];
    const modeMastered = detailMode === "unmastered" ? "未掌握" : detailMode === "mastered" ? "已掌握" : ALL;
    const items = getWrongBookItemsByChapter(selectedChapter.key, {
      ...baseFilters,
      mastered: modeMastered,
      type: filters.type,
      knowledgePoint: filters.knowledgePoint
    });
    if (detailMode === "frequent") {
      return [...items].sort((a, b) => (Number(b.wrongCount) || 0) - (Number(a.wrongCount) || 0) || new Date(b.lastWrongAt || 0).getTime() - new Date(a.lastWrongAt || 0).getTime());
    }
    return items;
  }, [selectedChapter, filters, baseFilters, wrongItems, detailMode]);

  const subjectCounts = useMemo(() => {
    const counts = {};
    subjectOptions.forEach((subject) => {
      counts[subject] = getWrongBookChapterSummary({
        grade: filters.grade,
        semester: filters.semester,
        subject
      }).reduce((sum, chapter) => sum + (Number(chapter.total) || 0), 0);
    });
    return counts;
  }, [wrongItems, filters.grade, filters.semester]);

  const scopedWrongTotal = useMemo(() => subjectOptions.reduce((sum, subject) => sum + (subjectCounts[subject] || 0), 0), [subjectCounts]);

  function updateFilter(key, value) {
    setFilters((old) => ({ ...old, [key]: value }));
    if (["grade", "subject", "semester"].includes(key)) {
      setSelectedChapter(null);
      setDetailMode("all");
    }
  }

  function syncHomeScope() {
    const saved = Taro.getStorageSync("baseSelection") || {};
    const grade = Taro.getStorageSync("homeGrade") || saved.grade || defaultSelection.grade;
    const semester = Taro.getStorageSync("homeSemester") || saved.semester || defaultSelection.semester;
    setFilters((old) => {
      if (old.grade === grade && old.semester === semester) return old;
      setSelectedChapter(null);
      setDetailMode("all");
      return {
        ...old,
        grade,
        semester,
        type: ALL,
        knowledgePoint: ALL
      };
    });
  }

  function openChapter(chapter, mode = "all") {
    setSelectedChapter(chapter);
    setDetailMode(mode);
    setFilters((old) => ({ ...old, type: ALL, knowledgePoint: ALL }));
  }

  async function startChapterReview(chapter) {
    const chapterItems = getWrongBookItemsByChapter(chapter.key, baseFilters);
    const unmasteredItems = chapterItems.filter((item) => !item.mastered);
    let reviewItems = sortReviewItems(unmasteredItems);
    if (!reviewItems.length && chapterItems.length) {
      const confirm = await Taro.showModal({
        title: "本章错题已全部掌握",
        content: "本章错题已全部掌握，可以重新练习全部错题。",
        confirmText: "重新练习",
        cancelText: "取消"
      });
      if (!confirm.confirm) return;
      reviewItems = sortReviewItems(chapterItems);
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
    <ScrollView className="page wrong-page page-shell safe-bottom-space" scrollY>
      <View className="hero hero-card hero-card--blue wrong-hero">
        <View className="wrong-hero-copy">
          <Text className="hero-title">错题本</Text>
          <Text className="hero-subtitle">先看章节错题分布，再进入章节集中重练。</Text>
          <View className="wrong-hero-tags">
            <Text className="wrong-hero-tag">错题复盘</Text>
            <Text className="wrong-hero-tag">章节重练</Text>
            <Text className="wrong-hero-tag">掌握提升</Text>
          </View>
        </View>
        <View className="wrong-hero-illus">
          <View className="wrong-paper">
            <Text className="wrong-mark">×</Text>
          </View>
          <View className="wrong-pencil" />
          <View className="wrong-star star-one" />
          <View className="wrong-star star-two" />
        </View>
      </View>

      <View className="card study-card wrong-filter-card">
        <View className="wrong-scope-card">
          <View>
            <Text className="wrong-scope-title">当前范围：{filters.grade}{filters.semester} · {filters.subject}</Text>
            <Text className="wrong-scope-desc">{filters.grade}{filters.semester}错题目录 · 同步首页选择</Text>
          </View>
          <Text className="wrong-scope-badge">当前范围</Text>
        </View>
        <View className="wrong-subject-tabs">
          {subjectOptions.map((subject) => (
            <Button key={subject} className={filters.subject === subject ? "wrong-subject-tab active" : "wrong-subject-tab"} onClick={() => updateFilter("subject", subject)}>
              <Text className="wrong-subject-icon">{subjectIcon(subject)}</Text>
              <Text>{subject}</Text>
              <Text className="wrong-subject-count">{subjectCounts[subject] || 0}</Text>
            </Button>
          ))}
        </View>
      </View>

      {!selectedChapter ? (
        <View className="card study-card wrong-directory-card">
          <View className="card-title-row">
            <View>
              <Text className="section-title">章节错题目录</Text>
              <Text className="section-subtitle">看哪一章还需要多练一练。</Text>
            </View>
            <Text className="wrong-count-pill">{chapterSummaries.length} 个章节</Text>
          </View>

          {!hasWrongItems || scopedWrongTotal === 0 ? (
            <EmptyState title={`暂无${filters.grade}${filters.semester}${filters.subject}错题`} desc="练习过程中答错的题会自动进入这里。" />
          ) : chapterSummaries.length ? (
            chapterSummaries.map((chapter) => (
              <View key={chapter.key} className="wrong-chapter-card study-card learning-path-card review-task-card">
                <View className="wrong-card-top">
                  <View className="wrong-chapter-icon">
                    <Text>{subjectIcon(chapter.subject)}</Text>
                  </View>
                  <View className="wrong-chapter-main">
                    <Text className="wrong-chapter-title">{chapter.unit}</Text>
                    <Text className="wrong-chapter-desc">{[chapter.grade, chapter.semester, chapter.subject, chapter.textbook].filter(Boolean).join(" · ")}</Text>
                  </View>
                  <Button className="wrong-error-badge" onClick={() => openChapter(chapter, "frequent")}>错 {chapter.wrongCount} 次</Button>
                </View>
                <View className="wrong-summary-grid">
                  <SummaryItem label="总错题" value={chapter.total} tone="blue" onClick={() => openChapter(chapter, "all")} />
                  <SummaryItem label="未掌握" value={chapter.unmastered} tone="red" onClick={() => openChapter(chapter, "unmastered")} />
                  <SummaryItem label="已掌握" value={chapter.mastered} tone="green" onClick={() => openChapter(chapter, "mastered")} />
                </View>
                <View className="wrong-progress-wrap">
                  <View className="wrong-progress-fill" style={{ width: `${chapter.progress}%` }} />
                </View>
                <View className="wrong-progress-meta">
                  <Text className="muted">掌握进度：{chapter.mastered} / {chapter.total}</Text>
                  <Text className="muted">最近答错 {formatTime(chapter.lastWrongAt)}</Text>
                </View>
                <Text className="weak-type-row">
                  主要薄弱题型：{chapter.weakTypes.length ? chapter.weakTypes.slice(0, 3).map((item) => `${item.type} ${item.count}道`).join("｜") : "暂无"}
                </Text>
                <View className="button-row wrong-chapter-actions">
                  <Button className="primary-button btn-primary" onClick={() => startChapterReview(chapter)}>开始重练</Button>
                </View>
              </View>
            ))
          ) : (
            <EmptyState title={`暂无${filters.grade}${filters.semester}${filters.subject}错题`} desc="练习过程中答错的题会自动进入这里。" />
          )}
        </View>
      ) : (
        <View className="card study-card wrong-detail-card">
          <View className="wrong-detail-head">
            <Button className="ghost-button small-button wrong-back-button" onClick={() => setSelectedChapter(null)}>返回章节</Button>
            <View className="detail-title-wrap">
              <Text className="section-title">{selectedChapter.unit} · {detailModeLabels[detailMode] || "全部错题"}</Text>
              <Text className="wrong-detail-path">{[selectedChapter.grade, selectedChapter.subject, selectedChapter.semester, selectedChapter.unit].filter(Boolean).join("｜")}</Text>
              <Text className="muted">本章 {detailItems.length} 道错题</Text>
            </View>
          </View>

          <View className="filter-grid wrong-detail-filter">
            <FilterPicker label="题型" value={filters.type} options={[ALL, ...filterOptions.types]} onChange={(value) => updateFilter("type", value)} />
            <FilterPicker label="知识点" value={filters.knowledgePoint} options={[ALL, ...filterOptions.knowledgePoints]} onChange={(value) => updateFilter("knowledgePoint", value)} />
          </View>

          {detailItems.length ? (
            detailItems.map((item) => (
              <View className="wrong-card study-card review-question-card" key={item.id}>
                <View className="tag-row">
                  <Text className="tag">{item.grade || "年级未记录"}</Text>
                  <Text className="tag">{item.subject || "学科未记录"}</Text>
                  {item.type ? <Text className="tag">{item.type}</Text> : null}
                  <Text className={item.mastered ? "tag mastered-tag" : "tag warning-tag"}>{item.mastered ? "已掌握" : "未掌握"}</Text>
                </View>
                <Text className="question-text">{shortText(normalizeQuestionStem(item), 72)}</Text>
                <View className="wrong-meta-grid">
                  <Text className="wrong-info-chip">章节：{item.unit || "未记录"}</Text>
                  <Text className="wrong-info-chip wrong-info-chip--orange">错误次数：{item.wrongCount || 1}</Text>
                  <Text className="wrong-info-chip">最近答错：{formatTime(item.lastWrongAt)}</Text>
                </View>
                <View className="wrong-answer-box">
                  <Text className="wrong-answer-label">我的答案</Text>
                  <Text className="wrong-answer-value wrong-answer-user">{item.userAnswer || "未填写"}</Text>
                </View>
                <View className="wrong-answer-box right-answer-box">
                  <Text className="wrong-answer-label">参考答案</Text>
                  <Text className="wrong-answer-value">{item.correctAnswer || item.answer || "暂无"}</Text>
                </View>
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

function SummaryItem({ label, value, tone = "blue", onClick }) {
  return (
    <Button className={`wrong-summary-item wrong-summary-item--${tone}`} onClick={onClick}>
      <Text className="wrong-summary-value">{Number(value) || 0}</Text>
      <View className="wrong-summary-label-row">
        <Text className="wrong-summary-label">{label}</Text>
        <Text className="wrong-summary-arrow">›</Text>
      </View>
    </Button>
  );
}

function subjectIcon(subject) {
  if (subject === "语文") return "文";
  if (subject === "英语") return "英";
  return "数";
}

function sortReviewItems(items = []) {
  return [...items].sort((a, b) => {
    const masteredA = a.mastered ? 1 : 0;
    const masteredB = b.mastered ? 1 : 0;
    return masteredA - masteredB ||
      (Number(b.wrongCount) || 0) - (Number(a.wrongCount) || 0) ||
      new Date(b.lastWrongAt || 0).getTime() - new Date(a.lastWrongAt || 0).getTime();
  });
}

function EmptyState({ title, desc }) {
  return (
    <View className="empty-state">
      <Text className="empty-illustration">✓</Text>
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
