import { useCallback, useMemo, useRef, useState } from "react";

/* =====================================================================
   PAGING A LIST THAT IS ALREADY ON THE PAGE

   The panels load a whole list (agents, orders, products) and then search,
   filter and sort it in the browser. This shows that list a page at a time
   instead of as one long scroll.

     const [pager, pagerTop] = usePagination(visibleAgents, { resetKey: search + filter });

     <div ref={pagerTop}>
       {pager.pageItems.map(...)}
     </div>
     <Pagination {...pager.controls} label="agents" />

   resetKey  anything that changes when the list being paged is a
             DIFFERENT list: the search text, the chosen filter. When it
             changes, paging goes back to the first page. It is not reset
             just because the data refreshed, so a new order arriving does
             not throw someone on page 3 back to page 1.

   If the list shrinks under the current page (a filter narrowed it, the
   last row of the last page was removed) the last page that still exists
   is shown, never an empty one.

   pagerTop        goes on the list's container. Changing page scrolls that
                   container back to its top, so the new page is read from
                   the start rather than from wherever the buttons were. It
                   is returned beside the pager, not inside it, because it
                   is a ref and the rest is read while rendering.

   pager.showItem  turns to the page holding one particular item, for a
                   screen that opens straight onto a given order:
                   pager.showItem((order) => order._id === wanted)
   ===================================================================== */

const NOTHING = [];

export default function usePagination(items, { pageSize = 10, resetKey = "" } = {}) {
  const list = Array.isArray(items) ? items : NOTHING;

  const [state, setState] = useState({ page: 1, size: pageSize, key: resetKey });

  // A different list: start again from its first page. Done while rendering,
  // as React recommends for "reset when an input changes", so there is never
  // a frame showing page 3 of the new list.
  if (state.key !== resetKey) {
    setState({ page: 1, size: state.size, key: resetKey });
  }

  const size = state.size;
  const total = list.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const page = state.key !== resetKey ? 1 : Math.min(Math.max(1, state.page), pageCount);
  const start = (page - 1) * size;

  const pageItems = useMemo(() => list.slice(start, start + size), [list, start, size]);

  const container = useRef(null);
  const top = useCallback((element) => {
    container.current = element;
  }, []);

  const toTop = () => {
    const element = container.current;
    if (!element) return;

    element.scrollTop = 0; // a list that scrolls inside its own box

    // Only when its top is off screen (or under the panel's header bar):
    // a short list that is already in view stays where it is
    const { top: y } = element.getBoundingClientRect();
    if (y < 72 || y > window.innerHeight - 120) {
      element.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  };

  const setPage = useCallback((next) => {
    setState((current) => ({ ...current, page: next }));
    // after the new page has been drawn
    requestAnimationFrame(toTop);
  }, []);

  const setPageSize = useCallback((next) => {
    setState((current) => ({ ...current, size: next, page: 1 }));
    requestAnimationFrame(toTop);
  }, []);

  // No scrolling here: the caller is about to scroll to the item itself
  const showItem = useCallback(
    (matches) => {
      const index = list.findIndex(matches);
      if (index < 0) return false;

      const wanted = Math.floor(index / size) + 1;
      setState((current) => (current.page === wanted ? current : { ...current, page: wanted }));
      return true;
    },
    [list, size],
  );

  const pager = {
    pageItems,
    page,
    pageCount,
    total,
    setPage,
    showItem,
    // exactly what <Pagination> takes
    controls: {
      page,
      pageCount,
      total,
      from: total ? start + 1 : 0,
      to: Math.min(start + size, total),
      pageSize: size,
      onPageChange: setPage,
      onPageSizeChange: setPageSize,
    },
  };

  return [pager, top];
}
