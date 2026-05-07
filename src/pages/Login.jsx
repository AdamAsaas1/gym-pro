import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
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
      setError(apiMessage || 'Connexion impossible. Verifiez vos identifiants.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-shell">
        <section className="login-showcase" aria-label="Presentation ASAAS Pro">
          <div className="login-showcase__glow" aria-hidden="true" />
          <img src="/logo_asaas.jpg" alt="ASAAS Pro" className="login-showcase__logo" />
          <p className="login-showcase__eyebrow">{t('login.system', 'ASAAS PRO SYSTEM')}</p>
          <h1 className="login-showcase__title">{t('login.title', 'Pilotez votre salle en toute simplicite.')}</h1>
          <p className="login-showcase__text">{t('login.subtitle', 'Acces rapide, propre et securise.')}</p>
        </section>

        <section className="login-card" aria-label="Formulaire de connexion">
          <div className="login-card__head">
            <p className="login-card__tag">{t('login.secureConnection', 'Connexion securisee')}</p>
            <h2>{t('login.welcome', 'Bienvenue')}</h2>
            <p>{t('login.instruction', 'Connecte-toi pour acceder au tableau de bord.')}</p>
          </div>

          <form onSubmit={onSubmit} className="login-form">
            <label htmlFor="username">Nom d'utilisateur</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="Ex: admin"
              required
            />

            <label htmlFor="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Entrez votre mot de passe"
              required
            />

            <p className="login-footnote" style={{ marginTop: 4 }}>
              Comptes de test: superadmin / superadmin123 ou admin / admin123
            </p>

            {error && <div className="login-error">{error}</div>}

            <button type="submit" disabled={submitting}>
              {submitting ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <p className="login-footnote">Acces reserve au personnel autorise.</p>
        </section>
      </div>
    </div>
  )
}
