import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Search, History, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface SearchHistoryItem {
  id: string
  query: string
  timestamp: Date
  results: any
}

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  onSearch: (query: string) => void
  onRetry: (query: string) => void
  isSearching: boolean
  searchError: string | null
  retryCount: number
  searchHistory: SearchHistoryItem[]
  onLoadFromHistory: (item: SearchHistoryItem) => string
  onClearHistory: () => void
}

const sampleQueries = [
  "深度学习在医学图像分析中的应用",
  "区块链技术在供应链管理中的实现",
  "量子计算对密码学的影响",
  "人工智能在自动驾驶汽车中的作用"
]

export function SearchInput({
  value,
  onChange,
  onSearch,
  onRetry,
  isSearching,
  searchError,
  retryCount,
  searchHistory,
  onLoadFromHistory,
  onClearHistory
}: SearchInputProps) {
  const [inputValue, setInputValue] = useState(value)

  const handleSearch = () => {
    if (inputValue.trim()) {
      onChange(inputValue.trim())
      onSearch(inputValue.trim())
    }
  }

  const handleRetry = () => {
    if (inputValue.trim()) {
      onRetry(inputValue.trim())
    }
  }

  const handleSampleQuery = (query: string) => {
    setInputValue(query)
    onChange(query)
    onSearch(query)
  }

  const handleHistorySelect = (item: SearchHistoryItem) => {
    const query = onLoadFromHistory(item)
    setInputValue(query)
    onChange(query)
  }

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue)
    onChange(newValue)
  }

  return (
    <div className="space-y-6">
      {/* Main Search Input */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">输入要检索的文本</h2>
              <div className="flex items-center gap-2">
                {searchHistory.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <History className="w-4 h-4 mr-2" />
                        历史记录
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80">
                      {searchHistory.map((item) => (
                        <DropdownMenuItem
                          key={item.id}
                          onClick={() => handleHistorySelect(item)}
                          className="flex flex-col items-start p-3 cursor-pointer"
                        >
                          <div className="font-medium text-sm truncate w-full">
                            {item.query}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.timestamp.toLocaleString()}
                          </div>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={onClearHistory}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        清空历史记录
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
            
            <Textarea
              placeholder="请输入要检索相关文献的文本内容..."
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              className="min-h-[120px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  handleSearch()
                }
              }}
            />
            
            <div className="flex gap-2">
              <Button 
                onClick={handleSearch} 
                disabled={isSearching || !inputValue.trim()}
                className="flex-1"
              >
                <Search className="w-4 h-4 mr-2" />
                {isSearching ? '搜索中...' : '开始检索'}
              </Button>
              
              {searchError && retryCount < 3 && (
                <Button 
                  onClick={handleRetry}
                  variant="outline"
                  disabled={isSearching}
                >
                  重试 ({retryCount}/3)
                </Button>
              )}
            </div>
            
            {searchError && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                搜索失败: {searchError}
                {retryCount >= 3 && (
                  <div className="mt-1">
                    已达到最大重试次数，请稍后再试或联系技术支持。
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sample Queries */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-sm font-medium mb-3">示例查询</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {sampleQueries.map((query, index) => (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                onClick={() => handleSampleQuery(query)}
                className="justify-start text-left h-auto p-3 whitespace-normal"
                disabled={isSearching}
              >
                {query}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-sm font-medium mb-3">使用说明</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• 输入您想要查找相关文献的文本内容</li>
            <li>• 系统会自动按句子分割文本并检索相关文献</li>
            <li>• 支持中英文混合输入</li>
            <li>• 使用 Ctrl+Enter (Mac: Cmd+Enter) 快速搜索</li>
            <li>• AI高亮功能已默认开启，为您提供智能的文本标注</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}