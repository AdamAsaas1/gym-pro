import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// Two separate downloads: the public shop (visitors on a phone) and the staff app.
const Shop = lazy(() => import('./pages/Shop'));
const StaffApp = lazy(() => import('./StaffApp'));

export default function App() {
  const { i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.dir = i18n.dir();
    document.documentElement.lang = i18n.language;
  }, [i18n, i18n.language]);

  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          {/* Public online shop (linked from Instagram): no login required */}
          <Route path="/shop" element={<Shop />} />
          <Route path="*" element={<StaffApp />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
