import { useState, useCallback } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { aiHighlightService, type HighlightOptions } from '@/lib/aiHighlightService'

export function useAIHighlight() {
  const [aiHighlightEnabled, setAiHighlightEnabled] = useState(false)
  const [highlightOptions, setHighlightOptions] = useState<HighlightOptions>({
    enableAI: false,
    keywordThreshold: 0.1,
    semanticThreshold: 0.3,
    hybridMode: true
  })
  const [isHighlighting, setIsHighlighting] = useState(false)
  const [highlightedTexts, setHighlightedTexts] = useState<Map<string, string>>(new Map())
  
  const { toast } = useToast()

  const highlightRelevantText = useCallback(async (text: string, query: string): Promise<string> => {
    if (!query.trim()) return text
    
    const cacheKey = `${query}:${text.substring(0, 100)}`
    
    // Check cache first
    if (highlightedTexts.has(cacheKey)) {
      return highlightedTexts.get(cacheKey)!
    }
    
    setIsHighlighting(true)
    
    try {
      const options: HighlightOptions = {
        ...highlightOptions,
        enableAI: aiHighlightEnabled
      }
      
      const result = await aiHighlightService.highlightText(query, text, options)
      
      // Cache the result
      setHighlightedTexts(prev => new Map(prev).set(cacheKey, result))
      
      return result
    } catch (error) {
      console.error('AI highlighting failed:', error)
      // Fallback to traditional highlighting
      return aiHighlightService.highlightText(query, text, { ...highlightOptions, enableAI: false })
    } finally {
      setIsHighlighting(false)
    }
  }, [highlightOptions, aiHighlightEnabled, highlightedTexts])

  const toggleAIHighlight = useCallback(() => {
    const newEnabled = !aiHighlightEnabled
    setAiHighlightEnabled(newEnabled)
    setHighlightOptions(prev => ({ ...prev, enableAI: newEnabled }))
    
    // Clear cache when toggling
    setHighlightedTexts(new Map())
    
    toast({
      description: newEnabled ? 'AI highlighting enabled' : 'AI highlighting disabled'
    })
  }, [aiHighlightEnabled, toast])

  const updateHighlightOptions = useCallback((newOptions: Partial<HighlightOptions>) => {
    setHighlightOptions(prev => ({ ...prev, ...newOptions }))
    // Clear cache when options change
    setHighlightedTexts(new Map())
  }, [])

  const clearHighlightCache = useCallback(() => {
    setHighlightedTexts(new Map())
  }, [])

  return {
    // State
    aiHighlightEnabled,
    highlightOptions,
    isHighlighting,
    highlightedTexts,
    
    // Actions
    highlightRelevantText,
    toggleAIHighlight,
    updateHighlightOptions,
    clearHighlightCache,
    
    // Setters
    setAiHighlightEnabled,
    setHighlightOptions
  }
}