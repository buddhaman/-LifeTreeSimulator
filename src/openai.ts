// AI integration for generating life simulation nodes
// Supports both OpenAI and GreenPT based on configuration
import { Node, findNode } from './graph';

// Schema for array of scenarios
const scenariosSchema = {
  type: "object",
  properties: {
    scenarios: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          change: { type: "string" },
          ageYears: { type: "integer", minimum: 0 },
          ageWeeks: { type: "integer", minimum: 0, maximum: 51 },
          location: { type: "string" },
          relationshipStatus: { type: "string" },
          livingSituation: { type: "string" },
          careerSituation: { type: "string" },
          monthlyIncome: { type: "number", minimum: 0 }
        },
        required: [
          "title", "change", "ageYears", "ageWeeks", "location",
          "relationshipStatus", "livingSituation", "careerSituation", "monthlyIncome"
        ],
        additionalProperties: false
      },
      minItems: 3,
      maxItems: 3
    }
  },
  required: ["scenarios"],
  additionalProperties: false
};

// Response from AI provider
export interface GeneratedNodeData {
  title: string;
  change: string;
  ageYears: number;
  ageWeeks: number;
  location: string;
  relationshipStatus: string;
  livingSituation: string;
  careerSituation: string;
  monthlyIncome: number;
}

// Configuration
const USE_GREENPT = import.meta.env.VITE_GREENPT === 'true';
const API_KEY = USE_GREENPT
  ? (import.meta.env.VITE_GREENPT_API_KEY || '')
  : (import.meta.env.VITE_OPENAI_API_KEY || '');

// Use proxy in development to bypass CORS issues with GreenPT
const API_BASE_URL = USE_GREENPT
  ? (import.meta.env.DEV ? '/api/greenpt/v1/chat/completions' : 'https://api.greenpt.ai/v1/chat/completions')
  : 'https://api.openai.com/v1/chat/completions';

const MODEL = USE_GREENPT ? 'green-l-raw' : 'gpt-4o-mini';
const PROVIDER_NAME = USE_GREENPT ? 'GreenPT' : 'OpenAI';

// Log configuration on module load
console.log('🔧 AI Provider Configuration:');
console.log('  VITE_GREENPT env:', import.meta.env.VITE_GREENPT);
console.log('  USE_GREENPT:', USE_GREENPT);
console.log('  PROVIDER_NAME:', PROVIDER_NAME);
console.log('  MODEL:', MODEL);
console.log('  API_BASE_URL:', API_BASE_URL);
console.log('  DEV mode:', import.meta.env.DEV);
console.log('  API_KEY present:', !!API_KEY);
console.log('  API_KEY length:', API_KEY?.length || 0);

/**
 * Build ancestry chain from node to root
 */
function getAncestryChain(node: Node): Node[] {
  const chain: Node[] = [node];
  let current = node;

  while (current.parentId !== null) {
    const parent = findNode(current.parentId);
    if (!parent) break;
    chain.unshift(parent);
    current = parent;
  }

  return chain;
}

/**
 * Generate child scenarios with streaming (collects full result at end)
 * @param parentNode The parent node to generate children from
 * @param count Number of scenarios to generate (default: 3)
 * @returns Array of generated node data
 */
