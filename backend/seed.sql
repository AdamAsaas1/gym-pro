-- Script d'insertion de données de test pour gym_pro
-- Exécuter avec: psql -U postgres -d gym_pro -f seed.sql

INSERT INTO membres (nom, prenom, genre, activite, abonnement, statut, telephone, email, date_naissance, date_inscription, date_expiration) VALUES
('BENALI',     'Mohamed', 'homme',  'musculation', 'mensuel',     'actif',   '0612-345-678', 'm.benali@email.com',    '1992-05-14', CURRENT_DATE - 45,  CURRENT_DATE + 15),
('EL IDRISSI', 'Karim',   'homme',  'kickboxing',  'trimestriel', 'actif',   '0623-456-789', 'k.elidrissi@email.com', '1995-08-22', CURRENT_DATE - 80,  CURRENT_DATE + 10),
('FATMI',      'Nadia',   'femme',  'aerobic',     'mensuel',     'actif',   '0634-567-890', 'n.fatmi@email.com',     '1990-03-18', CURRENT_DATE - 25,  CURRENT_DATE + 5),
('BRAHIM',     'Youssef', 'enfant', 'karate',      'mensuel',     'actif',   '0645-678-901', '',                      '2015-11-30', CURRENT_DATE - 15,  CURRENT_DATE + 15),
('MANSOURI',   'Said',    'homme',  'musculation', 'annuel',      'actif',   '0656-789-012', 's.mansouri@email.com',  '1988-07-04', CURRENT_DATE - 200, CURRENT_DATE + 165),
('CHRAIBI',    'Leila',   'femme',  'aerobic',     'trimestriel', 'actif',   '0667-890-123', 'l.chraibi@email.com',   '1998-12-09', CURRENT_DATE - 60,  CURRENT_DATE + 30),
('BERRADA',    'Hamid',   'homme',  'kickboxing',  'mensuel',     'inactif', '0678-901-234', 'h.berrada@email.com',   '1994-02-25', CURRENT_DATE - 60,  CURRENT_DATE - 30),
('AMRANI',     'Zineb',   'femme',  'aerobic',     'mensuel',     'actif',   '0689-012-345', 'z.amrani@email.com',    '2000-06-17', CURRENT_DATE - 10,  CURRENT_DATE + 20),
('RHANI',      'Adam',    'enfant', 'karate',      'trimestriel', 'actif',   '0690-123-456', '',                      '2013-09-12', CURRENT_DATE - 50,  CURRENT_DATE + 40),
('OUALI',      'Omar',    'homme',  'musculation', 'mensuel',     'actif',   '0601-234-567', 'o.ouali@email.com',     '1997-04-08', CURRENT_DATE - 8,   CURRENT_DATE + 22),
('TAHIRI',     'Malak',   'femme',  'aerobic',     'annuel',      'actif',   '0611-234-567', 'm.tahiri@email.com',    '1993-01-29', CURRENT_DATE - 120, CURRENT_DATE + 245),
('SOUSSI',     'Rayan',   'enfant', 'karate',      'mensuel',     'actif',   '0622-345-678', '',                      '2014-07-03', CURRENT_DATE - 20,  CURRENT_DATE + 10),
('ZAHRAOUI',   'Khalid',  'homme',  'musculation', 'trimestriel', 'actif',   '0633-456-789', 'k.zahraoui@email.com',  '1991-10-11', CURRENT_DATE - 55,  CURRENT_DATE + 35),
('HAMDOUNE',   'Imane',   'femme',  'aerobic',     'mensuel',     'actif',   '0644-567-890', 'i.hamdoune@email.com',  '1996-04-22', CURRENT_DATE - 5,   CURRENT_DATE + 25),
('NASSIRI',    'Hamza',   'enfant', 'karate',      'mensuel',     'inactif', '0655-678-901', '',                      '2012-08-15', CURRENT_DATE - 40,  CURRENT_DATE - 10);

SELECT COUNT(*) AS total_membres FROM membres;
