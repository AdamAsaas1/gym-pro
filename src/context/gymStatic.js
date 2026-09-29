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
