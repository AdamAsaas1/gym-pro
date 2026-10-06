import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { ShoppingBag, Search, Pencil, Trash2, Plus, Image as ImageIcon, ClipboardList, AlertTriangle, Settings2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ShopSettingsModal from '../components/ShopSettingsModal';
import Modal from '../components/Modal';
import { getProducts, createProduct, updateProduct, deleteProduct } from '../api/client';
import { useTranslation } from 'react-i18next';
import OrdersPanel from '../components/OrdersPanel';
import { useGym } from '../context/GymContext';
import './Boutique.css';

const EMPTY_PRODUCT = {
  name: '',
  description: '',
  price: '',
  stock: '',
  category: '',
  image_url: '',
  promo: '',
  variants: []
};

const getFirstImage = (url) => {
  if (!url) return null;
  try {
    const parsed = JSON.parse(url);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed[0];
    }
    return url;
  } catch (e) {
    return url;
  }
};

// Categories the public shop knows (tab, icon, translation). Anything else is shown as typed.
const SHOP_CATEGORIES = [
  { value: 'supplements', label: 'Compléments' },
  { value: 'accessories', label: 'Accessoires' },
  { value: 'clothing', label: 'Vêtements' },
];
const DESCRIPTION_MAX = 255; // products.description is VARCHAR(255)

const parseImages = (url) => {
  if (!url) return [];
  try {
    const parsed = JSON.parse(url);
    return Array.isArray(parsed) ? parsed : [url];
  } catch {
    return [url];
  }
};