export async function generateChildScenariosStreaming(
  parentNode: Node,
  count: number = 3,
  onNode: (node: GeneratedNodeData) => void
): Promise<void> {
  if (!API_KEY) {
    console.warn(`${PROVIDER_NAME} API key not set, returning mock data`);
    const mockData = generateMockScenarios(parentNode, count);
    for (const node of mockData) {
      onNode(node);
    }
    return;
  }

  // Build ancestry chain
  const ancestry = getAncestryChain(parentNode);

  // Build life history
  const lifeHistory = ancestry.map((node, index) => {
    if (index === 0) {
      return `START: Age ${node.ageYears}y ${node.ageWeeks}w - ${node.change} - ${node.location} - ${node.relationshipStatus} - ${node.livingSituation} - ${node.careerSituation} - $${node.monthlyIncome}/mo`;
    } else {
      return `THEN: Age ${node.ageYears}y ${node.ageWeeks}w - ${node.change}`;
    }
  }).join('\n');

  const systemPrompt = `Generate ${count} diverse life scenarios. Each should explore DIFFERENT aspects of life. Make them meaningfully different from each other.

SCENARIO VARIETY:
- Make 1-2 scenarios that are pretty varied and different from each other.
- Make at least 1 scenario wacky, unexpected, or unusual - something surprising that could still happen but would be a wild turn of events

IMPORTANT AGE RULES:
1. Each scenario must happen AFTER the current point in time. The age must be EQUAL TO OR GREATER than the current age (${parentNode.ageYears} years ${parentNode.ageWeeks} weeks). Never go backwards in time.
2. Advance time by approximately 1-2 years per scenario. Also add some weeks to the age to make it more realistic.
3. Keep life changes realistic for this timeframe.`;

  const userPrompt = `${lifeHistory}

Generate ${count} diverse future scenarios that happen 1-2 years AFTER the current point (age ${parentNode.ageYears}y ${parentNode.ageWeeks}w). Each scenario should advance time by roughly 1-2 years.`;

  console.log('═══════════════════════════════════════');
  console.log(`🚀 STREAMING REQUEST (${PROVIDER_NAME})`);
  console.log('═══════════════════════════════════════');
  console.log('Provider:', PROVIDER_NAME);
  console.log('USE_GREENPT:', USE_GREENPT);
  console.log('API URL:', API_BASE_URL);
  console.log('API Key present:', !!API_KEY);
  console.log('API Key length:', API_KEY.length);
  console.log('API Key prefix:', API_KEY.substring(0, 10) + '...');
  console.log('Count:', count);
  console.log('Model:', MODEL);
  console.log('Current Age:', parentNode.ageYears, 'years', parentNode.ageWeeks, 'weeks');
  console.log('\n--- SYSTEM PROMPT ---');
  console.log(systemPrompt);
  console.log('\n--- USER PROMPT ---');
  console.log(userPrompt);

  // Build request body - GreenPT DOES support response_format with json_schema!
  const requestBody = {
    model: MODEL,
    stream: true,
    temperature: 0.8,
    //max_tokens: 1000,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'LifeScenarios',
        strict: true,
        schema: scenariosSchema
      }
    }
  }

  console.log('\n--- REQUEST BODY (FULL JSON) ---');
  console.log(JSON.stringify(requestBody, null, 2));
  console.log('═══════════════════════════════════════\n');

  try {
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    console.log('✅ Response Status:', response.status);
    console.log('✅ Response Headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('\n❌ API ERROR ❌');
      console.error('Status:', response.status);
      console.error('Status Text:', response.statusText);
      console.error('Error Response:', errorText);
      console.error('Request URL:', API_BASE_URL);
      console.error('Request Headers:', {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY.substring(0, 10)}...`
      });
      console.error('Request Body (excerpt):', JSON.stringify(requestBody).substring(0, 500) + '...');
      throw new Error(`${PROVIDER_NAME} API error (${response.status}): ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let jsonBuffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;

        if (trimmed.startsWith('data: ')) {
          try {
            const jsonStr = trimmed.slice(6);
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;

            if (content) {
              // Log streaming content for debugging
              console.log('📦', content);
              jsonBuffer += content;
            }
          } catch (err) {
            // Skip invalid lines
          }
        }
      }
    }

    // Parse the complete accumulated JSON
    console.log('\n🔍 Parsing complete response...');
    console.log('Raw jsonBuffer length:', jsonBuffer.length);
    console.log('Raw jsonBuffer (first 200 chars):', jsonBuffer.substring(0, 200));

    const parsed = JSON.parse(jsonBuffer.trim()) as { scenarios: GeneratedNodeData[] };

    console.log('✅ Received', parsed.scenarios.length, 'scenarios');
    console.log('\n--- GENERATED SCENARIOS ---');

    // Validate and call onNode for each
    if (!parsed.scenarios || parsed.scenarios.length !== count) {
      throw new Error(`Expected ${count} scenarios, got ${parsed.scenarios?.length || 0}`);
    }

    for (let i = 0; i < parsed.scenarios.length; i++) {
      const scenario = parsed.scenarios[i];

      // Check age continuity
      const totalWeeksParent = parentNode.ageYears * 52 + parentNode.ageWeeks;
      const totalWeeksScenario = scenario.ageYears * 52 + scenario.ageWeeks;

      if (totalWeeksScenario < totalWeeksParent) {
        console.warn(`⚠️  Scenario ${i + 1} goes backwards in time! Parent: ${parentNode.ageYears}y ${parentNode.ageWeeks}w, Scenario: ${scenario.ageYears}y ${scenario.ageWeeks}w`);
        // Fix: set to at least parent's age + 1 week
        scenario.ageYears = parentNode.ageYears;
        scenario.ageWeeks = parentNode.ageWeeks + 1;
        if (scenario.ageWeeks > 51) {
          scenario.ageYears += 1;
          scenario.ageWeeks = 0;
        }
        console.log(`   ✓ Fixed to: ${scenario.ageYears}y ${scenario.ageWeeks}w`);
      }

      if (validateGeneratedNode(scenario)) {
        console.log(`✅ ${i + 1}: "${scenario.title}" (Age: ${scenario.ageYears}y ${scenario.ageWeeks}w)`);
        console.log(`   ${scenario.change}`);
        onNode(scenario);
      } else {
        throw new Error(`Scenario ${i + 1} failed validation`);
      }
    }
    console.log('═══════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Generation error:', error);
    // Fallback to mock data
    const mockData = generateMockScenarios(parentNode, count);
    for (const node of mockData) {
      onNode(node);
    }
  }
}

