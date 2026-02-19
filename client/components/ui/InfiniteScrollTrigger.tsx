/**
 * InfiniteScrollTrigger — sentinel element that triggers loading more data
 * Uses IntersectionObserver to detect when the user scrolls near the bottom.
 */

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';

interface InfiniteScrollTriggerProps {
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
}

export function InfiniteScrollTrigger({
  onLoadMore,
  hasMore,
  isLoading,
}: InfiniteScrollTriggerProps) {
  const { ref, isIntersecting } = useIntersectionObserver<HTMLDivElement>({
    enabled: hasMore && !isLoading,
    rootMargin: '300px',
  });

  useEffect(() => {
    if (isIntersecting && hasMore && !isLoading) {
      onLoadMore();
    }
  }, [isIntersecting, hasMore, isLoading, onLoadMore]);

  if (!hasMore) return null;

  return (
    <div ref={ref as React.Ref<HTMLDivElement>} className="flex justify-center py-4">
      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading more...</span>
        </div>
      )}
    </div>
  );
}
