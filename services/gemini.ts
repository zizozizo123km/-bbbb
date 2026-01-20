
import { GoogleGenAI, Type } from "@google/genai";
import { SiteGenerationResult } from "../types";

const API_KEY = process.env.API_KEY || "";

export const generateSiteStructure = async (prompt: string): Promise<SiteGenerationResult> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const response = await ai.models.generateContent({
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
        required: ["code", "imagePrompts"]
      }
    }
  });

  const data = JSON.parse(response.text || "{}");
  return data as SiteGenerationResult;
};

export const modifySiteStructure = async (currentCode: string, instruction: string): Promise<SiteGenerationResult> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const response = await ai.models.generateContent({
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
        required: ["code", "imagePrompts"]
      }
    }
  });

  const data = JSON.parse(response.text || "{}");
  return data as SiteGenerationResult;
};

export const generateImage = async (prompt: string): Promise<string | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const response = await ai.models.generateContent({
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

    for (const part of response.candidates?.[0]?.content?.parts || []) {
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
