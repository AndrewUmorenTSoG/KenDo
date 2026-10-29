import logo from '../../public/kendo-logo.svg?raw'

export default function Brand({ animated = false }: { animated?: boolean }) {
  return (
    <div className={`kendo-brand${animated ? ' kendo-brand-animated' : ''}`} aria-label="KenDo">
      <span className="kendo-logo" aria-hidden="true" dangerouslySetInnerHTML={{ __html: logo }} />
      <span className="kendo-wordmark" aria-hidden="true">
        Ken<span>Do</span>
      </span>
    </div>
  )
}
