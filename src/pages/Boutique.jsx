import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { ShoppingBag, Search, Pencil, Trash2, Plus, Image as ImageIcon, ClipboardList } from 'lucide-react';
import Modal from '../components/Modal';
import { getProducts, createProduct, updateProduct, deleteProduct, getCommandes, updateCommandeStatus } from '../api/client';
import { useTranslation } from 'react-i18next';
import { useGym } from '../context/GymContext';
import './Boutique.css';

const EMPTY_PRODUCT = {
  name: '',
  description: '',
  price: '',
  stock: '',
  category: '',
  image_url: '',
  promo: ''
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
    if (form.stock === '' || isNaN(form.stock)) e.stock = t('store.form.errStock', 'Stock invalide');
    
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
      stock: parseInt(form.stock, 10),
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
          <label>{t('store.form.stock', 'Stock')} *</label>
          <input type="number" value={form.stock} onChange={e => set('stock', e.target.value)} placeholder="0" />
          {errors.stock && <span className="form-error">{errors.stock}</span>}
        </div>
        <div className="form-group">
          <label>{t('store.form.category', 'Catégorie')}</label>
          <input value={form.category || ''} onChange={e => set('category', e.target.value)} placeholder="Ex: Suppléments, Vêtements..." />
        </div>
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
              <div key={idx} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                <img src={img} alt={`Preview ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => e.target.style.display = 'none'} />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    backgroundColor: 'rgba(239, 68, 68, 0.9)',
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
  const { commandes, setCommandes, fetchCommandes } = useGym();
  
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
  const [commandesLoading, setCommandesLoading] = useState(false);

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

  const loadCommandes = async () => {
    setCommandesLoading(true);
    await fetchCommandes();
    setCommandesLoading(false);
  };

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

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await updateCommandeStatus(orderId, newStatus);
      setCommandes(prev => prev.map(cmd => cmd.id === orderId ? { ...cmd, status: newStatus } : cmd));
    } catch (err) {
      console.error('Failed to update order status', err);
      alert(t('store.orders.errorStatus', 'Erreur lors de la mise à jour du statut'));
    }
  };

  const openAdd = () => { setSelected(null); setModal('add'); };
  const openEdit = (p) => { setSelected(p); setModal('edit'); };
  const openDelete = (p) => { setSelected(p); setModal('delete'); };

  const getStatusLabel = (st) => {
    const labels = {
      pending: t('store.orders.status.pending', 'En attente'),
      delivered: t('store.orders.status.delivered', 'Livré'),
      collected: t('store.orders.status.collected', 'Récupéré'),
      cancelled: t('store.orders.status.cancelled', 'Annulé')
    };
    return labels[st] || st;
  };

  const getPaymentMethodLabel = (pm) => {
    const methods = {
      cash_on_delivery: t('store.orders.payment.delivery', 'Paiement à la livraison'),
      cash_at_gym: t('store.orders.payment.gym', 'Paiement au Club')
    };
    return methods[pm] || pm;
  };

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
        </button>
      </div>

      {activeTab === 'products' ? (
        <>
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
                          <span className="store-card__price" style={{ color: 'var(--primary)' }}>{product.price.toLocaleString('fr-FR')} DH</span>
                        )}
                      </div>
                    </div>
                    <div className="store-card__meta">
                      {product.category && <span className="store-card__category">{product.category}</span>}
                      <span className="store-card__stock">{t('store.form.stock', 'Stock')}: {product.stock}</span>
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
        /* Orders Management Panel */
        commandesLoading ? (
          <div className="store-loading">{t('store.orders.loading', 'Chargement des commandes...')}</div>
        ) : commandes.length === 0 ? (
          <div className="store-empty">{t('store.orders.empty', 'Aucune commande trouvée.')}</div>
        ) : (
          <div className="orders-container fade-in">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>{t('store.orders.client', 'Client')}</th>
                  <th>{t('store.orders.date', 'Date')}</th>
                  <th>{t('store.orders.items', 'Articles')}</th>
                  <th>{t('store.orders.paymentMethod', 'Paiement')}</th>
                  <th>{t('store.orders.address', 'Adresse / Livraison')}</th>
                  <th>{t('store.orders.table.total', 'Total')}</th>
                  <th>{t('store.orders.table.status', 'Statut')}</th>
                  <th>{t('store.orders.table.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {commandes.map(cmd => (
                  <tr key={cmd.id}>
                    <td>#{cmd.id}</td>
                    <td>
                      <strong>{cmd.membre_prenom} {cmd.membre_nom}</strong>
                    </td>
                    <td>
                      {new Date(cmd.created_at).toLocaleDateString('fr-FR', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </td>
                    <td>
                      <ul className="orders-items-list">
                        {cmd.items?.map(it => (
                          <li key={it.id}>
                            {it.product?.name || `Produit #${it.product_id}`} x{it.quantity} 
                            <span style={{ color: 'var(--text-secondary)', marginLeft: '4px' }}>
                              ({it.price} DH)
                            </span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td>{getPaymentMethodLabel(cmd.payment_method)}</td>
                    <td>
                      {cmd.payment_method === 'cash_on_delivery' ? (
                        <div>
                          <div>{cmd.address}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {cmd.postal_code} {cmd.city}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                          {t('store.orders.pickupAtGym', 'Retrait au Club')}
                        </span>
                      )}
                    </td>
                    <td style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                      {cmd.total_price.toLocaleString('fr-FR')} DH
                    </td>
                    <td>
                      <span className={`order-status-badge order-status--${cmd.status}`}>
                        {getStatusLabel(cmd.status)}
                      </span>
                    </td>
                    <td>
                      <select 
                        className="order-select" 
                        value={cmd.status} 
                        onChange={(e) => handleStatusChange(cmd.id, e.target.value)}
                      >
                        <option value="pending">{t('store.orders.status.pending', 'En attente')}</option>
                        <option value="delivered">{t('store.orders.status.delivered', 'Livré')}</option>
                        <option value="collected">{t('store.orders.status.collected', 'Récupéré')}</option>
                        <option value="cancelled">{t('store.orders.status.cancelled', 'Annulé')}</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
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
    </div>
  );
}
