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

interface CrossrefSearchOptions {
  query?: string;
  title?: string;
  author?: string;
  rows?: number;
  offset?: number;
  sort?: 'relevance' | 'score' | 'updated' | 'deposited' | 'indexed' | 'published' | 'published-print' | 'published-online';
  order?: 'asc' | 'desc';
}

export class CrossrefService {
  private readonly baseUrl = 'https://api.crossref.org/works';
  private readonly userAgent = 'LiteratureTracer/1.0 (mailto:contact@example.com)';
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;

  constructor() {}

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

  async searchByTitle(title: string, rows: number = 5): Promise<CrossrefWork[]> {
    return this.search({
      title: title.trim(),
      rows,
      sort: 'relevance',
      order: 'desc'
    });
  }

  async searchByBibliographic(query: string, rows: number = 5): Promise<CrossrefWork[]> {
    return this.search({
      query: query.trim(),
      rows,
      sort: 'relevance',
      order: 'desc'
    });
  }

  private async makeRequestWithRetry(url: string, retryCount: number = 0): Promise<CrossrefWork[]> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Crossref API error: ${response.status} ${response.statusText}`);
      }

      const data: CrossrefResponse = await response.json();
      
      if (data.status !== 'ok') {
        throw new Error(`Crossref API returned status: ${data.status}`);
      }

      return data.message.items || [];
    } catch (error) {
      console.error(`Crossref search error (attempt ${retryCount + 1}):`, error);
      
      if (retryCount < this.maxRetries) {
        await this.delay(this.retryDelay * (retryCount + 1));
        return this.makeRequestWithRetry(url, retryCount + 1);
      }
      
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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