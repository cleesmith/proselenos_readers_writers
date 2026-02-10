import clsx from 'clsx';
import React from 'react';
import { Insets } from '@/types/misc';
import { PageInfo, TimeInfo } from '@/types/book';
import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useBookDataStore } from '@/store/bookDataStore';
import { formatNumber, formatProgress } from '@/utils/progress';

interface PageInfoProps {
  bookKey: string;
  section?: PageInfo;
  pageinfo?: PageInfo;
  timeinfo?: TimeInfo;
  horizontalGap: number;
  contentInsets: Insets;
  gridInsets: Insets;
}

const ProgressInfoView: React.FC<PageInfoProps> = ({
  bookKey,
  section,
  pageinfo,
  timeinfo,
  horizontalGap,
  contentInsets,
  gridInsets,
}) => {
  const _ = useTranslation();
  const { appService } = useEnv();
  const { getBookData } = useBookDataStore();
  const { getView, getViewSettings } = useReaderStore();
  const view = getView(bookKey);
  const bookData = getBookData(bookKey);
  const viewSettings = getViewSettings(bookKey)!;

  const showDoubleBorder = viewSettings.vertical && viewSettings.doubleBorder;
  const isScrolled = viewSettings.scrolled;
  const isVertical = viewSettings.vertical;
  const isEink = viewSettings.isEink;
  const { progressStyle: readingProgressStyle } = viewSettings;

  const template =
    readingProgressStyle === 'fraction'
      ? isVertical
        ? '{current} · {total}'
        : '{current} / {total}'
      : '{percent}%';

  const lang = localStorage?.getItem('i18nextLng') || '';
  const localize = isVertical && lang.toLowerCase().startsWith('zh');
  const progress = bookData?.isFixedLayout ? section : pageinfo;
  const progressInfo = formatProgress(progress?.current, progress?.total, template, localize, lang);

  const timeLeft = timeinfo
    ? _('{{time}} min left in chapter', {
        time: formatNumber(Math.round(timeinfo.section), localize, lang),
      })
    : '';
  const renderer = view?.renderer;
  const scrollPages = renderer && renderer.size > 0
    ? Math.max(1, Math.ceil(renderer.viewSize / renderer.size))
    : 0;
  const currentScrollPage = renderer && renderer.size > 0
    ? Math.floor(renderer.start / renderer.size)
    : 0;
  const pagesRemaining = Math.max(0, scrollPages - currentScrollPage - 1);
  const pageLeft =
    pagesRemaining > 0
      ? localize
        ? _('{{number}} pages left in chapter', {
            number: formatNumber(pagesRemaining, localize, lang),
          })
        : _('{{count}} pages left in chapter', {
            count: pagesRemaining,
          })
      : '';

  return (
    <div
      className={clsx(
        'progressinfo absolute bottom-0 flex items-center justify-between font-sans',
        isEink ? 'text-sm font-normal' : 'text-neutral-content text-xs font-extralight',
        isVertical ? 'writing-vertical-rl' : 'w-full',
        isScrolled && !isVertical && 'bg-base-100',
      )}
      aria-label={[
        progress
          ? _('On {{current}} of {{total}} page', {
              current: progress.current + 1,
              total: progress.total,
            })
          : '',
        timeLeft,
        pageLeft,
      ]
        .filter(Boolean)
        .join(', ')}
      style={
        isVertical
          ? {
              bottom: `${contentInsets.bottom * 1.5}px`,
              left: showDoubleBorder
                ? `calc(${contentInsets.left}px)`
                : `calc(${Math.max(0, contentInsets.left - 32)}px)`,
              width: showDoubleBorder ? '32px' : `${horizontalGap}%`,
              height: `calc(100% - ${((contentInsets.top + contentInsets.bottom) / 2) * 3}px)`,
            }
          : {
              paddingInlineStart: `calc(${horizontalGap / 2}% + ${contentInsets.left}px)`,
              paddingInlineEnd: `calc(${horizontalGap / 2}% + ${contentInsets.right}px)`,
              paddingBottom: appService?.hasSafeAreaInset ? `${gridInsets.bottom * 0.33}px` : 0,
            }
      }
    >
      <div
        aria-hidden='true'
        className={clsx(
          'flex items-center justify-between',
          isVertical ? 'h-full' : 'h-[52px] w-full',
        )}
      >
        {viewSettings.showRemainingTime ? (
          <span className='text-start'>{timeLeft}</span>
        ) : viewSettings.showRemainingPages ? (
          <span className='text-start'>{pageLeft}</span>
        ) : null}
        {viewSettings.showProgressInfo && (
          <span className={clsx('text-end', isVertical ? 'mt-auto' : 'ms-auto')}>
            {progressInfo}
          </span>
        )}
      </div>
    </div>
  );
};

export default ProgressInfoView;
