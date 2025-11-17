// lib/writing-assistant/workflow-actions.ts

'use server';

import { WorkflowStepId } from '@/app/writing-assistant/types';
import { listFiles, uploadFile, downloadFile } from '@/lib/github-storage';
import { getServerSession } from 'next-auth';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';
import { executeWorkflowAI } from './execution-engine';
import { getWorkflowPrompt } from './prompts';

interface ExtendedSession {
  user: {
    id: string;
    email?: string;
    name?: string;
    image?: string;
  };
  accessToken?: string;
}

export async function detectExistingWorkflowFilesAction(projectName: string) {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const userId = session.user.id;

    // Get all files in the project folder
    const allFiles = await listFiles(userId, 'proselenos', `${projectName}/`);

    // Find specific workflow files
    const workflowFiles = {
      brainstorm: allFiles.find(f => f.name === 'brainstorm.txt')
        ? { id: allFiles.find(f => f.name === 'brainstorm.txt')!.sha, name: 'brainstorm.txt', path: allFiles.find(f => f.name === 'brainstorm.txt')!.path }
        : undefined,
      outline: allFiles.find(f => f.name === 'outline.txt')
        ? { id: allFiles.find(f => f.name === 'outline.txt')!.sha, name: 'outline.txt', path: allFiles.find(f => f.name === 'outline.txt')!.path }
        : undefined,
      world: allFiles.find(f => f.name === 'world.txt')
        ? { id: allFiles.find(f => f.name === 'world.txt')!.sha, name: 'world.txt', path: allFiles.find(f => f.name === 'world.txt')!.path }
        : undefined,
      chapters: allFiles.filter(f => f.name === 'manuscript.txt' || (f.name?.startsWith('chapter_') && f.name.endsWith('.txt')))
        .map(f => ({ id: f.sha, name: f.name, path: f.path }))
    };

    return {
      success: true,
      data: workflowFiles
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to detect workflow files'
    };
  }
}

export async function executeWorkflowStepAction(
  stepId: WorkflowStepId,
  userInput: string,
  projectName: string,
  provider: string,
  model: string,
  existingFiles: any
) {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const userId = session.user.id;

    // Get step-specific prompt and context
    const prompt = getWorkflowPrompt(stepId);
    const context = await buildStepContext(userId, projectName, stepId, existingFiles);
    
    // Debug logging for context validation
    console.log(`[${stepId}] Context length: ${context.length} characters`);
    if (context.length < 10) {
      console.warn(`[${stepId}] Warning: Very short context (${context.length} chars): "${context}"`);
    }
    
    // Validate context has meaningful content before AI execution
    const trimmedContext = context.trim();
    if (!trimmedContext || trimmedContext === 'No previous content available.' || trimmedContext.startsWith('ERROR:')) {
      return {
        success: false,
        error: trimmedContext.startsWith('ERROR:') ? trimmedContext.substring(7) : `No valid context available for ${stepId} step. Please ensure prerequisite files exist.`
      };
    }
    
    // Execute AI generation
    const result = await executeWorkflowAI(
      prompt,
      userInput,
      context,
      provider,
      model
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error
      };
    }

    // Validate we actually have AI content before trying to save
    if (!result.content || result.content.trim() === '') {
      return {
        success: false,
        error: `AI generated no content for ${stepId} step. Check prompts and context.`
      };
    }

    // Save generated content to file
    const fileName = getStepFileName(stepId);
    let saveResult;

    if (stepId === 'chapters') {
      // For chapters, append to existing manuscript.txt or create new one
      saveResult = await appendToManuscript(
        userId,
        projectName,
        result.content || '',
        fileName,
        existingFiles
      );
    } else if (stepId === 'brainstorm') {
      // For brainstorm, append AI response to existing brainstorm.txt
      const brainstormFile = existingFiles.brainstorm;

      if (brainstormFile?.path) {
        // Read existing content and append AI response with divider
        const existingContent = context; // Already contains the existing brainstorm content
        const enhancedContent = `${existingContent}\n\n--- AI Enhanced Content ---\n\n${result.content || ''}`;

        await uploadFile(userId, 'proselenos', brainstormFile.path, enhancedContent, 'Enhance brainstorm content');
        saveResult = { success: true, data: { fileId: brainstormFile.id } };
      } else {
        // Fallback - create new file if somehow the brainstorm file doesn't exist
        const filePath = `${projectName}/${fileName}`;
        await uploadFile(userId, 'proselenos', filePath, result.content, `Create ${fileName}`);
        saveResult = { success: true, data: { fileId: filePath } };
      }
    } else {
      // For other steps, check if file exists first
      const existingFile = existingFiles[stepId]; // outline, world, etc.
      const filePath = existingFile?.path || `${projectName}/${fileName}`;

      const commitMessage = existingFile?.path ? `Update ${fileName}` : `Create ${fileName}`;
      await uploadFile(userId, 'proselenos', filePath, result.content, commitMessage);
      saveResult = { success: true, data: { fileId: filePath } };
    }

    if (!saveResult.success) {
      const errorDetail = saveResult.error || 'Unknown error occurred';
      return {
        success: false,
        error: `Failed to save generated content: ${errorDetail}`
      };
    }

    return {
      success: true,
      fileName,
      fileId: saveResult.data?.fileId,
      file: {
        id: saveResult.data?.fileId,
        name: fileName,
        path: saveResult.data?.fileId,
        content: result.content,
        createdAt: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Workflow step execution failed'
    };
  }
}

