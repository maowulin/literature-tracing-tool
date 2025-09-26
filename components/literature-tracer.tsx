"use client"

import { useState } from "react"
import { Search, ExternalLink, Copy, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface Literature {
  id: number
  title: string
  authors: string[]
  journal: string
  year: number
  doi: string
  verified: boolean
  supportingPages?: number
  abstract?: string
  impactFactor?: number
  citationCount?: number
}

interface SentenceResult {
  sentence: string
  sentenceIndex: number
  literature: Literature[]
}

const sampleQueries = [
  "子宫疤痕会影响胎盘。子宫疤痕可能导致罕见但严重的并发症，如剖宫产疤痕异位妊娠，涉及胎盘异常生长和出血风险。",
  "机器学习在医学诊断中的应用越来越广泛。深度学习算法可以自动分析医学图像。人工智能系统能够辅助临床决策。",
  "气候变化对生物多样性产生重大影响。全球变暖改变了物种分布模式。生态系统在气候压力下面临韧性挑战。",
  "量子计算为优化问题提供了新的解决方案。量子算法在某些计算任务上具有指数级优势。",
  "CRISPR基因编辑技术在治疗应用中显示出巨大潜力。基因治疗为遗传疾病提供了新的治疗途径。",
]

const mockSentenceData: { [key: string]: { api1: SentenceResult[]; api2: SentenceResult[] } } = {
  uterine: {
    api1: [
      {
        sentence: "子宫疤痕会影响胎盘。",
        sentenceIndex: 1,
        literature: [
          {
            id: 1,
            title: "Longitudinal changes in uterine artery Doppler and blood pressure and risk of pre-eclampsia",
            authors: ["A. Khalil", "R. Garcia-Mandujano", "N. Maiz", "and 5 other authors"],
            journal: "Ultrasound in Obstetrics & Gynecology",
            year: 2014,
            doi: "10.1002/uog.13257",
            verified: true,
            supportingPages: 2,
            impactFactor: 6.194,
            citationCount: 342,
            abstract:
              "Background: Uterine artery Doppler screening is used to identify pregnancies at risk of pre-eclampsia. This study aimed to investigate longitudinal changes in uterine artery pulsatility index (PI) and mean arterial pressure (MAP) throughout pregnancy and their association with the development of pre-eclampsia. Methods: A prospective longitudinal study was conducted in 1000 singleton pregnancies. Results showed significant correlations between early uterine artery changes and subsequent pre-eclampsia development.",
          },
          {
            id: 2,
            title: "<scp>FIGO</scp> classification for the clinical diagnosis of placenta accreta spectrum disorders",
            authors: ["Eric Jauniaux", "Diogo Ayres-de-Campos", "Jens Langhoff-Roos", "and 5 other authors"],
            journal: "International Journal of Gynecology & Obstetrics",
            year: 2019,
            doi: "10.1002/ijgo.12761",
            verified: true,
            impactFactor: 3.286,
            citationCount: 156,
            // 这个文献没有摘要
          },
        ],
      },
      {
        sentence: "子宫疤痕可能导致罕见但严重的并发症，如剖宫产疤痕异位妊娠，涉及胎盘异常生长和出血风险。",
        sentenceIndex: 2,
        literature: [
          {
            id: 3,
            title: "Maternal and perinatal outcomes in pregnancies complicated by uterine scars: A systematic review",
            authors: ["M. Johnson", "K. Smith", "L. Brown", "and 3 other authors"],
            journal: "American Journal of Obstetrics and Gynecology",
            year: 2020,
            doi: "10.1016/j.ajog.2020.03.015",
            verified: false,
            impactFactor: 9.256,
            citationCount: 89,
            abstract:
              "Objective: To systematically review maternal and perinatal outcomes in pregnancies complicated by uterine scars from previous cesarean deliveries. Study Design: We searched multiple databases for studies comparing outcomes between scarred and unscarred uteri. Results: Uterine scars were associated with increased risks of placental abnormalities, uterine rupture, and adverse perinatal outcomes. The risk of cesarean scar pregnancy was found to be 1 in 2000 pregnancies with previous cesarean delivery.",
          },
          {
            id: 4,
            title: "Cesarean scar pregnancy: diagnosis and management",
            authors: ["L. Zhang", "H. Wang", "M. Liu", "and 4 other authors"],
            journal: "Obstetrics & Gynecology",
            year: 2021,
            doi: "10.1097/AOG.0000000000004321",
            verified: true,
            supportingPages: 3,
            impactFactor: 7.661,
            citationCount: 234,
            abstract:
              "Cesarean scar pregnancy (CSP) is a rare form of ectopic pregnancy where the gestational sac implants in the myometrium at the site of a previous cesarean scar. Early diagnosis and appropriate management are crucial to prevent life-threatening complications such as uterine rupture and massive hemorrhage. This review discusses current diagnostic criteria, imaging findings, and treatment options including medical management with methotrexate and surgical interventions.",
          },
        ],
      },
    ],
    api2: [
      {
        sentence: "子宫疤痕会影响胎盘。",
        sentenceIndex: 1,
        literature: [
          {
            id: 5,
            title: "Risk factors and outcomes of uterine scar dehiscence during pregnancy and delivery",
            authors: ["S. Williams", "T. Davis", "R. Wilson", "and 4 other authors"],
            journal: "Obstetrics & Gynecology",
            year: 2021,
            doi: "10.1097/AOG.0000000000004321",
            verified: true,
            supportingPages: 3,
            impactFactor: 7.661,
            citationCount: 178,
            abstract:
              "Background: Uterine scar dehiscence is a serious complication that can occur during pregnancy and labor in women with previous cesarean deliveries. This study examined risk factors and maternal-fetal outcomes associated with scar dehiscence. Methods: A retrospective cohort study of 5,000 women with previous cesarean delivery. Results: Scar dehiscence occurred in 0.7% of cases, with increased risks associated with short interpregnancy intervals and multiple previous cesareans.",
          },
        ],
      },
      {
        sentence: "子宫疤痕可能导致罕见但严重的并发症，如剖宫产疤痕异位妊娠，涉及胎盘异常生长和出血风险。",
        sentenceIndex: 2,
        literature: [
          {
            id: 6,
            title: "Placental implantation abnormalities and uterine scarring: A comprehensive analysis",
            authors: ["H. Chen", "Y. Zhang", "L. Wang", "and 6 other authors"],
            journal: "Placenta",
            year: 2022,
            doi: "10.1016/j.placenta.2022.04.008",
            verified: true,
            impactFactor: 3.287,
            citationCount: 67,
            // 这个文献没有摘要
          },
        ],
      },
    ],
  },
  "machine learning": {
    api1: [
      {
        sentence: "机器学习在医学诊断中的应用越来越广泛。",
        sentenceIndex: 1,
        literature: [
          {
            id: 7,
            title: "Deep learning approaches for automated medical image analysis",
            authors: ["X. Liu", "A. Kumar", "S. Patel", "and 8 other authors"],
            journal: "Nature Medicine",
            year: 2023,
            doi: "10.1038/s41591-023-02156-7",
            verified: true,
            supportingPages: 5,
            impactFactor: 87.241,
            citationCount: 1247,
            abstract:
              "The application of deep learning in medical image analysis has revolutionized diagnostic capabilities across multiple medical specialties. This comprehensive review examines recent advances in convolutional neural networks, transformer architectures, and multimodal learning approaches for medical imaging. We analyze performance metrics across radiology, pathology, and ophthalmology applications, demonstrating significant improvements in diagnostic accuracy and efficiency compared to traditional methods.",
          },
        ],
      },
      {
        sentence: "深度学习算法可以自动分析医学图像。",
        sentenceIndex: 2,
        literature: [
          {
            id: 8,
            title: "Machine learning algorithms for early disease detection: A systematic review",
            authors: ["R. Singh", "M. Wang", "L. Garcia", "and 6 other authors"],
            journal: "The Lancet Digital Health",
            year: 2022,
            doi: "10.1016/S2589-7500(22)00089-3",
            verified: true,
            impactFactor: 36.615,
            citationCount: 892,
            abstract:
              "Early disease detection is crucial for improving patient outcomes and reducing healthcare costs. This systematic review evaluates machine learning algorithms used for early detection across various diseases including cancer, cardiovascular disease, and neurological disorders. We analyzed 150 studies and found that ensemble methods and deep learning approaches showed the highest sensitivity and specificity for early-stage disease identification.",
          },
        ],
      },
      {
        sentence: "人工智能系统能够辅助临床决策。",
        sentenceIndex: 3,
        literature: [
          {
            id: 9,
            title: "Artificial intelligence in clinical decision support systems",
            authors: ["K. Brown", "T. Wilson", "H. Kim", "and 4 other authors"],
            journal: "Journal of Medical Internet Research",
            year: 2023,
            doi: "10.2196/45123",
            verified: true,
            supportingPages: 3,
            impactFactor: 7.076,
            citationCount: 445,
            // 这个文献没有摘要
          },
        ],
      },
    ],
    api2: [
      {
        sentence: "机器学习在医学诊断中的应用越来越广泛。",
        sentenceIndex: 1,
        literature: [
          {
            id: 10,
            title: "AI-powered diagnostic tools in healthcare: Current applications and future prospects",
            authors: ["M. Thompson", "J. Lee", "S. Park", "and 5 other authors"],
            journal: "Nature Digital Medicine",
            year: 2023,
            doi: "10.1038/s41746-023-00789-1",
            verified: true,
            impactFactor: 12.329,
            citationCount: 623,
            abstract:
              "Artificial intelligence is transforming healthcare delivery through advanced diagnostic tools and predictive analytics. This review examines current AI applications in clinical practice, including image recognition systems, natural language processing for electronic health records, and predictive models for patient risk stratification. We discuss implementation challenges, regulatory considerations, and future directions for AI integration in healthcare systems.",
          },
        ],
      },
    ],
  },
}

const splitIntoSentences = (text: string): string[] => {
  // 按中文句号、英文句号、问号、感叹号分割
  return text
    .split(/[。.!?！？]/)
    .filter((sentence) => sentence.trim().length > 0)
    .map((s) => s.trim() + (s.match(/[。.!?！？]/) ? "" : "。"))
}

export function LiteratureTracer() {
  const [query, setQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [currentResults, setCurrentResults] = useState<{ api1: SentenceResult[]; api2: SentenceResult[] }>({
    api1: [],
    api2: [],
  })

  const handleSampleQuery = (sampleQuery: string) => {
    setQuery(sampleQuery)
  }

  const handleSearch = async () => {
    if (!query.trim()) return

    setIsSearching(true)

    const queryLower = query.toLowerCase()
    let selectedDataSet = mockSentenceData["uterine"] // 默认数据

    if (
      queryLower.includes("机器学习") ||
      queryLower.includes("machine learning") ||
      queryLower.includes("人工智能") ||
      queryLower.includes("深度学习")
    ) {
      selectedDataSet = mockSentenceData["machine learning"]
    } else if (queryLower.includes("子宫") || queryLower.includes("胎盘") || queryLower.includes("uterine")) {
      selectedDataSet = mockSentenceData["uterine"]
    }

    setCurrentResults(selectedDataSet)

    // 模拟API调用
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setIsSearching(false)
    setHasSearched(true)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const LiteratureCard = ({ literature, index }: { literature: Literature; index: number }) => (
    <Card className="mb-4 border border-border">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
              {index + 2}
            </div>
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3 mb-2">
              {literature.verified && (
                <Badge className="bg-verified text-verified-foreground hover:bg-verified/90">Crossref Verified</Badge>
              )}
            </div>

            <h4 className="text-base font-medium text-foreground leading-relaxed">{literature.title}</h4>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>👥</span>
                <span>{literature.authors.join(", ")}</span>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>📖</span>
                  <span>{literature.journal}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>📅</span>
                  <span>{literature.year}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm">
                {literature.impactFactor && (
                  <div className="flex items-center gap-2 px-2 py-1 bg-blue-50 text-blue-700 rounded-md">
                    <span className="font-medium">IF:</span>
                    <span className="font-semibold">{literature.impactFactor}</span>
                  </div>
                )}
                {literature.citationCount && (
                  <div className="flex items-center gap-2 px-2 py-1 bg-green-50 text-green-700 rounded-md">
                    <span className="font-medium">引用:</span>
                    <span className="font-semibold">{literature.citationCount}</span>
                  </div>
                )}
              </div>
            </div>

            {literature.abstract && (
              <div className="bg-muted/30 p-4 rounded-lg border-l-4 border-primary/30">
                <h5 className="text-sm font-medium text-foreground mb-2">摘要</h5>
                <p className="text-sm text-muted-foreground leading-relaxed">{literature.abstract}</p>
              </div>
            )}

            <div className="bg-warning/10 border-l-4 border-warning p-3 rounded-r">
              <p className="text-sm text-warning-foreground">
                📋 温馨提示：请点击DOI链接查看完整文献，选择最合适的论文进行引用
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">DOI:</span> {literature.doi}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                  <ExternalLink className="w-4 h-4" />
                  Access
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                      <Copy className="w-4 h-4" />
                      Copy
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => copyToClipboard(literature.title)}>Copy Title</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => copyToClipboard(literature.doi)}>Copy DOI</DropdownMenuItem>
                    {literature.abstract && (
                      <DropdownMenuItem onClick={() => copyToClipboard(literature.abstract)}>
                        Copy Abstract
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() =>
                        copyToClipboard(
                          `${literature.authors[0]} et al. (${literature.year}). ${literature.title}. ${literature.journal}.`,
                        )
                      }
                    >
                      Copy Citation
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const SentenceResultSection = ({ sentenceResult }: { sentenceResult: SentenceResult }) => (
    <div className="mb-8">
      <div className="flex items-start gap-4 mb-4">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
            {sentenceResult.sentenceIndex}
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-medium text-foreground leading-relaxed">{sentenceResult.sentence}</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Supporting References ({sentenceResult.literature.length} papers)
          </p>
        </div>
      </div>

      <div className="ml-12 space-y-3">
        {sentenceResult.literature.map((literature, index) => (
          <LiteratureCard key={literature.id} literature={literature} index={index} />
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* 搜索区域 */}
      <Card className="border border-border">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="输入要查询的文本内容（支持多句话）..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10 h-12 text-base"
                />
              </div>
              <Button onClick={handleSearch} disabled={isSearching || !query.trim()} className="h-12 px-6">
                {isSearching ? "搜索中..." : "搜索文献"}
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">试试这些示例查询：</p>
              <div className="flex flex-wrap gap-2">
                {sampleQueries.map((sampleQuery, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSampleQuery(sampleQuery)}
                    className="text-xs max-w-xs truncate"
                  >
                    {sampleQuery}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 结果区域 */}
      {hasSearched && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">为查询内容找到相关文献，按句子展示溯源结果</div>

          <Tabs defaultValue="api1" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="api1">接口一结果</TabsTrigger>
              <TabsTrigger value="api2">接口二结果</TabsTrigger>
            </TabsList>

            <TabsContent value="api1" className="mt-6">
              <div className="space-y-6">
                {currentResults.api1.map((sentenceResult, index) => (
                  <SentenceResultSection key={index} sentenceResult={sentenceResult} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="api2" className="mt-6">
              <div className="space-y-6">
                {currentResults.api2.map((sentenceResult, index) => (
                  <SentenceResultSection key={index} sentenceResult={sentenceResult} />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {!hasSearched && (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>输入文本内容开始文献溯源</p>
          <p className="text-sm mt-2">系统会自动按句子拆分并为每句话找到相关文献</p>
        </div>
      )}
    </div>
  )
}