function ProductForm({ initial, onSave, onClose }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => ({ ...EMPTY_PRODUCT, ...(initial || {}) }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState(() => parseImages(initial?.image_url));
  const [urlInput, setUrlInput] = useState('');
  // Flavours (same price as the product, each with its own stock).
  const [variants, setVariants] = useState(() => (initial?.variants || []).map((v) => ({ id: v.id, name: v.name, stock: String(v.stock) })));
  const [stockMode, setStockMode] = useState(() => ((initial?.variants || []).length ? 'variants' : 'single'));
  const knownCategory = SHOP_CATEGORIES.some((c) => c.value === form.category);
  const [customCategory, setCustomCategory] = useState(() => !!initial?.category && !SHOP_CATEGORIES.some((c) => c.value === initial.category));

  const useVariants = stockMode === 'variants';
  const variantsTotal = variants.reduce((sum, v) => sum + (parseInt(v.stock, 10) || 0), 0);
  const price = parseFloat(form.price);
  const promo = parseFloat(form.promo);
  const promoPct = price > 0 && promo > 0 && promo < price ? Math.round((1 - promo / price) * 100) : 0;

  const set = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };
  const setVariant = (i, key, val) => {
    setVariants((list) => list.map((v, idx) => (idx === i ? { ...v, [key]: val } : v)));
    setErrors((e) => ({ ...e, variants: '' }));
  };
  const addVariant = () => setVariants((list) => [...list, { name: '', stock: '0' }]);
  const removeVariant = (i) => setVariants((list) => list.filter((_, idx) => idx !== i));
  const chooseStockMode = (mode) => {
    setStockMode(mode);
    setErrors((e) => ({ ...e, stock: '', variants: '' }));
    if (mode === 'variants' && variants.length === 0) setVariants([{ name: '', stock: form.stock || '0' }]);
  };

  const addImages = (list) => setImages((prev) => [...prev, ...list]);
  const handleImageUpload = (e) => {
    Array.from(e.target.files || []).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => addImages([reader.result]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };
  const addUrlImage = () => {
    const url = urlInput.trim();
    if (!url) return;
    if (!/^(https?:\/\/|data:image\/)/i.test(url)) {
      setErrors((e) => ({ ...e, images: t('store.form.errImageUrl', 'Collez une adresse d’image qui commence par https://') }));
      return;
    }
    addImages([url]);
    setUrlInput('');
    setErrors((e) => ({ ...e, images: '' }));
  };
  const removeImage = (index) => setImages((prev) => prev.filter((_, idx) => idx !== index));
  const makeMain = (index) => setImages((prev) => [prev[index], ...prev.filter((_, idx) => idx !== index)]);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = t('store.form.errName', 'Le nom est obligatoire');
    if (form.price === '' || isNaN(price) || price <= 0) e.price = t('store.form.errPrice', 'Indiquez un prix supérieur à 0');
    if (form.promo !== '' && form.promo !== null && form.promo !== undefined) {
      if (isNaN(promo) || promo < 0) e.promo = t('store.form.errPromo', 'Prix promo invalide');
      else if (promo > 0 && promo >= price) e.promo = t('store.form.errPromoPrice', 'Le prix promo doit être inférieur au prix normal');
    }
    if (!useVariants && (form.stock === '' || isNaN(form.stock) || parseInt(form.stock, 10) < 0)) e.stock = t('store.form.errStock', 'Indiquez un stock (0 ou plus)');
    if (useVariants) {
      const names = variants.map((v) => v.name.trim().toLowerCase());
      if (!variants.length) e.variants = t('store.form.errVariantNone', 'Ajoutez au moins un goût, ou choisissez « Un seul stock »');
      else if (names.some((n) => !n)) e.variants = t('store.form.errVariantName', 'Donnez un nom à chaque goût (ou supprimez la ligne vide)');
      else if (new Set(names).size !== names.length) e.variants = t('store.form.errVariantDup', 'Deux goûts ont le même nom');
      else if (variants.some((v) => v.stock === '' || isNaN(v.stock) || parseInt(v.stock, 10) < 0)) e.variants = t('store.form.errVariantStock', 'Le stock de chaque goût doit être un nombre positif');
    }
    if ((form.description || '').length > DESCRIPTION_MAX) e.description = t('store.form.errDescription', 'Description trop longue');
    return e;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      requestAnimationFrame(() => document.querySelector('.pform [aria-invalid="true"], .pform .form-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
      return;
    }
    const data = {
      ...(initial?.id ? { id: initial.id } : {}),
      name: form.name.trim(),
      description: (form.description || '').trim() || null,
      category: (form.category || '').trim() || null,
      image_url: images.length ? JSON.stringify(images) : '',
      price,
      promo: promo > 0 ? promo : null,
      stock: useVariants ? variantsTotal : parseInt(form.stock, 10),
      // Always sent: an empty list removes the flavours of a product that had some.
      variants: useVariants ? variants.map((v) => ({ ...(v.id ? { id: v.id } : {}), name: v.name.trim(), stock: parseInt(v.stock, 10) || 0 })) : [],
    };
    setSaving(true);
    try {
      await onSave(data);
    } finally {
      setSaving(false);
    }
  };

  const err = (key) => errors[key] && <span className="form-error" id={`pf-err-${key}`}>{errors[key]}</span>;

  return (
    <form onSubmit={submit} className="pform" noValidate>
      {/* Photos */}
      <section className="pform__section">
        <h3 className="pform__title">{t('store.form.sectionPhotos', 'Photos')}</h3>
        <div className="pform__photos">
          {images.map((img, idx) => (
            <div key={`${idx}-${img.slice(-24)}`} className={`pform__photo${idx === 0 ? ' is-main' : ''}`}>
              <img src={img} alt="" onError={(e) => { e.currentTarget.style.opacity = '0.2'; }} />
              {idx === 0
                ? <span className="pform__photo-tag">{t('store.form.mainPhoto', 'Principale')}</span>
                : <button type="button" className="pform__photo-main" onClick={() => makeMain(idx)}>{t('store.form.makeMain', 'Mettre en premier')}</button>}
              <button type="button" className="pform__photo-remove" onClick={() => removeImage(idx)} aria-label={t('store.form.removePhoto', 'Retirer cette photo')}><X size={14} /></button>
            </div>
          ))}
          <label className="pform__drop">
            <ImageIcon size={22} />
            <span>{t('store.form.chooseFiles', 'Ajouter des photos')}</span>
            <input type="file" multiple hidden accept="image/*" onChange={handleImageUpload} />
          </label>
        </div>
        <div className="pform__url">
          <input
            value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrlImage(); } }}
            placeholder={t('store.form.pasteUrlPlaceholder', 'Ou collez l’adresse d’une image (https://…)')}
            aria-label={t('store.form.pasteUrl', 'Adresse d’une image')}
          />
          <button type="button" className="btn btn--ghost" onClick={addUrlImage}>{t('store.form.add', 'Ajouter')}</button>
        </div>
        {err('images')}
        <p className="pform__hint">{t('store.form.photosHint', 'La première photo est celle affichée dans la boutique. Fond blanc conseillé.')}</p>
      </section>

      {/* Information */}
      <section className="pform__section">
        <h3 className="pform__title">{t('store.form.sectionInfo', 'Informations')}</h3>
        <div className="form-group">
          <label htmlFor="pf-name">{t('store.form.name', 'Nom du produit')} *</label>
          <input id="pf-name" value={form.name} maxLength={100} onChange={(e) => set('name', e.target.value)} placeholder="Ex : Whey Protein Gold Standard 2,27 kg" aria-invalid={!!errors.name} aria-describedby={errors.name ? 'pf-err-name' : undefined} />
          {err('name')}
        </div>
        <div className="form-group">
          <label htmlFor="pf-cat">{t('store.form.category', 'Catégorie')}</label>
          <select
            id="pf-cat"
            value={customCategory ? '__other' : (knownCategory ? form.category : '')}
            onChange={(e) => {
              if (e.target.value === '__other') { setCustomCategory(true); set('category', knownCategory ? '' : form.category); return; }
              setCustomCategory(false);
              set('category', e.target.value);
            }}
          >
            <option value="">{t('store.form.noCategory', '— Sans catégorie —')}</option>
            {SHOP_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{t(`shop.categories.${c.value}`, c.label)}</option>)}
            <option value="__other">{t('store.form.otherCategory', 'Autre catégorie…')}</option>
          </select>
          {customCategory && (
            <input className="pform__mt" value={form.category || ''} maxLength={50} onChange={(e) => set('category', e.target.value)} placeholder={t('store.form.otherCategoryPh', 'Nom de la catégorie')} aria-label={t('store.form.otherCategoryPh', 'Nom de la catégorie')} />
          )}
        </div>
        <div className="form-group">
          <label htmlFor="pf-desc">{t('store.form.description', 'Description')}</label>
          <textarea id="pf-desc" rows={3} maxLength={DESCRIPTION_MAX} value={form.description || ''} onChange={(e) => set('description', e.target.value)} placeholder={t('store.form.descriptionPh', 'Ex : 24 g de protéines par dose, 74 doses, goût chocolat…')} />
          <span className={`pform__count${(form.description || '').length > DESCRIPTION_MAX - 20 ? ' is-near' : ''}`}>{(form.description || '').length} / {DESCRIPTION_MAX}</span>
          {err('description')}
        </div>
      </section>

      {/* Price */}
      <section className="pform__section">
        <h3 className="pform__title">{t('store.form.sectionPrice', 'Prix')}</h3>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="pf-price">{t('store.form.price', 'Prix')} *</label>
            <div className="pform__money">
              <input id="pf-price" type="number" inputMode="decimal" min="0" step="0.01" value={form.price} onChange={(e) => set('price', e.target.value)} placeholder="0" aria-invalid={!!errors.price} aria-describedby={errors.price ? 'pf-err-price' : undefined} />
              <span>DH</span>
            </div>
            {err('price')}
          </div>
          <div className="form-group">
            <label htmlFor="pf-promo">{t('store.form.promo', 'Prix promo (optionnel)')}</label>
            <div className="pform__money">
              <input id="pf-promo" type="number" inputMode="decimal" min="0" step="0.01" value={form.promo ?? ''} onChange={(e) => set('promo', e.target.value)} placeholder={t('store.form.promoPh', 'Vide = pas de promo')} aria-invalid={!!errors.promo} aria-describedby={errors.promo ? 'pf-err-promo' : undefined} />
              <span>DH</span>
            </div>
            {err('promo')}
          </div>
        </div>
        {promoPct > 0 && (
          <p className="pform__promo">
            <span className="pform__pct">-{promoPct}%</span>
            {t('store.form.promoResult', 'Le client paie {{promo}} DH au lieu de {{price}} DH.', { promo, price })}
          </p>
        )}
      </section>

      {/* Stock and flavours */}
      <section className="pform__section">
        <h3 className="pform__title">{t('store.form.sectionStock', 'Stock')}</h3>
        <div className="pform__seg" role="radiogroup" aria-label={t('store.form.sectionStock', 'Stock')}>
          <button type="button" role="radio" aria-checked={!useVariants} onClick={() => chooseStockMode('single')}>{t('store.form.stockSingle', 'Un seul stock')}</button>
          <button type="button" role="radio" aria-checked={useVariants} onClick={() => chooseStockMode('variants')}>{t('store.form.stockVariants', 'Plusieurs goûts')}</button>
        </div>

        {!useVariants ? (
          <div className="form-group pform__stock">
            <label htmlFor="pf-stock">{t('store.form.stock', 'Quantité en stock')} *</label>
            <input id="pf-stock" type="number" inputMode="numeric" min="0" step="1" value={form.stock} onChange={(e) => set('stock', e.target.value)} placeholder="0" aria-invalid={!!errors.stock} aria-describedby={errors.stock ? 'pf-err-stock' : undefined} />
            {err('stock')}
          </div>
        ) : (
          <div className="pform__variants">
            <p className="pform__hint">{t('store.form.variantsHint', 'Même prix pour tous les goûts. Chaque goût a son propre stock, et le client choisit son goût sur le site et dans l’application.')}</p>
            <div className="pform__vhead" aria-hidden="true"><span>{t('store.form.variantName', 'Goût')}</span><span>{t('store.form.variantStock', 'Stock')}</span><span /></div>
            {variants.map((v, i) => (
              <div key={v.id || `new-${i}`} className="pform__vrow">
                <input value={v.name} onChange={(e) => setVariant(i, 'name', e.target.value)} placeholder={t('store.form.variantNamePh', 'Ex : Chocolat')} aria-label={`${t('store.form.variantName', 'Goût')} ${i + 1}`} maxLength={60} aria-invalid={!!errors.variants && !v.name.trim()} />
                <input type="number" inputMode="numeric" min="0" step="1" value={v.stock} onChange={(e) => setVariant(i, 'stock', e.target.value)} aria-label={`${t('store.form.variantStock', 'Stock')} ${v.name || i + 1}`} />
                <button type="button" className="pform__vremove" onClick={() => removeVariant(i)} aria-label={t('store.form.removeVariant', 'Supprimer ce goût')}><Trash2 size={16} /></button>
              </div>
            ))}
            {err('variants')}
            <div className="pform__vfoot">
              <button type="button" className="btn btn--ghost btn--sm" onClick={addVariant}><Plus size={16} /> {t('store.form.addVariant', 'Ajouter un goût')}</button>
              <span className="pform__total">{t('store.form.stockTotalShort', 'Total : {{count}}', { count: variantsTotal })}</span>
            </div>
          </div>
        )}
      </section>

      <div className="pform__actions">
        <button type="button" className="btn btn--ghost" onClick={onClose}>{t('store.form.cancel', 'Annuler')}</button>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? t('store.form.saving', 'Enregistrement…') : initial?.id ? t('store.form.save', 'Enregistrer') : t('store.form.create', 'Ajouter le produit')}
        </button>
      </div>
    </form>
  );
}

