import { LiteratureTracer } from "@/components/literature-tracer"

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">文献溯源工具</h1>
            <p className="text-muted-foreground">输入文本内容，智能查找相关学术文献</p>
          </div>
          <LiteratureTracer />
        </div>
      </div>
    </main>
  )
}
