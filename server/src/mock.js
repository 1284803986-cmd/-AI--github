import { findKnowledgePoint, templatesFor } from "./content.js";

export function mockTextbookQuestions(input, context) {
  const count = clamp(input.count, 1, 50);
  const knowledgePoint = context.knowledgePoint || findKnowledgePoint(context.contentPackage, input.knowledgePoint);
  const rawTemplates = context.templates?.length ? context.templates : templatesFor(context.contentPackage, knowledgePoint, input.type);
  const templates = rawTemplates.some((item) => item.question_type === input.type) ? rawTemplates : [genericTemplate(input.type)];
  return {
    title: `${input.grade}数学${knowledgePoint.name}练习`,
    grade: input.grade,
    semester: input.semester,
    subject: input.subject,
    textbook: input.textbook,
    unit: input.unit,
    questions: Array.from({ length: count }, (_, index) => buildQuestion(index + 1, knowledgePoint, templates[index % templates.length], input.difficulty || "基础"))
  };
}

export function mockWrongQuestion(input, context) {
  const knowledgePoint = inferKnowledgePoint(input.originalQuestion, context.contentPackage);
  const baseTemplates = templatesFor(context.contentPackage, knowledgePoint, "计算题");
  const variantTemplates = templatesFor(context.contentPackage, knowledgePoint, "变式题");
  return {
    title: `${knowledgePoint.name}错题同类巩固`,
    subject: "数学",
    grade_guess: "四年级",
    knowledge_point: knowledgePoint.name,
    original_analysis: buildOriginalAnalysis(input.originalQuestion, input.wrongAnswer),
    error_reason: pick(knowledgePoint.common_mistakes, 0),
    similar_questions: Array.from({ length: 5 }, (_, index) => buildQuestion(index + 1, knowledgePoint, baseTemplates[index % baseTemplates.length], "基础")),
    variation_questions: Array.from({ length: 3 }, (_, index) => buildQuestion(index + 1, knowledgePoint, variantTemplates[index % variantTemplates.length] || baseTemplates[index % baseTemplates.length], "提高"))
  };
}

export function mockPaper(input, context) {
  const count = clamp(input.count, 1, 40);
  const score = Math.max(1, Math.floor(input.totalScore / count));
  const points = context.contentPackage.knowledge_points;
  return {
    title: `${input.grade}数学${context.contentPackage.scope.unit}练习卷`,
    grade: input.grade,
    subject: input.subject,
    textbook: input.textbook,
    unit: context.contentPackage.scope.unit,
    total_score: input.totalScore,
    questions: Array.from({ length: count }, (_, index) => {
      const point = points[index % points.length];
      const type = index % 4 === 0 ? "应用题" : index % 4 === 1 ? "填空题" : index % 4 === 2 ? "判断题" : "计算题";
      const template = templatesFor(context.contentPackage, point, type)[0] || templatesFor(context.contentPackage, point)[0];
      const difficulty = index < count * 0.6 ? "基础" : index < count * 0.9 ? "提高" : "拔高";
      return { ...buildQuestion(index + 1, point, template, difficulty), score };
    })
  };
}

function buildQuestion(id, knowledgePoint, template, difficulty) {
  const values = numberSet(id);
  const built = buildOriginalQuestion(id, knowledgePoint, template, values);
  const item = {
    id,
    question: built.question,
    answer: built.answer,
    explanation: built.explanation || `${template.answer_rule} 本题要点：${knowledgePoint.description}`,
    knowledge_point: knowledgePoint.name,
    difficulty,
    question_type: template.question_type,
    type: template.question_type,
    common_mistake: pick(knowledgePoint.common_mistakes, id - 1),
    parent_tip: buildParentTip(knowledgePoint)
  };
  if (template.question_type === "选择题") item.options = built.options || buildOptions(built.answer, id);
  return item;
}

function buildOriginalQuestion(id, knowledgePoint, template, values) {
  const raw = fillTemplate(template.template || "", values);
  if (!raw.includes("围绕")) {
    return {
      question: raw,
      answer: calculateAnswer(raw, template.answer_rule, values),
      explanation: `${template.answer_rule} 本题要点：${knowledgePoint.description}`
    };
  }
  const family = questionFamily(`${knowledgePoint.unit || ""}${knowledgePoint.name || ""}`);
  return buildByFamily(id, family, template.question_type || "填空题", knowledgePoint.name || "", values);
}

function questionFamily(text) {
  if (/三角形内角和/.test(text)) return "triangle_angle";
  if (/长方体正方体圆柱球|立体图形|拼搭中的图形|立体图形分类/.test(text)) return "solid_shape";
  if (/圆柱.*表面积|表面积.*圆柱/.test(text)) return "cylinder_surface";
  if (/圆的面积/.test(text)) return "circle_area";
  if (/组合图形面积/.test(text)) return "composite_area";
  if (/梯形面积/.test(text)) return "trapezoid_area";
  if (/三角形面积/.test(text)) return "triangle_area";
  if (/平行四边形面积/.test(text)) return "parallelogram_area";
  if (/面积|平方|周长|长方形|正方形|三角形|圆|圆柱|圆锥|体积|表面积|图形|角|平行|梯形/.test(text)) return "geometry";
  if (/分数|约分|通分|几分|百分|折扣|成数|税率|利率/.test(text)) return "fraction";
  if (/小数/.test(text)) return "decimal";
  if (/乘|除|倍|口诀|平均分|余数|因数|倍数|比例/.test(text)) return "multiply";
  if (/时间|时|分|秒|年|月|日/.test(text)) return "time";
  if (/观察|视图|物体/.test(text)) return "observe";
  if (/位置|方向|路线/.test(text)) return "position";
  if (/统计|可能性|数据/.test(text)) return "data";
  return "add";
}

function buildByFamily(id, family, type, name, values) {
  if (family === "solid_shape") {
    return sampleSolidShapeQuestion(type, values);
  }
  const calc = sampleCalc(family, values);
  if (type.includes("选择")) {
    const numeric = Number(calc.answer);
    const optionValues = Number.isFinite(numeric)
      ? [numeric, numeric + id + 1, Math.max(0, numeric - id), numeric + 3]
      : [calc.answer, "无法确定", "条件不足", "以上都不对"];
    const options = optionValues.map((item, index) => `${["A", "B", "C", "D"][index]}. ${Number.isFinite(Number(item)) ? format(Number(item)) : item}`);
    return { question: `${calc.stem}，结果是（  ）。`, answer: options[0], options, explanation: calc.explanation };
  }
  if (type.includes("判断")) {
    const numeric = Number(calc.answer);
    const wrong = Number.isFinite(numeric) ? format(numeric + 1) : "1";
    return { question: `判断：${calc.stem} 的结果是 ${wrong}。`, answer: "错误", explanation: `${calc.stem} 的正确结果是 ${calc.answer}。` };
  }
  if (type.includes("应用") || type.includes("变式")) {
    return sampleWordProblem(family, name, values, type.includes("变式"));
  }
  return { question: `${name}：${calc.stem} = ____。`, answer: String(calc.answer), explanation: calc.explanation };
}

