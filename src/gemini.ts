// Gemini integration for generating life situation images
import { GoogleGenAI } from "@google/genai";
import { Node } from './graph';

// Configuration
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-2.5-flash-image';

/**
 * Generate a sophisticated cartoon image illustrating the person's life at the given node situation
 * @param node The node containing the life situation details
 * @returns Base64 encoded image string, or null if generation fails
 */
export async function generateLifeImage(node: Node): Promise<string | null> {
  console.log('🎨 [GEMINI] generateLifeImage called for node:', node.title);

  if (!GEMINI_API_KEY) {
    console.error('🎨 [GEMINI] ❌ VITE_GEMINI_API_KEY not set! Please check your .env file.');
    console.error('🎨 [GEMINI] Expected key in .env: VITE_GEMINI_API_KEY');
    console.error('🎨 [GEMINI] Current value:', GEMINI_API_KEY ? 'SET' : 'NOT SET');
    console.error('🎨 [GEMINI] NOTE: Vite requires the VITE_ prefix for client-side env vars!');
    return null;
  }

  console.log('🎨 [GEMINI] ✓ API key found');

  // Build a detailed prompt based on the node's life situation
  const prompt = buildImagePrompt(node);

  console.log('═══════════════════════════════════════');
  console.log('🎨 [GEMINI] GENERATING IMAGE');
  console.log('═══════════════════════════════════════');
  console.log('Model:', GEMINI_MODEL);
  console.log('Node:', node.title);
  console.log('API Key (first 10 chars):', GEMINI_API_KEY.substring(0, 10) + '...');
  console.log('\n--- PROMPT ---');
  console.log(prompt);
  console.log('═══════════════════════════════════════\n');

  try {
    console.log('🎨 [GEMINI] Initializing GoogleGenAI client...');
    const ai = new GoogleGenAI({
      apiKey: GEMINI_API_KEY
    });
    console.log('🎨 [GEMINI] ✓ Client initialized');

    console.log('🎨 [GEMINI] Calling generateContent API...');
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseModalities: ['Image'],
        imageConfig: {
          aspectRatio: '16:9' // Wide format for the sidebar display
        }
      }
    });
    console.log('🎨 [GEMINI] ✓ API call completed');

    // Extract the image from the response
    console.log('🎨 [GEMINI] Parsing response...');
    console.log('🎨 [GEMINI] Full response object:', JSON.stringify(response, null, 2));

    // The response structure should have candidates with content parts
    const candidates = (response as any).candidates;
    console.log('🎨 [GEMINI] Candidates:', candidates ? `Found ${candidates.length} candidates` : 'No candidates');

    if (candidates && candidates.length > 0) {
      const content = candidates[0].content;
      console.log('🎨 [GEMINI] Content:', content ? 'Found content' : 'No content');

      if (content && content.parts) {
        console.log('🎨 [GEMINI] Parts:', `Found ${content.parts.length} parts`);

        for (let i = 0; i < content.parts.length; i++) {
          const part = content.parts[i];
          console.log(`🎨 [GEMINI] Part ${i}:`, Object.keys(part));

          if (part.inlineData) {
            const imageData = part.inlineData.data;
            const mimeType = part.inlineData.mimeType;
            console.log('🎨 [GEMINI] ✓ Found inline data!');
            console.log('🎨 [GEMINI] MIME type:', mimeType);
            console.log('🎨 [GEMINI] Data length:', imageData ? imageData.length : 0, 'characters');
            console.log('🎨 [GEMINI] ✅ Image generated successfully!');
            console.log('═══════════════════════════════════════\n');

            // Return as data URL for easy display in img tags
            return `data:${mimeType};base64,${imageData}`;
          }
        }
      }
    }

    console.error('🎨 [GEMINI] ❌ No image data found in response');
    console.log('═══════════════════════════════════════\n');
    return null;

  } catch (error) {
    console.error('🎨 [GEMINI] ❌ Image generation error:', error);
    if (error instanceof Error) {
      console.error('🎨 [GEMINI] Error message:', error.message);
      console.error('🎨 [GEMINI] Error stack:', error.stack);
    }
    console.log('═══════════════════════════════════════\n');
    return null;
  }
}

/**
 * Build a detailed prompt for image generation based on the node's life situation
 */
function buildImagePrompt(node: Node): string {
  // Create a sophisticated cartoon style prompt
  const age = `${node.ageYears} years old`;

  const prompt = `Create a sophisticated, whimsical cartoon illustration depicting this life moment:

Title: ${node.title}
Situation: ${node.change}

Character Appearance (IMPORTANT - The main character must have these exact features):
- Hair: ${node.hairColor}, ${node.hairStyle}
- Eyes: ${node.eyeColor}
- Facial Hair: ${node.facialHair}
- Glasses: ${node.glasses}
- Build: ${node.build}
- Age: ${age}

Life Details:
- Location: ${node.location}
- Relationship: ${node.relationshipStatus}
- Living: ${node.livingSituation}
- Career: ${node.careerSituation}
- Income: $${node.monthlyIncome}/month

Style Requirements:
Create a warm, friendly cartoon illustration with a sophisticated aesthetic. The art style should be:
- Charming and approachable, like editorial illustrations in lifestyle magazines
- Rich colors with good contrast
- Clear composition focusing on the key moment or situation
- The main character MUST match the physical appearance details listed above
- Expressive character that conveys the emotion of this life stage
- Include relevant environmental details that tell the story (location, career elements, etc.)
- Avoid being too simple or childish - aim for a mature, professional cartoon style

The image should capture the essence and emotion of this specific life moment, making it feel real and relatable while maintaining an artistic, illustrated quality. The character's appearance must remain consistent with the description provided.`;

  return prompt;
}
