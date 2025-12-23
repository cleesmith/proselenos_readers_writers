// lib/tool-prompts-installer.ts
// Server-side only module for tool-prompts installation

export interface ToolPromptsInstallResult {
  success: boolean;
  message: string;
  filesUploaded?: number;
  foldersCreated?: number;
}