export async function getWorkflowFileContentAction(filePath: string) {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const userId = session.user.id;

    const { content } = await downloadFile(userId, 'proselenos', filePath);
    const decoder = new TextDecoder('utf-8');
    const textContent = decoder.decode(content);

    return {
      success: true,
      content: textContent
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read file content'
    };
  }
}

// Helper functions
async function buildStepContext(userId: string, _projectName: string, stepId: WorkflowStepId, existingFiles: any): Promise<string> {
  let context = '';

  switch (stepId) {
    case 'brainstorm':
      // For brainstorm, read existing brainstorm.txt file content (user's ideas)
      if (existingFiles.brainstorm?.path) {
        const { content } = await downloadFile(userId, 'proselenos', existingFiles.brainstorm.path);
        const decoder = new TextDecoder('utf-8');
        context = decoder.decode(content);
      }
      break;

    case 'outline':
      if (existingFiles.brainstorm?.path) {
        const { content } = await downloadFile(userId, 'proselenos', existingFiles.brainstorm.path);
        const decoder = new TextDecoder('utf-8');
        context = `BRAINSTORM CONTENT:\n${decoder.decode(content)}`;
      }
      break;

    case 'world':
      let hasBrainstorm = false;
      let hasOutline = false;

      if (existingFiles.brainstorm?.path) {
        const { content } = await downloadFile(userId, 'proselenos', existingFiles.brainstorm.path);
        const decoder = new TextDecoder('utf-8');
        const brainstormText = decoder.decode(content).trim();
        if (brainstormText) {
          context += `BRAINSTORM CONTENT:\n${brainstormText}\n\n`;
          hasBrainstorm = true;
        }
      }
      if (existingFiles.outline?.path) {
        const { content } = await downloadFile(userId, 'proselenos', existingFiles.outline.path);
        const decoder = new TextDecoder('utf-8');
        const outlineText = decoder.decode(content).trim();
        if (outlineText) {
          context += `OUTLINE CONTENT:\n${outlineText}`;
          hasOutline = true;
        }
      }

      // Validate that we have required context files for world building
      if (!hasBrainstorm && !hasOutline) {
        context = 'ERROR: World Builder requires either brainstorm.txt or outline.txt to exist with content. Please complete the brainstorm or outline steps first.';
      } else if (!hasBrainstorm) {
        context += '\n\nNOTE: No brainstorm content found. Building world based on outline only.';
      } else if (!hasOutline) {
        context += '\n\nNOTE: No outline content found. Building world based on brainstorm only.';
      }
      break;

    case 'chapters':
      // Determine which specific chapter to write by comparing outline to existing manuscript
      const chapterToWrite = await determineNextChapter(userId, existingFiles);

      if (!chapterToWrite) {
        context = 'ERROR: Could not determine which chapter to write. Please check outline.txt exists.';
        break;
      }

      // Build context with outline, world, and specific chapter instruction
      let outlineContent = '';
      let worldContent = '';
      let manuscriptContent = '';

      if (existingFiles.outline?.path) {
        const { content } = await downloadFile(userId, 'proselenos', existingFiles.outline.path);
        const decoder = new TextDecoder('utf-8');
        outlineContent = decoder.decode(content);
      }

      if (existingFiles.world?.path) {
        const { content } = await downloadFile(userId, 'proselenos', existingFiles.world.path);
        const decoder = new TextDecoder('utf-8');
        worldContent = decoder.decode(content);
      }

      // Get existing manuscript if it exists
      if (existingFiles.chapters && existingFiles.chapters.length > 0) {
        const { content } = await downloadFile(userId, 'proselenos', existingFiles.chapters[0].path);
        const decoder = new TextDecoder('utf-8');
        manuscriptContent = decoder.decode(content);
      }

      context  = `\n=== MANUSCRIPT ===\n${manuscriptContent}\n=== END MANUSCRIPT ===\n`;
      context += `\n=== OUTLINE ===\n${outlineContent}\n=== END OUTLINE ===\n`;
      context += `\n=== WORLD ===\n${worldContent}\n=== END WORLD ===\n`;
      context += `\nSPECIFIC TASK: Write ${chapterToWrite.title}\n`;
      context += `This should be a complete chapter of 2,000-4,000 words.\n`;
      context += `Focus only on the events and scenes described for this chapter in the outline.\n`;
      context += `BEGIN WITH: ${chapterToWrite.title}`;
      break;
  }

  return context;
}

