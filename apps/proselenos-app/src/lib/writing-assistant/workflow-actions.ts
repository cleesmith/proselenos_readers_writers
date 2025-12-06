// lib/writing-assistant/workflow-actions.ts
// Writing assistant workflow actions - uses Supabase storage

'use server';

import { WorkflowStepId } from '@/app/writing-assistant/types';
import { listProjectFiles, uploadFileToProject, readTextFile } from '@/lib/supabase-project-actions';
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
    const allFiles = await listProjectFiles(userId, projectName);

    // Find specific workflow files
    const workflowFiles = {
      brainstorm: allFiles.find(f => f.name === 'brainstorm.txt')
        ? { id: allFiles.find(f => f.name === 'brainstorm.txt')!.id, name: 'brainstorm.txt', path: `${projectName}/brainstorm.txt` }
        : undefined,
      outline: allFiles.find(f => f.name === 'outline.txt')
        ? { id: allFiles.find(f => f.name === 'outline.txt')!.id, name: 'outline.txt', path: `${projectName}/outline.txt` }
        : undefined,
      world: allFiles.find(f => f.name === 'world.txt')
        ? { id: allFiles.find(f => f.name === 'world.txt')!.id, name: 'world.txt', path: `${projectName}/world.txt` }
        : undefined,
      chapters: allFiles.filter(f => f.name === 'manuscript.txt' || (f.name?.startsWith('chapter_') && f.name.endsWith('.txt')))
        .map(f => ({ id: f.id, name: f.name, path: `${projectName}/${f.name}` }))
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

        await uploadFileToProject(userId, projectName, 'brainstorm.txt', enhancedContent);
        saveResult = { success: true, data: { fileId: brainstormFile.id } };
      } else {
        // Fallback - create new file if somehow the brainstorm file doesn't exist
        await uploadFileToProject(userId, projectName, fileName, result.content);
        saveResult = { success: true, data: { fileId: `${projectName}/${fileName}` } };
      }
    } else {
      // For other steps, just save the content
      await uploadFileToProject(userId, projectName, fileName, result.content);
      saveResult = { success: true, data: { fileId: `${projectName}/${fileName}` } };
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

    // Extract project name and filename from path (e.g., "ProjectName/file.txt")
    const parts = filePath.split('/');
    if (parts.length < 2) {
      return { success: false, error: 'Invalid file path' };
    }
    const projectName = parts[0]!;
    const fileName = parts.slice(1).join('/');

    const textContent = await readTextFile(userId, projectName, fileName);

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
async function buildStepContext(userId: string, projectName: string, stepId: WorkflowStepId, existingFiles: any): Promise<string> {
  let context = '';

  switch (stepId) {
    case 'brainstorm':
      // For brainstorm, read existing brainstorm.txt file content (user's ideas)
      if (existingFiles.brainstorm?.path) {
        context = await readTextFile(userId, projectName, 'brainstorm.txt');
      }
      break;

    case 'outline':
      if (existingFiles.brainstorm?.path) {
        const brainstormContent = await readTextFile(userId, projectName, 'brainstorm.txt');
        context = `BRAINSTORM CONTENT:\n${brainstormContent}`;
      }
      break;

    case 'world':
      let hasBrainstorm = false;
      let hasOutline = false;

      if (existingFiles.brainstorm?.path) {
        const brainstormText = (await readTextFile(userId, projectName, 'brainstorm.txt')).trim();
        if (brainstormText) {
          context += `BRAINSTORM CONTENT:\n${brainstormText}\n\n`;
          hasBrainstorm = true;
        }
      }
      if (existingFiles.outline?.path) {
        const outlineText = (await readTextFile(userId, projectName, 'outline.txt')).trim();
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
      const chapterToWrite = await determineNextChapter(userId, projectName, existingFiles);

      if (!chapterToWrite) {
        context = 'ERROR: Could not determine which chapter to write. Please check outline.txt exists.';
        break;
      }

      // Build context with outline, world, and specific chapter instruction
      let outlineContent = '';
      let worldContent = '';
      let manuscriptContent = '';

      if (existingFiles.outline?.path) {
        outlineContent = await readTextFile(userId, projectName, 'outline.txt');
      }

      if (existingFiles.world?.path) {
        worldContent = await readTextFile(userId, projectName, 'world.txt');
      }

      // Get existing manuscript if it exists
      if (existingFiles.chapters && existingFiles.chapters.length > 0) {
        manuscriptContent = await readTextFile(userId, projectName, 'manuscript.txt');
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
async function determineNextChapter(userId: string, projectName: string, existingFiles: any): Promise<{ title: string; number: number } | null> {
  try {
    // Get outline content
    if (!existingFiles.outline?.path) {
      console.log('No outline file found');
      return null;
    }

    const outlineContent = await readTextFile(userId, projectName, 'outline.txt');

    // Get existing manuscript content (if it exists)
    let manuscriptContent = '';
    if (existingFiles.chapters && existingFiles.chapters.length > 0) {
      manuscriptContent = await readTextFile(userId, projectName, 'manuscript.txt');
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
): Promise<{ success: boolean; data?: { fileId: string }; error?: string }> {
  try {
    let manuscriptContent = '';

    // Check if manuscript.txt already exists
    if (existingFiles.chapters && existingFiles.chapters.length > 0) {
      // Read existing manuscript
      manuscriptContent = await readTextFile(userId, projectName, 'manuscript.txt');
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

    // Upload to Supabase storage
    await uploadFileToProject(userId, projectName, fileName, updatedContent);

    return {
      success: true,
      data: { fileId: `${projectName}/${fileName}` }
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
