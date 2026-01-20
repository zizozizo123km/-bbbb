import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { SiteGenerationResult } from "../types";

/**
 * Generates the initial website structure and content based on a text prompt.
 */
export const generateSiteStructure = async (prompt: string, apiKey?: string): Promise<SiteGenerationResult> => {
  const effectiveKey = apiKey || process.env.API_KEY;
  if (!effectiveKey) throw new Error("API Key is missing. Please set it in settings or .env file.");

  const ai = new GoogleGenAI({ apiKey: effectiveKey });
  
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Create a professional, high-quality website based on this description: "${prompt}".
    The website must use Tailwind CSS for styling.
    Include a navigation bar, a hero section with a primary call to action, a features/services section, an about section, and a footer.
    Make it fully responsive and modern.
    Return the result as a JSON object.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          code: {
            type: Type.STRING,
            description: "The complete HTML code including Tailwind CDN and embedded CSS/JS if needed."
          },
          imagePrompts: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "A list of 3-4 descriptive image prompts for sections like hero, gallery, or team."
          }
        },
        required: ["code", "imagePrompts"],
        propertyOrdering: ["code", "imagePrompts"]
      }
    }
  });

  const data = JSON.parse(response.text || "{}");
  return data as SiteGenerationResult;
};

/**
 * Modifies existing website code based on user instructions.
 */
export const modifySiteStructure = async (currentCode: string, instruction: string, apiKey?: string): Promise<SiteGenerationResult> => {
  const effectiveKey = apiKey || process.env.API_KEY;
  if (!effectiveKey) throw new Error("API Key is missing. Please set it in settings or .env file.");

  const ai = new GoogleGenAI({ apiKey: effectiveKey });
  
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `You are an expert web developer. Modify the following website code according to this instruction: "${instruction}".
    
    Current Code:
    ${currentCode}
    
    Guidelines:
    1. Maintain the existing style and Tailwind CSS usage unless asked to change it.
    2. Ensure the resulting code is a complete, valid HTML file.
    3. If the user asks for new sections that require images, provide descriptive prompts for them.
    4. Return the FULL updated code.
    
    Return the result as a JSON object.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          code: {
            type: Type.STRING,
            description: "The complete updated HTML code."
          },
          imagePrompts: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Any NEW descriptive image prompts needed for added sections. Return an empty array if no new images are needed."
          }
        },
        required: ["code", "imagePrompts"],
        propertyOrdering: ["code", "imagePrompts"]
      }
    }
  });

  const data = JSON.parse(response.text || "{}");
  return data as SiteGenerationResult;
};

/**
 * Generates an image based on a prompt.
 */
export const generateImage = async (prompt: string, apiKey?: string): Promise<string | null> => {
  try {
    const effectiveKey = apiKey || process.env.API_KEY;
    if (!effectiveKey) throw new Error("API Key is missing.");

    const ai = new GoogleGenAI({ apiKey: effectiveKey });
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9"
        }
      }
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Image generation failed:", error);
    return `https://picsum.photos/seed/${Math.random()}/1200/600`;
  }
};