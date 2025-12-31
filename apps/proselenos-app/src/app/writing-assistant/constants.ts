import { WorkflowStep } from './types';

export const INITIAL_WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 'brainstorm',
    name: 'Brainstorm',
    description: 'Generate and develop story ideas, characters, and initial concepts',
    status: 'ready',
    dependencies: []
  },
  {
    id: 'outline',
    name: 'Outline',
    description: 'Create detailed chapter-by-chapter story structure',
    status: 'ready',
    dependencies: ['brainstorm']
  },
  {
    id: 'world',
    name: 'World Builder',
    description: 'Develop setting, characters, and world details',
    status: 'ready',
    dependencies: ['outline']
  },
  {
    id: 'chapters',
    name: 'Chapter Writer',
    description: 'Write chapters one-by-one using Outline, World, and existing Manuscript. Click the Close button to read the latest chapter, then the AI Writing button to return here.',
    status: 'ready',
    dependencies: ['outline', 'world']
  }
];

export const WORKFLOW_FILE_NAMES = {
  brainstorm: 'brainstorm.txt',
  outline: 'outline.txt',
  world: 'world.txt',
  chapters: 'manuscript.txt' // For chapter writer, create main manuscript
} as const;

export const MODAL_CONFIG = {
  maxWidth: '800px',
  maxHeight: '80vh',
  backdropBlur: '4px',
  zIndex: 1000
} as const;
