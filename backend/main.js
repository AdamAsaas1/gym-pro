import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { Buffer } from 'buffer';
import { randomUUID } from 'crypto';

const app = express();
const PORT = Number(process.env.PORT || 5000);
const DURATIONS = { mensuel: 30, trimestriel: 90, annuel: 365 };

const ALL_PAGES = ['/', '/membres', '/paiements', '/planning', '/activites', '/abonnements', '/coaches', '/permissions'];
const DEFAULT_ROLE_PAGES = {
  superadmin: ['*'],
  admin: ['/', '/membres', '/paiements', '/planning', '/activites', '/abonnements', '/coaches'],
};

const USERS = {
  superadmin: {
    username: 'superadmin',
    password: 'superadmin123',
    role: 'superadmin',
    permissions: ['*'],
  },
  admin: {
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    permissions: [...DEFAULT_ROLE_PAGES.admin],
  },
};

const accessTokens = new Map();
const refreshTokens = new Map();
const rolePermissions = {
  superadmin: ['*'],
  admin: [...DEFAULT_ROLE_PAGES.admin],
};

// Middleware
app.use(cors());
app.use(express.json());

const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Gym Pro API',
    version: '1.0.0',
    description: 'Documentation de l\'API Gym Pro (backend Express).',
  },
  servers: [{ url: 'http://localhost:5000' }],
  paths: {
    '/api/health': {
      get: {
        summary: 'Health check',
        responses: {
          200: {
            description: 'Backend status',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { status: { type: 'string' } } },
              },
            },
          },
        },
      },
    },
    '/api/membres': {
      get: {
        summary: 'Lister les membres',
        responses: {
          200: {
            description: 'Liste des membres',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Membre' } },
              },
            },
          },
        },
      },
      post: {
        summary: 'Creer un membre',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/MembreInput' } },
          },
        },
        responses: {
          201: {
            description: 'Membre cree',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Membre' } } },
          },
        },
      },
    },
    '/api/membres/{id}': {
      put: {
        summary: 'Mettre a jour un membre',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/MembreInput' } } },
        },
        responses: {
          200: { description: 'Membre mis a jour', content: { 'application/json': { schema: { $ref: '#/components/schemas/Membre' } } } },
          404: { description: 'Membre introuvable' },
        },
      },
      delete: {
        summary: 'Supprimer un membre',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 204: { description: 'Supprime' } },
      },
    },
    '/api/membres/{id}/toggle': {
      patch: {
        summary: 'Basculer le statut actif/inactif',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Statut mis a jour', content: { 'application/json': { schema: { $ref: '#/components/schemas/Membre' } } } },
          404: { description: 'Membre introuvable' },
        },
      },
    },
    '/api/paiements': {
      get: {
        summary: 'Lister les paiements',
        responses: {
          200: {
            description: 'Liste des paiements',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Paiement' } },
              },
            },
          },
        },
      },
      post: {
        summary: 'Creer un paiement',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/PaiementInput' } } },
        },
        responses: {
          201: { description: 'Paiement cree', content: { 'application/json': { schema: { $ref: '#/components/schemas/Paiement' } } } },
          404: { description: 'Membre introuvable' },
        },
      },
    },
    '/api/paiements/{id}/recu': {
      get: {
        summary: 'Telecharger le recu PDF',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'PDF du recu', content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } },
          404: { description: 'Paiement introuvable' },
        },
      },
    },
    '/api/coaches': {
      get: {
        summary: 'Lister les coachs',
        responses: {
          200: {
            description: 'Liste des coachs',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Coach' } },
              },
            },
          },
        },
      },
    },
    '/api/activites': {
      get: {
        summary: 'Lister les activites',
        responses: {
          200: {
            description: 'Liste des activites',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Activite' } },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Membre: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          nom: { type: 'string' },
          prenom: { type: 'string' },
          genre: { type: 'string' },
          activite: { type: 'string' },
          abonnement: { type: 'string' },
          statut: { type: 'string' },
          telephone: { type: 'string' },
          email: { type: 'string' },
          date_naissance: { type: 'string', format: 'date' },
          date_inscription: { type: 'string', format: 'date' },
          date_expiration: { type: 'string', format: 'date' },
        },
      },
      MembreInput: {
        type: 'object',
        properties: {
          nom: { type: 'string' },
          prenom: { type: 'string' },
          genre: { type: 'string' },
          activite: { type: 'string' },
          abonnement: { type: 'string' },
          statut: { type: 'string' },
          telephone: { type: 'string' },
          email: { type: 'string' },
          date_naissance: { type: 'string', format: 'date' },
          date_inscription: { type: 'string', format: 'date' },
          date_expiration: { type: 'string', format: 'date' },
        },
      },
      Paiement: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          membre_id: { type: 'integer' },
          abonnement: { type: 'string' },
          montant: { type: 'number' },
          mode: { type: 'string' },
          date: { type: 'string', format: 'date' },
        },
      },
      PaiementInput: {
        type: 'object',
        properties: {
          membre_id: { type: 'integer' },
          abonnement: { type: 'string' },
          montant: { type: 'number' },
          mode: { type: 'string' },
          date: { type: 'string', format: 'date' },
        },
      },
      Coach: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          specialite: { type: 'string' },
        },
      },
      Activite: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          type: { type: 'string' },
          horaire: { type: 'string' },
        },
      },
    },
  },
};

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

