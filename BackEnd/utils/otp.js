export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// TEMP SMS (replace with gateway later)
export const sendOtpSMS = async (phone, otp) => {
  console.log(`📲 OTP for ${phone} is: ${otp}`);
};
