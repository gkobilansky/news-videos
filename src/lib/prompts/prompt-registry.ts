export interface PromptConfig {
  version: string
  model: string
  temperature?: number
  maxTokens?: number
  template: string
  systemMessage?: string
  requirements?: string[]
  examples?: Array<{
    input: Record<string, any>
    expectedOutput: string
  }>
  metadata?: Record<string, any>
}

export interface PromptVariable {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  required: boolean
  description?: string
  defaultValue?: any
}

export interface PromptMetadata {
  variables: PromptVariable[]
  outputFormat: 'text' | 'json' | 'structured'
  maxOutputLength?: number
  validation?: (output: any) => boolean
}

export const PROMPTS = {
  // Script Generation
  SCRIPT_GENERATION: {
    version: "1.2.0",
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 100,
    template: `Create a 10-15 second video script for a vertical newsbite format.

Requirements:
- 50 words maximum
- Engaging, punchy delivery for social media
- Focus on the key impact or significance
- Written for voice-over narration

Headline: {{headline}}

Sources:
{{sources}}

Hot Take: {{hot_take}}

Generate only the script text, no additional formatting or explanations.`,
    requirements: [
      "50 words maximum",
      "Engaging, punchy delivery for social media",
      "Focus on the key impact or significance",
      "Written for voice-over narration"
    ],
    metadata: {
      variables: [
        { name: "headline", type: "string", required: true, description: "The news headline" },
        { name: "sources", type: "string", required: true, description: "Formatted source URLs" },
        { name: "hot_take", type: "string", required: false, description: "User's perspective on the story" }
      ],
      outputFormat: "text",
      maxOutputLength: 50,
      validation: (output: string) => output.split(' ').length <= 50
    }
  } as PromptConfig,

  // Storyboard Generation
  STORYBOARD_GENERATION: {
    version: "2.1.0",
    model: "gpt-4o-mini", 
    temperature: 0.7,
    systemMessage: `You are a professional video storyboard creator specializing in news content for Runway ML Gen-4.

CRITICAL WORKFLOW REQUIREMENTS:
1. Split the script into 2-3 logical beats/segments
2. Create ONE shot per beat (2-3 shots total)
3. Each shot should be 5-10 seconds (total video 10-15 seconds)
4. Use motion-centric, action-focused prompts
5. Avoid negatives and conversational fluff
6. Include presenter/anchor references for consistency

SHOT DISTRIBUTION STRATEGY:
- 2 shots: Establishing shot + Close-up/detail shot
- 3 shots: Wide establishing + Medium focus + Close resolution

PROMPT STYLE GUIDE:
✅ Good: "handheld camera follows presenter walking through newsroom"
✅ Good: "dolly-in on anchor gesturing at data visualization"
✅ Good: "dynamic pan across breaking news graphics"
❌ Avoid: "don't show sad faces"
❌ Avoid: "the anchor is talking about..."

REFERENCE IMAGES:
- Use @anchor tag in prompts for presenter consistency
- Include camera movements and angles
- Focus on visual storytelling, not dialogue

Return a JSON object with this exact structure:
{
  "model": "gen4_turbo",
  "ratio": "768:1280",
  "shots": [
    {
      "promptText": "motion-centric action description with @anchor tag",
      "duration": 5,
      "camera": {
        "movement": "dolly-in|dolly-out|pan-left|pan-right|handheld|static|zoom-in|zoom-out",
        "angle": "eye-level|low-angle|high-angle|bird-eye|worm-eye"
      }
    }
  ],
  "fps": 24,
  "output_format": "mp4"
}`,
    template: `Create a storyboard for this news story:

HEADLINE: {{headline}}
HOT TAKE: {{hot_take}}
SCRIPT TO SPLIT: "{{script_text}}"

SOURCES: {{sources}}

{{source_content}}

Split the script into logical beats and create 2-3 dynamic shots that bring this news story to life. Each shot should advance the narrative and use engaging camera work.`,
    requirements: [
      "Split script into 2-3 logical beats",
      "Create ONE shot per beat",
      "Each shot 5-10 seconds",
      "Use motion-centric, action-focused prompts",
      "Include presenter/anchor references",
      "Return valid JSON structure"
    ],
    metadata: {
      variables: [
        { name: "headline", type: "string", required: true, description: "The news headline" },
        { name: "hot_take", type: "string", required: false, description: "User's perspective on the story" },
        { name: "script_text", type: "string", required: true, description: "The script to split into shots" },
        { name: "sources", type: "string", required: true, description: "Formatted source URLs" },
        { name: "source_content", type: "string", required: false, description: "Content from sources" }
      ],
      outputFormat: "json",
      validation: (output: any) => {
        return output && 
               output.shots && 
               Array.isArray(output.shots) && 
               output.shots.length >= 2 && 
               output.shots.length <= 3 &&
               output.shots.every((shot: any) => shot.promptText && shot.duration)
      }
    }
  } as PromptConfig,

  // Video Generation Context
  VIDEO_GENERATION_CONTEXT: {
    version: "1.0.0",
    model: "runway-gen4",
    template: `{{base_prompt}}. {{style_prompt}}. Professional news broadcast quality, vibrant colors, dynamic camera movement.{{hot_take_context}}`,
    requirements: [
      "Include motion-centric language",
      "Professional news broadcast quality",
      "Dynamic camera movement",
      "Truncate to 500 characters for Runway API"
    ],
    metadata: {
      variables: [
        { name: "base_prompt", type: "string", required: true, description: "Base shot prompt" },
        { name: "style_prompt", type: "string", required: true, description: "Visual style based on story keywords" },
        { name: "hot_take_context", type: "string", required: false, description: "Additional context from hot take" }
      ],
      outputFormat: "text",
      maxOutputLength: 500,
      validation: (output: string) => output.length <= 500
    }
  } as PromptConfig,

  // TTS Configuration
  TTS_GENERATION: {
    version: "1.0.0",
    model: "tts-1",
    template: "{{script_text}}",
    requirements: [
      "Clean script text",
      "Proper punctuation for speech",
      "No formatting characters"
    ],
    metadata: {
      variables: [
        { name: "script_text", type: "string", required: true, description: "The script text to convert to speech" }
      ],
      outputFormat: "text",
      validation: (output: string) => output.trim().length > 0
    }
  } as PromptConfig
} as const

export type PromptKey = keyof typeof PROMPTS

export class PromptRegistry {
  static getPrompt(key: PromptKey): PromptConfig {
    return PROMPTS[key]
  }

  static renderPrompt(key: PromptKey, variables: Record<string, any>): string {
    const prompt = PROMPTS[key]
    let rendered = prompt.template
    
    // Replace template variables
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g')
      rendered = rendered.replace(regex, String(value || ''))
    })
    
    // Clean up any remaining unreplaced variables
    rendered = rendered.replace(/{{[^}]+}}/g, '')
    
    return rendered
  }

  static validateOutput(key: PromptKey, output: any): boolean {
    const prompt = PROMPTS[key]
    return prompt.metadata?.validation ? prompt.metadata.validation(output) : true
  }

  static getSystemMessage(key: PromptKey): string | undefined {
    return PROMPTS[key].systemMessage
  }

  static getRequiredVariables(key: PromptKey): PromptVariable[] {
    const prompt = PROMPTS[key]
    return prompt.metadata?.variables?.filter(v => v.required) || []
  }

  static getAllPrompts(): Record<string, PromptConfig> {
    return PROMPTS
  }
}