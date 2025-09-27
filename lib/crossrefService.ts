import { BaseService } from './base/BaseService'
import { APIResponse, SearchOptions } from './types'

interface CrossrefWork {
  DOI: string;
  title: string[];
  author?: Array<{
    given?: string;
    family?: string;
  }>;
  'container-title'?: string[];
  published?: {
    'date-parts': number[][];
  };
  'published-print'?: {
    'date-parts': number[][];
  };
  'published-online'?: {
    'date-parts': number[][];
  };
  abstract?: string;
  URL?: string;
  'is-referenced-by-count'?: number;
}

interface CrossrefResponse {
  status: string;
  'message-type': string;
  'message-version': string;
  message: {
    'total-results': number;
    items: CrossrefWork[];
  };
}

export interface CrossrefSearchOptions extends SearchOptions {
  query?: string;
  title?: string;
  author?: string;
  rows?: number;
  offset?: number;
  sort?: 'relevance' | 'score' | 'updated' | 'deposited' | 'indexed' | 'published' | 'published-print' | 'published-online';
  order?: 'asc' | 'desc';
  type?: 'journal-article' | 'book-chapter' | 'conference-paper' | 'dataset' | 'preprint' | 'book' | 'proceedings-article' | 'report' | 'thesis';
}

export class CrossrefService extends BaseService {
  constructor() {
    super('https://api.crossref.org/works', {
      'User-Agent': 'LiteratureTracer/1.0 (mailto:contact@example.com)'
    })
  }

  async search(options: CrossrefSearchOptions): Promise<CrossrefWork[]> {
    const params = new URLSearchParams();
    
    if (options.query) {
      params.append('query', options.query);
    }
    
    if (options.title) {
      params.append('query.title', options.title);
    }
    
    if (options.author) {
      params.append('query.author', options.author);
    }
    
    if (options.type) {
      params.append('filter', `type:${options.type}`);
    }
    
    params.append('rows', (options.rows || 10).toString());
    params.append('offset', (options.offset || 0).toString());
    
    if (options.sort) {
      params.append('sort', options.sort);
    }
    
    if (options.order) {
      params.append('order', options.order);
    }

    const url = `${this.baseUrl}?${params.toString()}`;
    
    return this.makeRequestWithRetry(url);
  }

  async searchByTitle(title: string, options: Partial<CrossrefSearchOptions> = {}): Promise<CrossrefWork[]> {
    return this.search({
      title: title.trim(),
      rows: options.rows || 5,
      sort: options.sort || 'relevance',
      order: options.order || 'desc',
      type: options.type
    });
  }

  async searchByBibliographic(query: string, options: Partial<CrossrefSearchOptions> = {}): Promise<CrossrefWork[]> {
    return this.search({
      query: query.trim(),
      rows: options.rows || 5,
      sort: options.sort || 'relevance',
      order: options.order || 'desc',
      type: options.type
    });
  }

  async getWorkByDoi(doi: string): Promise<CrossrefWork | null> {
    const url = `${this.baseUrl}/${encodeURIComponent(doi)}`;
    try {
      const response = await fetch(url, {
        headers: {
          ...this.defaultHeaders,
          'User-Agent': 'literature-tracing-tool/1.0 (mailto:contact@example.com)',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null; // Not found
        }
        throw new Error(`Crossref API error for DOI ${doi}: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (data.status !== 'ok' || !data.message) {
        throw new Error(`Invalid response for DOI ${doi}`);
      }

      return data.message as CrossrefWork;
    } catch (error) {
      console.error(`Failed to fetch work by DOI ${doi}:`, error);
      return null;
    }
  }

  async getWorksByDois(dois: string[]): Promise<Array<CrossrefWork | null>> {
    return Promise.all(dois.map(doi => this.getWorkByDoi(doi)));
  }

  private async makeRequestWithRetry(url: string, retryCount: number = 0): Promise<CrossrefWork[]> {
    const response = await this.makeRequest<CrossrefResponse>(
      url.replace(this.baseUrl, ''),
      {
        headers: {
          'Accept': 'application/json'
        }
      },
      {
        maxRetries: 3,
        baseDelay: 1000
      }
    )

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch from Crossref API')
    }

    if (response.data.status !== 'ok') {
      throw new Error(`Crossref API returned status: ${response.data.status}`)
    }

    return response.data.message.items || []
  }

  formatAuthors(authors?: Array<{ given?: string; family?: string }>): string[] {
    if (!authors || authors.length === 0) {
      return ['Unknown Author'];
    }

    return authors.map(author => {
      const given = author.given || '';
      const family = author.family || '';
      
      if (given && family) {
        return `${given} ${family}`;
      } else if (family) {
        return family;
      } else if (given) {
        return given;
      } else {
        return 'Unknown Author';
      }
    });
  }

  extractYear(work: CrossrefWork): number {
    const published = work.published || work['published-print'] || work['published-online'];
    
    if (published && published['date-parts'] && published['date-parts'][0]) {
      return published['date-parts'][0][0] || new Date().getFullYear();
    }
    
    return new Date().getFullYear();
  }

  extractJournal(work: CrossrefWork): string {
    if (work['container-title'] && work['container-title'].length > 0) {
      return work['container-title'][0];
    }
    
    return 'Unknown Journal';
  }

  extractTitle(work: CrossrefWork): string {
    if (work.title && work.title.length > 0) {
      return work.title[0];
    }
    
    return 'Untitled';
  }
}