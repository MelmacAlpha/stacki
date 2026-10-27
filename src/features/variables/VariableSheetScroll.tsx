import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { VariableBlock } from './variablesBridge';
import { assert } from '../../../shared/core/assert';
import { createScrollSync, SCROLL_PEERS_MAX } from './variableScroll';

interface ScrollMetrics {
  readonly maximum: number;
  readonly viewport: number;
  readonly gutter: number;
}

export function useVariableSheetScroll(blocks: readonly VariableBlock[], columnCount: number) {
  const sync = useMemo(createScrollSync, []);
  const bodyRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<ScrollMetrics>({ maximum: 0, viewport: 0, gutter: 0 });
  useLayoutEffect(() => () => sync.dispose(), [sync]);
  useLayoutEffect(() => sync.register(barRef.current ?? undefined), [sync]);
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) {
      return undefined;
    }
    const strips = body.querySelectorAll<HTMLElement>('.vars-scroll-rows, .vars-scroll-head');
    assert(strips.length <= SCROLL_PEERS_MAX, 'Variable scroll: strip limit exceeded');
    const measure = () => {
      // A hidden editor has no geometry. Preserve its position until it is visible again.
      if (body.clientWidth === 0) {
        return;
      }
      const next = measureSheet(body, strips);
      setMetrics((previous) =>
        previous.maximum === next.maximum &&
        previous.viewport === next.viewport &&
        previous.gutter === next.gutter
          ? previous
          : next,
      );
    };
    measure();
    if (typeof ResizeObserver !== 'function') {
      return undefined;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    for (const strip of strips) {
      observer.observe(strip);
    }
    return () => observer.disconnect();
  }, [blocks, columnCount]);
  useLayoutEffect(() => sync.fit(metrics.maximum), [sync, metrics]);
  return { sync, bodyRef, barRef, metrics };
}

export function VariableScrollBar({
  scroll,
}: {
  readonly scroll: ReturnType<typeof useVariableSheetScroll>;
}) {
  const { metrics, barRef, sync } = scroll;
  return (
    <div
      className="vars-scrollbar-row"
      hidden={metrics.maximum <= 0}
      style={{ paddingRight: metrics.gutter }}
    >
      <div
        className="vars-horizontal-scroll"
        ref={barRef}
        role="region"
        aria-label="Scroll variable values horizontally"
        tabIndex={0}
        onScroll={(event) => sync.broadcast(event.currentTarget, event.currentTarget.scrollLeft)}
      >
        <div style={{ width: metrics.viewport + metrics.maximum, height: 1 }} />
      </div>
    </div>
  );
}

function measureSheet(body: HTMLElement, strips: NodeListOf<HTMLElement>): ScrollMetrics {
  assert(body.clientWidth > 0, 'Variable scroll: visible body is required');
  assert(strips.length <= SCROLL_PEERS_MAX, 'Variable scroll: strip limit exceeded');
  let maximum = 0;
  for (const strip of strips) {
    maximum = Math.max(maximum, strip.scrollWidth - strip.clientWidth);
  }
  return {
    maximum,
    viewport: strips[0]?.clientWidth ?? 0,
    gutter: body.offsetWidth - body.clientWidth,
  };
}