function sampleCalc(family, values) {
  if (family === "parallelogram_area") {
    const base = values.m + 4;
    const height = values.n + 2;
    return { stem: `平行四边形底 ${base} 厘米、高 ${height} 厘米，面积`, answer: base * height, explanation: "平行四边形面积 = 底 × 高。" };
  }
  if (family === "triangle_area") {
    const base = values.m + 6;
    const height = values.n + 4;
    return { stem: `三角形底 ${base} 厘米、高 ${height} 厘米，面积`, answer: base * height / 2, explanation: "三角形面积 = 底 × 高 ÷ 2。" };
  }
  if (family === "trapezoid_area") {
    const top = values.m + 3;
    const bottom = values.m + values.n + 6;
    const height = values.n + 2;
    return { stem: `梯形上底 ${top} 厘米、下底 ${bottom} 厘米、高 ${height} 厘米，面积`, answer: (top + bottom) * height / 2, explanation: "梯形面积 =（上底 + 下底）× 高 ÷ 2。" };
  }
  if (family === "circle_area") {
    const r = values.n + 2;
    return { stem: `圆的半径是 ${r} 厘米，面积`, answer: format(3.14 * r * r), explanation: "圆的面积 = πr²，这里取 π≈3.14。" };
  }
  if (family === "cylinder_surface") {
    const r = values.n + 2;
    const h = values.m + 4;
    return { stem: `圆柱底面半径 ${r} 厘米、高 ${h} 厘米，表面积`, answer: format(2 * 3.14 * r * r + 2 * 3.14 * r * h), explanation: "圆柱表面积 = 两个底面积 + 侧面积。" };
  }
  if (family === "composite_area") {
    const a = values.m + 6;
    const b = values.n + 3;
    const c = values.m + 2;
    return { stem: `组合图形可分成长 ${a}、宽 ${b} 的长方形和底 ${c}、高 ${b} 的三角形，面积`, answer: a * b + c * b / 2, explanation: "先分割成基本图形，分别求面积后相加。" };
  }
  if (family === "decimal") {
    const a = Number(values.a2);
    const b = Number(values.b2);
    return { stem: `${a} + ${b}`, answer: format(a + b), explanation: "小数加减法要把小数点对齐，相同数位相加。" };
  }
  if (family === "fraction") {
    const denominator = (values.n % 5) + 5;
    return { stem: `1/${denominator} + 2/${denominator}`, answer: `3/${denominator}`, explanation: "同分母分数相加，分母不变，分子相加。" };
  }
  if (family === "geometry") {
    const length = values.m + 4;
    const width = values.n + 2;
    return { stem: `长方形长 ${length} 厘米、宽 ${width} 厘米，面积`, answer: length * width, explanation: "长方形面积 = 长 × 宽。" };
  }
  if (family === "triangle_angle") {
    const a = 35 + (values.idSeed % 4) * 5;
    const b = 45 + (values.idSeed % 5) * 4;
    const c = 180 - a - b;
    return { stem: `180 - ${a} - ${b}`, answer: c, explanation: "三角形三个内角和是 180°。" };
  }
  if (family === "multiply") {
    return { stem: `${values.m} × ${values.n}`, answer: values.m * values.n, explanation: "根据乘法口诀计算。" };
  }
  if (family === "time") {
    return { stem: `${values.hour} 时过 ${values.m * 5} 分钟后是几时几分`, answer: `${values.hour}时${values.m * 5}分`, explanation: "经过多少分钟，就在开始时间上增加多少分钟。" };
  }
  if (family === "observe") {
    const count = values.n + 2;
    return { stem: `用 ${count} 个同样的小正方体摆成一排，从前面看到的小正方形个数`, answer: count, explanation: "一排小正方体从前面看，能看到几个正面就有几个小正方形。" };
  }
  return { stem: `${values.addend1} + ${values.addend2}`, answer: values.addend1 + values.addend2, explanation: "相同数位对齐，从个位算起。" };
}

