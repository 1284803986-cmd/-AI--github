import fs from "node:fs";

const bankPath = process.argv[2] || "content/extracted_question_bank.json";
const bank = JSON.parse(fs.readFileSync(bankPath, "utf8"));
const questions = bank.questions || [];

const badTextRe = /【[^】]*(?:知识加油站|对应练习|典型例题|考点|方法点拨|基础巩固|能力提升|详解|分析)|来源|学科网|Z&xx|附加|\(\d+分|（\d+分|jpg|png|INCLUDEPICTURE|EQ\\F|教材第|主题图|自主测评|综合测评|期中|期末|每日口算|预习|导学|教学过程|教师活动|学生活动|综合算式|下面.*图形|下面.*图|下面（）图|下面是|哪个方向看到|从.*看到|在下面的里|在里填|填数。|填序号|Ｋ|□里应该填|竖式计算|验算|计算下面各题|你的座位|从右数.*从左数|用字母表示|交换律：|结合律：|运算性质：|主持人|议一议|（三）|圈起来|圈出|够吗|条形图|扇形图|折线统计图|A．B|A.B|B．C|B.C|C．D|C.D|无法判/;
const mergedStemRe = /(?:^|[^0-9])[0-9]{1,3}[．.](?!\d)|[一二三四五六七八九十]+、(?:选择题|判断题|填空题|计算题|应用题)|[A-D][．.、].*[0-9]{1,3}[．.](?!\d)/;
const imageNeedRe = /如图|看图|图中|下图|上图|下面图形|下面.*图|从上面|从左面|从正面|涂色|圈一圈|圈起来|圈出|画一画|连一连|连线|哪个方向看到|下面钟面|钟面上|形成的角|条形图|扇形图|折线统计图/;
const attachableVisualRe = /在长方体的下面画|在不是圆柱的下面画|从左边数起，第（\s*）个和第（\s*）个都是圆柱|从左边数圆柱是第（\s*）个，球是第（\s*）个|在下面钟面上画出时针和分针/;

const bad = [];
const empty = [];
const needImage = [];
const groups = new Map();
const books = new Map();

for (const question of questions) {
  const text = question.question || "";
  if (
    badTextRe.test(text)
    || mergedStemRe.test(text)
    || text.length > 180
    || (text.match(/？|\?/g) || []).length > 1
    || /^\d+[：:]/.test(text)
    || /[。；;]\d/.test(text)
    || ((text.match(/[（(]\s*[）)]/g) || []).length > 3)
    || (/(面积|周长|体积)\s*[=＝]/.test(text) && !/[（(？?]/.test(text))
    || /[A-D][．.、][^A-D]{0,3}$/.test(text)
    || ((/例如|比值是|等于以上/.test(text)) && !/[（(）)？?]|____/.test(text))
    || /^\d+(?:\.\d+)?(?:元|米|厘米|千克|克|平方厘米|平方米|度|°)[。；;，,]/.test(text)
    || /^（\s*）比（\s*）(?:多|少)/.test(text)
    || (text.match(/[○◯]/g) || []).length >= 4
    || (text.match(/____/g) || []).length >= 2
    || (/^[从][左右](?:边)?数/.test(text) && !attachableVisualRe.test(text))
    || (/[=＝+\-＋－×÷：:]$/.test(text) && !text.startsWith("计算："))
    || /比（\s*）$/.test(text)
  ) {
    bad.push(question);
  }
  if (!question.unit || !question.knowledge_point || !question.unit_id || !question.knowledge_point_id) {
    empty.push(question);
  }
  if (imageNeedRe.test(text) && !question.image) {
    needImage.push(question);
  }
  const groupKey = `${question.grade}|${question.semester}|${question.unit}|${question.knowledge_point}`;
  groups.set(groupKey, (groups.get(groupKey) || 0) + 1);
  const bookKey = `${question.grade}${question.semester}`;
  books.set(bookKey, (books.get(bookKey) || 0) + 1);
}

const lowGroups = [...groups]
  .filter(([, count]) => count < 3)
  .sort((a, b) => a[1] - b[1]);

const report = {
  total: questions.length,
  books: Object.fromEntries([...books].sort()),
  types: bank.stats?.types || {},
  generatedDiagramQuestions: bank.stats?.generated_diagram_questions || 0,
  badCount: bad.length,
  emptyMappingCount: empty.length,
  missingImageCount: needImage.length,
  groupCount: groups.size,
  lowGroups: lowGroups.map(([key, count]) => ({ key, count })),
  samples: {
    bad: bad.slice(0, 8).map(formatQuestion),
    empty: empty.slice(0, 8).map(formatQuestion),
    missingImage: needImage.slice(0, 8).map(formatQuestion)
  }
};

console.log(JSON.stringify(report, null, 2));

if (bad.length || empty.length || needImage.length) {
  process.exitCode = 1;
}

function formatQuestion(question) {
  return {
    where: `${question.grade}${question.semester} ${question.unit}/${question.knowledge_point}`,
    type: question.question_type,
    question: question.question
  };
}
