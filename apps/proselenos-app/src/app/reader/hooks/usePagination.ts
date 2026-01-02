import { desktopGetWindowLogicalPosition } from '@/utils/desktop-stubs';
import { useEffect, useRef } from 'react';
import { useEnv } from '@/context/EnvContext';
import { FoliateView } from '@/types/view';
import { ViewSettings } from '@/types/book';
import { useReaderStore } from '@/store/readerStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { useDeviceControlStore } from '@/store/deviceStore';
import { eventDispatcher } from '@/utils/event';
import { isDesktopAppPlatform } from '@/services/environment';

export type ScrollSource = 'touch' | 'mouse';

type PaginationSide = 'left' | 'right' | 'up' | 'down';
type PaginationMode = 'page' | 'section';

const swapLeftRight = (side: PaginationSide) => {
  if (side === 'left') return 'right';
  if (side === 'right') return 'left';
  return side;
};

// REVERT: Remove COOLDOWN_DELAY to restore original behavior (no inertia protection)
// This prevents trackpad momentum from skipping multiple sections
const COOLDOWN_DELAY = 500;

export const viewPagination = (
  view: FoliateView | null,
  viewSettings: ViewSettings | null | undefined,
  side: PaginationSide,
  mode: PaginationMode = 'page',
) => {
  if (!view || !viewSettings) return;
  const renderer = view.renderer;
  if (view.book.dir === 'rtl') {
    side = swapLeftRight(side);
  }
  if (renderer.scrolled) {
    const { size } = renderer;
    const showHeader = viewSettings.showHeader && viewSettings.showBarsOnScroll;
    const showFooter = viewSettings.showFooter && viewSettings.showBarsOnScroll;
    const scrollingOverlap = viewSettings.scrollingOverlap;
    const distance = size - scrollingOverlap - (showHeader ? 44 : 0) - (showFooter ? 44 : 0);
    switch (mode) {
      case 'page':
        return side === 'left' || side === 'up' ? view.prev(distance) : view.next(distance);
      case 'section':
        if (side === 'left' || side === 'up') {
          return view.renderer.prevSection?.();
        } else {
          return view.renderer.nextSection?.();
        }
    }
  } else {
    switch (mode) {
      case 'page':
        return side === 'left' || side === 'up' ? view.prev() : view.next();
      case 'section':
        if (side === 'left' || side === 'up') {
          return view.renderer.prevSection?.();
        } else {
          return view.renderer.nextSection?.();
        }
    }
  }
};

