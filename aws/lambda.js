// AWS Lambda function for Chrome translation extension
// Handles OpenAI API integration for translation and summarization using modern API

const OpenAI = require('openai');

// Configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OPENAI_MODEL = 'gpt-4o-mini';
const MAX_TOKENS = 4000;
const TEMPERATURE = 0.3;

// Function definitions for OpenAI tool calling
const translationTool = {
  type: "function",
  function: {
    name: "provide_translation",
    description: "Provide translations for text segments",
    parameters: {
      type: "object",
      properties: {
        translations: {
          type: "object",
          description: "Object mapping original text to translated text",
          additionalProperties: {
            type: "string"
          }
        }
      },
      required: ["translations"]
    }
  }
};

const summaryTool = {
  type: "function",
  function: {
    name: "provide_summary",
    description: "Provide a structured summary of web content",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Brief title for the summary"
        },
        points: {
          type: "array",
          description: "Array of key points with emojis",
          items: {
            type: "object",
            properties: {
              emoji: {
                type: "string",
                description: "Relevant emoji for the point"
              },
              text: {
                type: "string",
                description: "Summary text for the point"
              }
            },
            required: ["emoji", "text"]
          }
        }
      },
      required: ["title", "points"]
    }
  }
};

const languageDetectionTool = {
  type: "function",
  function: {
    name: "detect_language",
    description: "Detect the language of the provided text",
    parameters: {
      type: "object",
      properties: {
        detectedLanguage: {
          type: "string",
          description: "The name of the detected language in English"
        }
      },
      required: ["detectedLanguage"]
    }
  }
};

// Main Lambda handler
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Parse request body
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { action, content, sourceLanguage, targetLanguage, model, pageUrl } = body;

    // Validate input
    if (!action || !content) {
      return createErrorResponse('Missing required fields: action and content', 400, headers);
    }

    let result;
    
    switch (action) {
      case 'translate':
        result = await handleTranslation(content, sourceLanguage, targetLanguage);
        break;
        
      case 'summarize':
        result = await handleSummarization(content, targetLanguage, pageUrl);
        break;
        
      case 'detect-language':
        result = await handleLanguageDetection(content);
        break;
        
      default:
        return createErrorResponse(`Unknown action: ${action}`, 400, headers);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        ...result
      })
    };

  } catch (error) {
    console.error('Lambda error:', error);
    
    return createErrorResponse(
      error.message || 'Internal server error',
      error.statusCode || 500,
      headers
    );
  }
};

async function handleTranslation(content, sourceLanguage, targetLanguage) {
  // Break content into manageable chunks
  const chunks = chunkText(content, 2000);
  const allTranslations = {};
  
  for (const chunk of chunks) {
    const prompt = createTranslationPrompt(chunk, sourceLanguage, targetLanguage);
    
    try {
      const response = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. When given text to translate, use the provide_translation function to return translations. Translate text while preserving meaning, tone, and context. If the text is already in ${targetLanguage}, return it unchanged. Split the text into logical segments (sentences or phrases) and provide translations for each segment.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        tools: [translationTool],
        tool_choice: { type: "function", function: { name: "provide_translation" } },
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE
      });

      const toolCall = response.choices[0]?.message?.tool_calls?.[0];
      
      if (toolCall && toolCall.function.name === 'provide_translation') {
        try {
          const functionResult = JSON.parse(toolCall.function.arguments);
          if (functionResult.translations) {
            Object.assign(allTranslations, functionResult.translations);
          }
        } catch (parseError) {
          console.error('Failed to parse translation function result:', parseError);
        }
      }
      
    } catch (error) {
      console.error('Translation error for chunk:', error);
      // Continue with other chunks even if one fails
    }
  }
  
  return { translations: allTranslations };
}

