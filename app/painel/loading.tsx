export default function PainelLoading() {
  return (
    <div className="panel-adaptive-loading" aria-label="Carregando painel">
      <div className="panel-adaptive-loading-heading">
        <span />
        <span />
      </div>

      <div className="panel-adaptive-loading-metrics">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="panel-adaptive-loading-card">
            <span />
            <strong />
            <small />
          </div>
        ))}
      </div>

      <div className="panel-adaptive-loading-content">
        <div className="panel-adaptive-loading-table">
          <span />
          {Array.from({ length: 5 }).map((_, index) => <i key={index} />)}
        </div>
        <div className="panel-adaptive-loading-side">
          <span />
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  )
}