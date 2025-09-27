import { useState, useCallback, useRef } from 'react';
import { aiHighlightService, type HighlightOptions } from '@/lib/aiHighlightService';
import { smartHighlightService, type SmartHighlightOptions, type LiteratureContent } from '@/lib/smartHighlightService';

interface UseAIHighlightReturn {
  isAIHighlightActive: boolean;
  highlightOptions: HighlightOptions;
  smartHighlightOptions: SmartHighlightOptions;
  updateHighlightOptions: (options: Partial<HighlightOptions>) => void;
  updateSmartHighlightOptions: (options: Partial<SmartHighlightOptions>) => void;
  highlightText: (query: string, text: string) => Promise<string | null>;
  smartHighlightLiterature: (query: string, literature: LiteratureContent) => Promise<{
    highlightedTitle: string;
    highlightedAbstract: string;
    overallRelevance: number;
  }>;
  clearCache: () => void;
  getServiceStatus: () => {
    aiAvailable: boolean;
    cacheSize: number;
  };
}

export function useAIHighlight(): UseAIHighlightReturn {
  const [isAIHighlightActive] = useState(true); // Always enabled
  const [highlightOptions, setHighlightOptions] = useState<HighlightOptions>({
    enableAI: true,
    keywordThreshold: 0.3,
    semanticThreshold: 0.4,
    hybridMode: true,
  });
  
  const [smartHighlightOptions, setSmartHighlightOptions] = useState<SmartHighlightOptions>({
    enableAI: true,
    relevanceThreshold: 0.3,
    contextWindow: 3,
    prioritizeStructure: true,
  });

  const cacheRef = useRef(new Map<string, string>());

  const updateHighlightOptions = useCallback((options: Partial<HighlightOptions>) => {
    setHighlightOptions(prev => ({ ...prev, ...options }));
  }, []);

  const updateSmartHighlightOptions = useCallback((options: Partial<SmartHighlightOptions>) => {
    setSmartHighlightOptions(prev => ({ ...prev, ...options }));
  }, []);

  const highlightText = useCallback(async (query: string, text: string): Promise<string | null> => {
    if (!text.trim()) {
      return text;
    }

    const cacheKey = `${query}|||${text}`.substring(0, 200);
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const result = await aiHighlightService.highlightText(query, text, highlightOptions);
      if (result) {
        cacheRef.current.set(cacheKey, result);
      }
      return result;
    } catch (error) {
      console.error('Text highlighting failed:', error);
      return text;
    }
  }, [highlightOptions]);

  const smartHighlightLiterature = useCallback(async (
    query: string, 
    literature: LiteratureContent
  ): Promise<{
    highlightedTitle: string;
    highlightedAbstract: string;
    overallRelevance: number;
  }> => {
    if (!isAIHighlightActive) {
      return {
        highlightedTitle: literature.title,
        highlightedAbstract: literature.abstract || '',
        overallRelevance: 0,
      };
    }

    const cacheKey = `smart_${query}|||${literature.title}|||${literature.abstract || ''}`.substring(0, 200);
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const result = await smartHighlightService.analyzeAndHighlight(query, literature, smartHighlightOptions);
      const returnValue = {
        highlightedTitle: result.highlightedTitle,
        highlightedAbstract: result.highlightedAbstract,
        overallRelevance: result.overallRelevance,
      };
      
      cacheRef.current.set(cacheKey, JSON.stringify(returnValue));
      return returnValue;
    } catch (error) {
      console.error('Smart literature highlighting failed:', error);
      return {
        highlightedTitle: literature.title,
        highlightedAbstract: literature.abstract || '',
        overallRelevance: 0,
      };
    }
  }, [isAIHighlightActive, smartHighlightOptions]);

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
    aiHighlightService.clearCache();
  }, []);

  const getServiceStatus = useCallback(() => {
    return aiHighlightService.getServiceStatus();
  }, []);

  return {
    isAIHighlightActive,
    highlightOptions,
    smartHighlightOptions,
    updateHighlightOptions,
    updateSmartHighlightOptions,
    highlightText,
    smartHighlightLiterature,
    clearCache,
    getServiceStatus,
  };
}