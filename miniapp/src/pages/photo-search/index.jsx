import React, { useState } from "react";
import Taro from "@tarojs/taro";
import { Button, Image, Text, Textarea, View } from "@tarojs/components";
import { BackButton } from "../../components/navigation";
import "../../styles/common.scss";
import "./index.scss";

export default function PhotoSearchPage() {
  const [imagePath, setImagePath] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [similarQuestions, setSimilarQuestions] = useState([]);

  async function choosePhoto() {
    try {
      const result = await Taro.chooseImage({
        count: 1,
        sourceType: ["camera", "album"],
        sizeType: ["compressed"]
      });
      const nextPath = result?.tempFilePaths?.[0] || "";
      setImagePath(nextPath);
      setAnalysis({
        title: "已上传题目图片",
        answer: "当前版本还没有接入拍照识别，请先在下方手动输入题目文字。",
        steps: ["后续接入 OCR 后，这里会自动识别图片里的题目。"]
      });
    } catch (error) {
      Taro.showToast({ title: "没有选择图片", icon: "none" });
    }
  }

  function analyzeQuestion() {
    const text = questionText.trim();
    if (!text && !imagePath) {
      Taro.showToast({ title: "请先拍照或输入题目", icon: "none" });
      return;
    }
    if (!text) {
      Taro.showToast({ title: "请先手动输入题目文字", icon: "none" });
      return;
    }
    setAnalysis({
      title: "模拟解析结果",
      answer: "先读清题目条件，再找要求的问题，最后列式或分步回答。",
      steps: [
        "第一步：圈出题目里的数字和关键词。",
        "第二步：判断是加、减、乘、除，还是时间、单位类问题。",
        "第三步：写出算式，算完后检查单位和答案。"
      ]
    });
    setSimilarQuestions([]);
  }

  function generateSimilar() {
    if (!analysis) {
      Taro.showToast({ title: "请先查看解析", icon: "none" });
      return;
    }
    setSimilarQuestions([
      "同类题 1：把题目里的数字换一组，再按同样方法列式解答。",
      "同类题 2：把问题反过来问，检查自己是否真的理解。"
    ]);
  }

  return (
    <View className="page photo-page">
      <BackButton />
      <View className="hero photo-hero">
        <Text className="hero-title">拍照搜题</Text>
        <Text className="hero-subtitle">先做基础流程：拍照上传、手动输入、查看解析、生成同类题。</Text>
      </View>

      <View className="card">
        <Text className="section-title">上传题目</Text>
        <Text className="section-desc">可以拍照，也可以从相册选图。第一版先不自动识别图片文字。</Text>
        <Button className="primary-button full-button" onClick={choosePhoto}>拍照或上传图片</Button>
        {imagePath ? (
          <Image className="photo-preview" src={imagePath} mode="aspectFill" />
        ) : null}
      </View>

      <View className="card">
        <Text className="section-title">手动输入题目</Text>
        <Textarea
          className="question-input"
          value={questionText}
          maxlength={500}
          placeholder="把题目文字输入到这里，例如：小明有 12 个苹果，分给 3 个同学，每人几个？"
          onInput={(event) => setQuestionText(event.detail.value)}
        />
        <Button className="primary-button full-button" onClick={analyzeQuestion}>查看解析</Button>
      </View>

      {analysis ? (
        <View className="card">
          <Text className="section-title">{analysis.title}</Text>
          <Text className="analysis-answer">{analysis.answer}</Text>
          <View className="analysis-steps">
            {analysis.steps.map((step) => (
              <Text key={step} className="analysis-step">{step}</Text>
            ))}
          </View>
          <Button className="secondary-button full-button" onClick={generateSimilar}>生成同类题</Button>
        </View>
      ) : null}

      {similarQuestions.length ? (
        <View className="card">
          <Text className="section-title">同类题</Text>
          {similarQuestions.map((item) => (
            <Text key={item} className="similar-question">{item}</Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