function DeleteConfirm({ product, onConfirm, onClose }) {
  const { t } = useTranslation();
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ marginBottom: '8px' }}>{t('store.delete.confirmMessage', 'Voulez-vous vraiment supprimer le produit :')}</p>
      <strong style={{ fontSize: '1.1rem' }}>{product.name}</strong>?
      <div className="form-actions" style={{ marginTop: '24px' }}>
        <button className="btn btn--ghost" onClick={onClose}>{t('store.delete.cancel', 'Annuler')}</button>
        <button className="btn btn--danger" onClick={() => { onConfirm(product.id); onClose(); }}>
          {t('store.delete.confirm', 'Supprimer')}
        </button>
      </div>
    </div>
  );
}

export default function Boutique() {
  const { t } = useTranslation();
  const location = useLocation();
  const { commandes, setCommandes, fetchCommandes, gymSettings } = useGym();
  
  const [activeTab, setActiveTab] = useState(() => {
    if (location.state?.activeTab) return location.state.activeTab;
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'commandes') return 'commandes';
    return 'products';
  });
  
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null); // 'add', 'edit', 'delete'
  const [selected, setSelected] = useState(null);

  // Sync tab if location changes
  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
    } else {
      const params = new URLSearchParams(location.search);
      if (params.get('tab') === 'commandes') {
        setActiveTab('commandes');
      }
    }
  }, [location]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await getProducts();
      setProducts(data || []);
    } catch (err) {
      console.error('Failed to load products', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCommandes = () => fetchCommandes();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';
  const [shopSettingsOpen, setShopSettingsOpen] = useState(false);
  const pendingCount = commandes.filter((c) => c.status === 'pending').length;
  const lowStock = products.filter((p) => p.stock <= 5);

  useEffect(() => {
    fetchProducts();
    loadCommandes();
  }, []);

  const filtered = useMemo(() => {
    return products.filter(p => {
      const searchStr = `${p.name} ${p.category} ${p.description}`.toLowerCase();
      return !query || searchStr.includes(query.toLowerCase());
    });
  }, [products, query]);

  const handleSave = async (data) => {
    try {
      if (data.id) {
        await updateProduct(data.id, data);
      } else {
        await createProduct(data);
      }
      await fetchProducts();
      setModal(null);
    } catch (err) {
      console.error('Failed to save product', err);
      const detail = err?.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail.map((d) => d.msg).join(' · ') : detail?.message);
      alert(message ? `${t('store.form.errorSave', 'Erreur lors de la sauvegarde')} : ${message}` : t('store.form.errorSave', 'Erreur lors de la sauvegarde'));
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteProduct(id);
      setProducts(products.filter(p => p.id !== id));
      setModal(null);
    } catch (err) {
      console.error('Failed to delete product', err);
      alert(t('store.delete.error', 'Erreur lors de la suppression'));
    }
  };

  const openAdd = () => { setSelected(null); setModal('add'); };
  const openEdit = (p) => { setSelected(p); setModal('edit'); };
  const openDelete = (p) => { setSelected(p); setModal('delete'); };

  return (
    <div className="page store-page fade-in">
      <section className="store-hero">
        <div>
          <span className="store-hero__eyebrow">{t('store.title', 'Boutique')}</span>
          <h2 className="store-hero__title">{t('store.management', 'Gestion du Store')}</h2>
          <p className="store-hero__subtitle">
            {t('store.subtitle', 'Gérez vos produits, réductions et commandes clients.')}
          </p>
        </div>
        <div className="store-hero__actions">
          {isSuperAdmin && (
            <button className="btn btn--ghost" onClick={() => setShopSettingsOpen(true)}>
              <Settings2 size={16} /> {t('orders.shopSettings', 'Réglages boutique')}
            </button>
          )}
          <button className="btn btn--primary" onClick={openAdd}>
            <Plus size={16} /> {t('store.newProduct', 'Nouveau Produit')}
          </button>
        </div>
      </section>

      <div className="store-tabs">
        <button 
          className={`store-tab-btn ${activeTab === 'products' ? 'active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          <ShoppingBag size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
          {t('store.tabs.products', 'Produits')}
        </button>
        <button 
          className={`store-tab-btn ${activeTab === 'commandes' ? 'active' : ''}`}
          onClick={() => setActiveTab('commandes')}
        >
          <ClipboardList size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
          {t('store.tabs.orders', 'Commandes')}
          {pendingCount > 0 && <span className="store-tab-badge">{pendingCount}</span>}
        </button>
      </div>

      {activeTab === 'products' ? (
        <>
          {lowStock.length > 0 && (
            <div className="coach-alert" style={{ marginBottom: 16 }}>
              <AlertTriangle size={18} />
              <span>{t('orders.lowStockAlert', 'Stock faible :')} {lowStock.map((p) => `${p.name} (${p.stock})`).join(' · ')}</span>
            </div>
          )}
          <div className="card store-filters">
            <div className="toolbar__search">
              <Search size={16} className="toolbar__search-icon" />
              <input
                placeholder={t('store.filters.searchPlaceholder', 'Rechercher un produit...')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="store-grid">
            {loading ? (
              <div className="store-loading">{t('store.loading', 'Chargement des produits...')}</div>
            ) : filtered.length === 0 ? (
              <div className="store-empty">{t('store.empty', 'Aucun produit trouvé.')}</div>
            ) : (
              filtered.map(product => (
                <div key={product.id} className="store-card fade-in">
                  <div className="store-card__image-container">
                    {getFirstImage(product.image_url) ? (
                      <img src={getFirstImage(product.image_url)} alt={product.name} className="store-card__image" />
                    ) : (
                      <div className="store-card__image-placeholder">
                        <ImageIcon size={48} />
                      </div>
                    )}
                    {product.promo && product.promo > 0 && (
                      <span className="store-card__badge badge--promo">{t('store.badgePromo', 'PROMO')}</span>
                    )}
                    {product.stock <= 5 && product.stock > 0 && (
                      <span className="store-card__badge badge--warning">{t('store.lowStock', 'Stock Faible')}</span>
                    )}
                    {product.stock === 0 && (
                      <span className="store-card__badge badge--danger">{t('store.outOfStock', 'Rupture')}</span>
                    )}
                  </div>
                  
                  <div className="store-card__content">
                    <div className="store-card__header">
                      <h3 className="store-card__name">{product.name}</h3>
                      <div className="store-card__price-container">
                        {product.promo && product.promo > 0 ? (
                          <>
                            <span className="store-card__price-original">{product.price.toLocaleString('fr-FR')} DH</span>
                            <span className="store-card__price-promo">{product.promo.toLocaleString('fr-FR')} DH</span>
                          </>
                        ) : (
                          <span className="store-card__price" style={{ color: 'var(--clr-primary)' }}>{product.price.toLocaleString('fr-FR')} DH</span>
                        )}
                      </div>
                    </div>
                    <div className="store-card__meta">
                      {product.category && <span className="store-card__category">{product.category}</span>}
                      <span className="store-card__stock">{t('store.form.stock', 'Stock')}: {product.stock}</span>
                      {product.variants?.length > 0 && (
                        <span className="store-card__variants">
                          {product.variants.map((v) => <span key={v.id} className={v.stock === 0 ? 'is-out' : v.stock <= 3 ? 'is-low' : ''}>{v.name} ({v.stock})</span>)}
                        </span>
                      )}
                    </div>
                    {product.description && (
                      <p className="store-card__description">{product.description}</p>
                    )}
                    <div className="store-card__actions">
                      <button className="btn btn--ghost btn--sm" onClick={() => openEdit(product)}>
                        <Pencil size={14} /> {t('store.edit', 'Modifier')}
                      </button>
                      <button className="btn btn--danger-ghost btn--sm" onClick={() => openDelete(product)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <OrdersPanel commandes={commandes} setCommandes={setCommandes} gymName={gymSettings?.name?.trim()} />
      )}

      {modal === 'add' || modal === 'edit' ? (
        <Modal
          title={modal === 'add' ? t('store.modals.addProduct', 'Ajouter un Produit') : t('store.modals.editProduct', 'Modifier le Produit')}
          onClose={() => setModal(null)}
          size="lg"
        >
          <ProductForm
            initial={selected}
            onSave={handleSave}
            onClose={() => setModal(null)}
          />
        </Modal>
      ) : null}

      {modal === 'delete' && selected && (
        <Modal title={t('store.modals.confirmDeleteTitle', 'Supprimer le produit')} onClose={() => setModal(null)}>
          <DeleteConfirm product={selected} onConfirm={handleDelete} onClose={() => setModal(null)} />
        </Modal>
      )}
      {shopSettingsOpen && <ShopSettingsModal onClose={() => setShopSettingsOpen(false)} />}
    </div>
  );
}
