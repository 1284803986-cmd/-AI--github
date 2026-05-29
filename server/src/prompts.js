export function textbookPrompt(input, context) {
  return `请基于固定内容配置生成小学数学原创练习题。不要扩展到其他年级、科目或单元，不要引用教材原文，不要复刻教材课后题，不要使用收费题库内容。

内容配置：
${JSON.stringify({ scope: context.contentPackage.scope, usage_policy: context.contentPackage.usage_policy, units: context.contentPackage.units, knowledge_point: context.knowledgePoint, templates: context.templates }, null, 2)}

用户要求：题目数量 ${input.count}，题型 ${input.type}，难度 ${input.difficulty}。

只返回合法 JSON。每道题必须包含 id, question, answer, explanation, knowledge_point, difficulty, question_type, type, common_mistake, parent_tip。题目必须是同知识点原创题。
同一批题不能只是替换数字：每道题的生活场景、对象、问法或解题步骤至少有一项明显不同；应用题和变式题必须尽量使用不同场景。`;
}

export function wrongQuestionPrompt(input, context) {
  return `请基于固定内容包分析错题，并生成错题同类原创题。不要做 OCR，不要扩展到其他学科或年级，不要复刻教材课后题。

内容配置：
${JSON.stringify({ scope: context.contentPackage.scope, usage_policy: context.contentPackage.usage_policy, knowledge_points: context.contentPackage.knowledge_points, templates: context.contentPackage.templates }, null, 2)}

原题：${input.originalQuestion}
学生错误答案：${input.wrongAnswer || "未提供"}

只返回合法 JSON。similar_questions 必须 5 道，variation_questions 必须 3 道。每道题必须包含 id, question, answer, explanation, knowledge_point, difficulty, question_type, type, common_mistake, parent_tip。
同类题不能只是替换数字：场景、对象、问法或解题步骤要有变化，避免连续出现同一题干结构。`;
}

export function paperPrompt(input, context) {
  return `请基于固定内容包生成一份小学数学原创练习卷或家庭作业。不要扩展到其他年级、科目或单元，不要复刻教材课后题。

内容配置：
${JSON.stringify({ scope: context.contentPackage.scope, usage_policy: context.contentPackage.usage_policy, units: context.contentPackage.units, knowledge_points: context.contentPackage.knowledge_points, templates: context.contentPackage.templates }, null, 2)}

用户要求：题目数量 ${input.count}，总分 ${input.totalScore}，难度比例 ${input.difficultyRatio}。

只返回合法 JSON。每道题必须包含 id, score, question, answer, explanation, knowledge_point, difficulty, question_type, type, common_mistake, parent_tip。
整张卷子要避免题干重复；同一知识点下的题目也要变化场景、对象、问法或步骤，不能只换数字。`;
}
