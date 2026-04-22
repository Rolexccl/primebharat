import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const checkIsTrending = async (movieTitle: string, year: number | string) => {
  try {
    const prompt = `Analyze if the movie or series entitled "${movieTitle}" (released/announced around ${year}) is currently trending, popular, or a top search in 2024-2025.
    
    Search the web to verify its current popularity status.
    
    Return a JSON object with the following structure:
    {
      "isTrending": boolean,
      "reason": "short explanation of why it is or isn't trending",
      "confidence": number (0-1)
    }`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        tools: [
          { googleSearch: {} }
        ],
        toolConfig: { includeServerSideToolInvocations: true }
      },
    });

    if (!response.text) return { isTrending: false, reason: "No response from AI", confidence: 0 };
    
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error checking trends:", error);
    return { isTrending: false, reason: "Error: " + (error as Error).message, confidence: 0 };
  }
};
