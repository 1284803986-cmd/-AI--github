import React from "react";
import Taro from "@tarojs/taro";
import { Button, Input, Picker, Text, Textarea, View } from "@tarojs/components";

export function SelectField({ label, value, options, onChange }) {
  const index = Math.max(0, options.indexOf(value));
  return (
    <View className="field">
      <Text className="field-label">{label}</Text>
      <Picker mode="selector" range={options} value={index} onChange={(event) => onChange(options[event.detail.value])}>
        <View className="picker">{value}</View>
      </Picker>
    </View>
  );
}

export function InputField({ label, value, onInput, type = "text", placeholder = "" }) {
  return (
    <View className="field">
      <Text className="field-label">{label}</Text>
      <Input className="input" type={type} value={String(value ?? "")} placeholder={placeholder} onInput={(event) => onInput(event.detail.value)} />
    </View>
  );
}

export function TextareaField({ label, value, onInput, placeholder = "" }) {
  return (
    <View className="field">
      <Text className="field-label">{label}</Text>
      <Textarea className="textarea" value={value} placeholder={placeholder} onInput={(event) => onInput(event.detail.value)} />
    </View>
  );
}

export function PrimaryButton({ loading, children, onClick }) {
  return <Button className="primary-button full-button" loading={loading} disabled={loading} onClick={onClick}>{children}</Button>;
}

export function AiNotice() {
  return <View className="notice">AI 内容仅供辅助，请家长或老师审核后使用。请不要输入学生真实姓名、手机号、身份证等敏感信息。</View>;
}

export function validateRequired(fields) {
  for (const field of fields) {
    if (!field.value && field.value !== 0) {
      Taro.showToast({ title: `请填写${field.label}`, icon: "none" });
      return false;
    }
  }
  return true;
}
