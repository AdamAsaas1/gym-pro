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

function ProductForm({ initial, onSave, onClose }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial || EMPTY_PRODUCT);
  const [errors, setErrors] = useState({});
  const [images, setImages] = useState(() => {
    if (!form.image_url) return [];
    try {
      const parsed = JSON.parse(form.image_url);
      if (Array.isArray(parsed)) return parsed;
      return [form.image_url];
    } catch (e) {
      return [form.image_url];
    }
  });
  const [urlInput, setUrlInput] = useState('');
  // Flavours (same price as the product, each with its own stock). Empty = a product without flavours.
  const [variants, setVariants] = useState(() => (initial?.variants || []).map((v) => ({ id: v.id, name: v.name, stock: String(v.stock) })));
  const hasVariants = variants.length > 0;
  const variantsTotal = variants.reduce((sum, v) => sum + (parseInt(v.stock, 10) || 0), 0);
  const setVariant = (i, key, val) => {
    setVariants((list) => list.map((v, idx) => (idx === i ? { ...v, [key]: val } : v)));
    setErrors((e) => ({ ...e, variants: '' }));
  };
  const addVariant = () => setVariants((list) => [...list, { name: '', stock: '0' }]);
  const removeVariant = (i) => setVariants((list) => list.filter((_, idx) => idx !== i));

  const set = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setErrors(e => ({ ...e, [key]: '' }));
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages(prev => {
          const updated = [...prev, reader.result];
          set('image_url', JSON.stringify(updated));
          return updated;
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index) => {
    setImages(prev => {
      const updated = prev.filter((_, idx) => idx !== index);
      set('image_url', updated.length > 0 ? JSON.stringify(updated) : '');
      return updated;
    });
  };

  const addUrlImage = () => {
    if (urlInput.trim()) {
      setImages(prev => {
        const updated = [...prev, urlInput.trim()];
        set('image_url', JSON.stringify(updated));
        return updated;
      });
      setUrlInput('');
    }
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = t('store.form.errName', 'Le nom est obligatoire');
    if (form.price === '' || isNaN(form.price)) e.price = t('store.form.errPrice', 'Prix invalide');
    if (!hasVariants && (form.stock === '' || isNaN(form.stock))) e.stock = t('store.form.errStock', 'Stock invalide');
    if (hasVariants) {
      const names = variants.map((v) => v.name.trim().toLowerCase());
      if (names.some((n) => !n)) e.variants = t('store.form.errVariantName', 'Donnez un nom à chaque goût (ou supprimez la ligne vide)');
      else if (new Set(names).size !== names.length) e.variants = t('store.form.errVariantDup', 'Deux goûts ont le même nom');
      else if (variants.some((v) => v.stock === '' || isNaN(v.stock) || parseInt(v.stock, 10) < 0)) e.variants = t('store.form.errVariantStock', 'Le stock de chaque goût doit être un nombre positif');
    }
    
    if (form.promo !== '' && form.promo !== null && form.promo !== undefined) {
      if (isNaN(form.promo) || parseFloat(form.promo) < 0) {
        e.promo = t('store.form.errPromo', 'Prix promo invalide');
      } else if (parseFloat(form.promo) >= parseFloat(form.price)) {
        e.promo = t('store.form.errPromoPrice', 'Le prix promo doit être inférieur au prix normal');
      }
    }
    return e;
  };

  const submit = (ev) => {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    
    // Convert to proper types
    const data = {
      ...form,
      price: parseFloat(form.price),
      stock: hasVariants ? variantsTotal : parseInt(form.stock, 10),
      // Always sent: an empty list removes the flavours of a product that had some.
      variants: variants.map((v) => ({ ...(v.id ? { id: v.id } : {}), name: v.name.trim(), stock: parseInt(v.stock, 10) || 0 })),
      promo: form.promo !== '' && form.promo !== null && form.promo !== undefined ? parseFloat(form.promo) : null
    };
    
    onSave(data);
  };

  return (
    <form onSubmit={submit} className="store-form">
      <div className="form-group">
        <label>{t('store.form.name', 'Nom du produit')} *</label>
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Whey Protein" />
        {errors.name && <span className="form-error">{errors.name}</span>}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>{t('store.form.price', 'Prix')} *</label>
          <input type="number" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0.00" />
          {errors.price && <span className="form-error">{errors.price}</span>}
        </div>
        <div className="form-group">
          <label>{t('store.form.promo', 'Prix Promo (Optionnel)')}</label>
          <input type="number" step="0.01" value={form.promo || ''} onChange={e => set('promo', e.target.value)} placeholder="0.00" />
          {errors.promo && <span className="form-error">{errors.promo}</span>}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>{hasVariants ? t('store.form.stockTotal', 'Stock total (somme des goûts)') : <>{t('store.form.stock', 'Stock')} *</>}</label>
          <input type="number" value={hasVariants ? variantsTotal : form.stock} onChange={e => set('stock', e.target.value)} placeholder="0" disabled={hasVariants} />
          {errors.stock && <span className="form-error">{errors.stock}</span>}
        </div>
        <div className="form-group">
          <label>{t('store.form.category', 'Catégorie')}</label>
          <input value={form.category || ''} onChange={e => set('category', e.target.value)} placeholder="Ex: Suppléments, Vêtements..." />
        </div>
      </div>

      <div className="form-group store-variants">
        <label>{t('store.form.variants', 'Goûts (optionnel)')}</label>
        <p className="store-variants__hint">{t('store.form.variantsHint', 'Même prix pour tous les goûts. Chaque goût a son propre stock, et le client choisit son goût sur le site et dans l’application.')}</p>
        {variants.map((v, i) => (
          <div key={v.id || `new-${i}`} className="store-variants__row">
            <input value={v.name} onChange={(e) => setVariant(i, 'name', e.target.value)} placeholder={t('store.form.variantNamePh', 'Ex : Chocolat')} aria-label={t('store.form.variantName', 'Nom du goût')} maxLength={60} />
            <input type="number" min="0" value={v.stock} onChange={(e) => setVariant(i, 'stock', e.target.value)} aria-label={t('store.form.variantStock', 'Stock du goût')} />
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => removeVariant(i)} aria-label={t('store.form.removeVariant', 'Supprimer ce goût')}><X size={16} /></button>
          </div>
        ))}
        {errors.variants && <span className="form-error">{errors.variants}</span>}
        <button type="button" className="btn btn--ghost btn--sm store-variants__add" onClick={addVariant}><Plus size={16} /> {t('store.form.addVariant', 'Ajouter un goût')}</button>
      </div>

      <div className="form-group">
        <label>{t('store.form.description', 'Description')}</label>
        <textarea rows={3} value={form.description || ''} onChange={e => set('description', e.target.value)} placeholder="Détails du produit..." />
      </div>

      <div className="form-group">
        <label style={{ marginBottom: '0.5rem', display: 'block' }}>{t('store.form.images', 'Photos du produit (Multiple)')}</label>
        
        {/* Upload Buttons */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <label className="btn btn--secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, padding: '0.5rem 1rem' }}>
            <ImageIcon size={16} />
            {t('store.form.chooseFiles', 'Ajouter des photos')}
            <input 
              type="file" 
              multiple 
              hidden 
              onChange={handleImageUpload} 
              accept="image/*" 
            />
          </label>
        </div>

        {/* URL input */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input 
            value={urlInput} 
            onChange={e => setUrlInput(e.target.value)} 
            placeholder={t('store.form.pasteUrlPlaceholder', "Ou coller l'URL d'une image (ex: https://...)")} 
            style={{ flex: 1 }}
          />
          <button 
            type="button" 
            className="btn btn--secondary" 
            onClick={addUrlImage}
            style={{ padding: '0 1rem' }}
          >
            {t('store.form.add', 'Ajouter')}
          </button>
        </div>

        {/* Images Preview Grid */}
        {images.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px', backgroundColor: 'rgba(0,0,0,0.1)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
            {images.map((img, idx) => (
              <div key={idx} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(21,23,26,0.1)' }}>
                <img src={img} alt={`Preview ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => e.target.style.display = 'none'} />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    backgroundColor: 'rgba(200,36,59, 0.9)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    padding: 0
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onClose}>{t('store.form.cancel', 'Annuler')}</button>
        <button type="submit" className="btn btn--primary">
          {initial?.id ? t('store.form.save', 'Enregistrer') : t('store.form.add', 'Ajouter')}
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
      alert(t('store.form.errorSave', 'Erreur lors de la sauvegarde'));
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
