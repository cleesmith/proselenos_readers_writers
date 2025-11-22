// app/lib/github/fastInitServer.ts

import { getServerSession } from 'next-auth';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';
import { getProselenosConfig } from '@/lib/github-config-storage';
import { ensureUserRepoExists, listFiles } from '@/lib/github-storage';
import { ensureLibraryRepoExists } from '@/app/actions/store-catalog';

export type Config = {
  settings: {
    current_project: string | null;
    current_project_folder_id: string | null;
    tool_prompts_folder_id: string | null;
  };
  selectedApiProvider: string;
  selectedAiModel: string;
  author_name: string;
  isDarkMode?: boolean;
};

export type StorageFile = {
  id: string;
  name: string;
  mimeType?: string;
};

export type InitPayloadForClient = {
  config: Config | null;
  hasSettingsFile: boolean;
  projects: StorageFile[];
  toolCategories: StorageFile[];
  toolsByCategory: Record<string, StorageFile[]>;
  durationMs: number;
};

type FileMetadata = {
  id: string;
  name: string;
};

export async function fastInitForUser(): Promise<InitPayloadForClient> {
  const memStart = process.memoryUsage().heapUsed / 1024 / 1024;
  const startTime = Date.now();

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return {
        config: null,
        hasSettingsFile: false,
        projects: [],
        toolCategories: [],
        toolsByCategory: {},
        durationMs: Date.now() - startTime
      };
    }

    const userId = session.user.id;

    // Ensure user's GitHub repo exists
    await ensureUserRepoExists(userId, 'proselenos', 'Proselenos user storage');

    // Ensure the public library repo exists
    await ensureLibraryRepoExists();

    // Load config and all files in parallel
    const [config, allFiles] = await Promise.all([
      getProselenosConfig(userId),
      listFiles(userId, 'proselenos', '')
    ]);

    // Check if settings file exists
    const hasSettingsFile = allFiles.some(f => f.name === 'proselenos-settings.json');

    // Extract projects (top-level folders, excluding tool-prompts)
    const projectSet = new Set<string>();
    allFiles.forEach(file => {
      const parts = file.path.split('/');
      if (parts.length > 1) {
        const folderName = parts[0];
        if (folderName && folderName !== 'tool-prompts' && !folderName.startsWith('.')) {
          projectSet.add(folderName);
        }
      }
    });
    const projects: FileMetadata[] = Array.from(projectSet).sort().map(name => ({ name, id: name }));

    // Extract tool categories (folders under tool-prompts/)
    const categorySet = new Set<string>();
    const toolsByCategory: Record<string, FileMetadata[]> = {};

    allFiles.forEach(file => {
      if (file.path.startsWith('tool-prompts/')) {
        const parts = file.path.split('/');
        if (parts.length >= 3) {
          const categoryName = parts[1];
          const fileName = parts[2];
          if (!categoryName) return;
          if (!fileName) return;

          categorySet.add(categoryName);

          if (!toolsByCategory[categoryName]) {
            toolsByCategory[categoryName] = [];
          }
          toolsByCategory[categoryName].push({
            name: fileName,
            id: `${categoryName}/${fileName}`
          });
        }
      }
    });

    const toolCategories: FileMetadata[] = Array.from(categorySet).sort().map(name => ({ name, id: name }));

    const memEnd = process.memoryUsage().heapUsed / 1024 / 1024;
    const durationMs = Date.now() - startTime;
    const memDelta = memEnd - memStart;
    const sign = memDelta >= 0 ? '+' : '';
    console.log(`fastInit Memory: ${memEnd.toFixed(1)}MB -> ${memStart.toFixed(1)}MB (${sign}${memDelta.toFixed(1)}MB)`);

    return {
      config: {
        ...config,
        settings: {
          current_project: config.settings.current_project,
          current_project_folder_id: config.settings.current_project_folder_id,
          tool_prompts_folder_id: null
        },
        isDarkMode: config.isDarkMode ?? false
      },
      hasSettingsFile,
      projects,
      toolCategories,
      toolsByCategory,
      durationMs
    };
  } catch (error) {
    console.error('fastInitForUser error:', error);
    return {
      config: null,
      hasSettingsFile: false,
      projects: [],
      toolCategories: [],
      toolsByCategory: {},
      durationMs: Date.now() - startTime
    };
  }
}
