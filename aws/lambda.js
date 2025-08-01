// AWS Lambda function for Chrome translation extension
// Handles AWS Nova-lite 1.0 integration for translation and summarization using Bedrock

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

// Configuration
const bedrockClient = new BedrockRuntimeClient({
  region: 'us-west-2',
});

const NOVA_LITE_MODEL_ID = 'us.amazon.nova-lite-v1:0';
const MAX_TOKENS = 4000;
const TEMPERATURE = 0.3;

// Tool definitions for AWS Bedrock Nova-lite tool calling
const translationTool = {
  toolSpec: {
    name: "provide_translation",
    description: "Provide translations for text segments",
    inputSchema: {
      json: {
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
  }
};

const summaryTool = {
  toolSpec: {
    name: "provide_summary",
    description: "Provide a structured summary of web content",
    inputSchema: {
      json: {
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
  }
};

const chatTool = {
  toolSpec: {
    name: "provide_chat_response",
    description: "Provide helpful conversational responses about website content and translations",
    inputSchema: {
      json: {
        type: "object",
        properties: {
          response: {
            type: "string",
            description: "Conversational response about the content, translation, or language learning"
          },
          suggestedQuestions: {
            type: "array",
            description: "3-5 suggested follow-up questions",
            items: {
              type: "string"
            },
            maxItems: 5
          }
        },
        required: ["response"]
      }
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
    // Parse request body - handle both API Gateway and direct test formats
    let body;
    if (event.body) {
      // API Gateway format (body is a JSON string)
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } else {
      // Direct test format (data is in event root)
      body = event;
    }
    
    const { action, content, sourceLanguage, targetLanguage, pageUrl, message, conversationHistory, summary } = body;

    // Validate input based on action
    if (!action) {
      return createErrorResponse('Missing required field: action', 400, headers);
    }
    
    if (action === 'chat' && !message) {
      return createErrorResponse('Missing required field: message for chat action', 400, headers);
    }
    
    if (action === 'chat' && !targetLanguage) {
      return createErrorResponse('Missing required field: targetLanguage for chat action', 400, headers);
    }
    
    if ((action === 'translate' || action === 'summarize') && !content) {
      return createErrorResponse('Missing required field: content', 400, headers);
    }

    let result;
    
    switch (action) {
      case 'translate':
        result = await handleTranslation(content, sourceLanguage, targetLanguage);
        break;
        
      case 'summarize':
        result = await handleSummarization(content, targetLanguage, pageUrl);
        break;
        
      case 'chat':
        result = await handleChatMessage(message, targetLanguage, pageUrl, content, conversationHistory, summary);
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
      const response = await invokeNovaModel({
        system: `You are a professional translator specializing in accurate, contextual translations. You MUST translate the provided text into ${targetLanguage} and ONLY ${targetLanguage}. 

CRITICAL LANGUAGE REQUIREMENT: The target language is "${targetLanguage}". Every single translation you provide MUST be written entirely in ${targetLanguage}. Do not mix languages or provide translations in any other language.

INSTRUCTIONS:
- Use the provide_translation tool to return all translations
- If the source text is already in ${targetLanguage}, return it unchanged
- Split text into logical segments (sentences or phrases) for better accuracy
- Preserve the original meaning, tone, and cultural context
- Maintain formatting and structure where possible
- For technical terms, use standard ${targetLanguage} equivalents
- If uncertain about a term, choose the most commonly accepted ${targetLanguage} translation

QUALITY STANDARDS:
- Translations must sound natural to native ${targetLanguage} speakers
- Maintain consistency in terminology throughout the text
- Preserve the original text's style and register (formal/informal)

Remember: ALL output must be in ${targetLanguage}. No exceptions.`,
        messages: [
          {
            role: 'user',
            content: [{ text: prompt }]
          }
        ],
        toolConfig: {
          tools: [translationTool],
          toolChoice: {
            tool: {
              name: "provide_translation"
            }
          }
        }
      });

      const toolUse = extractToolUse(response);
      
      if (toolUse && toolUse.name === 'provide_translation') {
        try {
          const functionResult = toolUse.input;
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

async function handleChatMessage(message, targetLanguage, pageUrl, pageContent, conversationHistory = [], summary = null) {
  console.log(`💬 Chat message - Target Language: "${targetLanguage}" for URL: ${pageUrl}`);
  const prompt = createChatPrompt(message, targetLanguage, pageUrl, pageContent, conversationHistory, summary);
  
  try {
    const response = await invokeNovaModel({
      system: `You are a helpful AI assistant specialized in website content analysis and translation assistance. You MUST respond in ${targetLanguage} and ONLY ${targetLanguage}.

🚨 CRITICAL LANGUAGE REQUIREMENT 🚨
TARGET LANGUAGE: ${targetLanguage}
YOU MUST WRITE EVERYTHING IN ${targetLanguage} ONLY!

CAPABILITIES:
- Answer questions about website content and its meaning
- Explain translation choices and cultural context
- Provide language learning insights
- Help with understanding complex terms or concepts
- Suggest better translation alternatives
- Explain cultural nuances and context

CONVERSATION STYLE:
- Be conversational, helpful, and friendly
- Write entirely in ${targetLanguage}
- Keep responses concise but informative (2-4 sentences)
- Use natural ${targetLanguage} expressions and tone
- Provide practical, actionable insights
- Reference the specific page content when relevant

CONTEXT AWARENESS:
- You have access to the current webpage content
- You know the translation language pair being used
- You can reference the AI-generated summary if available
- You maintain conversation context from previous messages

RESPONSE REQUIREMENTS:
- Use the provide_chat_response tool for all responses
- Write the response entirely in ${targetLanguage}
- Suggest 3-5 relevant follow-up questions in ${targetLanguage}
- Make suggestions contextual to the current page and conversation

🔥 FINAL REMINDER: The user selected ${targetLanguage} as their language. Honor their choice completely by writing EVERYTHING in ${targetLanguage}!`,
      messages: [
        {
          role: 'user',
          content: [{ text: prompt }]
        }
      ],
      toolConfig: {
        tools: [chatTool],
        toolChoice: {
          tool: {
            name: "provide_chat_response"
          }
        }
      }
    });

    const toolUse = extractToolUse(response);
    
    if (toolUse && toolUse.name === 'provide_chat_response') {
      try {
        const functionResult = toolUse.input;
        
        // Log what the AI generated for debugging
        console.log(`🤖 AI Generated Chat Response in "${targetLanguage}":`, JSON.stringify(functionResult, null, 2));
        
        // Validate response structure
        if (functionResult.response) {
          return { 
            response: functionResult.response,
            suggestedQuestions: functionResult.suggestedQuestions || []
          };
        }
      } catch (parseError) {
        console.error('Failed to parse chat function result:', parseError);
      }
    }
    
    // Fallback response if parsing fails
    return {
      response: createLocalizedFallbackChatResponse(targetLanguage),
      suggestedQuestions: []
    };
    
  } catch (error) {
    console.error('Chat error:', error);
    throw new Error('Failed to generate chat response');
  }
}

async function handleSummarization(content, targetLanguage, pageUrl) {
  console.log(`🎯 Summary generation - Target Language: "${targetLanguage}" for URL: ${pageUrl}`);
  const prompt = createSummarizationPrompt(content, targetLanguage, pageUrl);
  
  try {
    const response = await invokeNovaModel({
      system: `You are an AI assistant that creates concise, helpful summaries of web content. You MUST write entirely in ${targetLanguage} and ONLY ${targetLanguage}.

🚨 CRITICAL LANGUAGE REQUIREMENT 🚨
TARGET LANGUAGE: ${targetLanguage}
YOU MUST WRITE EVERYTHING IN ${targetLanguage} ONLY!

🎯 TITLE LANGUAGE REQUIREMENT 🎯
THE SUMMARY TITLE MUST BE WRITTEN ENTIRELY IN ${targetLanguage}!
- NO mixed languages in the title  
- The title should be a natural ${targetLanguage} phrase that summarizes the content
- Use ${targetLanguage} grammar and sentence structure for the title

LANGUAGE RULES:
- Every single word in the summary title must be in ${targetLanguage}
- Every single word in all bullet points must be in ${targetLanguage}  
- ONLY use ${targetLanguage} for all text content
- If you don't know how to say something in ${targetLanguage}, find an equivalent phrase
- Native ${targetLanguage} speakers should understand everything perfectly

TASK REQUIREMENTS:
- Use the provide_summary tool to return a structured summary
- Create exactly 3-5 key points that capture the most important information
- Each point must include an appropriate emoji that represents the content
- Write all text (title and points) exclusively in ${targetLanguage}
- Make the summary accessible to native ${targetLanguage} speakers
- Use natural, fluent ${targetLanguage} expressions and idioms where appropriate

CONTENT GUIDELINES:
- Focus on actionable insights and key takeaways
- Prioritize information that would be most valuable to users
- Keep each point concise but informative (1-2 sentences maximum)
- Ensure emojis are culturally appropriate and enhance understanding
- Use formal or informal tone appropriate to ${targetLanguage} conventions

🔥 FINAL REMINDER: The user selected ${targetLanguage} as their language. They expect to read BOTH the title AND bullet points in ${targetLanguage}, not English or any other language. Honor their language choice completely!`,
      messages: [
        {
          role: 'user',
          content: [{ text: prompt }]
        }
      ],
      toolConfig: {
        tools: [summaryTool],
        toolChoice: {
          tool: {
            name: "provide_summary"
          }
        }
      }
    });

    const toolUse = extractToolUse(response);
    
    if (toolUse && toolUse.name === 'provide_summary') {
      try {
        const functionResult = toolUse.input;
        
        // Log what the AI generated for debugging
        console.log(`🤖 AI Generated Summary in "${targetLanguage}":`, JSON.stringify(functionResult, null, 2));
        
        // Validate summary structure
        if (functionResult.title && Array.isArray(functionResult.points)) {
          return { summary: functionResult };
        }
      } catch (parseError) {
        console.error('Failed to parse summary function result:', parseError);
      }
    }
    
    // Fallback summary if parsing fails - localized to target language
    return {
      summary: createLocalizedFallbackSummary(targetLanguage, pageUrl)
    };
    
  } catch (error) {
    console.error('Summarization error:', error);
    throw new Error('Failed to generate summary');
  }
}



// Core function to invoke Nova-lite model via Bedrock
async function invokeNovaModel({ system, messages, toolConfig }) {
  const requestBody = {
    schemaVersion: "messages-v1",
    system: [{ text: system }],
    messages,
    inferenceConfig: {
      maxTokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      topP: 0.9
    }
  };

  // Add tool configuration if provided
  if (toolConfig) {
    requestBody.toolConfig = toolConfig;
  }

  const command = new InvokeModelCommand({
    modelId: NOVA_LITE_MODEL_ID,
    body: JSON.stringify(requestBody),
    contentType: 'application/json',
    accept: 'application/json'
  });

  try {
    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    if (responseBody.stopReason === 'tool_use') {
      return responseBody;
    }
    
    // Handle non-tool responses
    if (responseBody.output && responseBody.output.message) {
      return responseBody;
    }
    
    throw new Error('Unexpected response format from Nova-lite');
  } catch (error) {
    console.error('Error invoking Nova-lite:', error);
    throw error;
  }
}

// Extract tool use from Nova-lite response
function extractToolUse(response) {
  try {
    if (response.output && response.output.message && response.output.message.content) {
      for (const contentBlock of response.output.message.content) {
        if (contentBlock.toolUse) {
          return {
            name: contentBlock.toolUse.name,
            input: contentBlock.toolUse.input
          };
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Error extracting tool use:', error);
    return null;
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
  
  return `🚨 CRITICAL: You MUST write the ENTIRE summary (title AND bullet points) in ${targetLanguage}. Every single word in the title and all bullet points must be in ${targetLanguage}. Do not use English or any other language.

🎯 TITLE REQUIREMENT: Write the summary title completely in ${targetLanguage}.

Task: Summarize the key points from this web content in ${targetLanguage} ONLY. Create 3-5 concise bullet points with relevant emojis. Focus on the most important information a user would want to know.

Target Language: ${targetLanguage}
Website: ${domain}

Content to summarize:
${content.substring(0, 3000)}

🔥 REMEMBER: 
- Title must be 100% in ${targetLanguage}
- All bullet point text must be 100% in ${targetLanguage}
- NO exceptions - honor the user's language choice completely!`;
}

function createChatPrompt(message, targetLanguage, pageUrl, pageContent, conversationHistory, summary) {
  const domain = extractDomainFromUrl(pageUrl);
  
  let prompt = `🚨 CRITICAL: You MUST write your ENTIRE response in ${targetLanguage}. Every word must be in ${targetLanguage}.

User's question: "${message}"

Context Information:
- Target Language: ${targetLanguage}
- Website: ${domain}
- Page URL: ${pageUrl}`;

  if (pageContent) {
    prompt += `\n- Page Content Preview: ${pageContent.substring(0, 2000)}`;
  }

  if (summary) {
    prompt += `\n- Current AI Summary: ${JSON.stringify(summary)}`;
  }

  if (conversationHistory && conversationHistory.length > 0) {
    prompt += `\n- Conversation History:`;
    conversationHistory.slice(-6).forEach((msg, index) => {
      prompt += `\n  ${msg.role}: ${msg.content}`;
    });
  }

  prompt += `\n\nInstructions:
- Answer the user's question in ${targetLanguage} ONLY
- Be helpful, conversational, and informative
- Reference the page content when relevant
- Provide practical insights about the content or translation
- Keep response concise but useful (2-4 sentences)
- Suggest relevant follow-up questions in ${targetLanguage}

🔥 REMEMBER: Write EVERYTHING in ${targetLanguage}. The user expects to read your response in ${targetLanguage}!`;

  return prompt;
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
  
  // Validate based on action type
  if (body.action === 'chat') {
    if (!body.message) {
      errors.push('message is required for chat action');
    }
    if (body.message && body.message.length > 1000) {
      errors.push('message exceeds maximum length of 1,000 characters');
    }
  } else {
    if (!body.content) {
      errors.push('content is required');
    }
    if (body.content && body.content.length > 10000) {
      errors.push('content exceeds maximum length of 10,000 characters');
    }
  }
  
  if (body.action === 'translate' && !body.targetLanguage) {
    errors.push('targetLanguage is required for translation');
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

// Create localized fallback chat response for when AI generation fails
function createLocalizedFallbackChatResponse(targetLanguage) {
  // Predefined fallback messages for major languages
  const fallbackMessages = {
    'English': 'I\'m sorry, I\'m having trouble responding right now. Please try asking your question again.',
    'Spanish / Español': 'Lo siento, estoy teniendo problemas para responder ahora. Por favor, intenta hacer tu pregunta de nuevo.',
    'French / Français': 'Je suis désolé, j\'ai des difficultés à répondre maintenant. Veuillez réessayer votre question.',
    'German / Deutsch': 'Es tut mir leid, ich habe Schwierigkeiten zu antworten. Bitte stellen Sie Ihre Frage erneut.',
    'Chinese (Simplified) / 中文(简体)': '抱歉，我现在无法回答。请重新提问。',
    'Japanese / 日本語': '申し訳ございませんが、現在お答えできません。もう一度質問してください。',
    'Korean / 한국어': '죄송합니다. 지금 답변하는 데 문제가 있습니다. 질문을 다시 해주세요.',
    'Portuguese (Brazil) / Português (Brasil)': 'Desculpe, estou tendo problemas para responder agora. Tente fazer sua pergunta novamente.',
    'Italian / Italiano': 'Mi dispiace, sto avendo problemi a rispondere ora. Prova a fare la tua domanda di nuovo.',
    'Russian / Русский': 'Извините, у меня проблемы с ответом. Пожалуйста, задайте свой вопрос еще раз.',
    'Arabic / العربية': 'أعتذر، أواجه مشكلة في الرد الآن. يرجى طرح سؤالك مرة أخرى.',
    'Hindi / हिन्दी': 'खुशी है, मुझे अभी जवाब देने में समस्या हो रही है। कृपया अपना प्रश्न फिर से पूछें।'
  };

  return fallbackMessages[targetLanguage] || 'Sorry, I\'m having trouble responding right now. Please try again.';
}

// Create localized fallback summary for when AI generation fails
function createLocalizedFallbackSummary(targetLanguage, pageUrl) {
  const domain = extractDomainFromUrl(pageUrl);
  
  // Predefined fallback messages for major languages
  const fallbackMessages = {
    'English': {
      title: `Summary of ${domain}`,
      unavailable: 'Content summary is currently unavailable.',
      retry: 'Please try again in a moment.'
    },
    'Spanish / Español': {
      title: `Resumen de ${domain}`,
      unavailable: 'El resumen del contenido no está disponible actualmente.',
      retry: 'Por favor, inténtalo de nuevo en un momento.'
    },
    'French / Français': {
      title: `Résumé de ${domain}`,
      unavailable: 'Le résumé du contenu n\'est actuellement pas disponible.',
      retry: 'Veuillez réessayer dans un moment.'
    },
    'German / Deutsch': {
      title: `Zusammenfassung von ${domain}`,
      unavailable: 'Die Inhaltszusammenfassung ist derzeit nicht verfügbar.',
      retry: 'Bitte versuchen Sie es in einem Moment erneut.'
    },
    'Chinese (Simplified) / 中文(简体)': {
      title: `${domain} 摘要`,
      unavailable: '内容摘要当前不可用。',
      retry: '请稍后再试。'
    },
    'Chinese (Traditional) / 中文(繁體)': {
      title: `${domain} 摘要`,
      unavailable: '內容摘要目前不可用。',
      retry: '請稍後再試。'
    },
    'Japanese / 日本語': {
      title: `${domain} の要約`,
      unavailable: 'コンテンツの要約は現在利用できません。',
      retry: 'しばらくしてからもう一度お試しください。'
    },
    'Korean / 한국어': {
      title: `${domain} 요약`,
      unavailable: '콘텐츠 요약을 현재 사용할 수 없습니다.',
      retry: '잠시 후 다시 시도해 주세요.'
    },
    'Portuguese (Brazil) / Português (Brasil)': {
      title: `Resumo de ${domain}`,
      unavailable: 'O resumo do conteúdo não está disponível no momento.',
      retry: 'Tente novamente em um momento.'
    },
    'Italian / Italiano': {
      title: `Riassunto di ${domain}`,
      unavailable: 'Il riassunto del contenuto non è attualmente disponibile.',
      retry: 'Riprova tra un momento.'
    },
    'Russian / Русский': {
      title: `Сводка ${domain}`,
      unavailable: 'Сводка содержимого в настоящее время недоступна.',
      retry: 'Пожалуйста, попробуйте еще раз через мгновение.'
    },
    'Arabic / العربية': {
      title: `ملخص ${domain}`,
      unavailable: 'ملخص المحتوى غير متاح حاليًا.',
      retry: 'يرجى المحاولة مرة أخرى بعد قليل.'
    },
    'Hindi / हिन्दी': {
      title: `${domain} का सारांश`,
      unavailable: 'सामग्री का सारांश वर्तमान में उपलब्ध नहीं है।',
      retry: 'कृपया एक क्षण में फिर से प्रयास करें।'
    }
  };

  // Check if we have predefined messages for this language
  const messages = fallbackMessages[targetLanguage];
  
  if (messages) {
    return {
      title: messages.title,
      points: [
        { emoji: '📄', text: messages.unavailable },
        { emoji: '🔄', text: messages.retry }
      ]
    };
  }

  // For languages without predefined fallbacks, create a generic fallback in the target language
  // This is a simplified approach - in production, you'd want proper translations
  return {
    title: `${domain} Summary`, // Keep this simple since proper translation would require a translation service
    points: [
      { emoji: '📄', text: 'Content summary is currently unavailable.' },
      { emoji: '🔄', text: 'Please try again in a moment.' },
      { emoji: '🌍', text: `Language: ${targetLanguage}` }
    ]
  };
} 