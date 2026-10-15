/* What the public application forms may send in a text field.

   Becoming an agent or a delivery partner starts with a form anyone on the
   internet can post. Its fields were checked for being present and nothing
   more: a "name" a megabyte long was stored as it came and then drawn on
   the office's approval screen, and a field sent twice (which arrives as a
   list, not text) threw further down and answered 500.

   The limits are far above anything a real person types. */

/**
 * @param {object} body    the submitted fields
 * @param {Record<string, number>} limits  field name → longest text allowed
 * @returns {string|null} what is wrong, in words the form can show; null when nothing is
 */
export const checkTextFields = (body, limits) => {
  for (const [field, max] of Object.entries(limits)) {
    const value = body?.[field];

    if (value === undefined || value === null || value === "") continue;

    if (typeof value !== "string") return `${field} must be text`;
    if (value.length > max) return `${field} is too long (${max} characters at most)`;
  }

  return null;
};

// Shared by both applications: a person, their address, their bank
export const PERSON_FIELD_LIMITS = {
  name: 100,
  email: 254,
  phone: 20,
  password: 128,
  address: 500,
  state: 60,
  city: 100,
  street: 200,
  pincode: 12, // six digits, with room for a stray space or two
  idType: 30,
  idNumber: 40,
  accountHolderName: 100,
  accountNumber: 34,
  ifscCode: 20,
  bankName: 100,
};
