export function textbookPrompt(input, context) {
  return `请基于固定内容配置生成小学数学练习题。不要扩展到其他年级、科目或单元，不要引用教材原文，不要使用收费题库内容。

内容配置：
${JSON.stringify({ scope: context.contentPackage.scope, knowledge_point: context.knowledgePoint, templates: context.templates }, null, 2)}

用户要求：题目数量 ${input.count}，题型 ${input.type}，难度 ${input.difficulty}。

只返回合法 JSON。每道题必须包含 id, question, answer, explanation, knowledge_point, difficulty, question_type, type, common_mistake, parent_tip。`;
}

export function wrongQuestionPrompt(input, context) {
  return `请基于固定内容包分析错题，并生成错题同类题。不要做 OCR，不要扩展到其他学科或年级。

内容配置：
${JSON.stringify({ scope: context.contentPackage.scope, knowledge_points: context.contentPackage.knowledge_points, templates: context.contentPackage.templates }, null, 2)}

原题：${input.originalQuestion}
学生错误答案：${input.wrongAnswer || "未提供"}

只返回合法 JSON。similar_questions 必须 5 道，variation_questions 必须 3 道。每道题必须包含 id, question, answer, explanation, knowledge_point, difficulty, question_type, type, common_mistake, parent_tip。`;
}

export function paperPrompt(input, context) {
  return `请基于固定内容包生成一份小学数学练习卷或家庭作业。不要扩展到其他年级、科目或单元。

内容配置：
${JSON.stringify({ scope: context.contentPackage.scope, knowledge_points: context.contentPackage.knowledge_points, templates: context.contentPackage.templates }, null, 2)}

用户要求：题目数量 ${input.count}，总分 ${input.totalScore}，难度比例 ${input.difficultyRatio}。

只返回合法 JSON。每道题必须包含 id, score, question, answer, explanation, knowledge_point, difficulty, question_type, type, common_mistake, parent_tip。`;
}
