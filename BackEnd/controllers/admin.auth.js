import jwt from "jsonwebtoken";

export const adminLogin = async (req, res) => {
  const { email, password } = req.body;

  if (
    email !== process.env.ADMIN_LOGIN_EMAIL ||
    password !== process.env.ADMIN_LOGIN_PASSWORD
  ) {
    return res.status(401).json({
      success: false,
      message: "Invalid admin credentials",
    });
  }

  const token = jwt.sign(
    {
      role: "ADMIN",
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  res.json({
    success: true,
    token,
  });
};
