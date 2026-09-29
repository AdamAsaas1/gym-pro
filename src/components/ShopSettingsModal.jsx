import { useState } from 'react';
import { Save, Truck, MessageCircle, Instagram } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import { useGym } from '../context/GymContext';

// Online shop settings: contact links and shipping fees (stored with the gym settings).
export default function ShopSettingsModal({ onClose }) {
  const { t } = useTranslation();
  const { gymSettings, updateSettings } = useGym();
  const [form, setForm] = useState(() => ({
    shop_whatsapp: gymSettings?.shop_whatsapp || '',
    instagram_url: gymSettings?.instagram_url || 'https://www.instagram.com/asaas_pro',
    shipping_local_city: gymSettings?.shipping_local_city || 'Tanger',
    shipping_fee_local: gymSettings?.shipping_fee_local ?? 20,
    shipping_fee_other: gymSettings?.shipping_fee_other ?? 35,
  }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    const local = Number(form.shipping_fee_local);
    const other = Number(form.shipping_fee_other);
    if (!(local >= 0) || !(other >= 0)) { setError(t('orders.settings.errFee', 'Frais de livraison invalides')); return; }
    if (form.instagram_url && !/^https?:\/\//.test(form.instagram_url.trim())) { setError(t('orders.settings.errUrl', 'Le lien Instagram doit commencer par https://')); return; }
    setSaving(true);
    setError('');
    try {
      await updateSettings({
        shop_whatsapp: form.shop_whatsapp.trim() || null,
        instagram_url: form.instagram_url.trim() || null,
        shipping_local_city: form.shipping_local_city.trim() || 'Tanger',
        shipping_fee_local: local,
        shipping_fee_other: other,
      });
      onClose();
    } catch (err) {
      console.error(err);
      setError(t('orders.settings.errSave', "Erreur lors de l'enregistrement."));
      setSaving(false);
    }
  };

  return (
    <Modal title={t('orders.shopSettings', 'Réglages boutique')} onClose={onClose}>
      <form onSubmit={submit} className="member-form">
        <div className="form-section-title"><MessageCircle size={12} /> {t('orders.settings.contact', 'Contact')}</div>
        <div className="form-group">
          <label>{t('orders.settings.whatsapp', 'Numéro WhatsApp de la boutique')}</label>
          <input type="tel" value={form.shop_whatsapp} onChange={(e) => set('shop_whatsapp', e.target.value)} placeholder="06 12 34 56 78" />
          <span className="form-hint">{t('orders.settings.whatsappHint', 'Les clients pourront vous écrire depuis la boutique et après leur commande.')}</span>
        </div>
        <div className="form-group">
          <label><Instagram size={12} /> {t('orders.settings.instagram', 'Page Instagram')}</label>
          <input value={form.instagram_url} onChange={(e) => set('instagram_url', e.target.value)} placeholder="https://www.instagram.com/..." />
        </div>

        <div className="form-section-title"><Truck size={12} /> {t('orders.settings.shipping', 'Frais de livraison')}</div>
        <div className="form-row form-row--3">
          <div className="form-group">
            <label>{t('orders.settings.localCity', 'Ville locale')}</label>
            <input value={form.shipping_local_city} onChange={(e) => set('shipping_local_city', e.target.value)} />
          </div>
          <div className="form-group">
            <label>{t('orders.settings.feeLocal', 'Frais ville locale (DH)')}</label>
            <input type="number" min="0" step="any" value={form.shipping_fee_local} onChange={(e) => set('shipping_fee_local', e.target.value)} />
          </div>
          <div className="form-group">
            <label>{t('orders.settings.feeOther', 'Frais autres villes (DH)')}</label>
            <input type="number" min="0" step="any" value={form.shipping_fee_other} onChange={(e) => set('shipping_fee_other', e.target.value)} />
          </div>
        </div>

        {error && <div className="form-error form-error--block">{error}</div>}
        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>{t('settings.modal.cancelBtn', 'Annuler')}</button>
          <button type="submit" className="btn btn--primary" disabled={saving}><Save size={16} /> {t('settings.modal.saveBtn', 'Enregistrer')}</button>
        </div>
      </form>
    </Modal>
  );
}
