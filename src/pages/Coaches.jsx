import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Phone, Mail, Award, Clock, Search, UserPlus, Pencil, Trash2, MessageCircle,
  Users, CheckCircle2, AlertTriangle, UserX,
} from 'lucide-react';
import { useGym } from '../context/GymContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import ActivityIcon from '../components/ActivityIcon';
import CoachFormModal from '../components/CoachFormModal';
import Modal from '../components/Modal';

const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const TODAY = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][new Date().getDay()];

// "0612-111-111" -> "212612111111" (Moroccan numbers), for wa.me links.
function whatsappNumber(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0') && digits.length === 10) return `212${digits.slice(1)}`;
  return digits;
}

function DeleteCoachDialog({ coach, onConfirm, onClose }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
    } catch (err) {
      console.error(err);
      setError(t('coaches.delete.error', 'Erreur lors de la suppression.'));
      setBusy(false);
    }
  };

  return (
    <Modal title={t('coaches.delete.title', 'Supprimer le coach')} onClose={onClose}>
      <div className="act-delete">
        <strong className="act-delete__name">{coach.prenom} {coach.nom}</strong>
        <p className="act-delete__text">
          {t('coaches.delete.confirm', 'Cette action est définitive. Voulez-vous vraiment supprimer ce coach ?')}
        </p>
        {error && <div className="form-error form-error--block">{error}</div>}
        <div className="form-actions">
          <button className="btn btn--ghost" onClick={onClose}>{t('settings.modal.cancelBtn', 'Annuler')}</button>
          <button className="btn btn--danger" onClick={confirm} disabled={busy}>
            <Trash2 size={16} /> {t('settings.activities.delete', 'Supprimer')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function Coaches() {
  const { coaches, membres, activites, addCoach, updateCoach, deleteCoach } = useGym();
  const { user } = useAuth();
  const { t } = useTranslation();
  const canManage = user?.role === 'superadmin';

  const [query, setQuery] = useState('');
  const [actFilter, setActFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [editing, setEditing] = useState(null); // null | { coach, defaults }
  const [deleting, setDeleting] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const activeByActivity = useMemo(() => {
    const out = {};
    membres.forEach((m) => {
      if (m.statut === 'actif') out[m.activite] = (out[m.activite] || 0) + 1;
    });
    return out;
  }, [membres]);

  const actById = useMemo(() => Object.fromEntries(activites.map((a) => [a.id, a])), [activites]);

  const kpis = useMemo(() => {
    const active = coaches.filter((c) => c.is_active);
    const coveredIds = new Set(active.map((c) => c.activity_id).filter(Boolean));
    return {
      active: active.length,
      total: coaches.length,
      supervised: [...coveredIds].reduce((s, id) => s + (activeByActivity[id] || 0), 0),
      avgExp: active.length ? Math.round(active.reduce((s, c) => s + (c.experience_years || 0), 0) / active.length) : 0,
      today: active.filter((c) => (c.jours || []).includes(TODAY)).length,
      uncovered: activites.filter((a) => !coveredIds.has(a.id)),
    };
  }, [coaches, activites, activeByActivity]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = coaches.filter((c) => {
      if (actFilter === 'none' && c.activity_id) return false;
      if (actFilter !== 'all' && actFilter !== 'none' && c.activity_id !== actFilter) return false;
      if (!q) return true;
      const hay = `${c.prenom} ${c.nom} ${c.diplome || ''} ${c.telephone || ''} ${c.email || ''} ${actById[c.activity_id]?.nom || ''}`.toLowerCase();
      return hay.includes(q);
    });
    const members = (c) => activeByActivity[c.activity_id] || 0;
    const sorters = {
      name: (a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`),
      experience: (a, b) => (b.experience_years || 0) - (a.experience_years || 0),
      members: (a, b) => members(b) - members(a),
    };
    // Active coaches first, then the chosen order.
    return [...list].sort((a, b) => (b.is_active - a.is_active) || sorters[sortBy](a, b));
  }, [coaches, query, actFilter, sortBy, actById, activeByActivity]);

  const filterOptions = activites.filter((a) => coaches.some((c) => c.activity_id === a.id));
  const hasUnassigned = coaches.some((c) => !c.activity_id);

  const handleSave = async (payload) => {
    const name = `${payload.prenom} ${payload.nom}`;
    if (editing.coach) {
      await updateCoach(editing.coach.id, payload);
      setToast(t('coaches.toast.updated', '{{name}} a été mis à jour.', { name }));
    } else {
      await addCoach(payload);
      setToast(t('coaches.toast.created', '{{name}} a été ajouté à l’équipe.', { name }));
    }
    setEditing(null);
  };

  const handleDelete = async () => {
    const name = `${deleting.prenom} ${deleting.nom}`;
    await deleteCoach(deleting.id);
    setDeleting(null);
    setToast(t('coaches.toast.deleted', '{{name}} a été supprimé.', { name }));
  };

  return (
    <div className="page coaches-page fade-in">
      <section className="members-hero">
        <div>
          <span className="members-hero__eyebrow">{t('coaches.eyebrow', 'Équipe')}</span>
          <h2 className="members-hero__title">{t('coaches.heroTitle', 'Nos coachs')}</h2>
          <p className="members-hero__subtitle">
            {t('coaches.description', 'Notre équipe de coachs qualifiés assure un encadrement professionnel et personnalisé pour chaque section de la salle.')}
          </p>
        </div>
        {canManage && (
          <div className="members-hero__actions">
            <button className="btn btn--primary" onClick={() => setEditing({ coach: null })}>
              <UserPlus size={16} /> {t('coaches.new', 'Nouveau coach')}
            </button>
          </div>
        )}
      </section>

      <section className="members-kpis">
        <div className="members-kpi">
          <div className="members-kpi__label">{t('coaches.kpiActive', 'Coachs actifs')}</div>
          <div className="members-kpi__value">{kpis.active}<span className="kpi-sub"> / {kpis.total}</span></div>
        </div>
        <div className="members-kpi">
          <div className="members-kpi__label">{t('coaches.kpiToday', "Disponibles aujourd'hui")}</div>
          <div className="members-kpi__value">{kpis.today}</div>
        </div>
        <div className="members-kpi">
          <div className="members-kpi__label">{t('coaches.kpiSupervised', 'Membres encadrés')}</div>
          <div className="members-kpi__value">{kpis.supervised}</div>
        </div>
        <div className="members-kpi">
          <div className="members-kpi__label">{t('coaches.kpiExperience', 'Expérience moyenne')}</div>
          <div className="members-kpi__value">{kpis.avgExp} <span className="kpi-sub">{t('coaches.years', 'ans')}</span></div>
        </div>
      </section>

      {kpis.uncovered.length > 0 && (
        <div className="coach-alert">
          <AlertTriangle size={18} />
          <span>{t('coaches.uncovered', 'Activités sans coach :')}</span>
          <div className="coach-alert__chips">
            {kpis.uncovered.map((a) => (
              <button
                key={a.id}
                className="settings-act-chip"
                style={{ '--tc': a.couleur }}
                disabled={!canManage}
                onClick={() => setEditing({ coach: null, defaults: { activity_id: a.id } })}
                title={canManage ? t('coaches.assignHint', 'Ajouter un coach pour cette activité') : undefined}
              >
                <ActivityIcon icon={a.icon} size={14} /> {a.nom}
                {canManage && <UserPlus size={13} />}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="coach-toolbar">
        <label className="coach-search">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('coaches.search', 'Rechercher un coach, un diplôme…')}
          />
        </label>
        <select className="coach-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label={t('coaches.sortLabel', 'Trier par')}>
          <option value="name">{t('coaches.sort.name', 'Trier : nom')}</option>
          <option value="experience">{t('coaches.sort.experience', 'Trier : expérience')}</option>
          <option value="members">{t('coaches.sort.members', 'Trier : membres')}</option>
        </select>
      </div>

      {(filterOptions.length > 1 || hasUnassigned) && (
        <div className="act-filters">
          <button className={`act-filter${actFilter === 'all' ? ' is-active' : ''}`} onClick={() => setActFilter('all')}>
            {t('activities.filterAll', 'Toutes')}
            <span className="act-filter__count">{coaches.length}</span>
          </button>
          {filterOptions.map((a) => (
            <button key={a.id} className={`act-filter${actFilter === a.id ? ' is-active' : ''}`} onClick={() => setActFilter(a.id)}>
              <ActivityIcon icon={a.icon} size={14} /> {a.nom}
              <span className="act-filter__count">{coaches.filter((c) => c.activity_id === a.id).length}</span>
            </button>
          ))}
          {hasUnassigned && (
            <button className={`act-filter${actFilter === 'none' ? ' is-active' : ''}`} onClick={() => setActFilter('none')}>
              {t('coaches.unassigned', 'Sans activité')}
              <span className="act-filter__count">{coaches.filter((c) => !c.activity_id).length}</span>
            </button>
          )}
        </div>
      )}

      {coaches.length === 0 ? (
        <div className="act-empty">
          <UserX size={36} />
          <h3>{t('coaches.empty', 'Aucun coach pour le moment.')}</h3>
          {canManage && (
            <button className="btn btn--primary" onClick={() => setEditing({ coach: null })}>
              <UserPlus size={16} /> {t('coaches.createFirst', 'Ajouter le premier coach')}
            </button>
          )}
        </div>
      ) : visible.length === 0 ? (
        <div className="act-empty">
          <Search size={32} />
          <h3>{t('coaches.noResults', 'Aucun coach ne correspond à votre recherche.')}</h3>
          <button className="btn btn--ghost" onClick={() => { setQuery(''); setActFilter('all'); }}>
            {t('members.filters.reset', 'Réinitialiser')}
          </button>
        </div>
      ) : (
        <div className="coaches-grid coaches-grid--v2">
          {visible.map((coach) => {
            const act = actById[coach.activity_id];
            const color = act?.couleur || '#9fb3ad';
            const effectif = activeByActivity[coach.activity_id] || 0;
            const initials = `${coach.prenom?.[0] || ''}${coach.nom?.[0] || ''}`.toUpperCase();
            const worksToday = coach.is_active && (coach.jours || []).includes(TODAY);
            const wa = whatsappNumber(coach.telephone);

            return (
              <article key={coach.id} className={`coach-card2${coach.is_active ? '' : ' is-paused'}`} style={{ '--tc': color }}>
                <div className="coach-card2__glow" aria-hidden="true" />

                <header className="coach-card2__head">
                  <div className="coach-card2__avatar">
                    {coach.photo_base64 ? <img src={coach.photo_base64} alt="" /> : <span>{initials}</span>}
                    <i className={`coach-card2__dot${worksToday ? ' is-on' : ''}`} title={worksToday ? t('coaches.today', "Présent aujourd'hui") : t('coaches.notToday', "Pas de séance aujourd'hui")} />
                  </div>
                  <div className="coach-card2__id">
                    <h3 className="coach-card2__name">{coach.prenom} {coach.nom}</h3>
                    {act ? (
                      <span className="coach-card2__act"><ActivityIcon icon={act.icon} size={13} /> {act.nom}</span>
                    ) : (
                      <span className="coach-card2__act coach-card2__act--none">{t('coaches.unassigned', 'Sans activité')}</span>
                    )}
                  </div>
                  {canManage && (
                    <div className="act-card__actions">
                      <button className="act-card__action" onClick={() => setEditing({ coach })} title={t('settings.activities.edit', 'Modifier')} aria-label={t('settings.activities.edit', 'Modifier')}>
                        <Pencil size={15} />
                      </button>
                      <button className="act-card__action act-card__action--danger" onClick={() => setDeleting(coach)} title={t('settings.activities.delete', 'Supprimer')} aria-label={t('settings.activities.delete', 'Supprimer')}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </header>

                {!coach.is_active && <div className="coach-card2__paused">{t('coaches.status.inactive', 'Absent / en pause')}</div>}

                <div className="coach-card2__stats">
                  <div className="coach-card2__stat">
                    <strong>{coach.experience_years || 0}</strong>
                    <span>{t('coaches.yearsExp', "ans d'exp.")}</span>
                  </div>
                  {act ? (
                    <Link className="coach-card2__stat coach-card2__stat--link" to={`/membres?activite=${act.id}`} title={t('activities.delete.seeMembers', 'Voir les membres')}>
                      <strong>{effectif}</strong>
                      <span>{t('coaches.activeMembers', 'membres actifs')}</span>
                    </Link>
                  ) : (
                    <div className="coach-card2__stat"><strong>—</strong><span>{t('coaches.activeMembers', 'membres actifs')}</span></div>
                  )}
                  <div className="coach-card2__stat">
                    <strong>{(coach.jours || []).length}</strong>
                    <span>{t('coaches.daysPerWeek', 'jours / sem.')}</span>
                  </div>
                </div>

                <div className="coach-card2__week" aria-label={t('coaches.form.availability', 'Disponibilités')}>
                  {WEEKDAYS.map((d) => (
                    <span
                      key={d}
                      className={`coach-card2__day${(coach.jours || []).includes(d) ? ' is-on' : ''}${d === TODAY ? ' is-today' : ''}`}
                      title={t(`coaches.days.${d}`, d)}
                    >
                      {t(`coaches.daysShort.${d}`, d[0])}
                    </span>
                  ))}
                  {coach.horaires && <span className="coach-card2__hours"><Clock size={12} /> {coach.horaires}</span>}
                </div>

                {coach.diplome && (
                  <div className="coach-card2__diploma"><Award size={14} /> {coach.diplome}</div>
                )}
                {coach.bio && <p className="coach-card2__bio">{coach.bio}</p>}

                <footer className="coach-card2__contact">
                  {coach.telephone && (
                    <a className="coach-card2__btn" href={`tel:${coach.telephone.replace(/[^\d+]/g, '')}`} title={coach.telephone}>
                      <Phone size={15} /> <span>{t('coaches.call', 'Appeler')}</span>
                    </a>
                  )}
                  {wa && (
                    <a className="coach-card2__btn coach-card2__btn--wa" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" title="WhatsApp">
                      <MessageCircle size={15} /> <span>WhatsApp</span>
                    </a>
                  )}
                  {coach.email && (
                    <a className="coach-card2__btn" href={`mailto:${coach.email}`} title={coach.email}>
                      <Mail size={15} /> <span>{t('coaches.email', 'Email')}</span>
                    </a>
                  )}
                  {!coach.telephone && !coach.email && (
                    <span className="coach-card2__nocontact"><Users size={14} /> {t('coaches.noContact', 'Aucun contact renseigné')}</span>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {editing && (
        <CoachFormModal
          coach={editing.coach}
          defaults={editing.defaults}
          activites={activites}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <DeleteCoachDialog coach={deleting} onConfirm={handleDelete} onClose={() => setDeleting(null)} />
      )}

      {toast && (
        <div className="act-toast" role="status">
          <CheckCircle2 size={18} /> {toast}
        </div>
      )}
    </div>
  );
}
