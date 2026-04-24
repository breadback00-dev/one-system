export default function ReactivationLoading() {
  return (
    <div className="page-reactivation">
      <div className="pulse-bar">
        <div className="pulse-cell-skeleton" />
        <div className="pulse-cell-skeleton" />
        <div className="pulse-cell-skeleton" />
        <div className="pulse-cell-skeleton" />
      </div>
      <div className="grid-2">
        <div className="card-skeleton" />
        <div className="card-skeleton" />
      </div>
      <div className="section-label" style={{ marginTop: "24px" }}>Action Queue</div>
      <div className="card-skeleton" style={{ height: "220px" }} />
    </div>
  );
}
