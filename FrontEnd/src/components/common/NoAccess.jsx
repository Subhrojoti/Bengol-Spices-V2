import { Box, Typography, Paper, Link } from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";

const NoAccess = () => {
  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
      <Paper
        elevation={2}
        sx={{
          p: 5,
          maxWidth: 550,
          textAlign: "center",
          borderRadius: 3,
        }}>
        <Typography variant="h5" fontWeight={600} mb={2}>
          Access Restricted
        </Typography>

        <Typography variant="body1" color="text.secondary">
          You currently do not have permission to view this page.
        </Typography>

        <Typography variant="body2" color="text.secondary">
          Please contact the administrator to request access.
        </Typography>

        <Box
          mt={3}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
          }}>
          <EmailIcon fontSize="small" color="primary" />

          <Link
            href="mailto:admin@bengolspices.com"
            underline="hover"
            sx={{ fontWeight: 500 }}>
            admin@bengolspices.com
          </Link>
        </Box>
      </Paper>
    </Box>
  );
};

export default NoAccess;