function sampleWordProblem(family, name, values, variant) {
  const sceneIndex = values.idSeed || values.m + values.n;
  if (family === "triangle_angle") {
    const a = 35 + (values.idSeed % 4) * 5;
    const b = 45 + (values.idSeed % 5) * 4;
    const c = 180 - a - b;
    return pickScene([
      () => ({ question: `一个三角形的两个内角分别是 ${a}° 和 ${b}°，第三个内角是多少度？`, answer: `${c}°`, explanation: "三角形三个内角和是 180°。" }),
      () => ({ question: `风筝上的三角形装饰有两个角，分别是 ${a}° 和 ${b}°。剩下一个角是多少度？`, answer: `${c}°`, explanation: "用 180° 减去已知的两个角。" }),
      () => ({ question: `一个三角形路标中，已知两个角是 ${a}°、${b}°。这个路标的第三个角是多少度？`, answer: `${c}°`, explanation: "三角形内角和是 180°。" }),
      () => ({ question: `小丽画了一个三角形，其中两个角分别为 ${a}° 和 ${b}°。她还需要把第三个角标成多少度？`, answer: `${c}°`, explanation: "第三个角 = 180° - 已知两个角的和。" }),
      () => ({ question: `三角尺图案中一个三角形的两个内角是 ${a}° 和 ${b}°，另一个内角是多少度？`, answer: `${c}°`, explanation: "先求两个已知角的和，再用 180° 去减。" }),
      () => ({ question: `一个三角形彩旗的两个角分别是 ${a}°、${b}°。第三个角是锐角、直角还是钝角？`, answer: c < 90 ? "锐角" : c === 90 ? "直角" : "钝角", explanation: `第三个角是 ${c}°，再按角的大小分类。` }),
      () => ({ question: `判断：三角形中两个角是 ${a}° 和 ${b}°，第三个角可以是 ${c + 10}°。`, answer: "错误", explanation: `第三个角应是 180° - ${a}° - ${b}° = ${c}°。` }),
      () => ({ question: `一个等腰三角形的两个底角都是 ${a}°，顶角是多少度？`, answer: `${180 - a * 2}°`, explanation: "等腰三角形两个底角相等，顶角 = 180° - 2 个底角。" }),
      () => ({ question: `数学小报上画了一个三角形，两个角分别标着 ${a}° 和 ${b}°，第三个角应标多少度？`, answer: `${c}°`, explanation: "三角形内角和固定为 180°。" }),
      () => ({ question: `一个三角形纸片剪掉一个角后，原来两个已知内角是 ${a}° 和 ${b}°。被剪掉的那个角是多少度？`, answer: `${c}°`, explanation: "用 180° 减去两个已知内角。" })
    ], sceneIndex);
  }
  if (family === "triangle_area") {
    const base = values.m + 6;
    const height = values.n + 4;
    const area = base * height / 2;
    return pickScene([
      () => ({ question: `学校做一面三角形流动红旗，底是 ${base} 分米，高是 ${height} 分米。这面红旗的面积是多少平方分米？`, answer: `${format(area)} 平方分米`, explanation: "三角形面积 = 底 × 高 ÷ 2。" }),
      () => ({ question: `美术课剪一个三角形窗花，量得底边 ${base} 厘米，对应的高 ${height} 厘米。窗花面积是多少平方厘米？`, answer: `${format(area)} 平方厘米`, explanation: "用底乘高再除以 2。" }),
      () => ({ question: `劳动课整理一块三角形花圃，底 ${base} 米，高 ${height} 米。花圃占地多少平方米？`, answer: `${format(area)} 平方米`, explanation: "三角形花圃面积按底 × 高 ÷ 2 计算。" }),
      () => ({ question: `一块三角形广告牌的底是 ${base} 分米，高是 ${height} 分米。如果每平方分米刷 2 克颜料，一共需要多少克颜料？`, answer: `${format(area * 2)} 克`, explanation: "先求三角形面积，再乘每平方分米用量。" }),
      () => ({ question: `方格纸上画了一个三角形，底占 ${base} 个小格，高占 ${height} 个小格。这个三角形占多少个小方格？`, answer: `${format(area)} 个`, explanation: "把每个小格看作 1 平方单位。" }),
      () => ({ question: `一个三角形零件的底为 ${base} 厘米，高为 ${height} 厘米。两个这样的零件拼成平行四边形，拼成后的面积是多少平方厘米？`, answer: `${format(area * 2)} 平方厘米`, explanation: "两个完全一样的三角形可以拼成一个平行四边形。" }),
      () => ({ question: `一张三角形奖状的面积是 ${format(area)} 平方厘米，底是 ${base} 厘米。它对应的高是多少厘米？`, answer: `${height} 厘米`, explanation: "高 = 面积 × 2 ÷ 底。" }),
      () => ({ question: `手工小组做三角形书签，底 ${base} 厘米，高 ${height} 厘米。做 3 个同样书签共需要多少平方厘米彩纸？`, answer: `${format(area * 3)} 平方厘米`, explanation: "先求一个书签面积，再乘 3。" }),
      () => ({ question: `一块三角形玻璃的底是 ${base} 分米，高是 ${height} 分米。每平方分米 4 元，这块玻璃要多少元？`, answer: `${format(area * 4)} 元`, explanation: "面积乘单价就是总价。" }),
      () => ({ question: `三角形队旗的底边是 ${base} 厘米，高是 ${height} 厘米。它的面积比同底等高的平行四边形少多少平方厘米？`, answer: `${format(area)} 平方厘米`, explanation: "同底等高三角形面积是平行四边形的一半，少的也是一半。" })
    ], sceneIndex);
  }
  if (family === "parallelogram_area") {
    const base = values.m + 4;
    const height = values.n + 3;
    const area = base * height;
    return pickScene([
      () => ({ question: `校园里有一块平行四边形花坛，底 ${base} 米，高 ${height} 米。花坛面积是多少平方米？`, answer: `${area} 平方米`, explanation: "平行四边形面积 = 底 × 高。" }),
      () => ({ question: `手工课做平行四边形贴纸，底 ${base} 厘米，高 ${height} 厘米。一张贴纸面积是多少平方厘米？`, answer: `${area} 平方厘米`, explanation: "对应的底和高相乘。" }),
      () => ({ question: `一块平行四边形玻璃，底 ${base} 分米，高 ${height} 分米。需要多少平方分米玻璃？`, answer: `${area} 平方分米`, explanation: "求材料大小就是求面积。" }),
      () => ({ question: `劳动小组给平行四边形菜地铺膜，底 ${base} 米，高 ${height} 米。至少要多少平方米地膜？`, answer: `${area} 平方米`, explanation: "铺满菜地要按面积计算。" }),
      () => ({ question: `一张平行四边形宣传卡面积是 ${area} 平方厘米，底是 ${base} 厘米。它的高是多少厘米？`, answer: `${height} 厘米`, explanation: "高 = 面积 ÷ 底。" }),
      () => ({ question: `把一个长方形框架拉成平行四边形后，底是 ${base} 厘米，高是 ${height} 厘米。现在图形面积是多少平方厘米？`, answer: `${area} 平方厘米`, explanation: "拉斜后面积看对应的底和高。" }),
      () => ({ question: `平行四边形停车位底 ${base} 米，高 ${height} 米。6 个同样车位共占多少平方米？`, answer: `${area * 6} 平方米`, explanation: "先求一个车位面积，再乘 6。" }),
      () => ({ question: `一块平行四边形木板底 ${base} 分米，高 ${height} 分米。每平方分米刷漆 3 克，共需多少克漆？`, answer: `${area * 3} 克`, explanation: "面积乘每平方分米用量。" }),
      () => ({ question: `方格纸上一个平行四边形的底占 ${base} 格，高占 ${height} 格。面积是多少个小方格？`, answer: `${area} 个`, explanation: "每格代表 1 平方单位。" }),
      () => ({ question: `两个完全一样的三角形拼成一个底 ${base} 厘米、高 ${height} 厘米的平行四边形。每个三角形面积是多少平方厘米？`, answer: `${format(area / 2)} 平方厘米`, explanation: "每个三角形是拼成平行四边形面积的一半。" })
    ], sceneIndex);
  }
  if (family === "trapezoid_area") {
    const top = values.m + 3;
    const bottom = values.m + values.n + 6;
    const height = values.n + 2;
    const area = (top + bottom) * height / 2;
    return pickScene([
      () => ({ question: `一块梯形菜地，上底 ${top} 米，下底 ${bottom} 米，高 ${height} 米。面积是多少平方米？`, answer: `${format(area)} 平方米`, explanation: "梯形面积 =（上底 + 下底）× 高 ÷ 2。" }),
      () => ({ question: `梯形宣传牌上底 ${top} 分米，下底 ${bottom} 分米，高 ${height} 分米。做这块牌需要多少平方分米材料？`, answer: `${format(area)} 平方分米`, explanation: "按梯形面积公式计算。" }),
      () => ({ question: `一块梯形草坪的两条平行边分别是 ${top} 米和 ${bottom} 米，高 ${height} 米。草坪面积是多少平方米？`, answer: `${format(area)} 平方米`, explanation: "两底和乘高再除以 2。" }),
      () => ({ question: `梯形零件上底 ${top} 厘米，下底 ${bottom} 厘米，高 ${height} 厘米。两个这样的零件拼成平行四边形，拼成后的面积是多少平方厘米？`, answer: `${format(area * 2)} 平方厘米`, explanation: "两个完全一样的梯形可拼成平行四边形。" }),
      () => ({ question: `梯形纸片面积是 ${format(area)} 平方厘米，上底 ${top} 厘米，下底 ${bottom} 厘米。它的高是多少厘米？`, answer: `${height} 厘米`, explanation: "高 = 面积 × 2 ÷（上底 + 下底）。" }),
      () => ({ question: `一条梯形水渠横截面上底 ${top} 分米，下底 ${bottom} 分米，高 ${height} 分米。横截面面积是多少平方分米？`, answer: `${format(area)} 平方分米`, explanation: "横截面是梯形，套用梯形面积公式。" }),
      () => ({ question: `美术小组剪梯形彩纸，上底 ${top} 厘米，下底 ${bottom} 厘米，高 ${height} 厘米。剪 4 张共需要多少平方厘米彩纸？`, answer: `${format(area * 4)} 平方厘米`, explanation: "先求一张面积，再乘 4。" }),
      () => ({ question: `一个梯形花架的上底 ${top} 分米、下底 ${bottom} 分米、高 ${height} 分米。每平方分米贴 2 张装饰纸，共要多少张？`, answer: `${format(area * 2)} 张`, explanation: "面积乘每平方分米张数。" }),
      () => ({ question: `梯形操场示意图两条平行边长 ${top} 厘米和 ${bottom} 厘米，高 ${height} 厘米。图上面积是多少平方厘米？`, answer: `${format(area)} 平方厘米`, explanation: "识别上底、下底和高后计算。" }),
      () => ({ question: `梯形窗帘布上底 ${top} 分米，下底 ${bottom} 分米，高 ${height} 分米。每平方分米 5 元，布料费用是多少元？`, answer: `${format(area * 5)} 元`, explanation: "先求面积，再乘单价。" })
    ], sceneIndex);
  }
  if (family === "circle_area") {
    const r = values.n + 2;
    const area = 3.14 * r * r;
    return pickScene([
      () => ({ question: `圆形花坛半径是 ${r} 米。花坛占地面积大约是多少平方米？`, answer: `${format(area)} 平方米`, explanation: "圆面积 = 3.14 × 半径 × 半径。" }),
      () => ({ question: `一个圆形餐垫的半径是 ${r} 分米。这个餐垫的面积是多少平方分米？`, answer: `${format(area)} 平方分米`, explanation: "用 πr² 计算，π 取 3.14。" }),
      () => ({ question: `圆形钟面的半径是 ${r} 厘米。钟面的面积是多少平方厘米？`, answer: `${format(area)} 平方厘米`, explanation: "半径平方后乘 3.14。" }),
      () => ({ question: `学校要给半径 ${r} 米的圆形沙坑铺防护垫，至少需要多少平方米防护垫？`, answer: `${format(area)} 平方米`, explanation: "铺满沙坑就是求圆面积。" }),
      () => ({ question: `圆形桌面的半径是 ${r} 分米。给桌面贴膜需要多少平方分米贴膜？`, answer: `${format(area)} 平方分米`, explanation: "贴膜面积等于桌面面积。" }),
      () => ({ question: `一个圆形徽章半径 ${r} 厘米。做 5 个这样的徽章，正面面积一共是多少平方厘米？`, answer: `${format(area * 5)} 平方厘米`, explanation: "先求一个圆面积，再乘 5。" }),
      () => ({ question: `圆形喷泉半径 ${r} 米。如果每平方米清洗费 2 元，清洗喷泉底面要多少元？`, answer: `${format(area * 2)} 元`, explanation: "面积乘每平方米费用。" }),
      () => ({ question: `一个圆形纸片直径是 ${r * 2} 厘米。它的面积是多少平方厘米？`, answer: `${format(area)} 平方厘米`, explanation: "先用直径除以 2 得到半径。" }),
      () => ({ question: `圆形舞台半径 ${r} 米，半径扩大到原来的 2 倍后，面积变成多少平方米？`, answer: `${format(3.14 * (r * 2) * (r * 2))} 平方米`, explanation: "新半径是原来的 2 倍，再按圆面积公式计算。" }),
      () => ({ question: `一个圆形瓶盖半径 ${r} 厘米，另一个同样瓶盖和它完全相同。两个瓶盖正面面积共是多少平方厘米？`, answer: `${format(area * 2)} 平方厘米`, explanation: "两个相同圆面积相加。" })
    ], sceneIndex);
  }
  if (family === "cylinder_surface") {
    const r = values.n + 2;
    const h = values.m + 4;
    const baseArea = 3.14 * r * r;
    const sideArea = 2 * 3.14 * r * h;
    const surface = sideArea + baseArea * 2;
    return pickScene([
      () => ({ question: `一个圆柱形笔筒底面半径 ${r} 厘米，高 ${h} 厘米。给外表面和底面贴纸，至少要多少平方厘米贴纸？`, answer: `${format(sideArea + baseArea)} 平方厘米`, explanation: "无盖笔筒贴侧面和一个底面。" }),
      () => ({ question: `圆柱形茶叶罐半径 ${r} 厘米，高 ${h} 厘米。包装整个罐身含上下底，需要多少平方厘米包装纸？`, answer: `${format(surface)} 平方厘米`, explanation: "完整圆柱表面积 = 侧面积 + 两个底面积。" }),
      () => ({ question: `一个圆柱形水桶无盖，底面半径 ${r} 分米，高 ${h} 分米。做这个水桶至少需要多少平方分米铁皮？`, answer: `${format(sideArea + baseArea)} 平方分米`, explanation: "无盖水桶只有侧面和一个底面。" }),
      () => ({ question: `圆柱形礼盒半径 ${r} 厘米，高 ${h} 厘米。只包侧面，需要多少平方厘米彩纸？`, answer: `${format(sideArea)} 平方厘米`, explanation: "只包侧面就求圆柱侧面积。" }),
      () => ({ question: `一个圆柱形油漆桶底面半径 ${r} 厘米，高 ${h} 厘米。给桶身和上下底都刷漆，刷漆面积是多少平方厘米？`, answer: `${format(surface)} 平方厘米`, explanation: "刷全部外表面，求圆柱表面积。" }),
      () => ({ question: `圆柱形柱子半径 ${r} 分米，高 ${h} 分米。只给柱子的侧面贴瓷砖，需要多少平方分米瓷砖？`, answer: `${format(sideArea)} 平方分米`, explanation: "柱子侧面面积 = 底面周长 × 高。" }),
      () => ({ question: `一个圆柱形罐头盒半径 ${r} 厘米，高 ${h} 厘米。做 3 个这样的盒子共需多少平方厘米铁皮？`, answer: `${format(surface * 3)} 平方厘米`, explanation: "先求一个完整圆柱表面积，再乘 3。" }),
      () => ({ question: `圆柱形灯罩没有上下底，半径 ${r} 厘米，高 ${h} 厘米。做这个灯罩需要多少平方厘米材料？`, answer: `${format(sideArea)} 平方厘米`, explanation: "灯罩没有底，只算侧面积。" }),
      () => ({ question: `一个圆柱形收纳盒半径 ${r} 厘米，高 ${h} 厘米，盖子和底都要贴标签。标签面积一共是多少平方厘米？`, answer: `${format(baseArea * 2)} 平方厘米`, explanation: "只贴上下两个圆形底面。" }),
      () => ({ question: `圆柱形薯片筒半径 ${r} 厘米，高 ${h} 厘米。外包装包括侧面和上盖，不包括底面，需要多少平方厘米？`, answer: `${format(sideArea + baseArea)} 平方厘米`, explanation: "按侧面积加一个底面积计算。" })
    ], sceneIndex);
  }
  if (family === "composite_area") {
    const a = values.m + 6;
    const b = values.n + 3;
    const c = values.m + 2;
    const rect = a * b;
    const tri = c * b / 2;
    const total = rect + tri;
    return pickScene([
      () => ({ question: `一块组合花圃由长 ${a} 米、宽 ${b} 米的长方形和底 ${c} 米、高 ${b} 米的三角形组成。花圃面积是多少平方米？`, answer: `${format(total)} 平方米`, explanation: "把组合图形分成长方形和三角形分别求面积后相加。" }),
      () => ({ question: `美术板由一个长方形和一个三角形拼成。长方形长 ${a} 分米、宽 ${b} 分米，三角形底 ${c} 分米、高 ${b} 分米。面积共多少平方分米？`, answer: `${format(total)} 平方分米`, explanation: "分割求和。" }),
      () => ({ question: `一个组合地垫左边是 ${a} 厘米 × ${b} 厘米的长方形，右边接一个底 ${c} 厘米、高 ${b} 厘米的三角形。地垫面积是多少平方厘米？`, answer: `${format(total)} 平方厘米`, explanation: "长方形面积加三角形面积。" }),
      () => ({ question: `校园指示牌由长方形牌面和三角形箭头组成，长方形长 ${a} 分米、宽 ${b} 分米，箭头底 ${c} 分米、高 ${b} 分米。牌面面积是多少平方分米？`, answer: `${format(total)} 平方分米`, explanation: "先看成两个基本图形。" }),
      () => ({ question: `一块组合玻璃可分成长方形和三角形：长方形面积 ${rect} 平方厘米，三角形底 ${c} 厘米、高 ${b} 厘米。总面积是多少平方厘米？`, answer: `${format(total)} 平方厘米`, explanation: "先求三角形面积，再与已知长方形面积相加。" })
    ], sceneIndex);
  }
  if (family === "geometry") {
    const length = values.m + 4;
    const width = values.n + 2;
    const area = length * width;
    return pickScene([
      () => ({ question: `学校花坛是长方形，长 ${length} 米，宽 ${width} 米。${variant ? "如果每平方米种 2 棵花，一共可以种多少棵花？" : "面积是多少平方米？"}`, answer: variant ? `${area * 2} 棵` : `${area} 平方米`, explanation: variant ? "先求面积，再用面积乘每平方米棵数。" : "长方形面积 = 长 × 宽。" }),
      () => ({ question: `美术课要做一张长方形展示牌，长 ${length} 分米，宽 ${width} 分米。这张展示牌的面积是多少平方分米？`, answer: `${area} 平方分米`, explanation: "长方形面积 = 长 × 宽。" }),
      () => ({ question: `操场边有一块长方形沙坑，长 ${length} 米，宽 ${width} 米。给沙坑铺满细沙，至少要铺多少平方米？`, answer: `${area} 平方米`, explanation: "铺满的大小就是沙坑面积。" }),
      () => ({ question: `一块长方形桌布长 ${length} 分米，宽 ${width} 分米。沿桌布四周缝花边，需要多少分米花边？`, answer: `${(length + width) * 2} 分米`, explanation: "求四周长度，用长方形周长 =（长 + 宽）× 2。" }),
      () => ({ question: `劳动课整理菜地，一块长方形菜地长 ${length} 米，宽 ${width} 米。菜地面积是多少平方米？`, answer: `${area} 平方米`, explanation: "菜地是长方形，面积 = 长 × 宽。" })
    ], sceneIndex);
  }
  if (family === "decimal") {
    const a = Number(values.a2);
    const b = Number(values.b2);
    return pickScene([
      () => ({ question: `小明买文具花了 ${a} 元，又买练习本花了 ${b} 元。一共花了多少元？`, answer: `${format(a + b)} 元`, explanation: "求一共花多少钱，用加法计算，小数点要对齐。" }),
      () => ({ question: `一条彩带长 ${a} 米，另一条彩带长 ${b} 米。两条彩带一共长多少米？`, answer: `${format(a + b)} 米`, explanation: "求两段长度合起来，用小数加法。" }),
      () => ({ question: `小华跳远成绩是 ${a} 米，小林比他多跳 ${b} 米。小林跳了多少米？`, answer: `${format(a + b)} 米`, explanation: "求比一个数多多少，用加法。" }),
      () => ({ question: `妈妈买苹果用了 ${a} 千克，买橙子用了 ${b} 千克。两种水果一共重多少千克？`, answer: `${format(a + b)} 千克`, explanation: "质量合起来，用小数加法。" }),
      () => ({ question: `一本书厚 ${a} 厘米，另一本书厚 ${b} 厘米。两本书叠在一起厚多少厘米？`, answer: `${format(a + b)} 厘米`, explanation: "求总厚度，用加法。" }),
      () => ({ question: `晨跑时，小林跑了 ${a} 千米，小美跑了 ${b} 千米。两人一共跑了多少千米？`, answer: `${format(a + b)} 千米`, explanation: "求两段距离合计，用小数加法。" }),
      () => ({ question: `一桶水用了 ${a} 升，又用了 ${b} 升。一共用了多少升？`, answer: `${format(a + b)} 升`, explanation: "求总用量，用加法。" }),
      () => ({ question: `科技小组测量两根木条，一根长 ${a} 米，另一根长 ${b} 米。两根共长多少米？`, answer: `${format(a + b)} 米`, explanation: "长度合计，用小数加法。" }),
      () => ({ question: `小票上牛奶 ${a} 元，面包 ${b} 元。这两样一共多少钱？`, answer: `${format(a + b)} 元`, explanation: "购物总价用加法。" }),
      () => ({ question: `一袋米重 ${a} 千克，另一袋米重 ${b} 千克。两袋米共重多少千克？`, answer: `${format(a + b)} 千克`, explanation: "两袋质量合计，用加法。" })
    ], sceneIndex);
  }
  if (family === "fraction") {
    const d = (values.n % 5) + 5;
    return pickScene([
      () => ({ question: `一根彩带，第一次用去 1/${d}，第二次用去 2/${d}。两次一共用去这根彩带的几分之几？`, answer: `3/${d}`, explanation: "同分母分数相加，分母不变，分子相加。" }),
      () => ({ question: `一块蛋糕，小丽吃了 1/${d}，小明吃了 2/${d}。两人一共吃了这块蛋糕的几分之几？`, answer: `3/${d}`, explanation: "同分母分数相加，分母不变，分子相加。" }),
      () => ({ question: `一本故事书，上午读了 1/${d}，下午读了 2/${d}。这一天一共读了全书的几分之几？`, answer: `3/${d}`, explanation: "把两次读的份数相加。" }),
      () => ({ question: `一块试验田，第一组浇了 1/${d}，第二组浇了 2/${d}。两个小组一共浇了这块地的几分之几？`, answer: `3/${d}`, explanation: "同分母分数相加，分子相加。" }),
      () => ({ question: `一瓶果汁，小刚喝了 1/${d}，小红喝了 2/${d}。他们一共喝了这瓶果汁的几分之几？`, answer: `3/${d}`, explanation: "同分母分数相加，分母不变。" }),
      () => ({ question: `一张彩纸，做手工用了 1/${d}，贴画用了 2/${d}。一共用了这张彩纸的几分之几？`, answer: `3/${d}`, explanation: "把两次使用的分数相加。" }),
      () => ({ question: `一段路，第一天修了 1/${d}，第二天修了 2/${d}。两天共修了全长的几分之几？`, answer: `3/${d}`, explanation: "同分母分数加法，分母不变，分子相加。" }),
      () => ({ question: `一盒巧克力，上午吃了 1/${d}，晚上吃了 2/${d}。一共吃了这盒巧克力的几分之几？`, answer: `3/${d}`, explanation: "求一共吃了多少，用加法。" }),
      () => ({ question: `一块布，裁衣服用了 1/${d}，做口袋用了 2/${d}。一共用了这块布的几分之几？`, answer: `3/${d}`, explanation: "同分母分数相加。" })
    ], sceneIndex);
  }
  if (family === "time") {
    const minutes = values.m * 5;
    return pickScene([
      () => ({ question: `小华 ${values.hour} 时开始读书，读了 ${minutes} 分钟。读完时是几时几分？`, answer: `${values.hour}时${minutes}分`, explanation: "把经过的分钟数加到开始时间上。" }),
      () => ({ question: `一节手工课从 ${values.hour} 时开始，上了 ${minutes} 分钟。下课时是几时几分？`, answer: `${values.hour}时${minutes}分`, explanation: "结束时间 = 开始时间 + 经过时间。" }),
      () => ({ question: `动画片 ${values.hour} 时开始播放，播放 ${minutes} 分钟后结束。结束时间是几时几分？`, answer: `${values.hour}时${minutes}分`, explanation: "在开始时间上加播放时长。" }),
      () => ({ question: `小队活动 ${values.hour} 时开始，持续 ${minutes} 分钟。活动结束时是几时几分？`, answer: `${values.hour}时${minutes}分`, explanation: "持续多少分钟，就往后推多少分钟。" })
    ], sceneIndex);
  }
  if (family === "position") {
    const routes = [
      ["东", "北", "东北方向"],
      ["西", "北", "西北方向"],
      ["东", "南", "东南方向"],
      ["西", "南", "西南方向"]
    ];
    const route = routes[values.m % routes.length];
    return { question: `小红从教室出发，先向${route[0]}走 ${values.m} 格，再向${route[1]}走 ${values.n} 格。她现在在教室的什么方向？`, answer: route[2], explanation: `${route[0]}和${route[1]}合起来是${route[2]}。` };
  }
  if (family === "observe") {
    const cubes = values.n + 2;
    return pickScene([
      () => ({ question: `用 ${cubes} 个同样的小正方体摆成一排。从前面看，能看到几个小正方形？`, answer: `${cubes} 个`, explanation: "一排小正方体从前面看，每个小正方体露出一个正面。" }),
      () => ({ question: `用 ${cubes} 个同样的小正方体摆成一列。从上面看，能看到几个小正方形？`, answer: `${cubes} 个`, explanation: "摆成一列时，从上面能看到每个小正方体的上面。" }),
      () => ({ question: `把 ${cubes} 个小正方体上下摞成一摞。从前面看，能看到几个小正方形？`, answer: `1 个`, explanation: "上下摞成一摞，从前面只看到最前面的一个正面。" }),
      () => ({ question: `用 ${cubes} 个小正方体摆成一个横排。从右面看，能看到几个小正方形？`, answer: `1 个`, explanation: "横排从右面看，只看到最右边一个正面。" }),
      () => ({ question: `把 ${cubes} 个小正方体摆成前后相连的一排。从上面看，能看到几个小正方形？`, answer: `${cubes} 个`, explanation: "从上面看，每个小正方体都有一个上面可见。" }),
      () => ({ question: `用 ${cubes} 个小正方体摆成左右相连的一排。从左面看，能看到几个小正方形？`, answer: `1 个`, explanation: "从左面看，只看到最左边一个侧面。" }),
      () => ({ question: `把 ${cubes} 个小正方体分成两层，上层 1 个，下层 ${cubes - 1} 个。从前面看，至少能看到几个小正方形？`, answer: `${cubes} 个`, explanation: "上下两层都露出正面时，把可见正面相加。" }),
      () => ({ question: `桌上有 ${cubes} 个小正方体排成一行。换到右面观察，最少能看到几个正方形？`, answer: `1 个`, explanation: "一行物体从端面看，只看到一个正方形。" }),
      () => ({ question: `用 ${cubes} 个小正方体摆成一条直线。从前面和从上面看到的小正方形个数一样吗？`, answer: "一样", explanation: "摆成一排且没有重叠时，前面和上面都能看到每个小正方体。" }),
      () => ({ question: `如果 ${cubes} 个小正方体摞成一列，从上面看能看到几个小正方形？`, answer: `1 个`, explanation: "上下摞在一起，从上面只看到最上面的一个面。" })
    ], sceneIndex);
  }
  if (family === "data") {
    const a = values.addend1 % 30 + 10;
    const b = values.addend2 % 30 + 10;
    return pickScene([
      () => ({ question: `三年级一班喜欢足球的有 ${a} 人，喜欢篮球的有 ${b} 人。喜欢这两项运动的一共有多少人？`, answer: `${a + b} 人`, explanation: "求两部分合起来，用加法计算。" }),
      () => ({ question: `图书角借出故事书 ${a} 本，科技书 ${b} 本。这两类书一共借出多少本？`, answer: `${a + b} 本`, explanation: "把两类数量相加。" }),
      () => ({ question: `兴趣小组调查水果喜好，喜欢苹果的有 ${a} 人，喜欢香蕉的有 ${b} 人。两组一共有多少人？`, answer: `${a + b} 人`, explanation: "求合计，用加法。" }),
      () => ({ question: `班级统计中，参加跳绳的有 ${a} 人，参加跑步的有 ${b} 人。两项活动共有多少人次？`, answer: `${a + b} 人次`, explanation: "统计两项总数，用加法。" })
    ], sceneIndex);
  }
  if (family === "multiply") {
    return pickScene([
      () => ({ question: `每盒有 ${values.m} 支铅笔，${values.n} 盒一共有多少支？`, answer: `${values.m * values.n} 支`, explanation: "求几个相同加数的和，用乘法计算。" }),
      () => ({ question: `每排有 ${values.m} 个座位，排了 ${values.n} 排。一共有多少个座位？`, answer: `${values.m * values.n} 个`, explanation: "每排数量相同，用乘法。" }),
      () => ({ question: `每盒彩笔有 ${values.m} 支，老师买了 ${values.n} 盒。一共有多少支彩笔？`, answer: `${values.m * values.n} 支`, explanation: "求几个几，用乘法。" }),
      () => ({ question: `每个小组做 ${values.m} 张贺卡，${values.n} 个小组一共做多少张？`, answer: `${values.m * values.n} 张`, explanation: "每组数量相同，用乘法计算。" }),
      () => ({ question: `花坛里每行种 ${values.m} 棵花，种了 ${values.n} 行。一共种了多少棵？`, answer: `${values.m * values.n} 棵`, explanation: "行数和每行棵数相乘。" }),
      () => ({ question: `每页贴 ${values.m} 张照片，贴了 ${values.n} 页。一共贴了多少张照片？`, answer: `${values.m * values.n} 张`, explanation: "每页张数相同，用乘法。" }),
      () => ({ question: `每袋有 ${values.m} 个橘子，买了 ${values.n} 袋。一共有多少个橘子？`, answer: `${values.m * values.n} 个`, explanation: "求几个相同袋数的总量，用乘法。" }),
      () => ({ question: `每辆玩具车有 ${values.m} 个轮子，${values.n} 辆玩具车一共有多少个轮子？`, answer: `${values.m * values.n} 个`, explanation: "每辆数量相同，用乘法。" }),
      () => ({ question: `每层书架放 ${values.m} 本书，放了 ${values.n} 层。一共放了多少本书？`, answer: `${values.m * values.n} 本`, explanation: "层数和每层本数相乘。" }),
      () => ({ question: `每个盘子放 ${values.m} 个点心，${values.n} 个盘子一共放多少个点心？`, answer: `${values.m * values.n} 个`, explanation: "求几个几，用乘法。" })
    ], sceneIndex);
  }
  return pickScene([
    () => ({ question: `图书角原来有 ${values.addend1} 本书，又买来 ${values.addend2} 本。现在一共有多少本书？`, answer: `${values.addend1 + values.addend2} 本`, explanation: "求总数，用加法计算。" }),
    () => ({ question: `学校合唱队有 ${values.addend1 % 80 + 20} 人，舞蹈队有 ${values.addend2 % 70 + 15} 人。两个队一共有多少人？`, answer: `${values.addend1 % 80 + 20 + (values.addend2 % 70 + 15)} 人`, explanation: "求两个队合计人数，用加法。" }),
    () => ({ question: `仓库上午运来 ${values.addend1} 个足球，下午又运来 ${values.addend2} 个。一共运来多少个足球？`, answer: `${values.addend1 + values.addend2} 个`, explanation: "两次运来的数量合起来，用加法。" }),
    () => ({ question: `书法社团收集了 ${values.addend1 % 90 + 30} 张作品，美术社团收集了 ${values.addend2 % 90 + 25} 张作品。两个社团共收集多少张？`, answer: `${values.addend1 % 90 + 30 + (values.addend2 % 90 + 25)} 张`, explanation: "求合计，用加法。" })
  ], sceneIndex);
}

