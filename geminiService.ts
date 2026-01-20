
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

async function resizeBase64(base64: string, maxWidth = 800): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(maxWidth / img.width, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
  });
}

/**
 * Performs deep spatial analysis of a single frame.
 */
export const analyzeSpatialScene = async (base64Image: string) => {
  try {
    const resized = await resizeBase64(base64Image);
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: resized.split(',')[1] } },
            { text: "Analyze this video frame deeply. Identify 3-5 interesting objects or people. Return a JSON object with: 'summary' (a poetic description of the mood and setting) and 'labels' (array of objects with 'label', 'ymin', 'xmin', 'ymax', 'xmax' normalized 0-1000)." }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            labels: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  ymin: { type: Type.NUMBER },
                  xmin: { type: Type.NUMBER },
                  ymax: { type: Type.NUMBER },
                  xmax: { type: Type.NUMBER }
                }
              }
            }
          }
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Analysis Error:", error);
    return null;
  }
};

/**
 * Determines playback speed by analyzing scene complexity.
 */
export const analyzeContentComplexity = async (base64Image: string, fileName: string) => {
  try {
    const resized = await resizeBase64(base64Image, 400);
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: resized.split(',')[1] } },
            { text: `Evaluate the narrative density of this scene from "${fileName}". Is it fast action, complex dialogue, or slow scenery? Return JSON with 'score' (0.0-1.0, high is high complexity) and 'reason'.` }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            reason: { type: Type.STRING }
          }
        }
      }
    });
    return JSON.parse(response.text || '{"score": 0.5, "reason": "Stable flow"}');
  } catch (error) {
    return { score: 0.5, reason: "Neural link unstable" };
  }
};

/**
 * Contextual chat about the current video frame.
 */
export const chatWithScene = async (base64Image: string, query: string) => {
  try {
    const resized = await resizeBase64(base64Image);
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: resized.split(',')[1] } },
            { text: `You are Y SERIES Assistant. Context: Current video frame. Question: "${query}". Be concise, insightful, and maintain a tech-futuristic tone.` }
          ]
        }
      ],
    });
    return response.text;
  } catch (error) {
    console.error("Chat Error:", error);
    return "Protocol error: Unable to parse visual data.";
  }
};

/**
 * Semantic search through analysis history to find relevant timestamps.
 */
export const semanticSearch = async (query: string, history: { timestamp: number, description: string }[]): Promise<number> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `User Query: "${query}". Video History: ${JSON.stringify(history)}. Find the most relevant timestamp. Return JSON with 'timestamp' property. If nothing matches, return -1.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            timestamp: { type: Type.NUMBER }
          },
          required: ["timestamp"]
        }
      }
    });
    const data = JSON.parse(response.text || '{"timestamp": -1}');
    return data.timestamp;
  } catch (error) {
    return -1;
  }
};

/**
 * Generates precise chapters based on a temporal sequence of frames.
 */
export const generateChapters = async (frames: { timestamp: number, data: string }[]) => {
  try {
    const processedFrames = await Promise.all(frames.map(async f => ({
      timestamp: f.timestamp,
      data: (await resizeBase64(f.data, 400)).split(',')[1]
    })));

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            ...processedFrames.map(f => ({ inlineData: { mimeType: 'image/jpeg', data: f.data } })),
            { text: "Review this sequence of video frames. Identify key narrative shifts or scene changes to create meaningful chapters. Return a JSON array of objects with 'timestamp' and 'title'. Ensure timestamps correspond to logical story beats." }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              timestamp: { type: Type.NUMBER },
              title: { type: Type.STRING }
            },
            required: ["timestamp", "title"]
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Chapter Gen Error:", error);
    return [];
  }
};
