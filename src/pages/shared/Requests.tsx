import {
  EarlyCheckoutRequestsCard,
  CoverTimeRequestsCard,
  OvertimeRequestsCard,
  LeaveRequestsCard,
} from '../../components/RequestCards';

export function RequestsPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Requests</h1>
          <p className="page-header-sub">
            Review and approve employee requests — leave, early checkout, management overtime, and cover time.
          </p>
        </div>
      </div>

      <LeaveRequestsCard />
      <EarlyCheckoutRequestsCard />
      <OvertimeRequestsCard />
      <CoverTimeRequestsCard />
    </>
  );
}
