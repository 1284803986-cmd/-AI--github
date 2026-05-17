export const gradeOptions = ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级"];
export const subjectOptions = ["数学", "语文", "英语"];
export const textbookOptions = ["人教版", "北师大版", "苏教版"];
export const semesterOptions = ["上册", "下册"];
export const knowledgeOptions = [
  "小数位数相同的小数加法",
  "小数位数相同的小数减法",
  "小数位数不同的小数加减法",
  "小数加减法解决实际问题",
  "小数加减法验算"
];
export const questionTypeOptions = ["计算题", "填空题", "判断题", "应用题", "变式题"];
export const difficultyOptions = ["基础", "提高", "拔高"];

export const defaultSelection = {
  grade: "四年级",
  subject: "数学",
  textbook: "人教版",
  semester: "下册",
  unit: "小数加减法",
  knowledgePoint: "小数位数不同的小数加减法"
};

export function todayKey() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export function defaultFileName(meta = {}) {
  return `${meta.grade || "四年级"}_${meta.subject || "数学"}_${meta.knowledgePoint || meta.unit || "小数加减法"}_${todayKey()}`;
}

export function getQuestionCount(result) {
  if (!result) return 0;
  if (Array.isArray(result.questions)) return result.questions.length;
  return [...(result.similar_questions || []), ...(result.variation_questions || [])].length;
}
