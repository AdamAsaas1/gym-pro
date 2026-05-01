import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Banknote, TrendingUp, Users, AlertCircle, CheckCircle2,
  Search, ReceiptText, Clock, X, Download, Calendar,
} from 'lucide-react';
import { useGym } from '../context/GymContext';
import { telechargerRecu } from '../api/client';

const ABO_LABELS = { mensuel: 'Mensuel', trimestriel: 'Trimestriel', annuel: 'Annuel' };
const MODE_OPTS  = ['Espèces', 'Virement', 'Chèque'];

const GENRE_ICONS = { homme: 'H', femme: 'F', enfant: 'E' };
const ACT_ICONS   = { musculation: 'MU', kickboxing: 'KB', karate: 'KR', aerobic: 'AE' };

const MONTHS = ['janv.', 'fevr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'aout', 'sept.', 'oct.', 'nov.', 'dec.'];

function parseMonthValue(value) {
  if (!value) return null;
  const parts = value.split('-');
  if (parts.length !== 2) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  if (Number.isNaN(year) || Number.isNaN(month)) return null;
  return { year, month };
}

function buildMonthValue(year, monthIndex) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

function getAccess(m) {
  const days = Math.ceil((new Date(m.dateExpiration) - new Date()) / 86400000);
  if (m.statut === 'inactif') return { key: 'inactif', label: 'Inactif',    color: '#64748b', bg: 'rgba(100,116,139,0.1)' };
  if (days < 0)               return { key: 'expire',  label: 'Expiré',     color: '#ef4444', bg: 'rgba(239,68,68,0.1)'  };
  if (days === 0)             return { key: 'expire',  label: "Expire aujourd'hui", color: '#ef4444', bg: 'rgba(239,68,68,0.1)' };
  if (days <= 7)              return { key: 'bientot', label: `Expire dans ${days}j`, color: '#f97316', bg: 'rgba(249,115,22,0.1)' };
  return                             { key: 'ok',      label: 'Autorisé',   color: '#22c55e', bg: 'rgba(34,197,94,0.1)'  };
}

function getPrix(activites, activite, abonnement) {
  return activites.find((a) => a.id === activite)?.prix?.[abonnement] ?? 0;
}

/* ── Modal paiement ── */
function ModalPaiement({ membre, onClose, onConfirm, activites, abonnementDurations }) {
  const [abo,    setAbo]    = useState(membre.abonnement);
  const [mode,   setMode]   = useState('Espèces');
  const [montant, setMontant] = useState(() => getPrix(activites, membre.activite, membre.abonnement));
  const [workflowOn, setWorkflowOn] = useState(false);
  const [sendReminders, setSendReminders] = useState(true);
  const [daysBefore, setDaysBefore] = useState(3);

  const handleAbo = (val) => {
    setAbo(val);
    setMontant(getPrix(activites, membre.activite, val));
  };

  const newExp = () => {
    const d = new Date();
    const duration = abonnementDurations[abo] ?? 0;
    d.setDate(d.getDate() + duration);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal paiement-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="paiement-modal__head">
          <div className="paiement-modal__avatar">
            {membre.prenom[0]}{membre.nom[0]}
          </div>
          <div>
            <div className="paiement-modal__name">{membre.prenom} {membre.nom}</div>
            <div className="paiement-modal__sub">
              {ACT_ICONS[membre.activite]} {membre.activite} · {GENRE_ICONS[membre.genre]}
            </div>
          </div>
          <button className="paiement-modal__close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="paiement-modal__content">
          <div className="paiement-modal__body">

          {/* Type abonnement */}
          <div className="pay-field">
            <label>Type d'abonnement</label>
            <div className="pay-abo-btns">
              {Object.entries(ABO_LABELS).map(([k, label]) => (
                <button
                  key={k}
                  className={`pay-abo-btn${abo === k ? ' pay-abo-btn--active' : ''}`}
                  onClick={() => handleAbo(k)}
                >
                  <span>{label}</span>
                  <span className="pay-abo-price">{getPrix(activites, membre.activite, k).toLocaleString('fr-FR')} DH</span>
                </button>
              ))}
            </div>
          </div>

          {/* Montant */}
          <div className="pay-field">
            <label>Montant encaissé (DH)</label>
            <div className="pay-amount-wrap">
              <Banknote size={18} />
              <input
                type="number"
                className="pay-amount-input"
                value={montant}
                min={0}
                onChange={(e) => setMontant(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Mode paiement */}
          <div className="pay-field">
            <label>Mode de paiement</label>
            <div className="pay-mode-btns">
              {MODE_OPTS.map((m) => (
                <button
                  key={m}
                  className={`pay-mode-btn${mode === m ? ' pay-mode-btn--active' : ''}`}
                  onClick={() => setMode(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Récapitulatif */}
          <div className="pay-recap">
            <div className="pay-recap__row">
              <span>Nouvelle échéance</span>
              <strong>{newExp()}</strong>
            </div>
            <div className="pay-recap__row">
              <span>Durée</span>
              <strong>{abonnementDurations[abo] ?? 0} jours</strong>
            </div>
            <div className="pay-recap__row pay-recap__row--total">
              <span>Total à encaisser</span>
              <strong>{montant.toLocaleString('fr-FR')} DH</strong>
            </div>
          </div>
          </div>

          {/* Options workflow */}
          <div className="pay-workflow">
            <label className="pay-workflow__row">
              <input
                type="checkbox"
                checked={workflowOn}
                onChange={(e) => setWorkflowOn(e.target.checked)}
              />
              <span>Envoyer recu + rappels</span>
            </label>
            {workflowOn && (
              <div className="pay-workflow__options">
                <label className="pay-workflow__row">
                  <input
                    type="checkbox"
                    checked={sendReminders}
                    onChange={(e) => setSendReminders(e.target.checked)}
                  />
                  <span>Rappels actifs</span>
                </label>
                <label className="pay-workflow__row">
                  <span>Jours avant expiration</span>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={daysBefore}
                    onChange={(e) => setDaysBefore(Number(e.target.value))}
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="paiement-modal__footer">
          <button className="btn-ghost" onClick={onClose}>Annuler</button>
          <button
            className="btn-pay"
            onClick={() => {
              onConfirm({ abonnement: abo, montant, mode, action: workflowOn ? 'workflow' : 'simple', sendReminders, daysBefore });
              onClose();
            }}
          >
            <ReceiptText size={16} /> {workflowOn ? 'Workflow complet' : 'Confirmer le paiement'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page principale ── */
const FILTERS = [
  { key: 'tous',    label: 'Tous'           },
  { key: 'ok',      label: 'En règle'       },
  { key: 'bientot', label: 'Expire bientôt' },
  { key: 'expire',  label: 'À renouveler'   },
  { key: 'inactif', label: 'Inactifs'       },
];

export default function Paiements() {
  const { membres, paiements, statsP, activites, abonnementDurations, enregistrerPaiement, enregistrerPaiementWorkflow } = useGym();
  const [search,     setSearch]     = useState('');
  const [filter,     setFilter]     = useState('tous');
  const [tab,        setTab]        = useState('membres');   // 'membres' | 'historique'
  const [selected,   setSelected]   = useState(null);        // membre pour modal
  const [moisHisto,  setMoisHisto]  = useState('');
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [yearCursor, setYearCursor] = useState(() => new Date().getFullYear());
  const monthPickerRef = useRef(null);

  useEffect(() => {
    const parsed = parseMonthValue(moisHisto);
    if (parsed) setYearCursor(parsed.year);
  }, [moisHisto]);

  useEffect(() => {
    if (!monthPickerOpen) return;
    const handleClickOutside = (event) => {
      if (!monthPickerRef.current) return;
      if (!monthPickerRef.current.contains(event.target)) {
        setMonthPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [monthPickerOpen]);

  /* Filtered member list */
  const liste = useMemo(() => {
    return membres
      .filter((m) => {
        const q = search.toLowerCase();
        const hay = `${m.nom} ${m.prenom} ${m.telephone} ${m.email} ${m.activite} ${m.abonnement} ${m.statut}`.toLowerCase();
        const match = !q || hay.includes(q);
        const acc = getAccess(m);
        const fMatch = filter === 'tous' || acc.key === filter;
        return match && fMatch;
      })
      .sort((a, b) => {
        const order = { expire: 0, bientot: 1, inactif: 2, ok: 3 };
        return (order[getAccess(a).key] ?? 4) - (order[getAccess(b).key] ?? 4);
      });
  }, [membres, search, filter]);

  /* Historique filtered */
  const historiqueFiltre = useMemo(() => {
    return paiements.filter((p) => !moisHisto || p.date.startsWith(moisHisto));
  }, [paiements, moisHisto]);

  const totalHisto = historiqueFiltre.reduce((s, p) => s + p.montant, 0);
  const parsedMonth = parseMonthValue(moisHisto);
  const monthLabel = parsedMonth ? `${MONTHS[parsedMonth.month]} ${parsedMonth.year}` : 'Tous les mois';

  /* Compter par filter */
  const countByFilter = useMemo(() => {
    const r = { tous: membres.length };
    membres.forEach((m) => {
      const k = getAccess(m).key;
      r[k] = (r[k] || 0) + 1;
    });
    return r;
  }, [membres]);

  const handlePay = (membre) => setSelected(membre);

  const handleDownloadRecu = async (paiementId, membre) => {
    const blob = await telechargerRecu(paiementId);
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `recu_${String(paiementId).padStart(4, '0')}_${membre?.nom}_${membre?.prenom}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirm = async ({ abonnement, montant, mode, action, sendReminders, daysBefore }) => {
    if (action === 'workflow') {
      const res = await enregistrerPaiementWorkflow({
        membreId: selected.id,
        abonnement,
        montant,
        mode,
        sendReminders,
        daysBefore,
      });
      const m = selected;
      await handleDownloadRecu(res.paiement.id, m);
    } else {
      await enregistrerPaiement({ membreId: selected.id, abonnement, montant, mode });
    }
    setSelected(null);
  };

  return (
    <div className="page pay-page fade-in">
      <section className="pay-hero">
        <div>
          <span className="pay-hero__eyebrow">Paiements</span>
          <h2 className="pay-hero__title">Pilotage des encaissements</h2>
          <p className="pay-hero__subtitle">
            Suivez les paiements, verifiez les acces et declenchez un encaissement en quelques secondes.
          </p>
        </div>
        <div className="pay-hero__actions">
          <button className="btn btn--ghost" onClick={() => setTab('membres')}>Membres & acces</button>
          <button className="btn btn--primary" onClick={() => setTab('historique')}>Historique paiements</button>
        </div>
      </section>

      <section className="pay-kpis">
        <div className="pay-kpi pay-kpi--primary">
          <TrendingUp size={20} />
          <div>
            <div className="pay-stat-val">{statsP.totalMois.toLocaleString('fr-FR')} DH</div>
            <div className="pay-stat-lbl">Encaisse ce mois</div>
          </div>
        </div>
        <div className="pay-kpi">
          <Users size={20} />
          <div>
            <div className="pay-stat-val">{statsP.enRegle}</div>
            <div className="pay-stat-lbl">Membres en regle</div>
          </div>
        </div>
        <div className="pay-kpi pay-kpi--alert">
          <AlertCircle size={20} />
          <div>
            <div className="pay-stat-val">{statsP.aRegler}</div>
            <div className="pay-stat-lbl">A renouveler</div>
          </div>
        </div>
        <div className="pay-kpi">
          <ReceiptText size={20} />
          <div>
            <div className="pay-stat-val">{statsP.paiementsMois}</div>
            <div className="pay-stat-lbl">Paiements ce mois</div>
          </div>
        </div>
      </section>

      <div className="pay-tabs">
        <button className={`pay-tab${tab === 'membres' ? ' pay-tab--active' : ''}`} onClick={() => setTab('membres')}>
          <Users size={15} /> Membres & acces
        </button>
        <button className={`pay-tab${tab === 'historique' ? ' pay-tab--active' : ''}`} onClick={() => setTab('historique')}>
          <ReceiptText size={15} /> Historique des paiements
          {paiements.length > 0 && <span className="pay-tab__cnt">{paiements.length}</span>}
        </button>
      </div>

      {/* ══════════ TAB MEMBRES ══════════ */}
      {tab === 'membres' && (
        <>
          {/* Toolbar */}
          <div className="card pay-filters-card">
            <div className="pay-toolbar">
              <div className="search-box">
                <Search size={15} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un membre..."
                />
                {search && <button onClick={() => setSearch('')}><X size={14} /></button>}
              </div>
              <div className="pay-filters">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    className={`notif-filter${filter === f.key ? ' notif-filter--active' : ''}`}
                    onClick={() => setFilter(f.key)}
                  >
                    {f.label}
                    {countByFilter[f.key] > 0 && (
                      <span className="notif-filter__cnt">{countByFilter[f.key]}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="card pay-table-wrap">
            {liste.length === 0 ? (
              <div className="notif-empty">
                <Users size={32} style={{ opacity: 0.2 }} />
                <span>Aucun membre trouvé</span>
              </div>
            ) : (
              <table className="pay-table">
                <thead>
                  <tr>
                    <th>Membre</th>
                    <th>Activité</th>
                    <th>Abonnement</th>
                    <th>Échéance</th>
                    <th>Accès Salle</th>
                    <th>Montant</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {liste.map((m) => {
                    const acc    = getAccess(m);
                    const prix   = getPrix(activites, m.activite, m.abonnement);
                    const needPay = acc.key === 'expire' || acc.key === 'inactif';
                    return (
                      <tr key={m.id} className={`pay-row${needPay ? ' pay-row--alert' : ''}`}>
                        <td>
                          <div className="pay-member">
                            <div className="pay-member__avatar">{m.prenom[0]}{m.nom[0]}</div>
                            <div>
                              <div className="pay-member__name">{m.prenom} {m.nom}</div>
                              <div className="pay-member__tel">{m.telephone}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="pay-act">
                            {ACT_ICONS[m.activite]} {m.activite}
                          </span>
                        </td>
                        <td>
                          <span className="pay-abo-badge">{ABO_LABELS[m.abonnement]}</span>
                        </td>
                        <td>
                          <div className="pay-date">
                            <Clock size={13} />
                            {new Date(m.dateExpiration).toLocaleDateString('fr-FR')}
                          </div>
                        </td>
                        <td>
                          <span className="pay-access" style={{ '--ac': acc.color, '--abg': acc.bg }}>
                            {acc.key === 'ok' || acc.key === 'bientot'
                              ? <CheckCircle2 size={13} />
                              : <AlertCircle  size={13} />
                            }
                            {acc.label}
                          </span>
                        </td>
                        <td>
                          <span className="pay-prix">{prix.toLocaleString('fr-FR')} DH</span>
                        </td>
                        <td>
                          <button
                            className={`pay-encaisser-btn${!needPay ? ' pay-encaisser-btn--renew' : ''}`}
                            onClick={() => handlePay(m)}
                          >
                            <Banknote size={14} />
                            {needPay ? 'Encaisser' : 'Renouveler'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ══════════ TAB HISTORIQUE ══════════ */}
      {tab === 'historique' && (
        <>
          <div className="card pay-histo-card">
            <div className="pay-histo-toolbar">
              <div className="month-picker" ref={monthPickerRef}>
                <button
                  className="month-picker__trigger"
                  onClick={() => setMonthPickerOpen((v) => !v)}
                >
                  <Calendar size={14} /> {monthLabel}
                </button>
                {monthPickerOpen && (
                  <div className="month-picker__panel">
                    <div className="month-picker__head">
                      <button className="month-picker__nav" onClick={() => setYearCursor((y) => y - 1)}>←</button>
                      <div className="month-picker__year">{yearCursor}</div>
                      <button className="month-picker__nav" onClick={() => setYearCursor((y) => y + 1)}>→</button>
                    </div>
                    <div className="month-picker__grid">
                      {MONTHS.map((label, idx) => {
                        const isActive = parsedMonth && parsedMonth.year === yearCursor && parsedMonth.month === idx;
                        return (
                          <button
                            key={label}
                            className={`month-chip${isActive ? ' month-chip--active' : ''}`}
                            onClick={() => {
                              setMoisHisto(buildMonthValue(yearCursor, idx));
                              setMonthPickerOpen(false);
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="month-picker__foot">
                      <button
                        className="month-picker__clear"
                        onClick={() => {
                          setMoisHisto('');
                          setMonthPickerOpen(false);
                        }}
                      >
                        Tout afficher
                      </button>
                      <button
                        className="month-picker__now"
                        onClick={() => {
                          const now = new Date();
                          setMoisHisto(buildMonthValue(now.getFullYear(), now.getMonth()));
                          setYearCursor(now.getFullYear());
                          setMonthPickerOpen(false);
                        }}
                      >
                        Ce mois
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {historiqueFiltre.length > 0 && (
                <div className="pay-histo-total">
                  Total : <strong>{totalHisto.toLocaleString('fr-FR')} DH</strong>
                  &nbsp;·&nbsp; {historiqueFiltre.length} paiement{historiqueFiltre.length > 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>

          <div className="card pay-table-wrap">
            {historiqueFiltre.length === 0 ? (
              <div className="notif-empty">
                <ReceiptText size={32} style={{ opacity: 0.2 }} />
                <span>Aucun paiement enregistré</span>
                <span style={{ fontSize: '0.78rem', marginTop: 4 }}>
                  Les paiements apparaîtront ici après encaissement
                </span>
              </div>
            ) : (
              <table className="pay-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Membre</th>
                    <th>Activité</th>
                    <th>Abonnement</th>
                    <th>Mode</th>
                    <th>Date</th>
                    <th>Montant</th>
                    <th>Reçu</th>
                  </tr>
                </thead>
                <tbody>
                  {historiqueFiltre.map((p, i) => {
                    const m = membres.find((mb) => mb.id === p.membreId);
                    return (
                      <tr key={p.id} className="pay-row">
                        <td className="pay-num">{historiqueFiltre.length - i}</td>
                        <td>
                          {m ? (
                            <div className="pay-member">
                              <div className="pay-member__avatar">{m.prenom[0]}{m.nom[0]}</div>
                              <div>
                                <div className="pay-member__name">{m.prenom} {m.nom}</div>
                                <div className="pay-member__tel">{m.telephone}</div>
                              </div>
                            </div>
                          ) : <span style={{ color: 'var(--clr-muted)' }}>Inconnu</span>}
                        </td>
                        <td>
                          {m && <span className="pay-act">{ACT_ICONS[m.activite]} {m.activite}</span>}
                        </td>
                        <td>
                          <span className="pay-abo-badge">{ABO_LABELS[p.abonnement]}</span>
                        </td>
                        <td>
                          <span className="pay-mode">{p.mode}</span>
                        </td>
                        <td>
                          <span className="pay-date"><Clock size={13} />{p.date}</span>
                        </td>
                        <td>
                          <span className="pay-prix pay-prix--paid">{p.montant.toLocaleString('fr-FR')} DH</span>
                        </td>
                        <td>
                          <button
                            className="pay-recu-btn"
                            title="Télécharger le reçu PDF"
                            onClick={() => handleDownloadRecu(p.id, m)}
                          >
                            <Download size={14} /> PDF
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Modal */}
      {selected && (
        <ModalPaiement
          membre={selected}
          onClose={() => setSelected(null)}
          onConfirm={handleConfirm}
          activites={activites}
          abonnementDurations={abonnementDurations}
        />
      )}
    </div>
  );
}