function sampleSolidShapeQuestion(type, values) {
  const sceneIndex = values.idSeed || values.m + values.n;
  const fillQuestions = [
    () => ({ question: "魔方每个面都是正方形，它的形状是____。", answer: "正方体", explanation: "正方体有 6 个同样大的正方形面。" }),
    () => ({ question: "足球能在地上滚来滚去，它的形状最接近____。", answer: "球", explanation: "球没有平平的面，容易滚动。" }),
    () => ({ question: "牙膏盒像一个长长的盒子，它的形状最接近____。", answer: "长方体", explanation: "长方体有平平的面，整体像长盒子。" }),
    () => ({ question: "易拉罐上下面是圆圆的，侧面弯弯的，它的形状是____。", answer: "圆柱", explanation: "圆柱有两个圆形底面，侧面是弯的。" }),
    () => ({ question: "把积木按形状分类，骰子应放在____这一类。", answer: "正方体", explanation: "骰子通常 6 个面一样大，是正方体。" }),
    () => ({ question: "粉笔盒、书盒、牛奶盒这类物品，多数可以看作____。", answer: "长方体", explanation: "这些物品一般像长长方方的盒子。" }),
    () => ({ question: "乒乓球、玻璃珠、弹力球可以分为____这一类。", answer: "球", explanation: "它们都圆圆的，容易滚动。" }),
    () => ({ question: "茶叶罐和水杯的形状常常接近____。", answer: "圆柱", explanation: "它们通常有圆形的底面和弯曲的侧面。" }),
    () => ({ question: "既能平放，也能滚动的立体图形是____。", answer: "圆柱", explanation: "圆柱有平平的圆面，也有弯曲的侧面。" }),
    () => ({ question: "没有平平的面，从哪边看都圆圆的图形是____。", answer: "球", explanation: "球的表面是弯曲的，没有平面。" }),
    () => ({ question: "药盒有长长方方的平面，放在桌上不容易滚，它最接近____。", answer: "长方体", explanation: "药盒像长方体，有平平的面。" }),
    () => ({ question: "正方体积木每个面都是一样大的____形。", answer: "正方形", explanation: "正方体的每个面都是正方形。" }),
    () => ({ question: "卷纸筒立起来像一个____。", answer: "圆柱", explanation: "卷纸筒有两个圆形底面。" }),
    () => ({ question: "橡皮一般有平平的面和直直的棱，形状接近____。", answer: "长方体", explanation: "橡皮常见形状像长方体。" }),
    () => ({ question: "把皮球放进箱子，它会滚动，因为它是____形。", answer: "球", explanation: "球容易向各个方向滚动。" }),
    () => ({ question: "小印章的上下面都是圆形，侧面是弯的，它像____。", answer: "圆柱", explanation: "圆柱有两个圆形底面。" }),
    () => ({ question: "同样大小的 6 个正方形面围成的立体图形是____。", answer: "正方体", explanation: "正方体有 6 个同样大的正方形面。" }),
    () => ({ question: "课本、文具盒、纸巾盒放在一起，可分为____这一类。", answer: "长方体", explanation: "这些物品都像长方体。" }),
    () => ({ question: "玻璃珠和乒乓球虽然大小不同，但形状都属于____。", answer: "球", explanation: "分类时看形状，不看大小。" }),
    () => ({ question: "铅笔筒能稳稳站着，也能横着滚动，它的形状接近____。", answer: "圆柱", explanation: "圆柱有平面和曲面。" }),
    () => ({ question: "搭高楼时，最适合放在最下面当底座的是哪种积木？____。", answer: "长方体", explanation: "长方体有平平的面，摆放更稳。" }),
    () => ({ question: "一个盒子长、宽、高不一定相等，它通常叫____。", answer: "长方体", explanation: "长方体的长、宽、高可以不一样。" }),
    () => ({ question: "一个积木上下、前后、左右看起来都一样方正，它可能是____。", answer: "正方体", explanation: "正方体各个方向都很方正。" }),
    () => ({ question: "生活中，电池的形状常常接近____。", answer: "圆柱", explanation: "电池通常有两个圆形底面。" }),
    () => ({ question: "用手摸一摸，表面一直弯弯的、没有角的物体可能是____。", answer: "球", explanation: "球没有棱和角。" }),
    () => ({ question: "把魔方、骰子、正方体积木放在一起，是因为它们都像____。", answer: "正方体", explanation: "这些物品都具有正方体的外形特点。" })
  ];
  const choiceQuestions = [
    () => ({ question: "下面哪个物品最接近正方体？", answer: "A. 魔方", options: ["A. 魔方", "B. 铅笔", "C. 足球", "D. 易拉罐"], explanation: "魔方像正方体。" }),
    () => ({ question: "下面哪个物品最接近圆柱？", answer: "B. 易拉罐", options: ["A. 魔方", "B. 易拉罐", "C. 皮球", "D. 三角尺"], explanation: "易拉罐有两个圆形底面。" }),
    () => ({ question: "下面哪个物品最接近长方体？", answer: "C. 牙膏盒", options: ["A. 乒乓球", "B. 水杯", "C. 牙膏盒", "D. 玻璃珠"], explanation: "牙膏盒像长方体。" }),
    () => ({ question: "下面哪一组都容易滚动？", answer: "D. 球和圆柱", options: ["A. 长方体和正方体", "B. 正方体和书本", "C. 长方体和魔方", "D. 球和圆柱"], explanation: "球和圆柱都有弯曲的面，容易滚动。" }),
    () => ({ question: "把物品按形状分类，篮球应放在哪一类？", answer: "A. 球", options: ["A. 球", "B. 圆柱", "C. 长方体", "D. 正方体"], explanation: "篮球是球形。" })
  ];
  const judgeQuestions = [
    () => ({ question: "判断：足球的形状是长方体。", answer: "错误", explanation: "足球是球，不是长方体。" }),
    () => ({ question: "判断：魔方可以看作正方体。", answer: "正确", explanation: "魔方的形状接近正方体。" }),
    () => ({ question: "判断：圆柱只有平平的面，不能滚动。", answer: "错误", explanation: "圆柱有弯曲的侧面，可以滚动。" }),
    () => ({ question: "判断：书盒和牙膏盒都可以看作长方体。", answer: "正确", explanation: "它们都像长长方方的盒子。" }),
    () => ({ question: "判断：球没有平平的面。", answer: "正确", explanation: "球的表面是弯曲的。" })
  ];
  const applicationQuestions = [
    () => ({ question: "整理玩具时，小明把魔方、骰子放在一盒，把足球、玻璃珠放在另一盒。他是按什么分的？", answer: "按形状分类", explanation: "魔方和骰子像正方体，足球和玻璃珠像球。" }),
    () => ({ question: "搭积木时，想让底座放得稳，应先选球、圆柱、长方体中的哪一种？", answer: "长方体", explanation: "长方体有平平的面，放在下面更稳。" }),
    () => ({ question: "体育角有足球、篮球、魔方、易拉罐，哪些物品可以分到球这一类？", answer: "足球、篮球", explanation: "足球和篮球都是球形。" }),
    () => ({ question: "手工课要用一个能滚动、上下又是平面的物体印圆，选水杯、魔方、书盒哪个更合适？", answer: "水杯", explanation: "水杯形状接近圆柱，底面是圆形。" }),
    () => ({ question: "把牙膏盒、牛奶盒、皮球、茶叶罐分类，牙膏盒和牛奶盒属于哪一类？", answer: "长方体", explanation: "它们都像长方体。" })
  ];
  if (type.includes("选择")) return pickScene(choiceQuestions, sceneIndex);
  if (type.includes("判断")) return pickScene(judgeQuestions, sceneIndex);
  if (type.includes("应用") || type.includes("变式")) return pickScene(applicationQuestions, sceneIndex);
  return pickScene(fillQuestions, sceneIndex);
}