export const usePagination = (
  bookKey: string,
  viewRef: React.MutableRefObject<FoliateView | null>,
  containerRef: React.RefObject<HTMLDivElement>,
) => {
  const { appService } = useEnv();
  const { getBookData } = useBookDataStore();
  const { getViewSettings, getViewState } = useReaderStore();
  const { hoveredBookKey, setHoveredBookKey } = useReaderStore();
  const { acquireVolumeKeyInterception, releaseVolumeKeyInterception } = useDeviceControlStore();

  // REVERT: Remove these refs to restore original behavior (no inertia protection)
  const transitionPendingRef = useRef(false);
  const lastTransitionTimeRef = useRef(0);

  const handlePageFlip = async (
    msg: MessageEvent | CustomEvent | React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    const viewState = getViewState(bookKey);
    const bookData = getBookData(bookKey);
    if (!viewState?.inited || !bookData) return;

    if (msg instanceof MessageEvent) {
      if (msg.data && msg.data.bookKey === bookKey) {
        const viewSettings = getViewSettings(bookKey)!;
        if (msg.data.type === 'iframe-single-click') {
          const viewElement = containerRef.current;
          if (viewElement) {
            const { screenX } = msg.data;
            const viewRect = viewElement.getBoundingClientRect();
            let windowStartX;
            // Currently for desktop APP the window.screenX is always 0
            if (isDesktopAppPlatform()) {
              if (appService?.isMobile) {
                windowStartX = 0;
              } else {
                const windowPosition = (await desktopGetWindowLogicalPosition()) as {
                  x: number;
                  y: number;
                };
                windowStartX = windowPosition.x;
              }
            } else {
              windowStartX = window.screenX;
            }
            const viewStartX = windowStartX + viewRect.left;
            const viewCenterX = viewStartX + viewRect.width / 2;
            const consumed = eventDispatcher.dispatchSync('iframe-single-click');
            if (!consumed) {
              const centerStartX = viewStartX + viewRect.width * 0.375;
              const centerEndX = viewStartX + viewRect.width * 0.625;
              if (
                viewSettings.disableClick! ||
                (screenX >= centerStartX && screenX <= centerEndX)
              ) {
                // toggle visibility of the header bar and the footer bar
                setHoveredBookKey(hoveredBookKey ? null : bookKey);
              } else {
                if (hoveredBookKey) {
                  setHoveredBookKey(null);
                  return;
                }
                if (!viewSettings.disableClick! && screenX >= viewCenterX) {
                  if (viewSettings.fullscreenClickArea) {
                    viewPagination(viewRef.current, viewSettings, 'down');
                  } else if (viewSettings.swapClickArea) {
                    viewPagination(viewRef.current, viewSettings, 'left');
                  } else {
                    viewPagination(viewRef.current, viewSettings, 'right');
                  }
                } else if (!viewSettings.disableClick! && screenX < viewCenterX) {
                  if (viewSettings.fullscreenClickArea) {
                    viewPagination(viewRef.current, viewSettings, 'down');
                  } else if (viewSettings.swapClickArea) {
                    viewPagination(viewRef.current, viewSettings, 'right');
                  } else {
                    viewPagination(viewRef.current, viewSettings, 'left');
                  }
                }
              }
            }
          }
        } else if (
          msg.data.type === 'iframe-wheel' &&
          !viewSettings.scrolled &&
          (!bookData.isFixedLayout || viewSettings.zoomLevel <= 100)
        ) {
          // The wheel event is handled by the iframe itself in scrolled mode.
          const { deltaY } = msg.data;
          if (deltaY > 0) {
            viewRef.current?.next(1);
          } else if (deltaY < 0) {
            viewRef.current?.prev(1);
          }
        } else if (msg.data.type === 'iframe-mouseup') {
          if (msg.data.button === 3) {
            viewRef.current?.history.back();
          } else if (msg.data.button === 4) {
            viewRef.current?.history.forward();
          }
        }
      }
    } else if (msg instanceof CustomEvent) {
      const viewSettings = getViewSettings(bookKey);
      if (msg.type === 'native-key-down' && viewSettings?.volumeKeysToFlip) {
        const { keyName } = msg.detail;
        setHoveredBookKey('');
        if (keyName === 'VolumeUp') {
          viewPagination(viewRef.current, viewSettings, 'up');
        } else if (keyName === 'VolumeDown') {
          viewPagination(viewRef.current, viewSettings, 'down');
        }
      } else if (
        msg.type === 'touch-swipe' &&
        bookData.isFixedLayout &&
        viewSettings!.zoomLevel <= 100
      ) {
        const { deltaX, deltaY } = msg.detail;
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
          if (deltaX > 0) {
            viewPagination(viewRef.current, viewSettings, 'left');
          } else {
            viewPagination(viewRef.current, viewSettings, 'right');
          }
        }
      }
    } else {
      if (msg.type === 'click') {
        const { clientX } = msg;
        const width = window.innerWidth;
        const leftThreshold = width * 0.5;
        const rightThreshold = width * 0.5;
        const viewSettings = getViewSettings(bookKey);
        if (clientX < leftThreshold) {
          viewPagination(viewRef.current, viewSettings, 'left');
        } else if (clientX > rightThreshold) {
          viewPagination(viewRef.current, viewSettings, 'right');
        }
      }
    }
  };

  const handleContinuousScroll = (mode: ScrollSource, scrollDelta: number, threshold: number) => {
    const renderer = viewRef.current?.renderer;
    const viewSettings = getViewSettings(bookKey)!;
    const bookData = getBookData(bookKey)!;

    // Currently continuous scroll is not supported in pre-paginated layout
    if (bookData.bookDoc?.rendition?.layout === 'pre-paginated') return;

    if (renderer && viewSettings.scrolled && viewSettings.continuousScroll) {
      const doScroll = () => {
        // REVERT: Remove transitionPendingRef check to restore original behavior
        // Prevent re-entry if a transition is already happening
        if (transitionPendingRef.current) return;

        // REVERT: Remove cooldown check to restore original behavior
        // Block scroll inputs shortly after a page turn to prevent inertia skipping
        if (Date.now() - lastTransitionTimeRef.current < COOLDOWN_DELAY) return;

        // Check Top Boundary (scrolling up/backward)
        // may have overscroll where the start is greater than 0
        if (renderer.start <= scrollDelta && scrollDelta > threshold) {
          transitionPendingRef.current = true;
          const distance = renderer.start + 1;

          (async () => {
            await viewRef.current?.prev(distance);
            lastTransitionTimeRef.current = Date.now();
            transitionPendingRef.current = false;
          })();
        }
        // Check Bottom Boundary (scrolling down/forward)
        // sometimes viewSize has subpixel value that the end never reaches
        else if (
          Math.ceil(renderer.end) - scrollDelta >= renderer.viewSize &&
          scrollDelta < -threshold
        ) {
          transitionPendingRef.current = true;
          const distance = renderer.viewSize - Math.floor(renderer.end) + 1;

          (async () => {
            await viewRef.current?.next(distance);
            lastTransitionTimeRef.current = Date.now();
            transitionPendingRef.current = false;
          })();
        }
      };

      if (mode === 'mouse') {
        // we can always get mouse wheel events
        doScroll();
      } else if (mode === 'touch') {
        // when the document height is less than the viewport height, we can't get the relocate event
        if (renderer.size >= renderer.viewSize) {
          doScroll();
        } else {
          // scroll after the relocate event
          renderer.addEventListener('relocate', () => doScroll(), { once: true });
        }
      }
    }
  };

  useEffect(() => {
    if (!appService?.isMobileApp) return;

    const viewSettings = getViewSettings(bookKey);
    if (viewSettings?.volumeKeysToFlip) {
      acquireVolumeKeyInterception();
    } else {
      releaseVolumeKeyInterception();
    }

    eventDispatcher.on('native-key-down', handlePageFlip);
    return () => {
      releaseVolumeKeyInterception();
      eventDispatcher.off('native-key-down', handlePageFlip);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    handlePageFlip,
    handleContinuousScroll,
  };
};
