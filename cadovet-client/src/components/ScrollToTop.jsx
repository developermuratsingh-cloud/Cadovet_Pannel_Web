import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// React Router doesn't reset scroll position on navigation the way a traditional multi-page site does —
// without this, clicking a nav/dropdown link while scrolled down on the current page lands on the new
// page at that same scroll offset instead of at the top. Rendered once, next to <Routes>.
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

export default ScrollToTop;
