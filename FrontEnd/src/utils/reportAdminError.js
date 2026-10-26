// Axios errors contain request headers and bodies, including credentials and
// customer data. Keep useful diagnostics without logging those objects.
export default function reportAdminError(context, error) {
  console.error(context, {
    status: Number.isInteger(error?.response?.status) ? error.response.status : null,
    code: ["ERR_NETWORK", "ECONNABORTED", "ETIMEDOUT", "ERR_CANCELED"].includes(error?.code) ? error.code : "REQUEST_FAILED",
  });
}
