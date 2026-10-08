import crypto from "crypto";

/* Nothing calls this yet. It is left correct rather than removed so that
   whoever wires up the SMS gateway does not start from a one-time code
   built on Math.random, which is predictable enough to guess. */
export const generateOTP = () => String(crypto.randomInt(100000, 1000000));

// TEMP SMS (replace with gateway later)
export const sendOtpSMS = async (phone, otp) => {
  console.log(`📲 OTP for ${phone} is: ${otp}`);
};
