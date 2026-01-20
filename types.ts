
export interface GeneratedSite {
  html: string;
  css: string;
  js: string;
  images: string[];
  title: string;
}

export interface SiteGenerationResult {
  code: string;
  imagePrompts: string[];
}

export enum GenerationStep {
  IDLE = 'idle',
  GENERATING_CODE = 'generating_code',
  GENERATING_IMAGES = 'generating_images',
  FINALIZING = 'finalizing',
  COMPLETED = 'completed',
  ERROR = 'error'
}
