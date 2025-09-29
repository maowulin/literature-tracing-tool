"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Settings, RotateCcw } from "lucide-react";

interface EvaluationConfigProps {
  onConfigChange: (config: { model: string; prompt: string }) => void;
  defaultModel?: string;
  defaultPrompt?: string;
}

const AVAILABLE_MODELS = [
  { value: "deepseek/deepseek-chat-v3.1", label: "DeepSeek V3.1" },
  { value: "deepseek/deepseek-chat-v3.1:free", label: "DeepSeek V3.1 免费" },
  { value: "deepseek/deepseek-chat", label: "DeepSeek Chat" },
  { value: "anthropic/claude-opus-4.1", label: "Claude Opus 4.1" },
  { value: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
  {
    value: "anthropic/claude-3-5-sonnet-20241022",
    label: "Claude 3.5 Sonnet (Latest)",
  },
  { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { value: "anthropic/claude-3-opus", label: "Claude 3 Opus" },
  { value: "x-ai/grok-4", label: "Grok 4" },
  { value: "x-ai/grok-4-fast:free", label: "Grok 4 Fast (免费)" },
  { value: "openai/gpt-5", label: "GPT-5" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini" },
  { value: "openai/gpt-4o", label: "GPT-4o (推荐)" },
  { value: "openai/gpt-4o-mini", label: "GPT-4o Mini (经济)" },
  { value: "openai/o1-preview", label: "o1 Preview (推理专家)" },
  {
    value: "google/gemini-2.5-flash-preview-09-2025",
    label: "Gemini 2.5 Flash",
  },
  { value: "google/gemini-pro-1.5", label: "Gemini Pro 1.5" },
  { value: "google/gemini-flash-1.5", label: "Gemini Flash 1.5" },
  { value: "moonshot/moonshot-v1-8k", label: "Kimi K2-0905" },
  { value: "meta-llama/llama-3.1-70b-instruct", label: "Llama 3.1 70B" },
];

const DEFAULT_PROMPT = `You are an expert academic literature evaluator. Evaluate the relevance and quality of academic papers based on the given query and paper details. 

Utilize the provided context intent and keywords to better understand the user's underlying research aim and terminology. If context is missing, proceed with the query alone.

Respond with a JSON object containing:
- relevance: object with score (0-10) and reason (string explaining relevance to query)
- credibility: object with score (0-10) and reason (string explaining credibility assessment)
- impact: object with score (0-10) and reason (string explaining impact assessment)
- advantages: array of strings (key strengths of the paper)
- limitations: array of strings (potential limitations and methodological concerns)

Be objective and consider factors like journal reputation, citation count, impact factor, and relevance to the query.`;

export function EvaluationConfig({
  onConfigChange,
  defaultModel = "deepseek/deepseek-chat-v3.1:free",
  defaultPrompt = DEFAULT_PROMPT,
}: EvaluationConfigProps) {
  const [model, setModel] = useState(defaultModel);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [isOpen, setIsOpen] = useState(false);

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    onConfigChange({ model: newModel, prompt });
  };

  const handlePromptChange = (newPrompt: string) => {
    setPrompt(newPrompt);
    onConfigChange({ model, prompt: newPrompt });
  };

  const resetToDefault = () => {
    setModel(defaultModel);
    setPrompt(DEFAULT_PROMPT);
    onConfigChange({ model: defaultModel, prompt: DEFAULT_PROMPT });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          评分配置
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI评分配置</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">模型选择</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="model-select">选择评分模型</Label>
                <Select value={model} onValueChange={handleModelChange}>
                  <SelectTrigger id="model-select">
                    <SelectValue placeholder="选择模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_MODELS.map((modelOption) => (
                      <SelectItem
                        key={modelOption.value}
                        value={modelOption.value}
                      >
                        {modelOption.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  不同模型有不同的成本和性能特点，GPT-4o为推荐选择
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">评分提示词</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="prompt-textarea">自定义评分提示词</Label>
                <Textarea
                  id="prompt-textarea"
                  value={prompt}
                  onChange={(e) => handlePromptChange(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                  placeholder="输入自定义的评分提示词..."
                />
                <p className="text-sm text-muted-foreground">
                  修改提示词可以调整AI评分的标准和重点，留空使用默认提示词
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={resetToDefault}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              重置为默认
            </Button>
            <Button onClick={() => setIsOpen(false)}>确定</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