const formatDate = (date) => date.toISOString().split('T')[0];

const addDays = (input, days) => {
  const date = new Date(input);
  date.setDate(date.getDate() + days);
  return formatDate(date);
};

const toPublicUser = (user) => ({
  username: user.username,
  role: user.role,
  permissions: user.role === 'superadmin' ? ['*'] : [...(rolePermissions[user.role] || ['/'])],
});

const issueTokens = (username) => {
  const accessToken = `acc_${randomUUID()}`;
  const refreshToken = `ref_${randomUUID()}`;
  accessTokens.set(accessToken, username);
  refreshTokens.set(refreshToken, username);
  return { accessToken, refreshToken };
};

const revokeAllUserTokens = (username) => {
  for (const [token, tokenUser] of accessTokens.entries()) {
    if (tokenUser === username) accessTokens.delete(token);
  }
  for (const [token, tokenUser] of refreshTokens.entries()) {
    if (tokenUser === username) refreshTokens.delete(token);
  }
};

const getBearerToken = (req) => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null;
  return authHeader.slice(7).trim();
};

const normalizeRolePages = (role, pages) => {
  if (role === 'superadmin') return ['*'];
  if (!Array.isArray(pages)) return ['/'];
  const clean = [...new Set(pages)].filter((page) => ALL_PAGES.includes(page) && page !== '/permissions');
  return clean.length ? clean : ['/'];
};

const today = formatDate(new Date());

let membres = [
  {
    id: 1,
    nom: 'El Alaoui',
    prenom: 'Ahmed',
    genre: 'homme',
    activite: 'musculation',
    abonnement: 'mensuel',
    statut: 'actif',
    telephone: '0612345678',
    email: 'ahmed.elalaoui@example.com',
    date_naissance: '1998-04-15',
    date_inscription: '2026-03-01',
    date_expiration: addDays(today, 12),
  },
  {
    id: 2,
    nom: 'Bennani',
    prenom: 'Sara',
    genre: 'femme',
    activite: 'aerobic',
    abonnement: 'trimestriel',
    statut: 'actif',
    telephone: '0623456789',
    email: 'sara.bennani@example.com',
    date_naissance: '1995-09-03',
    date_inscription: '2026-02-10',
    date_expiration: addDays(today, 4),
  },
  {
    id: 3,
    nom: 'Ziani',
    prenom: 'Youssef',
    genre: 'enfant',
    activite: 'karate',
    abonnement: 'mensuel',
    statut: 'inactif',
    telephone: '0634567890',
    email: 'youssef.ziani@example.com',
    date_naissance: '2014-06-21',
    date_inscription: '2026-01-08',
    date_expiration: addDays(today, -6),
  },
];

let paiements = [
  {
    id: 1,
    membre_id: 1,
    abonnement: 'mensuel',
    montant: 300,
    mode: 'Espèces',
    date: '2026-03-01',
  },
  {
    id: 2,
    membre_id: 2,
    abonnement: 'trimestriel',
    montant: 750,
    mode: 'Virement',
    date: '2026-02-10',
  },
];

