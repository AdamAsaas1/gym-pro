import { Smartphone, Monitor, QrCode, ShieldAlert, ExternalLink, KeyRound, FileText, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './Surveillance.css';

// The gym's recorder is a Dahua XVR (16 channels) on the gym network. The website runs on a remote
// server that cannot reach it, so live viewing goes through Dahua's own apps (P2P), linked from here.
const PLAY_STORE = 'https://play.google.com/store/search?q=DMSS%20Dahua&c=apps';
const APP_STORE = 'itms-apps://search.itunes.apple.com/WebObjects/MZSearch.woa/wa/search?media=software&term=DMSS';
const DAHUA_SITE = 'https://www.dahuasecurity.com';

const platform = () => {
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return 'desktop';
};

export default function Surveillance() {
  const { t } = useTranslation();
  const device = platform();

  return (
    <div className="page surv-page fade-in">
      <section className="members-hero">
        <div>
          <span className="members-hero__eyebrow">{t('titles.surveillance', 'Surveillance')}</span>
          <h2 className="members-hero__title">{t('surveillance.title', 'Caméras de la salle')}</h2>
          <p className="members-hero__subtitle">
            {t('surveillance.subtitle', 'Regardez les caméras en direct et les enregistrements depuis votre téléphone ou votre ordinateur, avec les applications officielles Dahua.')}
          </p>
        </div>
      </section>

      <section className="surv-grid">
        <article className={`surv-card${device !== 'desktop' ? ' is-suggested' : ''}`}>
          <div className="surv-card__icon"><Smartphone size={22} /></div>
          <h3>{t('surveillance.phoneTitle', 'Sur téléphone : application DMSS')}</h3>
          <p>{t('surveillance.phoneText', 'Ouvrez l’application DMSS pour voir les caméras en direct, revoir les enregistrements et recevoir les alertes.')}</p>
          <div className="surv-card__actions">
            {device !== 'ios' && (
              <a className="btn btn--primary" href={PLAY_STORE} target="_blank" rel="noreferrer">
                {t('surveillance.android', 'DMSS pour Android')} <ExternalLink size={15} />
              </a>
            )}
            {/* itms-apps:// only opens the App Store on an iPhone or iPad. */}
            {device === 'ios' && (
              <a className="btn btn--primary" href={APP_STORE}>
                {t('surveillance.ios', 'DMSS pour iPhone')} <ExternalLink size={15} />
              </a>
            )}
          </div>
          <p className="surv-card__hint">{t('surveillance.phoneHint', 'Sur iPhone, cherchez « DMSS » dans l’App Store (éditeur : Zhejiang Dahua Technology). Si l’application est déjà installée, ouvrez-la depuis l’écran d’accueil.')}</p>
        </article>

        <article className={`surv-card${device === 'desktop' ? ' is-suggested' : ''}`}>
          <div className="surv-card__icon"><Monitor size={22} /></div>
          <h3>{t('surveillance.pcTitle', 'Sur ordinateur : SmartPSS Lite')}</h3>
          <p>{t('surveillance.pcText', 'Le logiciel gratuit de Dahua pour Windows : mur de caméras, enregistrements et export des vidéos.')}</p>
          <div className="surv-card__actions">
            <a className="btn btn--ghost" href={DAHUA_SITE} target="_blank" rel="noreferrer">
              {t('surveillance.dahuaSite', 'Site officiel Dahua')} <ExternalLink size={15} />
            </a>
          </div>
          <p className="surv-card__hint">{t('surveillance.pcHint', 'Téléchargez SmartPSS Lite uniquement depuis le site officiel de Dahua.')}</p>
        </article>
      </section>

      <section className="surv-card surv-steps">
        <div className="surv-card__icon"><QrCode size={22} /></div>
        <h3>{t('surveillance.setupTitle', 'Première installation (une seule fois)')}</h3>
        <ol>
          <li>{t('surveillance.step1', 'Installez DMSS et créez un compte Dahua (ou utilisez l’application sans compte).')}</li>
          <li>{t('surveillance.step2', 'Touchez « + », puis « SN / Scanner » et scannez le QR code collé sous l’enregistreur, ou affiché sur l’écran de l’enregistreur dans Menu principal → Réseau → P2P.')}</li>
          <li>{t('surveillance.step3', 'Entrez le nom d’utilisateur et le mot de passe de l’enregistreur.')}</li>
          <li>{t('surveillance.step4', 'Les 16 voies s’affichent : touchez une caméra pour la voir en plein écran.')}</li>
        </ol>
        <p className="surv-card__hint">{t('surveillance.setupHint', 'Le P2P doit être activé sur l’enregistreur (Menu principal → Réseau → P2P → Activer).')}</p>
      </section>

      <section className="surv-card surv-rules">
        <div className="surv-card__icon surv-card__icon--warn"><ShieldAlert size={22} /></div>
        <h3>{t('surveillance.rulesTitle', 'Sécurité et obligations')}</h3>
        <ul>
          <li><KeyRound size={16} /> {t('surveillance.rule1', 'Utilisez un mot de passe fort pour l’enregistreur, différent de vos autres mots de passe, et ne le partagez pas.')}</li>
          <li><FileText size={16} /> {t('surveillance.rule2', 'Loi 09-08 : la vidéosurveillance doit être déclarée à la CNDP, avec un panneau « Lieu placé sous vidéosurveillance » visible à l’entrée.')}</li>
          <li><EyeOff size={16} /> {t('surveillance.rule3', 'Aucune caméra dans les vestiaires, les douches ou les toilettes.')}</li>
        </ul>
      </section>
    </div>
  );
}
