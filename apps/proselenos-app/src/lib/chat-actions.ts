// lib/chat-actions.ts - Server actions for chat functionality
'use server';

import { 
  getProviderModelInfoInternal, 
  getChatResponseInternal, 
  saveChatToBrainstormInternal,
  type ChatMessage,
  type ChatResponse 
} from './chatInternal';

/**
 * Server action to get provider/model info
 */
export async function getChatProviderModelAction(): Promise<{ providerModel: string }> {
  return await getProviderModelInfoInternal();
}

/**
 * Server action to get chat response
 * @param messages - Array of chat messages
 * @param customModel - Optional custom model to use (for TabChat-specific model)
 */
export async function getChatResponseAction(
  messages: ChatMessage[], 
  customModel?: string
): Promise<ChatResponse> {
  return await getChatResponseInternal(messages, customModel);
}

/**
 * Server action to save chat with custom filename
 */
export async function saveChatToBrainstormAction(
  messages: ChatMessage[],
  providerModel: string,
  projectName: string,
  filename: string = 'brainstorm'
): Promise<{ success: boolean; message: string }> {
  return await saveChatToBrainstormInternal(messages, providerModel, projectName, filename);
}
