import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, TrendingUp, UserCheck, Plus, Pencil, Trash2, CheckCircle2, AlertTriangle, Dumbbell } from 'lucide-react';
import { useGym } from '../context/GymContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import ActivityIcon from '../components/ActivityIcon';
import ActivityFormModal from '../components/ActivityFormModal';
import Modal from '../components/Modal';

const SECTIONS = ['homme', 'femme', 'enfant', 'universel'];

function DeleteActivityDialog({ activity, enrolled, onConfirm, onClose }) {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    setDeleting(true);
    setError('');
    try {
      await onConfirm();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail?.code === 'activity_has_members'
        ? t('activities.delete.hasMembers', '{{count}} membre(s) sont encore inscrits à cette activité.', { count: detail.count })
        : t('settings.error.deleteActivity', 'Erreur lors de la suppression.'));
      setDeleting(false);
    }
  };

  return (
    <Modal title={t('activities.delete.title', "Supprimer l'activité")} onClose={onClose}>
      <div className="act-delete">
        <ActivityIcon icon={activity.icon} color={activity.couleur} badge size={20} className="act-delete__icon" />
        <strong className="act-delete__name">{activity.nom}</strong>

        {enrolled > 0 ? (
          <>
            <p className="act-delete__warn">
              <AlertTriangle size={16} />
              {t('activities.delete.hasMembers', '{{count}} membre(s) sont encore inscrits à cette activité.', { count: enrolled })}
            </p>
            <p className="act-delete__text">
              {t('activities.delete.reassign', "Changez d'abord leur activité, puis vous pourrez la supprimer.")}
            </p>
            <div className="form-actions">
              <button className="btn btn--ghost" onClick={onClose}>{t('settings.modal.cancelBtn', 'Annuler')}</button>
              <Link className="btn btn--primary" to={`/membres?activite=${activity.id}`}>
                <Users size={16} /> {t('activities.delete.seeMembers', 'Voir les membres')}
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="act-delete__text">
              {t('activities.delete.confirm', 'Cette action est définitive. Voulez-vous vraiment supprimer cette activité ?')}
            </p>
            {error && <div className="form-error form-error--block">{error}</div>}
            <div className="form-actions">
              <button className="btn btn--ghost" onClick={onClose}>{t('settings.modal.cancelBtn', 'Annuler')}</button>
              <button className="btn btn--danger" onClick={confirm} disabled={deleting}>
                <Trash2 size={16} /> {t('settings.activities.delete', 'Supprimer')}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default function Activites() {
  const { membres, activites, addActivity, updateActivity, deleteActivity } = useGym();
  const { user } = useAuth();
  const { t } = useTranslation();
  const canManage = user?.role === 'superadmin';

  const [section, setSection] = useState('all');
  const [editing, setEditing] = useState(null);   // null | 'new' | activity
  const [deleting, setDeleting] = useState(null); // null | activity
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const GENRE_LABEL = {
    homme: t('activities.menSection', 'Section Hommes'),
    femme: t('activities.womenSection', 'Section Femmes'),
    enfant: t('activities.childrenSection', 'Section Enfants'),
    universel: t('activities.mixedSection', 'Section Mixte (Universel)'),
  };
  const SECTION_SHORT = {
    homme: t('settings.modal.sectionMen', 'Hommes'),
    femme: t('settings.modal.sectionWomen', 'Femmes'),
    enfant: t('settings.modal.sectionChildren', 'Enfants'),
    universel: t('settings.modal.sectionUniversal', 'Universel'),
  };

  const statsById = useMemo(() => {
    const out = {};
    activites.forEach((a) => { out[a.id] = { inscrits: 0, actifs: 0 }; });
    membres.forEach((m) => {
      const s = out[m.activite];
      if (!s) return;
      s.inscrits += 1;
      if (m.statut === 'actif') s.actifs += 1;
    });
    return out;
  }, [membres, activites]);

  const kpis = useMemo(() => {
    const totals = Object.values(statsById);
    const top = activites.reduce((best, a) => (
      !best || statsById[a.id].actifs > statsById[best.id].actifs ? a : best
    ), null);
    return {
      count: activites.length,
      inscrits: totals.reduce((s, x) => s + x.inscrits, 0),
      actifs: totals.reduce((s, x) => s + x.actifs, 0),
      top: top && statsById[top.id].actifs > 0 ? top : null,
    };
  }, [activites, statsById]);

  const presentSections = SECTIONS.filter((s) => activites.some((a) => a.genre === s));
  const visible = section === 'all' ? activites : activites.filter((a) => a.genre === section);

  const handleSave = async (payload) => {
    if (editing === 'new') {
      await addActivity(payload);
      setToast(t('settings.success.activityCreated', "L'activité \"{{name}}\" a été créée avec succès.", { name: payload.name }));
    } else {
      await updateActivity(editing.id, payload);
      setToast(t('settings.success.activityUpdated', "L'activité \"{{name}}\" a été mise à jour.", { name: payload.name }));
    }
    setEditing(null);
  };

  const handleDelete = async () => {
    const name = deleting.nom;
    await deleteActivity(deleting.id);
    setDeleting(null);
    setToast(t('activities.delete.done', "L'activité \"{{name}}\" a été supprimée.", { name }));
  };

  return (
    <div className="page activites-page fade-in">
      <section className="members-hero">
        <div>
          <span className="members-hero__eyebrow">{t('activities.eyebrow', 'Catalogue')}</span>
          <h2 className="members-hero__title">{t('activities.heroTitle', 'Activités & Tarifs')}</h2>
          <p className="members-hero__subtitle">
            {t('activities.description', 'Notre salle est non mixte. Chaque section dispose de son propre espace, ses horaires et son coach spécialisé.')}
          </p>
        </div>
        {canManage && (
          <div className="members-hero__actions">
            <button className="btn btn--primary" onClick={() => setEditing('new')}>
              <Plus size={16} /> {t('activities.new', 'Nouvelle activité')}
            </button>
          </div>
        )}
      </section>

      <section className="members-kpis">
        <div className="members-kpi">
          <div className="members-kpi__label">{t('activities.kpiCount', 'Activités')}</div>
          <div className="members-kpi__value">{kpis.count}</div>
        </div>
        <div className="members-kpi">
          <div className="members-kpi__label">{t('activities.kpiRegistered', 'Membres inscrits')}</div>
          <div className="members-kpi__value">{kpis.inscrits}</div>
        </div>
        <div className="members-kpi">
          <div className="members-kpi__label">{t('activities.kpiActive', 'Membres actifs')}</div>
          <div className="members-kpi__value">{kpis.actifs}</div>
        </div>
        <div className="members-kpi">
          <div className="members-kpi__label">{t('activities.kpiTop', 'La plus populaire')}</div>
          <div className="members-kpi__value act-kpi-top">
            {kpis.top ? (<><ActivityIcon icon={kpis.top.icon} color={kpis.top.couleur} size={20} /> {kpis.top.nom}</>) : '—'}
          </div>
        </div>
      </section>

      {presentSections.length > 1 && (
        <div className="act-filters" role="tablist">
          {['all', ...presentSections].map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={section === s}
              className={`act-filter${section === s ? ' is-active' : ''}`}
              onClick={() => setSection(s)}
            >
              {s === 'all' ? t('activities.filterAll', 'Toutes') : SECTION_SHORT[s]}
              <span className="act-filter__count">
                {s === 'all' ? activites.length : activites.filter((a) => a.genre === s).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {activites.length === 0 ? (
        <div className="act-empty">
          <Dumbbell size={36} />
          <h3>{t('settings.activities.noActivities', 'Aucune activité configurée.')}</h3>
          {canManage && (
            <button className="btn btn--primary" onClick={() => setEditing('new')}>
              <Plus size={16} /> {t('activities.createFirst', 'Créer la première activité')}
            </button>
          )}
        </div>
      ) : (
        <div className="activites-grid">
          {visible.map((act) => {
            const { inscrits, actifs } = statsById[act.id] || { inscrits: 0, actifs: 0 };
            const cap = Number(act.max_capacity) || 0;
            const fill = cap > 0 ? Math.min(100, Math.round((actifs / cap) * 100)) : 0;
            const fillLevel = fill >= 90 ? 'high' : fill >= 70 ? 'mid' : 'low';

            return (
              <div key={act.id} className="act-card" style={{ '--tc': act.couleur, '--bg': act.bg }}>
                {/* Header */}
                <div className="act-card__header">
                  <div className="act-card__icon-wrap">
                    <span className="act-card__emoji"><ActivityIcon icon={act.icon} size={26} color={act.couleur} /></span>
                  </div>
                  <div className="act-card__heading">
                    <div className="act-card__genre">{GENRE_LABEL[act.genre]}</div>
                    <h2 className="act-card__name">{act.nom}</h2>
                  </div>
                  {canManage && (
                    <div className="act-card__actions">
                      <button className="act-card__action" onClick={() => setEditing(act)} title={t('settings.activities.edit', 'Modifier')} aria-label={t('settings.activities.edit', 'Modifier')}>
                        <Pencil size={15} />
                      </button>
                      <button className="act-card__action act-card__action--danger" onClick={() => setDeleting(act)} title={t('settings.activities.delete', 'Supprimer')} aria-label={t('settings.activities.delete', 'Supprimer')}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>

                {act.description && <p className="act-card__desc">{act.description}</p>}

                {/* Stats row */}
                <div className="act-card__stats">
                  <Link className="act-stat act-stat--link" to={`/membres?activite=${act.id}`} title={t('activities.delete.seeMembers', 'Voir les membres')}>
                    <Users size={15} />
                    <div>
                      <div className="act-stat__val">{inscrits}</div>
                      <div className="act-stat__lbl">{t('activities.registered', 'Inscrits')}</div>
                    </div>
                  </Link>
                  <div className="act-stat">
                    <TrendingUp size={15} />
                    <div>
                      <div className="act-stat__val">{actifs}</div>
                      <div className="act-stat__lbl">{t('activities.active', 'Actifs')}</div>
                    </div>
                  </div>
                </div>

                {/* Capacity */}
                {cap > 0 && (
                  <div className={`act-capacity act-capacity--${fillLevel}`}>
                    <div className="act-capacity__top">
                      <span>{t('activities.capacity', 'Remplissage')}</span>
                      <strong>{actifs} / {cap} · {fill}%</strong>
                    </div>
                    <div className="act-capacity__bar"><span style={{ width: `${fill}%` }} /></div>
                  </div>
                )}

                {/* Tarifs */}
                <div className="act-card__tarifs">
                  <div className="tarif-title">{t('activities.rates', 'Tarifs')}</div>
                  <div className="tarif-row">
                    <span>{t('activities.monthly', 'Mensuel')}</span> <strong>{act.prix.mensuel} DH</strong>
                  </div>
                  <div className="tarif-row">
                    <span>{t('activities.quarterly', 'Trimestriel')}</span> <strong>{act.prix.trimestriel} DH</strong>
                  </div>
                  <div className="tarif-row">
                    <span>{t('activities.yearly', 'Annuel')}</span> <strong>{act.prix.annuel} DH</strong>
                  </div>
                  {(act.inscription_fees > 0 || act.assurance_first > 0) && (
                    <div className="tarif-extra">
                      {act.inscription_fees > 0 && <span>{t('activities.fees', 'Inscription')} {act.inscription_fees} DH</span>}
                      {act.assurance_first > 0 && <span>{t('activities.insurance', 'Assurance')} {act.assurance_first} DH</span>}
                    </div>
                  )}
                </div>

                {/* Coach */}
                <div className="act-card__coach">
                  <UserCheck size={14} />
                  {t('activities.coach', 'Coach')} : <strong>{act.coachNom}</strong>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <ActivityFormModal
          activity={editing === 'new' ? null : editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <DeleteActivityDialog
          activity={deleting}
          enrolled={statsById[deleting.id]?.inscrits || 0}
          onConfirm={handleDelete}
          onClose={() => setDeleting(null)}
        />
      )}

      {toast && (
        <div className="act-toast" role="status">
          <CheckCircle2 size={18} /> {toast}
        </div>
      )}
    </div>
  );
}
