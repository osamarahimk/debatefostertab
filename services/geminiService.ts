
import { GoogleGenAI } from "@google/genai";

export const generateMotion = async (): Promise<string> => {
    if (!process.env.API_KEY) {
        console.error("API_KEY environment variable not set.");
        return "API key not configured. Please check your environment variables.";
    }
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'Generate a compelling, debatable motion for a high school parliamentary debate tournament. The motion should be clear, concise, and balanced. Provide only the motion text, without any prefixes like "Motion:" or quotation marks.',
        });

        const text = response.text.trim();
        // Clean up potential unwanted formatting
        return text.replace(/^"|"$/g, '').replace(/^Motion:\s*/, '');

    } catch (error) {
        console.error("Error generating motion with Gemini:", error);
        return "Failed to generate motion. Please try again.";
    }
};
