export const gradeOptions = ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级"];
export const subjectOptions = ["语文", "数学", "英语"];
export const textbookOptions = ["人教版", "北师大版", "苏教版"];
export const semesterOptions = ["上册", "下册"];

export const subjectCards = [
  { key: "语文", title: "语文", desc: "字词、阅读和表达练习", icon: "文", tone: "red" },
  { key: "数学", title: "数学", desc: "计算、应用和思维训练", icon: "数", tone: "blue" },
  { key: "英语", title: "英语", desc: "单词、句型和阅读练习", icon: "英", tone: "green" }
];

export const subjectKnowledgeOptions = {
  语文: ["字词基础", "句子训练", "阅读理解", "看图写话", "古诗积累"],
  数学: [
    "认识钟面时间",
    "有余数除法计算",
    "有余数除法应用题",
    "乘除关系解决问题",
    "万以内数的读写",
    "万以内加法",
    "万以内减法"
  ],
  英语: ["单词拼写", "句型练习", "阅读理解", "情景对话", "语法基础"]
};

export const subjectQuestionTypeOptions = {
  语文: ["填空题", "选择题", "判断题", "阅读题", "表达题"],
  数学: ["计算题", "填空题", "选择题", "判断题", "应用题", "变式题"],
  英语: ["选择题", "填空题", "判断题", "阅读题", "翻译题"]
};

export const knowledgeOptions = subjectKnowledgeOptions.数学;
export const questionTypeOptions = subjectQuestionTypeOptions.数学;
export const difficultyOptions = ["基础", "提高", "拔高"];

export const defaultSelection = {
  grade: "二年级",
  subject: "数学",
  textbook: "人教版",
  semester: "下册",
  unit: "时间在哪里",
  knowledgePoint: "认识钟面时间"
};

export function getKnowledgeOptions(subject) {
  return subjectKnowledgeOptions[subject] || knowledgeOptions;
}

export function getQuestionTypeOptions(subject) {
  return subjectQuestionTypeOptions[subject] || questionTypeOptions;
}

export function defaultKnowledgePoint(subject) {
  return getKnowledgeOptions(subject)[0];
}

export function defaultQuestionType(subject) {
  return getQuestionTypeOptions(subject)[0];
}

export function todayKey() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export function defaultFileName(meta = {}) {
  return `${meta.grade || "二年级"}_${meta.subject || "数学"}_${meta.knowledgePoint || meta.unit || "练习"}_${todayKey()}`;
}

export function getQuestionCount(result) {
  if (!result) return 0;
  if (Array.isArray(result.questions)) return result.questions.length;
  return [...(result.similar_questions || []), ...(result.variation_questions || [])].length;
}
