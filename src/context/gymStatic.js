export const FALLBACK_DURATIONS = { mensuel: 30, trimestriel: 90, annuel: 365 };
export const FALLBACK_PRIX = {
  musculation: { mensuel: 300, trimestriel: 800, annuel: 2800 },
  kickboxing: { mensuel: 350, trimestriel: 950, annuel: 3200 },
  karate: { mensuel: 200, trimestriel: 550, annuel: 1800 },
  aerobic: { mensuel: 280, trimestriel: 750, annuel: 2600 },
};

export const BASE_ACTIVITES = [
  {
    id: 'musculation', nom: 'Musculation', genre: 'homme',
    couleur: '#39ff14', bg: 'rgba(57,255,20,0.12)', icon: 'MU',
    coachNom: 'Rachid ALAMI',
    description: 'Programme de renforcement musculaire pour hommes adultes. Machines modernes, halteres libres et suivi personnalise par notre coach certifie.',
  },
  {
    id: 'kickboxing', nom: 'Kickboxing', genre: 'homme',
    couleur: '#22c55e', bg: 'rgba(34,197,94,0.12)', icon: 'KB',
    coachNom: 'Hassan BENNIS',
    description: 'Arts martiaux et combat debout pour hommes. Technique, condition physique et self-defense avec un champion experimente.',
  },
  {
    id: 'karate', nom: 'Karate Enfants', genre: 'enfant',
    couleur: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: 'KR',
    coachNom: 'Omar ZIANI',
    description: 'Initiation et perfectionnement au karate pour enfants de 6 a 14 ans. Discipline, respect et developpement physique harmonieux.',
  },
  {
    id: 'aerobic', nom: 'Aerobic', genre: 'femme',
    couleur: '#16a34a', bg: 'rgba(22,163,74,0.12)', icon: 'AE',
    coachNom: 'Sarah MEJDOUBI',
    description: "Cours d'aerobic et de fitness exclusivement feminins. Cardio, tonicite et bien-etre dans un cadre securise et bienveillant.",
  },
];

export const COACHES = [
  { id: 1, nom: 'ALAMI',    prenom: 'Rachid', activite: 'musculation', telephone: '0612-111-111', email: 'rachid.alami@gym.ma',   experience: '8 ans',  diplome: 'BEES Musculation & Halterophilie',       initials: 'RA', couleur: '#3b82f6', jours: 'Lun - Sam' },
  { id: 2, nom: 'BENNIS',   prenom: 'Hassan', activite: 'kickboxing',  telephone: '0612-222-222', email: 'hassan.bennis@gym.ma',  experience: '12 ans', diplome: 'Ceinture Noire K-1 / Kyokushin',         initials: 'HB', couleur: '#ef4444', jours: 'Mar, Jeu, Sam' },
  { id: 3, nom: 'ZIANI',    prenom: 'Omar',   activite: 'karate',      telephone: '0612-333-333', email: 'omar.ziani@gym.ma',     experience: '15 ans', diplome: 'Ceinture Noire 3eme Dan Shotokan',       initials: 'OZ', couleur: '#22c55e', jours: 'Mar, Jeu, Sam' },
  { id: 4, nom: 'MEJDOUBI', prenom: 'Sarah',  activite: 'aerobic',     telephone: '0612-444-444', email: 'sarah.mejdoubi@gym.ma', experience: '6 ans',  diplome: 'BF Fitness Aerobic - CFPA Certifie',    initials: 'SM', couleur: '#ec4899', jours: 'Lun, Mer, Ven, Sam' },
];

export const JOURS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];

export const PLANNING = [
  /* Musculation - Hommes */
  { id:1,  activite:'musculation', genre:'homme',  jours:['Lundi','Mardi','Mercredi','Jeudi','Vendredi'], heureDebut:'06:00', heureFin:'08:00', label:'Seance Matin'          },
  { id:2,  activite:'musculation', genre:'homme',  jours:['Lundi','Mardi','Mercredi','Jeudi','Vendredi'], heureDebut:'17:00', heureFin:'20:00', label:'Seance Soir'           },
  { id:3,  activite:'musculation', genre:'homme',  jours:['Samedi'],                                       heureDebut:'09:00', heureFin:'12:00', label:'Seance Week-end'       },
  /* Kickboxing - Hommes */
  { id:4,  activite:'kickboxing',  genre:'homme',  jours:['Mardi','Jeudi'],                                heureDebut:'19:00', heureFin:'20:30', label:'Techniques & Sparring' },
  { id:5,  activite:'kickboxing',  genre:'homme',  jours:['Samedi'],                                       heureDebut:'10:00', heureFin:'11:30', label:'Entrainement Ouvert'   },
  /* Aerobic - Femmes */
  { id:6,  activite:'aerobic',     genre:'femme',  jours:['Lundi','Mercredi','Vendredi'],                  heureDebut:'09:00', heureFin:'10:30', label:'Cardio Matin'          },
  { id:7,  activite:'aerobic',     genre:'femme',  jours:['Lundi','Mercredi','Vendredi'],                  heureDebut:'17:30', heureFin:'19:00', label:'Tonicite Soir'         },
  { id:8,  activite:'aerobic',     genre:'femme',  jours:['Samedi'],                                       heureDebut:'10:00', heureFin:'11:30', label:'Zumba & Stretching'    },
  /* Karate - Enfants */
  { id:9,  activite:'karate',      genre:'enfant', jours:['Mardi','Jeudi'],                                heureDebut:'16:00', heureFin:'17:30', label:'Katas & Techniques'    },
  { id:10, activite:'karate',      genre:'enfant', jours:['Samedi'],                                       heureDebut:'09:00', heureFin:'11:00', label:'Kumite & Tournoi'      },
];
