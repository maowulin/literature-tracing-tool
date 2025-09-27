import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { ExaService, type ExaResult } from "@/lib/exaService"
import { CrossrefService } from "@/lib/crossrefService"
import { DeduplicationService } from "@/lib/deduplicationService"
import { evaluationService } from "@/lib/evaluationService"
import { LiteratureEvaluation } from "@/lib/types"
import { sentenceSplitService } from "@/lib/sentenceSplitService"

// Define types matching frontend interface
const LiteratureSchema = z.object({
  id: z.number(),
  title: z.string(),
  authors: z.array(z.string()),
  journal: z.string(),
  year: z.number(),
  doi: z.string(),
  verified: z.boolean(),
  supportingPages: z.number().optional(),
  abstract: z.string().optional(),
  impactFactor: z.number().optional(),
  citationCount: z.number().optional(),
  // Evaluation fields
  evaluation: z.object({
    relevance: z.object({
      score: z.number().min(0).max(10),
      reason: z.string()
    }),
    credibility: z.object({
      score: z.number().min(0).max(10),
      reason: z.string()
    }),
    impact: z.object({
      score: z.number().min(0).max(10),
      reason: z.string()
    }),
    advantages: z.array(z.string()),
    limitations: z.array(z.string())
  }).optional(),
})

const SentenceResultSchema = z.object({
  sentence: z.string(),
  sentenceIndex: z.number(),
  literature: z.array(LiteratureSchema),
})

const SearchRequestSchema = z.object({
  text: z.string(),
})

const SearchResponseSchema = z.object({
  api1: z.array(SentenceResultSchema),
  api2: z.array(SentenceResultSchema),
})

export type Literature = z.infer<typeof LiteratureSchema>
type SentenceResult = z.infer<typeof SentenceResultSchema>
type SearchRequest = z.infer<typeof SearchRequestSchema>

// Helper function to convert Crossref results to Literature format
function convertCrossrefToLiterature(crossrefWork: any, id: number): Literature {
  const crossrefService = new CrossrefService()
  
  return {
    id,
    title: crossrefService.extractTitle(crossrefWork),
    authors: crossrefService.formatAuthors(crossrefWork.author),
    journal: crossrefService.extractJournal(crossrefWork),
    year: crossrefService.extractYear(crossrefWork),
    doi: crossrefWork.DOI || 'N/A',
    verified: true, // Crossref results are verified
    abstract: crossrefWork.abstract || undefined,
    citationCount: crossrefWork['is-referenced-by-count'] || undefined,
  }
}

// Mock academic abstracts for demonstration
const mockAbstracts: Record<string, string> = {
  "深度学习在医学图像分析中的应用": "本研究综述了深度学习技术在医学图像分析领域的最新进展。通过对卷积神经网络(CNN)、循环神经网络(RNN)和生成对抗网络(GAN)等深度学习架构的分析，我们发现这些技术在医学影像诊断、病灶检测和图像分割等任务中表现出色。研究表明，深度学习模型在X光片、CT扫描和MRI图像的自动分析中达到了与专业医师相当的准确率。特别是在肺癌筛查、皮肤癌检测和视网膜病变诊断等应用中，深度学习技术显著提高了诊断效率和准确性。然而，数据隐私、模型可解释性和临床验证仍是该领域面临的主要挑战。",
  
  "区块链技术在供应链管理中的实现": "本文探讨了区块链技术在现代供应链管理中的应用潜力和实施策略。通过分析区块链的去中心化、不可篡改和透明性特征，我们提出了一个基于智能合约的供应链追溯系统架构。该系统能够实现从原材料采购到最终产品交付的全程可追溯性，有效解决了传统供应链中的信息不对称和信任缺失问题。实验结果表明，基于区块链的供应链管理系统在食品安全、药品溯源和奢侈品防伪等领域具有显著优势。研究发现，该技术可将供应链透明度提升85%，降低欺诈风险60%，但同时也面临着能耗高、处理速度慢和监管不明确等挑战。",
  
  "量子计算对密码学的影响": "随着量子计算技术的快速发展，传统密码学体系面临前所未有的挑战。本研究分析了Shor算法和Grover算法对现有公钥密码系统的威胁，并探讨了后量子密码学的发展方向。研究表明，具有足够量子比特的量子计算机能够在多项式时间内破解RSA、ECC等广泛使用的加密算法。为应对这一威胁，我们评估了基于格、哈希函数、编码理论和多变量方程的后量子密码算法的安全性和效率。实验结果显示，CRYSTALS-Kyber和CRYSTALS-Dilithium等算法在保持高安全性的同时，具有较好的计算效率。然而，密钥尺寸增大和标准化进程缓慢仍是后量子密码学面临的主要问题。",
  
  "人工智能在自动驾驶汽车中的作用": "本文系统分析了人工智能技术在自动驾驶汽车系统中的核心作用和技术实现。通过对计算机视觉、深度学习、传感器融合和决策规划等关键技术的研究，我们构建了一个多层次的自动驾驶AI架构。该架构集成了激光雷达、摄像头、毫米波雷达等多模态传感器数据，利用深度神经网络进行环境感知和目标识别。研究结果表明，基于Transformer架构的感知模型在复杂交通场景下的目标检测准确率达到96.8%。同时，强化学习算法在路径规划和决策制定方面表现出色，能够处理99.2%的常见驾驶场景。然而，极端天气条件下的感知能力、伦理决策和法律责任认定仍是自动驾驶技术商业化的主要障碍。"
}

