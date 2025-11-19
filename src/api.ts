// Placeholder for Claude API integration
// TODO: Add your Anthropic API key and integrate with Claude API

import { Node } from './graph';

const ANTHROPIC_API_KEY = 'YOUR_API_KEY_HERE';

export interface Scenario {
  title: string;
  description: string;
  probability: number;
  tags: string[];
}

export async function generateScenarios(parentScenario: Node): Promise<Scenario[]> {
  // This is a placeholder that returns mock data
  // Replace this with actual Claude API call

  /* Example Claude API integration:

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Given this life scenario: "${parentScenario.title} - ${parentScenario.description}",
                  generate 3 possible future scenarios. For each scenario provide:
                  - title (short, under 50 chars)
                  - description (1-2 sentences)
                  - probability (0-100)
                  - tags (2-3 keywords)

                  Return as JSON array.`
      }]
    })
  });

  const data = await response.json();
  return JSON.parse(data.content[0].text);

  */

  // Mock data for now
  return new Promise((resolve) => {
    setTimeout(() => {
      const scenarios: Scenario[] = [
        {
          title: 'Career Advancement',
          description: 'You take a risk and pursue a promotion at work.',
          probability: 65,
          tags: ['career', 'growth'],
        },
        {
          title: 'New Skill',
          description: 'You decide to learn something completely new.',
          probability: 80,
          tags: ['education', 'personal'],
        },
        {
          title: 'Relationship Change',
          description: 'A significant change in your personal life.',
          probability: 45,
          tags: ['personal', 'social'],
        },
      ];
      resolve(scenarios);
    }, 500);
  });
}