let nextMembreId = membres.length + 1;
let nextPaiementId = paiements.length + 1;

const sanitizeMembre = (payload, current = {}) => ({
  ...current,
  nom: payload.nom ?? current.nom ?? '',
  prenom: payload.prenom ?? current.prenom ?? '',
  genre: payload.genre ?? current.genre ?? 'homme',
  activite: payload.activite ?? current.activite ?? 'musculation',
  abonnement: payload.abonnement ?? current.abonnement ?? 'mensuel',
  statut: payload.statut ?? current.statut ?? 'actif',
  telephone: payload.telephone ?? current.telephone ?? '',
  email: payload.email ?? current.email ?? '',
  date_naissance: payload.date_naissance ?? current.date_naissance ?? null,
  date_inscription: payload.date_inscription ?? current.date_inscription ?? today,
  date_expiration: payload.date_expiration ?? current.date_expiration ?? addDays(today, 30),
});

const createReceiptPdf = (paiement, membre) => Buffer.from(`%PDF-1.1
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 156 >>
stream
BT
/F1 18 Tf
72 720 Td
(Recu Gym Pro) Tj
0 -28 Td
/F1 12 Tf
(Paiement #${paiement.id}) Tj
0 -20 Td
(Membre: ${membre.prenom} ${membre.nom}) Tj
0 -20 Td
(Abonnement: ${paiement.abonnement}) Tj
0 -20 Td
(Montant: ${paiement.montant} DH) Tj
0 -20 Td
(Date: ${paiement.date}) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000241 00000 n 
0000000448 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
518
%%EOF`, 'utf-8');

// Routes
app.post('/auth/login', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const user = USERS[username];

  if (!user || user.password !== password) {
    return res.status(401).json({ detail: { message: 'Identifiants invalides' } });
  }

  revokeAllUserTokens(username);
  const { accessToken, refreshToken } = issueTokens(username);
  return res.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    user: toPublicUser(user),
  });
});

app.post('/auth/refresh', (req, res) => {
  const refreshToken = String(req.body?.refresh_token || '');
  const username = refreshTokens.get(refreshToken);

  if (!username || !USERS[username]) {
    return res.status(401).json({ detail: { message: 'Session expiree' } });
  }

  refreshTokens.delete(refreshToken);
  const { accessToken, refreshToken: newRefreshToken } = issueTokens(username);
  return res.json({ access_token: accessToken, refresh_token: newRefreshToken });
});

app.post('/auth/logout', (req, res) => {
  const refreshToken = String(req.body?.refresh_token || '');
  const username = refreshTokens.get(refreshToken);
  if (username) {
    revokeAllUserTokens(username);
  }
  refreshTokens.delete(refreshToken);
  return res.json({ success: true });
});

app.get('/auth/me', (req, res) => {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ detail: { message: 'Non authentifie' } });
  }
  const username = accessTokens.get(token);
  const user = username ? USERS[username] : null;

  if (!user) {
    return res.status(401).json({ detail: { message: 'Session invalide' } });
  }

  return res.json(toPublicUser(user));
});

app.get('/permissions/pages', (_req, res) => {
  return res.json({ pages: ALL_PAGES });
});

app.get('/permissions/roles', (_req, res) => {
  return res.json({ roles: Object.keys(DEFAULT_ROLE_PAGES) });
});

app.get('/permissions/roles/:role/pages', (req, res) => {
  const role = req.params.role;
  if (!DEFAULT_ROLE_PAGES[role]) {
    return res.status(404).json({ detail: { message: 'Role introuvable' } });
  }
  return res.json({ pages: rolePermissions[role] || DEFAULT_ROLE_PAGES[role] });
});

app.put('/permissions/roles/:role/pages', (req, res) => {
  const role = req.params.role;
  if (!DEFAULT_ROLE_PAGES[role]) {
    return res.status(404).json({ detail: { message: 'Role introuvable' } });
  }
  rolePermissions[role] = normalizeRolePages(role, req.body?.pages);
  if (role === 'admin') {
    USERS.admin.permissions = [...rolePermissions.admin];
  }
  return res.json({ pages: rolePermissions[role] });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend running!' });
});

// Backward-compatible aliases without /api prefix.
app.get('/membres', (req, res) => {
  res.json(membres);
});

