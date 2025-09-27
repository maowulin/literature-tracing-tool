import { APIResponse } from '../types'

export interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  body?: unknown
  timeout?: number
}

export interface RetryConfig {
  maxRetries?: number
  baseDelay?: number
  backoffMultiplier?: number
}

export abstract class BaseService {
  protected readonly baseUrl: string
  protected readonly defaultHeaders: Record<string, string>
  protected readonly defaultTimeout: number = 30000

  constructor(baseUrl: string, defaultHeaders: Record<string, string> = {}) {
    this.baseUrl = baseUrl
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...defaultHeaders
    }
  }

  protected async makeRequest<T>(
    endpoint: string,
    config: RequestConfig = {},
    retryConfig: RetryConfig = {}
  ): Promise<APIResponse<T>> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      backoffMultiplier = 2
    } = retryConfig

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.executeRequest<T>(endpoint, config)
        return response
      } catch (error) {
        lastError = error as Error
        
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(backoffMultiplier, attempt)
          await this.delay(delay)
          continue
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Request failed after retries'
    }
  }

  private async executeRequest<T>(
    endpoint: string,
    config: RequestConfig
  ): Promise<APIResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = this.defaultTimeout
    } = config

    const url = `${this.baseUrl}${endpoint}`
    const requestHeaders = { ...this.defaultHeaders, ...headers }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return {
        success: true,
        data
      }
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  protected validateResponse<T>(data: unknown, validator: (data: unknown) => data is T): T {
    if (!validator(data)) {
      throw new Error('Invalid response format')
    }
    return data
  }
}