import CanvasDashboardFull from "./CanvasDashboardFull";

const DashboardsPage = ({ selectedOrg, token, api, getApiErrorMessage }) => (
  <CanvasDashboardFull
    selectedOrg={selectedOrg}
    token={token}
    api={api}
    getApiErrorMessage={getApiErrorMessage}
  />
);

export default DashboardsPage;