function pickScene(factories, index) {
  return factories[Math.abs(index) % factories.length]();
}

function genericTemplate(type) {
  if (type === "选择题") {
    return {
      question_type: "选择题",
      template: "选择：{m} × {n} 的结果是（ ）。",
      answer_rule: "选择正确的乘法结果。",
      difficulty: "基础"
    };
  }
  if (type === "判断题") {
    return {
      question_type: "判断题",
      template: "判断：{m} × {n} = {product}。",
      answer_rule: "正确",
      difficulty: "基础"
    };
  }
  if (type === "应用题") {
    return {
      question_type: "应用题",
      template: "小明有 {total} 个物品，平均分给 {n} 个同学，每人可以分到多少个？",
      answer_rule: "用除法解决平均分问题。",
      difficulty: "基础"
    };
  }
  if (type === "计算题") {
    return {
      question_type: "计算题",
      template: "计算：{m} × {n} = ____",
      answer_rule: "用乘法口诀计算。",
      difficulty: "基础"
    };
  }
  return {
    question_type: type || "填空题",
    template: "根据题意填空：{m} + {n} = ____",
    answer_rule: "把两个数相加。",
    difficulty: "基础"
  };
}

function buildOptions(answer, id) {
  const right = String(answer || "").trim();
  if (["A", "B", "C", "D"].includes(right)) return ["A. 正确答案", "B. 干扰选项", "C. 干扰选项", "D. 干扰选项"];
  const number = Number(right.replace(/[^\d.-]/g, ""));
  if (Number.isFinite(number)) {
    const options = [];
    for (const item of [number, number + id + 1, Math.max(0, number - id), number + 2, number + 3, number + 4]) {
      const text = Number(item.toFixed(2)).toString();
      if (!options.includes(text)) options.push(text);
      if (options.length >= 4) break;
    }
    return options.map((item, index) => `${["A", "B", "C", "D"][index]}. ${item}`);
  }
  return [`A. ${right || "正确"}`, "B. 错误", "C. 无法确定", "D. 条件不足"];
}

