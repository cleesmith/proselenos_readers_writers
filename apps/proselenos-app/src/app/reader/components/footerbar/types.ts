import { PageInfo } from '@/types/book';
import { Insets } from '@/types/misc';

export interface FooterBarProps {
  bookKey: string;
  bookFormat: string;
  section?: PageInfo;
  pageinfo?: PageInfo;
  isHoveredAnim: boolean;
  gridInsets: Insets;
  onCloseBook: (bookKey: string) => void;
}

export interface NavigationHandlers {
  onPrevPage: () => void;
  onNextPage: () => void;
  onPrevSection: () => void;
  onNextSection: () => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onProgressChange: (value: number) => void;
}

export interface FooterBarChildProps {
  bookKey: string;
  navigationHandlers: NavigationHandlers;
  progressFraction: number;
  progressValid: boolean;
  gridInsets: Insets;
  actionTab: string;
  onSetActionTab: (tab: string) => void;
  onCloseBook: (bookKey: string) => void;
}