async function handleSummarization(content, targetLanguage, pageUrl) {
  const prompt = createSummarizationPrompt(content, targetLanguage, pageUrl);
  
  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant that creates concise, helpful summaries of web content. Use the provide_summary function to return a structured summary with 3-5 key points, each with an appropriate emoji. Write in ${targetLanguage}.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      tools: [summaryTool],
      tool_choice: { type: "function", function: { name: "provide_summary" } },
      max_tokens: 800,
      temperature: 0.5
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    
    if (toolCall && toolCall.function.name === 'provide_summary') {
      try {
        const functionResult = JSON.parse(toolCall.function.arguments);
        
        // Validate summary structure
        if (functionResult.title && Array.isArray(functionResult.points)) {
          return { summary: functionResult };
        }
      } catch (parseError) {
        console.error('Failed to parse summary function result:', parseError);
      }
    }
    
    // Fallback summary if parsing fails
    return {
      summary: {
        title: `Summary of ${extractDomainFromUrl(pageUrl)}`,
        points: [
          { emoji: '📄', text: 'Content summary is currently unavailable.' },
          { emoji: '🔄', text: 'Please try again in a moment.' }
        ]
      }
    };
    
  } catch (error) {
    console.error('Summarization error:', error);
    throw new Error('Failed to generate summary');
  }
}

async function handleLanguageDetection(content) {
  const prompt = `Detect the language of this text: "${content.substring(0, 500)}"`;
  
  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a language detection expert. Use the detect_language function to return the detected language name in English.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      tools: [languageDetectionTool],
      tool_choice: { type: "function", function: { name: "detect_language" } },
      max_tokens: 50,
      temperature: 0.1
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    
    if (toolCall && toolCall.function.name === 'detect_language') {
      try {
        const functionResult = JSON.parse(toolCall.function.arguments);
        return { detectedLanguage: functionResult.detectedLanguage };
      } catch (parseError) {
        console.error('Failed to parse language detection result:', parseError);
      }
    }
    
    return { detectedLanguage: 'Unknown' };
    
  } catch (error) {
    console.error('Language detection error:', error);
    return { detectedLanguage: 'Unknown' };
  }
}

// Helper functions
function createTranslationPrompt(text, sourceLanguage, targetLanguage) {
  const sourceLang = sourceLanguage === 'auto' ? 'the detected language' : sourceLanguage;
  
  return `Translate the following text from ${sourceLang} to ${targetLanguage}. Break it into logical segments (sentences or phrases) and provide translations for each segment. Maintain the original meaning, tone, and formatting:

${text}`;
}

function createSummarizationPrompt(content, targetLanguage, pageUrl) {
  const domain = extractDomainFromUrl(pageUrl);
  
  return `Summarize the key points from this web content in ${targetLanguage}. Create 3-5 concise bullet points with relevant emojis. Focus on the most important information a user would want to know.

Website: ${domain}
Content: ${content.substring(0, 3000)}`;
}

function chunkText(text, maxLength) {
  if (text.length <= maxLength) {
    return [text];
  }
  
  const chunks = [];
  let currentChunk = '';
  const sentences = splitIntoSentences(text);
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxLength && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(chunk => chunk.length > 0);
}

function splitIntoSentences(text) {
  // Simple sentence splitting - could be improved with more sophisticated NLP
  return text
    .split(/(?<=[.!?])\s+/)
    .filter(sentence => sentence.trim().length > 0);
}

function extractDomainFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch (error) {
    return 'Unknown website';
  }
}

function createErrorResponse(message, statusCode, headers) {
  return {
    statusCode,
    headers,
    body: JSON.stringify({
      success: false,
      error: message
    })
  };
}

// Input validation
function validateInput(body) {
  const errors = [];
  
  if (!body.action) {
    errors.push('action is required');
  }
  
  if (!body.content) {
    errors.push('content is required');
  }
  
  if (body.action === 'translate' && !body.targetLanguage) {
    errors.push('targetLanguage is required for translation');
  }
  
  if (body.content && body.content.length > 10000) {
    errors.push('content exceeds maximum length of 10,000 characters');
  }
  
  return errors;
}

// Sanitize input text
function sanitizeInput(text) {
  if (typeof text !== 'string') {
    return '';
  }
  
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .trim()
    .substring(0, 10000); // Limit length
} 