function inferKnowledgePoint(question, contentPackage) {
  if (question.includes("验算") || question.includes("判断")) return findKnowledgePoint(contentPackage, "小数加减法验算");
  if (question.includes("花") || question.includes("米") || question.includes("千克") || question.includes("还剩")) return findKnowledgePoint(contentPackage, "小数加减法解决实际问题");
  return findKnowledgePoint(contentPackage, "小数位数不同的小数加减法");
}

function buildOriginalAnalysis(originalQuestion, wrongAnswer) {
  const wrong = wrongAnswer ? `学生答案是 ${wrongAnswer}。` : "";
  return `${wrong}这类题需要先把小数点对齐，相同数位再加减；位数不同时可以在末尾补 0 后计算。`;
}

function numberSet(id) {
  const base = id + 3;
  const m = (id % 5) + 3;
  const n = (id % 4) + 2;
  const product = m * n;
  const divisor = (id % 4) + 3;
  const quotient = (id % 5) + 4;
  const remainder = id % divisor;
  const dividend = divisor * quotient + remainder;
  const thousands = (id % 7) + 1;
  const hundreds = (id * 2) % 10;
  const tens = (id * 3) % 10;
  const ones = (id * 4 + 1) % 10;
  const num4 = thousands * 1000 + hundreds * 100 + tens * 10 + ones;
  const num4b = num4 + ((id % 2 === 0 ? -1 : 1) * ((id % 6) + 12));
  const addend1 = 230 + id * 17;
  const addend2 = 140 + id * 23;
  const carry1 = 368 + id * 11;
  const carry2 = 257 + id * 13;
  const subtrahend = 120 + id * 9;
  const minuend = subtrahend + 260 + id * 7;
  const borrow2 = 168 + id * 8;
  const borrow1 = borrow2 + 501 + id * 6;
  const diff = minuend - subtrahend;
  return {
    a: (base + 0.5).toFixed(1),
    a2: (base + 0.25).toFixed(2),
    b: (id + 1.8).toFixed(1),
    b2: (id + 1.75).toFixed(2),
    c: (id + 0.6).toFixed(1),
    idSeed: id,
    hour: (id % 9) + 1,
    m,
    n,
    product,
    total: product * 2,
    divisor,
    quotient,
    remainder,
    dividend,
    thousands,
    hundreds,
    tens,
    ones,
    num4,
    num4b,
    addend1,
    addend2,
    carry1,
    carry2,
    subtrahend,
    minuend,
    borrow1,
    borrow2,
    diff
  };
}

