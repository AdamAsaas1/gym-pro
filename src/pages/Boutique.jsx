import { useState, useEffect, useMemo } from 'react';
import { ShoppingBag, Search, Pencil, Trash2, Plus, Image as ImageIcon } from 'lucide-react';
import Modal from '../components/Modal';
import { getProducts, createProduct, updateProduct, deleteProduct } from '../api/client';
import { useTranslation } from 'react-i18next';
import './Boutique.css';

const EMPTY_PRODUCT = {
  name: '',
  description: '',
  price: '',
  stock: '',
  category: '',
  image_url: ''
};

function ProductForm({ initial, onSave, onClose }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial || EMPTY_PRODUCT);
  const [errors, setErrors] = useState({});

  const set = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setErrors(e => ({ ...e, [key]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = t('store.form.errName', 'Le nom est obligatoire');
    if (form.price === '' || isNaN(form.price)) e.price = t('store.form.errPrice', 'Prix invalide');
    if (form.stock === '' || isNaN(form.stock)) e.stock = t('store.form.errStock', 'Stock invalide');
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
      stock: parseInt(form.stock, 10)
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
          <label>{t('store.form.stock', 'Stock')} *</label>
          <input type="number" value={form.stock} onChange={e => set('stock', e.target.value)} placeholder="0" />
          {errors.stock && <span className="form-error">{errors.stock}</span>}
        </div>
      </div>

      <div className="form-group">
        <label>{t('store.form.category', 'Catégorie')}</label>
        <input value={form.category} onChange={e => set('category', e.target.value)} placeholder="Ex: Suppléments, Vêtements..." />
      </div>

      <div className="form-group">
        <label>{t('store.form.description', 'Description')}</label>
        <textarea rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Détails du produit..." />
      </div>

      <div className="form-group">
        <label>{t('store.form.imageUrl', "URL de l'image")}</label>
        <input value={form.image_url} onChange={e => set('image_url', e.target.value)} placeholder="https://..." />
      </div>

      {form.image_url && (
        <div className="store-form__preview">
           <img src={form.image_url} alt="Preview" onError={(e) => e.target.style.display = 'none'} />
        </div>
      )}

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
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null); // 'add', 'edit', 'delete'
  const [selected, setSelected] = useState(null);

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

  useEffect(() => {
    fetchProducts();
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
            {t('store.subtitle', 'Gérez vos produits, accessoires et suppléments vendus au club.')}
          </p>
        </div>
        <div className="store-hero__actions">
          <button className="btn btn--primary" onClick={openAdd}>
            <Plus size={16} /> {t('store.newProduct', 'Nouveau Produit')}
          </button>
        </div>
      </section>

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
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="store-card__image" />
                ) : (
                  <div className="store-card__image-placeholder">
                    <ImageIcon size={48} />
                  </div>
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
                  <div className="store-card__price">{product.price.toLocaleString('fr-FR')} DH</div>
                </div>
                <div className="store-card__meta">
                  {product.category && <span className="store-card__category">{product.category}</span>}
                  <span className="store-card__stock">Stock: {product.stock}</span>
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
