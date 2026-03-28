import React from 'react';
import { GoogleGenAI } from "@google/genai";
import { ArtStyle } from "../types";
import { ART_STYLES } from "../constants";

export const generateArt = async (prompt: string, style: ArtStyle, sketchBase64?: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const styleInfo = ART_STYLES.find(s => s.label === style);
  const basePrompt = prompt.trim() || (sketchBase64 ? "A detailed artwork based on this sketch" : "A beautiful masterpiece");
  const fullPrompt = `${basePrompt}. ${styleInfo?.promptSuffix || ""}`;

  const parts: any[] = [{ text: fullPrompt }];

  if (sketchBase64) {
    // Remove data:image/png;base64, prefix
    const base64Data = sketchBase64.split(',')[1];
    parts.push({
      inlineData: {
        data: base64Data,
        mimeType: "image/png"
      }
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image generated in response");
  } catch (error) {
    console.error("Art Generation Error:", error);
    throw error;
  }
};