// Helper function to generate appropriate abstract based on title
function generateMockAbstract(title: string): string {
  const titleLower = title.toLowerCase()
  
  // Check for deep learning / medical image analysis keywords
  if (titleLower.includes("deep learning") && titleLower.includes("medical") || 
      titleLower.includes("深度学习") && titleLower.includes("医学")) {
    return mockAbstracts["深度学习在医学图像分析中的应用"]
  }
  
  // Check for blockchain / supply chain keywords
  if (titleLower.includes("blockchain") && titleLower.includes("supply") ||
      titleLower.includes("区块链") && titleLower.includes("供应链")) {
    return mockAbstracts["区块链技术在供应链管理中的实现"]
  }
  
  // Check for quantum computing / cryptography keywords
  if (titleLower.includes("quantum") && titleLower.includes("crypto") ||
      titleLower.includes("量子") && titleLower.includes("密码")) {
    return mockAbstracts["量子计算对密码学的影响"]
  }
  
  // Check for AI / autonomous driving keywords
  if (titleLower.includes("artificial intelligence") && titleLower.includes("autonomous") ||
      titleLower.includes("人工智能") && titleLower.includes("自动驾驶")) {
    return mockAbstracts["人工智能在自动驾驶汽车中的作用"]
  }
  
  // Try exact matching with original keys
  for (const [key, abstract] of Object.entries(mockAbstracts)) {
    if (title.includes(key) || key.includes(title.substring(0, 10))) {
      return abstract
    }
  }
  
  // Generate a generic abstract based on title keywords
  const keywords = titleLower
  if (keywords.includes("深度学习") || keywords.includes("机器学习") || keywords.includes("人工智能") ||
      keywords.includes("deep learning") || keywords.includes("machine learning") || keywords.includes("artificial intelligence")) {
    return "本研究探讨了人工智能技术在相关领域的应用与发展。通过深入分析现有技术框架和方法论，我们提出了一种新的解决方案来应对当前面临的挑战。实验结果表明，所提出的方法在性能指标上有显著提升，为该领域的进一步发展提供了重要参考。然而，技术实施过程中仍存在一些限制和挑战需要进一步研究解决。"
  } else if (keywords.includes("区块链") || keywords.includes("加密") || keywords.includes("密码") ||
             keywords.includes("blockchain") || keywords.includes("crypto") || keywords.includes("encryption")) {
    return "本文分析了区块链和密码学技术的最新发展趋势及其在实际应用中的表现。研究重点关注了技术安全性、可扩展性和实用性等关键问题。通过理论分析和实验验证，我们发现该技术在解决信任和安全问题方面具有独特优势。研究结果为相关技术的进一步优化和应用推广提供了理论基础和实践指导。"
  } else {
    return "本研究针对相关领域的关键问题进行了深入分析和探讨。通过综合运用理论分析和实验方法，我们提出了创新性的解决方案。研究结果表明，所提出的方法在解决实际问题方面具有良好的效果和应用前景。这项工作为该领域的理论发展和实践应用做出了重要贡献，同时也为未来的研究方向提供了有价值的参考。"
  }
}

