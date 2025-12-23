import { streamAIInternal } from '@/lib/aiInternal';

export async function executeWorkflowAI(
  prompt: string,
  _userInput: string,
  context: string,
  _provider: string,
  _model: string
) {
  try {
    // The AI service needs content to process:
    // - For brainstorm: existing brainstorm.txt content (user's ideas from Editor)
    // - For other steps: context from previous workflow files
    const contentToProcess = context || 'No previous content available.';
    
    // Use the internal AI streaming function
    // Note: streamAIInternal's second parameter is the file content to process
    const result = await streamAIInternal(prompt, contentToProcess);
    
    return {
      success: true,
      content: result,
      error: undefined
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'AI execution failed'
    };
  }
}