import fs from "node:fs";

const DIFFICULTIES = ["基础", "提高", "拔高"];
const QUESTION_TYPES = ["计算题", "填空题", "选择题", "应用题", "综合题"];

const books = [
  book("g1_math_up_rj_2026", "一年级", "上册", "content/packages/g1_math_up_rj_2026.json", [
    unit("math_game", "数学游戏", ["在校园里找一找", "在操场上玩一玩", "在教室里认一认", "在教室里玩一玩"]),
    unit("numbers_1_5", "5以内数的认识和加、减法", ["1-5的认识", "比大小", "第几", "分与合", "加法的认识", "减法的认识", "0的认识和加减法"]),
    unit("numbers_6_10", "6-10的认识和加、减法", ["6-9的认识", "10的认识", "6、7的加减法", "8、9的加减法", "10的加减法", "连加连减", "加减混合"]),
    unit("solid_shapes", "认识立体图形", ["认识立体图形", "立体图形拼搭"]),
    unit("numbers_11_20", "11-20的认识", ["10的再认识", "11-20的认识", "简单加减法", "解决问题"]),
    unit("carry_add_20", "20以内的进位加法", ["9加几", "8、7、6加几", "5、4、3、2加几", "解决进位加法问题"]),
    unit("review", "总复习", ["数与运算整理", "数量关系整理", "图形的认识整理", "应用提升"])
  ]),
  book("g1_math_down_rj_2026", "一年级", "下册", "content/packages/g1_math_down_rj_2026.json", [
    unit("plane_shapes", "认识平面图形", ["认识平面图形", "平面图形的拼组", "七巧板"]),
    unit("sub_20", "20以内的退位减法", ["十几减9", "十几减8、7、6", "十几减5、4、3、2", "退位减法解决问题"]),
    unit("numbers_100", "100以内数的认识", ["数数和数的组成", "认识100", "数的顺序", "比较大小", "简单加减法"]),
    unit("oral_add_sub_100", "100以内的口算加、减法", ["口算加法", "口算减法", "两位数加一位数", "两位数减一位数"]),
    unit("written_add_sub_100", "100以内的笔算加、减法", ["不进位加法", "进位加法", "退位减法"]),
    unit("add_sub_relation", "数量间的加减关系", ["求总数", "求剩余", "比多比少", "多步加减问题"])
  ]),
  book("g2_math_up_rj_2026", "二年级", "上册", "content/packages/g2_math_up_rj_2026.json", [
    unit("classification", "分类与整理", ["按一个标准分类", "按不同标准分类", "多标准分类"]),
    unit("mul_1_6", "1-6的表内乘法", ["乘法的初步认识", "5的乘法口诀", "2、3、4的乘法口诀", "乘加乘减", "6的乘法口诀", "乘法解决问题"]),
    unit("div_1_6", "1-6的表内除法", ["平均分", "认识除法", "除法各部分名称", "用2-6的乘法口诀求商", "除法解决问题"]),
    unit("cm_m", "厘米和米", ["认识厘米", "认识米", "认识线段", "选择合适的长度单位"]),
    unit("mul_div_7_9", "7-9的表内乘、除法", ["7的乘法口诀", "8的乘法口诀", "9的乘法口诀", "用7和8的口诀求商", "用9的口诀求商", "乘除法解决问题"]),
    unit("campus_guide", "校园小导游", ["方向路线描述"]),
    unit("body_measure", "身体上的尺子", ["身体尺估测"])
  ]),
  book("g2_math_down_rj_2026", "二年级", "下册", "content/packages/g2_math_down_rj_2026.json", [
    unit("division_remainder", "有余数的除法", ["认识有余数的除法", "余数和除数的关系", "竖式计算有余数的除法", "有余数除法的试商", "有余数除法的实际应用", "周期问题"]),
    unit("times_relation", "数量间的倍数关系", ["倍的认识", "求一个数是另一个数的几倍", "求一个数的几倍是多少", "已知几倍是多少求这个数", "连续两问问题", "补充条件和问题"]),
    unit("numbers_10000", "万以内数的认识", ["千以内数的认识及读写", "认识计数单位千", "万以内数的组成", "算盘表示数", "认识计数单位万", "万以内数的读法", "万以内数的写法", "万以内数的大小比较", "认识近似数", "简单加减法"]),
    unit("add_sub_10000", "万以内的加法和减法", ["一次进位加法", "连续进位加法", "退位减法", "被减数中间有0的减法", "加减法各部分间的关系", "估算解决问题", "数独游戏"])
  ]),
  book("g2_math_down_2025", "二年级", "下册", "content/packages/g2_math_down_2025.json", [
    unit("division_remainder", "有余数的除法", ["认识有余数的除法", "余数和除数的关系", "竖式计算有余数的除法", "有余数除法的试商", "有余数除法的实际应用", "周期问题"]),
    unit("times_relation", "数量间的倍数关系", ["倍的认识", "求一个数是另一个数的几倍", "求一个数的几倍是多少", "已知几倍是多少求这个数", "连续两问问题", "补充条件和问题"]),
    unit("numbers_10000", "万以内数的认识", ["千以内数的认识及读写", "认识计数单位千", "万以内数的组成", "算盘表示数", "认识计数单位万", "万以内数的读法", "万以内数的写法", "万以内数的大小比较", "认识近似数", "简单加减法"]),
    unit("add_sub_10000", "万以内的加法和减法", ["一次进位加法", "连续进位加法", "退位减法", "被减数中间有0的减法", "加减法各部分间的关系", "估算解决问题", "数独游戏"])
  ]),
  book("g3_math_up_rj_2026", "三年级", "上册", "content/packages/g3_math_up_rj_2026.json", [
    unit("observe_objects", "观察物体", ["不同方向看同一物体", "观察简单立体图形", "根据视图推测立体图形", "立体图形展开和折叠"]),
    unit("mixed_operations", "混合运算", ["同级混合运算", "两级混合运算", "含括号混合运算", "用混合运算解决问题"]),
    unit("measure", "测量", ["毫米分米的认识", "千米的认识", "吨的认识", "单位换算"]),
    unit("multi_digit_mul", "多位数乘一位数", ["口算乘法", "笔算乘法", "连续进位乘法", "乘法估算", "解决问题"]),
    unit("time", "时、分、秒", ["秒的认识", "时间单位换算", "经过时间"]),
    unit("rectangle_square", "长方形和正方形", ["四边形", "周长", "长方形和正方形周长"]),
    unit("fraction_intro", "分数的初步认识", ["几分之一", "几分之几", "简单分数加减法"]),
    unit("math_wide_matching", "数学广角--搭配问题", ["排列", "组合", "搭配应用"])
  ]),
  book("g3_math_down_rj_2026", "三年级", "下册", "content/packages/g3_math_down_rj_2026.json", [
    unit("motion", "生活中的运动现象", ["轴对称图形", "平移和旋转", "剪纸问题"]),
    unit("division_one_digit", "除数是一位数的除法", ["口算除法", "除法估算", "一位数除两位数三位数", "有余数除法", "商中间有0", "商末尾有0", "连乘连除问题", "归一归总问题"]),
    unit("perimeter", "长方形和正方形的周长", ["认识多边形", "认识周长", "长方形和正方形周长", "拼图游戏"]),
    unit("area", "面积", ["认识面积和面积单位", "常见面积单位", "长方形和正方形面积", "面积单位进率"]),
    unit("statistics_table", "复式统计表", ["调查收集数据", "读取统计表", "比较与分析"]),
    unit("decimal_intro", "小数的初步认识", ["认识小数", "小数大小比较", "简单小数加减法"])
  ]),
  book("g4_math_up_rj_2026", "四年级", "上册", "content/packages/g4_math_up_rj_2026.json", [
    unit("big_numbers", "大数的认识", ["亿以内数的认识", "大数读写", "数位顺序表", "改写和近似数"]),
    unit("area_units", "公顷和平方千米", ["公顷", "平方千米", "面积单位换算"]),
    unit("angle_measure", "角的度量", ["线段直线射线", "角的认识", "量角和画角", "角的分类"]),
    unit("three_digit_mul", "三位数乘两位数", ["口算乘法", "笔算乘法", "积的变化规律", "速度时间路程"]),
    unit("parallel_trapezoid", "平行四边形和梯形", ["垂直与平行", "平行四边形", "梯形"]),
    unit("division_two_digit", "除数是两位数的除法", ["口算除法", "笔算除法", "商的变化规律"]),
    unit("bar_chart", "条形统计图", ["认识条形统计图", "一格表示多个单位"]),
    unit("optimization", "数学广角--优化", ["沏茶问题", "烙饼问题", "田忌赛马"])
  ]),
  book("g4_math_down_rj_2026", "四年级", "下册", "content/knowledge_points.json", [
    unit("four_operations", "四则运算", ["加减法的意义", "乘除法的意义", "含括号四则运算", "租船等优化问题"]),
    unit("observe_objects_2", "观察物体（二）", ["从不同位置观察", "根据视图搭物体"]),
    unit("operation_laws", "运算定律", ["加法运算律", "乘法运算律", "简便计算", "连减连除简算"]),
    unit("decimal_meaning", "小数的意义和性质", ["小数意义", "小数读写", "小数性质", "小数大小比较", "小数点移动", "小数近似数"]),
    unit("triangle", "三角形", ["三角形特性", "三角形分类", "三角形内角和"]),
    unit("decimal_add_sub", "小数的加法和减法", ["小数加法", "小数减法", "小数加减混合"]),
    unit("shape_motion_2", "图形的运动（二）", ["轴对称", "平移"]),
    unit("average_bar_chart", "平均数与条形统计图", ["平均数", "复式条形统计图"]),
    unit("chicken_rabbit", "数学广角--鸡兔同笼", ["鸡兔同笼"])
  ]),
  book("g5_math_up_rj_2026", "五年级", "上册", "content/packages/g5_math_up_rj_2026.json", [
    unit("decimal_mul", "小数乘法", ["小数乘整数", "小数乘小数", "积的近似数", "小数乘法应用"]),
    unit("position", "位置", ["用数对表示位置"]),
    unit("decimal_div", "小数除法", ["小数除以整数", "一个数除以小数", "商的近似数", "循环小数", "用计算器探索规律", "小数除法应用"]),
    unit("possibility", "可能性", ["事件可能性", "可能性大小"]),
    unit("equation", "简易方程", ["用字母表示数", "方程的意义", "等式性质", "解简易方程", "实际问题与方程"]),
    unit("polygon_area", "多边形的面积", ["平行四边形面积", "三角形面积", "梯形面积", "组合图形面积"]),
    unit("planting", "数学广角--植树问题", ["两端都栽", "两端不栽", "封闭路线植树"])
  ]),
  book("g5_math_down_rj_2026", "五年级", "下册", "content/packages/g5_math_down_rj_2026.json", [
    unit("observe_objects_3", "观察物体（三）", ["根据视图拼摆几何体"]),
    unit("factor_multiple", "因数与倍数", ["因数和倍数", "2、5、3的倍数特征", "质数和合数"]),
    unit("cuboid_cube", "长方体和正方体", ["长方体和正方体认识", "表面积", "体积和体积单位", "体积计算", "容积"]),
    unit("fraction_meaning", "分数的意义和性质", ["分数意义", "真分数和假分数", "分数基本性质", "约分", "通分", "分数和小数互化"]),
    unit("shape_motion_3", "图形的运动（三）", ["旋转", "平移和旋转应用"]),
    unit("fraction_add_sub", "分数的加法和减法", ["同分母分数加减法", "异分母分数加减法", "分数加减混合"]),
    unit("line_chart", "折线统计图", ["单式折线统计图", "复式折线统计图"]),
    unit("defective_item", "数学广角--找次品", ["天平找次品"])
  ]),
  book("g6_math_up_rj_2026", "六年级", "上册", "content/packages/g6_math_up_rj_2026.json", [
    unit("fraction_mul", "分数乘法", ["分数乘整数", "一个数乘分数", "分数乘分数", "分数混合运算", "分数乘法解决问题"]),
    unit("position_direction_2", "位置与方向（二）", ["用方向和距离确定位置", "描述路线图"]),
    unit("fraction_div", "分数除法", ["倒数的认识", "分数除以整数", "一个数除以分数", "分数混合运算", "列方程解决分数除法问题", "工程问题"]),
    unit("ratio", "比", ["比的意义", "比的基本性质", "化简比", "按比分配"]),
    unit("circle", "圆", ["圆的认识", "圆的周长", "圆的面积", "扇形"]),
    unit("percent_1", "百分数（一）", ["百分数认识", "百分率", "求一个数的百分之几", "百分数解决问题"]),
    unit("sector_chart", "扇形统计图", ["认识扇形统计图", "统计图选择"]),
    unit("number_shape", "数学广角--数与形", ["数形结合"])
  ]),
  book("g6_math_down_rj_2026", "六年级", "下册", "content/packages/g6_math_down_rj_2026.json", [
    unit("negative", "负数", ["负数的认识", "正负数表示意义"]),
    unit("percent_2", "百分数（二）", ["折扣", "成数", "税率", "利率"]),
    unit("cylinder_cone", "圆柱与圆锥", ["圆柱认识", "圆柱表面积", "圆柱体积", "圆锥认识", "圆锥体积"]),
    unit("proportion", "比例", ["比例的意义", "比例的基本性质", "解比例", "正比例", "反比例", "比例尺", "图形放大与缩小"]),
    unit("pigeonhole", "数学广角--鸽巢问题", ["鸽巢问题"]),
    unit("review", "整理和复习", ["数与代数", "图形与几何", "统计与概率", "综合与实践"])
  ])
];

