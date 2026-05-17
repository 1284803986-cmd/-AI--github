export async function generateWithAI(prompt) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "你是小学教育练习题生成助手。只返回合法 JSON，不要 Markdown，不要解释 JSON 之外的内容。题目必须适合小学阶段，避免收集学生隐私。"
      },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" },
    temperature: 0.4
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API 请求失败：${response.status}`);
  }

  const completion = await response.json();

  const content = completion.choices[0]?.message?.content || "{}";
  return JSON.parse(content);
}