function fillTemplate(template, values) {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
}

function calculateAnswer(question, rule, values) {
  if (question.includes("判断")) return rule.includes("错误") ? "错误" : "正确";
  if (question.includes("是否正确")) return rule;
  if (question.includes("几个？") && question.includes("还剩")) return `${values.quotient} 个，剩 ${values.remainder} 个`;
  if (question.includes("几袋？还剩几个")) return `${values.quotient} 袋，还剩 ${values.remainder} 个`;
  if (question.includes("至少需要几条船")) return `${values.quotient + (values.remainder ? 1 : 0)} 条`;
  if (question.includes("每人分几颗")) return `${Math.floor(values.total / values.n)} 颗`;
  if (question.includes("可以扎几束")) return `${Math.floor(values.total / values.m)} 束`;
  if (question.includes("每个班分到几个")) return `${Math.floor((values.total - values.remainder) / values.n)} 个`;
  if (question.includes("结束时间比开始时间晚了多少分钟")) return `${values.m} 分钟`;
  if (question.includes("一共有多少支")) return `${values.m * values.n} 支`;
  if (question.includes("写出一道除法算式")) return String(values.n);
  if (question.includes("现在有多少本")) return `${values.minuend - values.subtrahend + values.m} 本`;
  if (question.includes("还剩多少张")) return `${values.m + values.n - values.divisor} 张`;
  if (question.includes("还剩几个任务")) return `${values.total - values.m - values.m * values.n} 个`;
  if (question.includes("由 ____ 个千")) return `${values.thousands}，${values.hundreds}，${values.tens}，${values.ones}`;
  if (question.includes("组成的数")) return String(values.num4);
  if (question.includes("接近整百数")) return String(Math.round(values.num4 / 100) * 100);
  if (question.includes("填“>”“<”")) return values.num4 > values.num4b ? ">" : values.num4 < values.num4b ? "<" : "=";
  if (question.includes("÷") && question.includes("……")) return `${values.quotient} …… ${values.remainder}`;
  if (question.includes("×")) return format(firstNumber(question) * secondNumber(question));
  if (question.includes("÷")) return format(firstNumber(question) / secondNumber(question));
  if (question.includes("一共") && question.includes("米")) return `${format(firstNumber(question) + secondNumber(question))} 米`;
  if (question.includes("一共")) return `${format(firstNumber(question) + secondNumber(question))} 元`;
  if (question.includes("现在长")) return `${format(Number(values.a) - Number(values.b) + Number(values.c))} 米`;
  if (question.includes("+") || question.includes("-")) return formatArithmetic(question);
  return rule;
}

