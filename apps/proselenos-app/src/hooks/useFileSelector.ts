import { AppService } from '@/types/system';
import { stubTranslation as _ } from '@/utils/misc';
import { BOOK_ACCEPT_FORMATS, SUPPORTED_BOOK_EXTS } from '@/services/constants';

export interface FileSelectorOptions {
  type: SelectionType;
  accept?: string;
  multiple?: boolean;
  extensions?: string[];
  dialogTitle?: string;
}

export interface SelectedFile {
  // For Web file
  file?: File;

  // For Desktop file
  path?: string;

  // Import source for tracking provenance (URL, file path, bookstore URL, etc.)
  importSource?: string;
}

export interface FileSelectionResult {
  files: SelectedFile[];
  error?: string;
}

const selectFileWeb = (options: FileSelectorOptions): Promise<File[]> => {
  return new Promise((resolve) => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = options.accept || '*/*';
    fileInput.multiple = options.multiple || false;
    fileInput.click();

    fileInput.onchange = () => {
      resolve(Array.from(fileInput.files || []));
    };
  });
};

// No Desktop - removed desktop file selection

const processWebFiles = (files: File[]): SelectedFile[] => {
  return files.map((file) => ({
    file,
  }));
};

// No Desktop - removed desktop file processing

export const useFileSelector = (_appService: AppService | null, _: (key: string) => string) => {
  const selectFiles = async (options: FileSelectorOptions = { type: 'generic' }) => {
    options = { ...FILE_SELECTION_PRESETS[options.type], ...options };
    // No Desktop - web-only file selection
    try {
      const webFiles = await selectFileWeb(options);
      const files = processWebFiles(webFiles);
      return { files };
    } catch (error) {
      return {
        files: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  };
  return {
    selectFiles,
  };
};

export const FILE_SELECTION_PRESETS = {
  generic: {
    accept: '*/*',
    extensions: ['*'],
    dialogTitle: _('Select Files'),
  },
  images: {
    accept: 'image/*',
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
    dialogTitle: _('Select Image'),
  },
  videos: {
    accept: 'video/*',
    extensions: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'],
    dialogTitle: _('Select Video'),
  },
  audio: {
    accept: 'audio/*',
    extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a'],
    dialogTitle: _('Select Audio'),
  },
  books: {
    accept: BOOK_ACCEPT_FORMATS,
    extensions: SUPPORTED_BOOK_EXTS,
    dialogTitle: _('Select Books'),
  },
  fonts: {
    accept: '.ttf, .otf, .woff, .woff2',
    extensions: ['ttf', 'otf', 'woff', 'woff2'],
    dialogTitle: _('Select Fonts'),
  },
  covers: {
    accept: '.png, .jpg, .jpeg, .gif',
    extensions: ['png', 'jpg', 'jpeg', 'gif'],
    dialogTitle: _('Select Image'),
  },
};

export type SelectionType = keyof typeof FILE_SELECTION_PRESETS;
