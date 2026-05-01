import urllib.request, json, datetime

BASE = 'http://localhost:8000'

def post(path, data):
    body = json.dumps(data).encode()
    req  = urllib.request.Request(f'{BASE}{path}', data=body, headers={'Content-Type':'application/json'}, method='POST')
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read())

today = datetime.date.today()
def add(n): return str(today + datetime.timedelta(days=n))
def sub(n): return str(today - datetime.timedelta(days=n))

membres = [
  {'nom':'BENALI',     'prenom':'Mohamed', 'genre':'homme',  'activite':'musculation','abonnement':'mensuel',     'statut':'actif',   'telephone':'0612-345-678','email':'m.benali@email.com',   'date_naissance':'1992-05-14','date_inscription':sub(45), 'date_expiration':add(15)},
  {'nom':'EL IDRISSI', 'prenom':'Karim',   'genre':'homme',  'activite':'kickboxing', 'abonnement':'trimestriel', 'statut':'actif',   'telephone':'0623-456-789','email':'k.elidrissi@email.com','date_naissance':'1995-08-22','date_inscription':sub(80), 'date_expiration':add(10)},
  {'nom':'FATMI',      'prenom':'Nadia',   'genre':'femme',  'activite':'aerobic',    'abonnement':'mensuel',     'statut':'actif',   'telephone':'0634-567-890','email':'n.fatmi@email.com',    'date_naissance':'1990-03-18','date_inscription':sub(25), 'date_expiration':add(5)},
  {'nom':'BRAHIM',     'prenom':'Youssef', 'genre':'enfant', 'activite':'karate',     'abonnement':'mensuel',     'statut':'actif',   'telephone':'0645-678-901','email':'',                     'date_naissance':'2015-11-30','date_inscription':sub(15), 'date_expiration':add(15)},
  {'nom':'MANSOURI',   'prenom':'Said',    'genre':'homme',  'activite':'musculation','abonnement':'annuel',      'statut':'actif',   'telephone':'0656-789-012','email':'s.mansouri@email.com', 'date_naissance':'1988-07-04','date_inscription':sub(200),'date_expiration':add(165)},
  {'nom':'CHRAIBI',    'prenom':'Leila',   'genre':'femme',  'activite':'aerobic',    'abonnement':'trimestriel', 'statut':'actif',   'telephone':'0667-890-123','email':'l.chraibi@email.com',  'date_naissance':'1998-12-09','date_inscription':sub(60), 'date_expiration':add(30)},
  {'nom':'BERRADA',    'prenom':'Hamid',   'genre':'homme',  'activite':'kickboxing', 'abonnement':'mensuel',     'statut':'inactif', 'telephone':'0678-901-234','email':'h.berrada@email.com',  'date_naissance':'1994-02-25','date_inscription':sub(60), 'date_expiration':sub(30)},
  {'nom':'AMRANI',     'prenom':'Zineb',   'genre':'femme',  'activite':'aerobic',    'abonnement':'mensuel',     'statut':'actif',   'telephone':'0689-012-345','email':'z.amrani@email.com',   'date_naissance':'2000-06-17','date_inscription':sub(10), 'date_expiration':add(20)},
  {'nom':'RHANI',      'prenom':'Adam',    'genre':'enfant', 'activite':'karate',     'abonnement':'trimestriel', 'statut':'actif',   'telephone':'0690-123-456','email':'',                     'date_naissance':'2013-09-12','date_inscription':sub(50), 'date_expiration':add(40)},
  {'nom':'OUALI',      'prenom':'Omar',    'genre':'homme',  'activite':'musculation','abonnement':'mensuel',     'statut':'actif',   'telephone':'0601-234-567','email':'o.ouali@email.com',    'date_naissance':'1997-04-08','date_inscription':sub(8),  'date_expiration':add(22)},
  {'nom':'TAHIRI',     'prenom':'Malak',   'genre':'femme',  'activite':'aerobic',    'abonnement':'annuel',      'statut':'actif',   'telephone':'0611-234-567','email':'m.tahiri@email.com',   'date_naissance':'1993-01-29','date_inscription':sub(120),'date_expiration':add(245)},
  {'nom':'SOUSSI',     'prenom':'Rayan',   'genre':'enfant', 'activite':'karate',     'abonnement':'mensuel',     'statut':'actif',   'telephone':'0622-345-678','email':'',                     'date_naissance':'2014-07-03','date_inscription':sub(20), 'date_expiration':add(10)},
  {'nom':'ZAHRAOUI',   'prenom':'Khalid',  'genre':'homme',  'activite':'musculation','abonnement':'trimestriel', 'statut':'actif',   'telephone':'0633-456-789','email':'k.zahraoui@email.com', 'date_naissance':'1991-10-11','date_inscription':sub(55), 'date_expiration':add(35)},
  {'nom':'HAMDOUNE',   'prenom':'Imane',   'genre':'femme',  'activite':'aerobic',    'abonnement':'mensuel',     'statut':'actif',   'telephone':'0644-567-890','email':'i.hamdoune@email.com', 'date_naissance':'1996-04-22','date_inscription':sub(5),  'date_expiration':add(25)},
  {'nom':'NASSIRI',    'prenom':'Hamza',   'genre':'enfant', 'activite':'karate',     'abonnement':'mensuel',     'statut':'inactif', 'telephone':'0655-678-901','email':'',                     'date_naissance':'2012-08-15','date_inscription':sub(40), 'date_expiration':sub(10)},
]

for m in membres:
    r = post('/membres/', m)
    print(f"  OK -> {r['prenom']} {r['nom']} (id={r['id']})")

print(f"\n{len(membres)} membres inseres avec succes !")