app.get('/membres/', (req, res) => {
  res.json(membres);
});

app.get('/api/membres', (req, res) => {
  res.json(membres);
});

app.post('/api/membres', (req, res) => {
  const membre = {
    id: nextMembreId++,
    ...sanitizeMembre(req.body),
  };
  membres.push(membre);
  res.status(201).json(membre);
});

app.put('/api/membres/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = membres.findIndex((membre) => membre.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Membre introuvable' });
  }

  membres[index] = { id, ...sanitizeMembre(req.body, membres[index]) };
  return res.json(membres[index]);
});

app.delete('/api/membres/:id', (req, res) => {
  const id = Number(req.params.id);
  membres = membres.filter((membre) => membre.id !== id);
  paiements = paiements.filter((paiement) => paiement.membre_id !== id);
  res.status(204).send();
});

app.patch('/api/membres/:id/toggle', (req, res) => {
  const id = Number(req.params.id);
  const membre = membres.find((entry) => entry.id === id);

  if (!membre) {
    return res.status(404).json({ error: 'Membre introuvable' });
  }

  membre.statut = membre.statut === 'actif' ? 'inactif' : 'actif';
  return res.json(membre);
});

app.get('/api/paiements', (req, res) => {
  res.json(paiements.slice().sort((left, right) => right.date.localeCompare(left.date) || right.id - left.id));
});

app.get('/paiements', (req, res) => {
  res.json(paiements.slice().sort((left, right) => right.date.localeCompare(left.date) || right.id - left.id));
});

app.get('/paiements/', (req, res) => {
  res.json(paiements.slice().sort((left, right) => right.date.localeCompare(left.date) || right.id - left.id));
});

app.post('/api/paiements', (req, res) => {
  const membreId = Number(req.body.membre_id);
  const membre = membres.find((entry) => entry.id === membreId);

  if (!membre) {
    return res.status(404).json({ error: 'Membre introuvable' });
  }

  const paiement = {
    id: nextPaiementId++,
    membre_id: membreId,
    abonnement: req.body.abonnement ?? membre.abonnement,
    montant: Number(req.body.montant ?? 0),
    mode: req.body.mode ?? 'Espèces',
    date: req.body.date ?? today,
  };

  membre.abonnement = paiement.abonnement;
  membre.statut = 'actif';
  membre.date_inscription = membre.date_inscription ?? paiement.date;
  membre.date_expiration = addDays(paiement.date, DURATIONS[paiement.abonnement] ?? 30);

  paiements.unshift(paiement);
  return res.status(201).json(paiement);
});

app.get('/api/paiements/:id/recu', (req, res) => {
  const id = Number(req.params.id);
  const paiement = paiements.find((entry) => entry.id === id);

  if (!paiement) {
    return res.status(404).json({ error: 'Paiement introuvable' });
  }

  const membre = membres.find((entry) => entry.id === paiement.membre_id);
  const pdf = createReceiptPdf(paiement, membre ?? { prenom: 'Inconnu', nom: 'Inconnu' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="recu_${id}.pdf"`);
  return res.send(pdf);
});

app.get('/api/coaches', (req, res) => {
  res.json([
    { id: 1, name: 'Coach Ali', specialite: 'Cardio' },
    { id: 2, name: 'Coach Sara', specialite: 'Force' }
  ]);
});

app.get('/api/activites', (req, res) => {
  res.json([
    { id: 1, name: 'Yoga', type: 'Flexibilité', horaire: '09:00' },
    { id: 2, name: 'CrossFit', type: 'Force', horaire: '18:00' }
  ]);
});

// Error handling
app.use((err, req, res, _next) => {
  void _next;
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`✅ Backend démarré sur http://localhost:${PORT}`);
  console.log(`📍 Routes disponibles:`);
  console.log(`   GET http://localhost:${PORT}/api/health`);
  console.log(`   GET http://localhost:${PORT}/api/membres`);
  console.log(`   POST http://localhost:${PORT}/api/membres`);
  console.log(`   GET http://localhost:${PORT}/api/coaches`);
  console.log(`   GET http://localhost:${PORT}/api/activites`);
  console.log(`   GET http://localhost:${PORT}/api/paiements`);
});
