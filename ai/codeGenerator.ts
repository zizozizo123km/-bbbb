
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { SiteGenerationResult } from "../types";

export const generateCode = async (prompt: string, apiKey: string): Promise<SiteGenerationResult> => {
  const ai = new GoogleGenAI({ apiKey });
  
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Act as a senior full-stack developer. Create a modern, high-converting landing page for: "${prompt}".
    
    Technical Requirements:
    1. Use Tailwind CSS via CDN.
    2. Use Lucide-React icons style (rendered as SVGs).
    3. Include: Responsive Nav, Hero with glassmorphism, Features Grid, Testimonials, FAQ, and Footer.
    4. Animation: Use simple CSS transitions for a premium feel.
    5. Content: Write compelling, SEO-friendly copy.
    
    Image Strategy:
    Use placeholders like "IMAGE_PLACEHOLDER_1", "IMAGE_PLACEHOLDER_2", etc., where images should go.
    
    Return a JSON object only.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          code: { type: Type.STRING, description: "Full HTML content with embedded CSS/JS." },
          imagePrompts: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "Descriptive prompts for image generation (Hero, Product, etc)."
          }
        },
        required: ["code", "imagePrompts"]
      }
    }
  });

  return JSON.parse(response.text || "{}") as SiteGenerationResult;
};

export const modifyCode = async (currentCode: string, instruction: string, apiKey: string): Promise<SiteGenerationResult> => {
  const ai = new GoogleGenAI({ apiKey });
  
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Modify this website based on: "${instruction}".
    
    Current Code:
    ${currentCode}
    
    Return the complete updated HTML in a JSON object.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          code: { type: Type.STRING },
          imagePrompts: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["code", "imagePrompts"]
      }
    }
  });

  return JSON.parse(response.text || "{}") as SiteGenerationResult;
};
