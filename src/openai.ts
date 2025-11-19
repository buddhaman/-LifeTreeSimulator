// OpenAI integration for generating life simulation nodes
import { Node, findNode } from './graph';

// Schema for structured output - array of 3 scenarios
const scenariosSchema = {
  type: "object",
  properties: {
    scenarios: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Short label for the decision or event"
          },
          change: {
            type: "string",
            description: "One sentence describing what changed"
          },
          ageYears: {
            type: "integer",
            minimum: 0,
            description: "Whole years of age after the event"
          },
          ageWeeks: {
            type: "integer",
            minimum: 0,
            maximum: 51,
            description: "Weeks beyond the years (0-51)"
          },
          location: {
            type: "string",
            description: "New location after the event"
          },
          relationshipStatus: {
            type: "string",
            description: "Relationship status after the event"
          },
          livingSituation: {
            type: "string",
            description: "Living situation (e.g., renting, own house, shared flat) after the event"
          },
          careerSituation: {
            type: "string",
            description: "Career situation after the event (e.g., student, working professional, freelancer)"
          },
          monthlyIncome: {
            type: "number",
            minimum: 0,
            description: "Net monthly income after the event"
          }
        },
        required: [
          "title",
          "change",
          "ageYears",
          "ageWeeks",
          "location",
          "relationshipStatus",
          "livingSituation",
          "careerSituation",
          "monthlyIncome"
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

// Response from OpenAI matching the schema
interface GeneratedNodeData {
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
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
const OPENAI_MODEL = 'gpt-5-nano'; // Latest lightweight model (released Aug 2025)

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
 * Generate child scenarios from a parent node using OpenAI
 * @param parentNode The parent node to generate children from
 * @param count Number of scenarios to generate (default: 3)
 * @returns Array of generated node data
 */
export async function generateChildScenarios(
  parentNode: Node,
  count: number = 3
): Promise<GeneratedNodeData[]> {
  if (!OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not set, returning mock data');
    return generateMockScenarios(parentNode, count);
  }

  // Build ancestry chain
  const ancestry = getAncestryChain(parentNode);

  // Build life history from ancestry
  const lifeHistory = ancestry.map((node, index) => {
    if (index === 0) {
      return `STARTING POINT:\n- Age: ${node.ageYears}y ${node.ageWeeks}w\n- ${node.change}\n- Location: ${node.location}\n- Relationship: ${node.relationshipStatus}\n- Living: ${node.livingSituation}\n- Career: ${node.careerSituation}\n- Income: $${node.monthlyIncome}/month`;
    } else {
      return `THEN:\n- Age: ${node.ageYears}y ${node.ageWeeks}w\n- ${node.change}\n- Location: ${node.location}\n- Relationship: ${node.relationshipStatus}\n- Living: ${node.livingSituation}\n- Career: ${node.careerSituation}\n- Income: $${node.monthlyIncome}/month`;
    }
  }).join('\n\n');

  const systemPrompt = `You are a life simulation engine that generates realistic future scenarios.
Given a person's life history, you generate exactly 3 diverse possible future scenarios.
Each scenario should be a realistic life event or decision that could happen next.
Keep changes realistic and incremental (small time jumps of weeks/months, gradual income changes).
Make the scenarios meaningfully different from each other - explore different life paths.`;

  const userPrompt = `LIFE HISTORY:

${lifeHistory}

Based on this life journey, generate exactly 3 diverse possible next scenarios.
Each should represent a different realistic direction this person's life could take from their current situation.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'LifeSimulationScenarios',
            strict: true,
            schema: scenariosSchema
          }
        },
        temperature: 0.9,
        max_completion_tokens: 1500
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
      const errorMessage = errorData.error?.message || response.statusText || 'Unknown error';
      throw new Error(`OpenAI API error: ${errorMessage}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    const parsed = JSON.parse(content) as { scenarios: GeneratedNodeData[] };

    // Validate all scenarios
    if (!parsed.scenarios || parsed.scenarios.length !== 3) {
      throw new Error('Expected exactly 3 scenarios');
    }

    for (const scenario of parsed.scenarios) {
      if (!validateGeneratedNode(scenario)) {
        throw new Error('Generated scenario failed validation');
      }
    }

    return parsed.scenarios;
  } catch (error) {
    console.error('Error generating scenarios with OpenAI:', error);
    // Fallback to mock data
    return generateMockScenarios(parentNode, count);
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
 * Generate mock scenarios (fallback when API key is not set)
 */
function generateMockScenarios(parentNode: Node, count: number): GeneratedNodeData[] {
  const mockTemplates = [
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
    },
    {
      title: 'Further Education',
      change: 'Started taking evening classes',
      ageDelta: 0.5,
      incomeDelta: -200,
      careerChange: 'Student & ' + parentNode.careerSituation
    },
    {
      title: 'Housing Upgrade',
      change: 'Moved to a better apartment',
      ageDelta: 0.25,
      incomeDelta: -300,
      livingChange: 'Upgraded apartment'
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