for (const spec of books) {
  const existing = fs.existsSync(spec.path) ? JSON.parse(fs.readFileSync(spec.path, "utf8")) : {};
  const pkg = {
    ...existing,
    package_id: spec.packageId,
    package_name: `${spec.grade}数学${spec.semester}人教版内容包`,
    version: "2026-05-29",
    usage_policy: {
      mode: "source_question_extract_only",
      copyright_note: "根据用户提供的本地教材资料整理单元、课时、知识点，并接入本地摘录题库。"
    },
    scope: {
      grade: spec.grade,
      semester: spec.semester,
      subject: "数学",
      textbook: "人教版",
      unit: "全册"
    },
    units: spec.units.map((u) => ({
      id: u.id,
      name: u.name,
      lessons: u.lessons.map((lesson, index) => ({
        id: `${u.id}_lesson_${index + 1}`,
        name: lesson,
        knowledge_point_ids: [`${u.id}_${index + 1}`]
      }))
    })),
    knowledge_points: spec.units.flatMap((u) => u.lessons.map((lesson, index) => ({
      id: `${u.id}_${index + 1}`,
      unit_id: u.id,
      lesson_id: `${u.id}_lesson_${index + 1}`,
      grade: spec.grade,
      semester: spec.semester,
      subject: "数学",
      textbook: "人教版",
      unit: u.name,
      name: lesson,
      description: `${spec.grade}${spec.semester}人教版数学“${u.name}”中“${lesson}”相关练习。`,
      common_mistakes: [
        "没有看清题目要求",
        "计算后没有检查结果是否合理",
        "单位、格式或关键条件遗漏"
      ],
      recommended_question_types: QUESTION_TYPES,
      difficulty_levels: DIFFICULTIES
    })))
  };
  fs.writeFileSync(spec.path, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}

function book(packageId, grade, semester, path, units) {
  return { packageId, grade, semester, path, units };
}

function unit(id, name, lessons) {
  return { id, name, lessons };
}
