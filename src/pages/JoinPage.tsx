import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeading } from '../components/bits'
import Icon from '../components/Icon'
import { joinProject } from '../data/projects'
import { useStore } from '../data/store'
import { useUI } from '../hooks/useUI'

// Opened from an invite link: /join/{owner}/{projectId}/{code}. Signing in comes first if needed.
export default function JoinPage() {
  const { uid, profile } = useStore()
  const { toast } = useUI()
  const navigate = useNavigate()
  const { owner = '', projectId = '', code = '' } = useParams()
  const [failed, setFailed] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    joinProject(uid, profile.name, owner, projectId, code).then((result) => {
      if (result === 'invalid') return setFailed(true)
      if (result === 'joined') toast('You’re in. Welcome to the project.')
      navigate(`/projects?project=${projectId}`, { replace: true })
    })
  }, [uid, profile.name, owner, projectId, code, toast, navigate])

  return (
    <>
      <PageHeading eyebrow="INVITATION" title={failed ? 'This link doesn’t work any more.' : 'Joining the project…'}
        sub={failed ? 'No harm done.' : 'Just a moment.'}
      />
      {failed && (
        <section className="panel">
          <div className="empty">
            <Icon name="link" />
            <p>The invite link may be old, or sharing has been turned off.</p>
            <p className="tiny">Ask for a fresh link and try again.</p>
          </div>
          <button className="btn" onClick={() => navigate('/', { replace: true })}>
            Back to my day
          </button>
        </section>
      )}
    </>
  )
}
