import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// Two separate downloads: the public shop (visitors on a phone) and the staff app.
const Shop = lazy(() => import('./pages/Shop'));
const StaffApp = lazy(() => import('./StaffApp'));

// The shop's pages arrive from the server with their content already in #root (for Google and
// link previews). It stays on screen while the shop's code downloads, instead of a blank page.
const serverContent = document.getElementById('root')?.innerHTML.trim() || '';
const ShopLoading = () => (serverContent ? <div dangerouslySetInnerHTML={{ __html: serverContent }} /> : null);
const shopPage = (
  <Suspense fallback={<ShopLoading />}>
    <Shop />
  </Suspense>
);

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
          {/* One route for /shop and the product pages /shop/p/<id>-<slug>: the shop stays mounted. */}
          <Route path="/shop/*" element={shopPage} />
          <Route path="*" element={<StaffApp />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