// Helper function to convert Exa results to Literature format
function convertExaResultToLiterature(exaResult: ExaResult, id: number): Literature {
  // Extract year from publishedDate if available
  const year = exaResult.publishedDate 
    ? new Date(exaResult.publishedDate).getFullYear() 
    : new Date().getFullYear()

  // Extract authors from author field or use placeholder
  const authors = exaResult.author 
    ? [exaResult.author] 
    : ["Unknown Author"]

  // Extract DOI from URL if it's a DOI link, otherwise use URL
  const doi = exaResult.url.includes("doi.org") 
    ? exaResult.url.replace("https://doi.org/", "")
    : exaResult.url

  // Extract journal name from URL or use placeholder
  const journal = extractJournalFromUrl(exaResult.url)

  return {
    id,
    title: exaResult.title,
    authors,
    journal,
    year,
    doi,
    verified: false, // Exa results are not Crossref verified yet
    abstract: generateMockAbstract(exaResult.title),
    supportingPages: exaResult.highlights?.length || 1,
  }
}

// Helper function to extract journal name from URL
function extractJournalFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname
    
    // Common academic domains
    if (hostname.includes("arxiv.org")) return "arXiv"
    if (hostname.includes("pubmed.ncbi.nlm.nih.gov")) return "PubMed"
    if (hostname.includes("nature.com")) return "Nature"
    if (hostname.includes("science.org")) return "Science"
    if (hostname.includes("cell.com")) return "Cell"
    if (hostname.includes("nejm.org")) return "New England Journal of Medicine"
    if (hostname.includes("thelancet.com")) return "The Lancet"
    if (hostname.includes("bmj.com")) return "BMJ"
    if (hostname.includes("springer.com")) return "Springer"
    if (hostname.includes("wiley.com")) return "Wiley"
    if (hostname.includes("elsevier.com")) return "Elsevier"
    if (hostname.includes("ieee.org")) return "IEEE"
    if (hostname.includes("acm.org")) return "ACM"
    
    // Default to hostname without www
    return hostname.replace("www.", "")
  } catch {
    return "Unknown Journal"
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedRequest = SearchRequestSchema.parse(body)
    
    // Use AI-powered sentence splitting
    const sentences = await sentenceSplitService.splitIntoSentences(validatedRequest.text)
    
    // Initialize Exa service
    const exaApiKey = process.env.EXA_API_KEY
    if (!exaApiKey) {
      return NextResponse.json(
        { error: "EXA_API_KEY is not configured. Please set up the API key to use the search functionality." },
        { status: 500 }
      )
    }

    if (sentences.length === 0) {
      return NextResponse.json({ api1: [], api2: [] })
    }

    // Initialize services
    const exaService = new ExaService()
    const crossrefService = new CrossrefService()
    
    try {
      // Search with Exa for each sentence
      const exaResults = await exaService.searchMultipleQueries(sentences, {
        type: 'neural',
        category: 'research paper',
        numResults: 5,
        includeText: true,
        includeHighlights: true,
        includeSummary: true,
      })

      console.log('EXA search completed:', {
        sentencesCount: sentences.length,
        exaResultsCount: exaResults.length,
        exaResults: exaResults.map((results, index) => ({
          sentenceIndex: index,
          sentence: sentences[index],
          resultCount: results.length,
          results: results.map(r => ({ id: r.id, title: r.title, url: r.url }))
        }))
      })

      if (exaResults.length !== sentences.length) {
        console.warn("Warning: Mismatch between number of sentences and Exa search results.");
      }

      // Search with Crossref for each sentence using a hybrid approach
      const crossrefPromises = sentences.map(async (sentence, index) => {
        try {
          const exaResultsForSentence = exaResults[index] || []
          const doisFromExa = exaResultsForSentence
            .map(r => r.doi)
            .filter((doi): doi is string => !!doi && doi.startsWith('10.'))

          // Fetch by DOI from Exa results
          const doiResults = await crossrefService.getWorksByDois(doisFromExa)
          const literatureFromDois = doiResults
            .filter((work): work is NonNullable<typeof work> => work !== null)
            .map((work, i) => convertCrossrefToLiterature(work, 1000 + i))

          // Fallback/supplement with bibliographic search
          const bibliographicResults = await crossrefService.searchByBibliographic(sentence, { 
            rows: 3,
            type: 'journal-article'
          })
          const literatureFromBiblio = bibliographicResults.map((work, i) => convertCrossrefToLiterature(work, 2000 + i))

          // Combine and deduplicate results
          const combinedLiterature = [...literatureFromDois, ...literatureFromBiblio]
          const deduplicatedResults = DeduplicationService.deduplicate(combinedLiterature)
          
          return deduplicatedResults.slice(0, 3)
        } catch (error) {
          console.error(`Crossref hybrid search failed for sentence: "${sentence}"`, error)
          return []
        }
      })
      const crossrefResults = await Promise.all(crossrefPromises)

      // Convert Exa results to our Literature format for API 1
      let literatureId = 1
      const api1Results: SentenceResult[] = await Promise.all(
        sentences.map(async (sentence, index) => {
          const exaResultsForSentence = exaResults[index] || []
          const literature = exaResultsForSentence
            .slice(0, 3) // Take first 3 results before deduplication
            .map(exaResult => convertExaResultToLiterature(exaResult, literatureId++))
          
          // Apply deduplication and sorting
          const deduplicatedLiterature = DeduplicationService.sortByRelevanceAndQuality(
            DeduplicationService.deduplicate(literature)
          ).slice(0, 2) // Keep top 2 after deduplication
          
          // Add GPT-5 evaluation for each literature item
           const evaluatedLiterature = await Promise.all(
             deduplicatedLiterature.map(async (lit) => {
               try {
                 const evaluationRequest = {
                   query: sentence,
                   title: lit.title,
                   authors: lit.authors,
                   journal: lit.journal,
                   year: lit.year,
                   abstract: lit.abstract,
                   doi: lit.doi,
                   citationCount: lit.citationCount,
                   impactFactor: lit.impactFactor
                 }
                 const evaluation = await evaluationService.evaluateLiterature(evaluationRequest)
                 return { ...lit, evaluation }
               } catch (error) {
                 console.error(`Evaluation failed for literature ${lit.id}:`, error)
                 return lit // Return without evaluation if it fails
               }
             })
           )
          
          return {
            sentence,
            sentenceIndex: index + 1,
            literature: evaluatedLiterature,
          }
        })
      )

      // Convert Crossref results to our Literature format for API 2
      const api2Results: SentenceResult[] = await Promise.all(
        sentences.map(async (sentence, index) => {
          const crossrefResultsForSentence = crossrefResults[index] || []
          // Results are already converted and deduplicated in the search phase
          const literature = crossrefResultsForSentence
          
          // Apply final sorting for Crossref results
          const sortedLiterature = DeduplicationService.sortByRelevanceAndQuality(literature)
          
          // Add GPT-5 evaluation for each literature item
           const evaluatedLiterature = await Promise.all(
             sortedLiterature.map(async (lit) => {
               try {
                 const evaluationRequest = {
                   query: sentence,
                   title: lit.title,
                   authors: lit.authors,
                   journal: lit.journal,
                   year: lit.year,
                   abstract: lit.abstract,
                   doi: lit.doi,
                   citationCount: lit.citationCount,
                   impactFactor: lit.impactFactor
                 }
                 const evaluation = await evaluationService.evaluateLiterature(evaluationRequest)
                 return { ...lit, evaluation }
               } catch (error) {
                 console.error(`Evaluation failed for literature ${lit.id}:`, error)
                 return lit // Return without evaluation if it fails
               }
             })
           )
          
          return {
            sentence,
            sentenceIndex: index + 1,
            literature: evaluatedLiterature,
          }
        })
      )

      const response = {
        api1: api1Results,
        api2: api2Results,
      }

      const validatedResponse = SearchResponseSchema.parse(response)
      return NextResponse.json(validatedResponse)

    } catch (exaError) {
      console.error("Search service failed:", exaError)
      return NextResponse.json(
        { error: `Search service failed: ${exaError instanceof Error ? exaError.message : 'Unknown error'}` },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error("Search API error:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request format", details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}