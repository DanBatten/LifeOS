/**
 * Smart Message Router
 * 
 * Uses a fast LLM (Haiku) to intelligently route messages to the right agent
 * based on content, intent, and conversation context.
 */

import type { LLMProvider } from '@lifeos/llm';
import { getLogger } from '@lifeos/core';

const logger = getLogger();

export type AgentId = 'health-agent' | 'training-coach' | 'general';

export interface RouteResult {
  agentId: AgentId;
  confidence: number; // 0-1
  reasoning: string;
  routingTimeMs: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  agentId?: string;
}

const ROUTER_SYSTEM_PROMPT = `You are a message router for a fitness/health AI system. Your job is to classify user messages and route them to the correct agent.

Available agents:
1. **health-agent**: Health, recovery, sleep, HRV, body battery, stress, injuries, biomarkers, blood work, fatigue, rest days, wellness
2. **training-coach**: Running, workouts, training plans, paces, distances, marathon prep, intervals, tempo runs, long runs, race strategy, weekly mileage

Classification rules:
- Blood biomarkers, lab results, health metrics → health-agent
- Recovery status, sleep quality, HRV analysis → health-agent  
- Injury concerns, pain, soreness → health-agent
- Workout details, running paces, training plan → training-coach
- Race prep, marathon strategy, workout modifications → training-coach
- Questions about today's/tomorrow's run → training-coach
- General greetings or unclear → training-coach (default)

Respond with ONLY a JSON object:
{
  "agentId": "health-agent" | "training-coach",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

/**
 * Route a message to the appropriate agent using LLM classification
 */
export async function routeMessage(
  llmClient: LLMProvider,
  message: string,
  conversationHistory: ConversationMessage[] = []
): Promise<RouteResult> {
  const startTime = Date.now();

  // Build context from recent conversation
  const recentContext = conversationHistory
    .slice(-4) // Last 4 messages for context
    .map(m => `${m.role}: ${m.content.slice(0, 100)}`)
    .join('\n');

  const userPrompt = recentContext
    ? `Recent conversation:\n${recentContext}\n\nNew message to route: "${message}"`
    : `Message to route: "${message}"`;

  try {
    const response = await llmClient.chat({
      systemPrompt: ROUTER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      model: 'claude-haiku-4-20250514', // Fast model for routing
      temperature: 0.1, // Low temp for consistent classification
      maxTokens: 150,
    });

    const routingTimeMs = Date.now() - startTime;
    logger.info(`[Router] Classified in ${routingTimeMs}ms`);

    // Parse JSON response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        agentId: result.agentId || 'training-coach',
        confidence: result.confidence || 0.5,
        reasoning: result.reasoning || 'No reasoning provided',
        routingTimeMs,
      };
    }

    // Fallback if parsing fails
    return {
      agentId: 'training-coach',
      confidence: 0.5,
      reasoning: 'Failed to parse routing response',
      routingTimeMs,
    };
  } catch (error) {
    const routingTimeMs = Date.now() - startTime;
    logger.error(`[Router] Error: ${error instanceof Error ? error.message : String(error)}`);
    
    // Fallback to keyword-based routing on error
    return fallbackRoute(message, routingTimeMs);
  }
}

/**
 * Fast keyword-based fallback routing (used if LLM fails)
 */
function fallbackRoute(message: string, routingTimeMs: number): RouteResult {
  const lowerMessage = message.toLowerCase();

  const healthKeywords = [
    'sleep', 'hrv', 'heart rate', 'resting', 'recovery', 'fatigue',
    'tired', 'energy', 'stress', 'body battery', 'injury', 'injured',
    'sore', 'pain', 'sick', 'biomarker', 'blood', 'lab', 'test',
    'vitamin', 'iron', 'ferritin', 'inflammation'
  ];

  const trainingKeywords = [
    'workout', 'run', 'running', 'pace', 'mile', 'marathon',
    'tempo', 'interval', 'long run', 'easy', 'training', 'plan',
    'tomorrow', 'today', 'week', 'mileage', 'race'
  ];

  const healthScore = healthKeywords.filter(kw => lowerMessage.includes(kw)).length;
  const trainingScore = trainingKeywords.filter(kw => lowerMessage.includes(kw)).length;

  if (healthScore > trainingScore) {
    return {
      agentId: 'health-agent',
      confidence: 0.6,
      reasoning: 'Keyword fallback: health terms detected',
      routingTimeMs,
    };
  }

  return {
    agentId: 'training-coach',
    confidence: 0.6,
    reasoning: 'Keyword fallback: training terms or default',
    routingTimeMs,
  };
}

/**
 * Quick pre-check for obvious routing (skips LLM for simple cases)
 */
export function quickRoute(message: string): RouteResult | null {
  const lower = message.toLowerCase().trim();

  // Obvious health queries
  if (
    lower.includes('biomarker') ||
    lower.includes('blood work') ||
    lower.includes('lab result') ||
    lower.includes('ferritin') ||
    lower.includes('vitamin d') ||
    lower.includes('inflammation')
  ) {
    return {
      agentId: 'health-agent',
      confidence: 0.95,
      reasoning: 'Quick route: explicit health/biomarker query',
      routingTimeMs: 0,
    };
  }

  // Obvious training queries
  if (
    lower.includes("today's run") ||
    lower.includes("tomorrow's run") ||
    lower.includes("my workout") ||
    lower.includes("training plan") ||
    lower.includes("marathon pace")
  ) {
    return {
      agentId: 'training-coach',
      confidence: 0.95,
      reasoning: 'Quick route: explicit training query',
      routingTimeMs: 0,
    };
  }

  // Simple greetings
  if (['hi', 'hello', 'hey', 'good morning', 'good evening'].some(g => lower === g || lower.startsWith(g + ' '))) {
    return {
      agentId: 'training-coach',
      confidence: 0.9,
      reasoning: 'Quick route: greeting',
      routingTimeMs: 0,
    };
  }

  return null; // Needs LLM routing
}

