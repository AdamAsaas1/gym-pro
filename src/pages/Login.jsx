import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const normalizedUsername = username.trim().toLowerCase()
      const normalizedPassword = password.trim()
      await login({ username: normalizedUsername, password: normalizedPassword })
      navigate('/', { replace: true })
    } catch (err) {
      const apiMessage = err?.response?.data?.detail?.message
      setError(apiMessage || t('login.error.failed', 'Connexion impossible. Vérifiez vos identifiants.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-shell">
        <section className="login-showcase" aria-label="ASAAS Pro">
          <h1 className="login-showcase__title">{t('login.title', 'Pilotez votre salle en toute simplicité.')}</h1>
          <p className="login-showcase__text">{t('login.subtitle', 'Accès rapide, propre et sécurisé.')}</p>
        </section>

        <section className="login-card" aria-label={t('login.welcome', 'Bienvenue')}>
          <div className="login-pass__strip">
            <span>ASAAS Pro</span>
            <span>{t('login.staffPass', 'Accès personnel')}</span>
          </div>
          <div className="login-card__head">
            <img src="/logo_asaas.jpg" alt="" className="login-card__logo" />
            <div>
              <h2>{t('login.welcome', 'Bienvenue')}</h2>
              <p>{t('login.instruction', 'Connectez-vous pour accéder au tableau de bord.')}</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="login-form">
            <label htmlFor="username">{t('login.username', "Nom d'utilisateur")}</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder={t('login.placeholder.username', 'Ex: admin')}
              required
            />

            <label htmlFor="password">{t('login.password', 'Mot de passe')}</label>
            <div className="login-password-field">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder={t('login.placeholder.password', 'Entrez votre mot de passe')}
                required
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={
                  showPassword
                    ? t('login.hidePassword', 'Masquer le mot de passe')
                    : t('login.showPassword', 'Afficher le mot de passe')
                }
                aria-pressed={showPassword}
                title={
                  showPassword
                    ? t('login.hidePassword', 'Masquer le mot de passe')
                    : t('login.showPassword', 'Afficher le mot de passe')
                }
              >
                {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>

            {error && <div className="login-error" role="alert">{error}</div>}

            <div className="login-perf" aria-hidden="true" />
            <button type="submit" disabled={submitting}>
              {submitting ? t('login.submitting', 'Connexion...') : t('login.submit', 'Se connecter')}
            </button>
          </form>

          <p className="login-footnote">{t('login.restrictedAccess', 'Accès réservé au personnel autorisé.')}</p>
        </section>
      </div>
    </div>
  )
}
