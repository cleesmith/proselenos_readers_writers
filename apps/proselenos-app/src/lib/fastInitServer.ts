// apps/proselenos-app/src/lib/fastInitServer.ts
// Fast initialization for Authors Mode using Supabase

import { getServerSession } from 'next-auth';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';
import { getAuthorConfig } from '@/lib/config-storage';
import { listProjects } from '@/lib/project-storage';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
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

    // Ensure the public library repo exists (for Bookstore)
    await ensureLibraryRepoExists();

    // Load config and projects from Supabase in parallel
    const [config, projectsList] = await Promise.all([
      getAuthorConfig(userId),
      listProjects(userId)
    ]);

    // Transform projects to expected format
    const projects: FileMetadata[] = projectsList.map(p => ({
      name: p.name,
      id: p.id
    }));

    // Get tool categories from default_tool_prompts
    let toolCategories: FileMetadata[] = [];
    const toolsByCategory: Record<string, FileMetadata[]> = {};

    if (isSupabaseConfigured()) {
      const { data: defaultTools } = await supabase!
        .from('default_tool_prompts')
        .select('category, tool_name')
        .order('category')
        .order('tool_name');

      if (defaultTools) {
        const categorySet = new Set<string>();
        defaultTools.forEach(tool => {
          categorySet.add(tool.category);
          if (!toolsByCategory[tool.category]) {
            toolsByCategory[tool.category] = [];
          }
          toolsByCategory[tool.category]!.push({
            name: `${tool.tool_name}.txt`,
            id: `${tool.category}/${tool.tool_name}.txt`
          });
        });
        toolCategories = Array.from(categorySet).sort().map(name => ({ name, id: name }));
      }
    }

    const memEnd = process.memoryUsage().heapUsed / 1024 / 1024;
    const durationMs = Date.now() - startTime;
    const memDelta = memEnd - memStart;
    const sign = memDelta >= 0 ? '+' : '';
    console.log(`fastInit Memory: ${memEnd.toFixed(1)}MB -> ${memStart.toFixed(1)}MB (${sign}${memDelta.toFixed(1)}MB)`);

    return {
      config: {
        settings: {
          current_project: config.settings.current_project,
          current_project_folder_id: config.settings.current_project_folder_id,
          tool_prompts_folder_id: null
        },
        selectedApiProvider: config.selectedApiProvider,
        selectedAiModel: config.selectedAiModel,
        author_name: config.author_name,
        isDarkMode: config.isDarkMode ?? false
      },
      hasSettingsFile: true, // Always true with Supabase (API keys in author_config.api_keys)
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