/**
 * Validate generated node data
 */
function validateGeneratedNode(data: unknown): data is GeneratedNodeData {
  if (typeof data !== 'object' || data === null) return false;

  const node = data as Record<string, unknown>;

  return (
    typeof node.title === 'string' &&
    typeof node.change === 'string' &&
    typeof node.ageYears === 'number' && node.ageYears >= 0 &&
    typeof node.ageWeeks === 'number' && node.ageWeeks >= 0 && node.ageWeeks <= 51 &&
    typeof node.location === 'string' &&
    typeof node.relationshipStatus === 'string' &&
    typeof node.livingSituation === 'string' &&
    typeof node.careerSituation === 'string' &&
    typeof node.monthlyIncome === 'number' && node.monthlyIncome >= 0
  );
}

/**
 * Generate mock scenarios (fallback)
 */
function generateMockScenarios(parentNode: Node, count: number): GeneratedNodeData[] {
  const mockTemplates: Array<{
    title: string;
    change: string;
    ageDelta: number;
    incomeDelta: number;
    careerChange?: string;
    relationshipChange?: string;
    locationChange?: string;
    livingChange?: string;
  }> = [
    {
      title: 'Career Advancement',
      change: 'Got promoted to senior position at work',
      ageDelta: 1,
      incomeDelta: 500,
      careerChange: 'Senior ' + parentNode.careerSituation
    },
    {
      title: 'New Relationship',
      change: 'Started dating someone special',
      ageDelta: 0.5,
      incomeDelta: 0,
      relationshipChange: 'In a relationship'
    },
    {
      title: 'Move to New City',
      change: 'Relocated for better opportunities',
      ageDelta: 0.25,
      incomeDelta: 200,
      locationChange: 'New City'
    }
  ];

  const results: GeneratedNodeData[] = [];
  for (let i = 0; i < count; i++) {
    const template = mockTemplates[i % mockTemplates.length];
    const ageDelta = template.ageDelta;
    const newAgeYears = parentNode.ageYears + Math.floor(ageDelta);
    const newAgeWeeks = Math.min(51, parentNode.ageWeeks + Math.floor((ageDelta % 1) * 52));

    results.push({
      title: template.title,
      change: template.change,
      ageYears: newAgeYears,
      ageWeeks: newAgeWeeks,
      location: template.locationChange || parentNode.location,
      relationshipStatus: template.relationshipChange || parentNode.relationshipStatus,
      livingSituation: template.livingChange || parentNode.livingSituation,
      careerSituation: template.careerChange || parentNode.careerSituation,
      monthlyIncome: Math.max(0, parentNode.monthlyIncome + template.incomeDelta)
    });
  }

  return results;
}
