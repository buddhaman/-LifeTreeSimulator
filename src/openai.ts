// OpenAI integration for generating life simulation nodes
import { Node } from './graph';

// Schema for structured output
const nodeSchema = {
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
const OPENAI_MODEL = 'gpt-4o-mini'; // or 'gpt-4o' for better results

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

  const systemPrompt = `You are a life simulation engine that generates realistic future scenarios.
Given a current life situation, you generate ${count} possible future scenarios.
Each scenario should be a realistic life event or decision that could happen next.
Output exactly one JSON object per scenario matching the provided schema.
Keep changes realistic and incremental (small time jumps, gradual income changes).`;

  const userPrompt = `Current situation:
- Age: ${parentNode.ageYears} years, ${parentNode.ageWeeks} weeks
- Location: ${parentNode.location}
- Relationship: ${parentNode.relationshipStatus}
- Living: ${parentNode.livingSituation}
- Career: ${parentNode.careerSituation}
- Income: $${parentNode.monthlyIncome}/month
- Latest change: ${parentNode.change}

Generate ${count} possible future scenarios. Each should represent a realistic next step in this person's life.`;

  try {
    const results: GeneratedNodeData[] = [];

    // Generate scenarios one at a time for better control
    for (let i = 0; i < count; i++) {
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
              name: 'LifeSimulationNode',
              strict: true,
              schema: nodeSchema
            }
          },
          temperature: 0.8,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      const parsed = JSON.parse(content) as GeneratedNodeData;

      // Validate the data
      if (!validateGeneratedNode(parsed)) {
        throw new Error('Generated node failed validation');
      }

      results.push(parsed);
    }

    return results;
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