function buildParentTip(knowledgePoint) {
  if (knowledgePoint.subject === "数学" && knowledgePoint.grade === "二年级") {
    return "让孩子先说清题目里的数量关系，再列式计算，最后检查单位和答语。";
  }
  return "让孩子先复述题目条件和问题，再写出关键步骤，最后检查答案是否符合题意。";
}

function firstNumber(text) {
  return Number(text.match(/\d+(?:\.\d+)?/)?.[0] || 0);
}

function secondNumber(text) {
  return Number(text.match(/\d+(?:\.\d+)?/g)?.[1] || 0);
}

function formatArithmetic(text) {
  const expr = text.match(/(\d+(?:\.\d+)?)(?:\s*)([+\-])(?:\s*)(\d+(?:\.\d+)?)(?:\s*([+\-])\s*(\d+(?:\.\d+)?))?/) || [];
  const first = Number(expr[1] || 0);
  const second = Number(expr[3] || 0);
  let value = expr[2] === "-" ? first - second : first + second;
  if (expr[4] && expr[5]) value = expr[4] === "-" ? value - Number(expr[5]) : value + Number(expr[5]);
  return format(value);
}

function format(value) {
  return Number(value.toFixed(2)).toString();
}

function pick(list, index) {
  return list[index % list.length];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || min));
}
