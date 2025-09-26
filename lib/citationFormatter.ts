import { Literature } from '@/app/api/search/route'

export interface CitationFormat {
  name: string
  format: (literature: Literature) => string
}

export class CitationFormatter {
  static formatAPA(literature: Literature): string {
    const authors = literature.authors.length > 0 
      ? literature.authors.join(', ')
      : 'Unknown Author'
    
    const year = literature.year || 'n.d.'
    const title = literature.title
    const journal = literature.journal || 'Unknown Journal'
    
    let citation = `${authors} (${year}). ${title}. ${journal}`
    
    if (literature.doi) {
      citation += `. https://doi.org/${literature.doi}`
    }
    
    return citation
  }
  
  static formatIEEE(literature: Literature): string {
    const authors = literature.authors.length > 0 
      ? literature.authors.join(', ')
      : 'Unknown Author'
    
    const title = `"${literature.title}"`
    const journal = literature.journal || 'Unknown Journal'
    const year = literature.year || 'n.d.'
    
    let citation = `${authors}, ${title}, ${journal}`
    
    if (literature.year) {
      citation += `, ${year}`
    }
    
    if (literature.doi) {
      citation += `, doi: ${literature.doi}`
    } else {
      citation += '.'
    }
    
    return citation
  }
  
  static getAvailableFormats(): CitationFormat[] {
    return [
      {
        name: 'APA',
        format: this.formatAPA
      },
      {
        name: 'IEEE',
        format: this.formatIEEE
      }
    ]
  }
}