// Determine which chapter to write next by comparing outline to existing manuscript
async function determineNextChapter(userId: string, existingFiles: any): Promise<{ title: string; number: number } | null> {
  try {
    // Get outline content
    if (!existingFiles.outline?.path) {
      console.log('No outline file found');
      return null;
    }

    const { content: outlineBuffer } = await downloadFile(userId, 'proselenos', existingFiles.outline.path);
    const decoder = new TextDecoder('utf-8');
    const outlineContent = decoder.decode(outlineBuffer);

    // Get existing manuscript content (if it exists)
    let manuscriptContent = '';
    if (existingFiles.chapters && existingFiles.chapters.length > 0) {
      const { content: manuscriptBuffer } = await downloadFile(userId, 'proselenos', existingFiles.chapters[0].path);
      manuscriptContent = decoder.decode(manuscriptBuffer);
    }
    
    // Extract chapters from manuscript and put numbers in a Set for quick lookup
    const manuscriptChapterNumbers = new Set<number>();
    const chapterRegex = /Chapter\s+(\d+):/g;
    let match;
    
    while ((match = chapterRegex.exec(manuscriptContent)) !== null) {
      if (match[1]) {
        manuscriptChapterNumbers.add(parseInt(match[1], 10));
      }
    }
    
    console.log(`Found ${manuscriptChapterNumbers.size} chapters in manuscript`);
    
    // Find all chapters in the outline
    const outlineChapters = [];
    const outlineChapterRegex = /^Chapter\s+(\d+):\s+(.+)$/gm;
    let outlineMatch;
    
    while ((outlineMatch = outlineChapterRegex.exec(outlineContent)) !== null) {
      if (outlineMatch[1] && outlineMatch[2]) {
        console.log(`Found in outline: Chapter ${outlineMatch[1]}: ${outlineMatch[2]}`);

        outlineChapters.push({
          number: parseInt(outlineMatch[1], 10),
          title: outlineMatch[2],
          full: `Chapter ${outlineMatch[1]}: ${outlineMatch[2]}`
        });
      }
    }
    
    // Sort outline chapters by chapter number
    outlineChapters.sort((a, b) => a.number - b.number);
    
    console.log(`Found ${outlineChapters.length} chapters in outline`);
    
    // Find the first chapter in the outline that's not in the manuscript
    for (const chapter of outlineChapters) {
      if (!manuscriptChapterNumbers.has(chapter.number)) {
        console.log(`Chapter ${chapter.number} is in outline but not in manuscript`);
        return {
          title: chapter.full,
          number: chapter.number
        };
      }
    }
    
    // No missing chapters found
    console.log('No missing chapters found');
    return null;
    
  } catch (error) {
    console.error('Error determining next chapter:', error);
    return null;
  }
}

// Append new chapter to existing manuscript.txt file
async function appendToManuscript(
  userId: string,
  projectName: string,
  chapterText: string,
  fileName: string,
  existingFiles: any
) {
  try {
    let manuscriptContent = '';
    let filePath = `${projectName}/${fileName}`;

    // Check if manuscript.txt already exists
    if (existingFiles.chapters && existingFiles.chapters.length > 0) {
      // Read existing manuscript
      const manuscriptFile = existingFiles.chapters[0];
      filePath = manuscriptFile.path;

      const { content } = await downloadFile(userId, 'proselenos', filePath);
      const decoder = new TextDecoder('utf-8');
      manuscriptContent = decoder.decode(content);
    }

    // Prepare the content to append
    let updatedContent;
    if (manuscriptContent.trim() === '') {
      // Empty manuscript - add chapter with initial formatting
      updatedContent = '\n\n' + chapterText;
    } else {
      // Existing content - append with proper spacing
      manuscriptContent = manuscriptContent.replace(/\s+$/, '') + '\n';
      updatedContent = manuscriptContent + '\n\n' + chapterText;
    }

    // Upload to GitHub (handles both create and update)
    await uploadFile(userId, 'proselenos', filePath, updatedContent, `Add chapter to ${fileName}`);

    return {
      success: true,
      data: { fileId: filePath }
    };

  } catch (error) {
    console.error('Error appending to manuscript:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to append to manuscript'
    };
  }
}


function getStepFileName(stepId: WorkflowStepId): string {
  const fileNames = {
    brainstorm: 'brainstorm.txt',
    outline: 'outline.txt',
    world: 'world.txt',
    chapters: 'manuscript.txt' // For chapter writer, create main manuscript
  };
  
  return fileNames[stepId];
}