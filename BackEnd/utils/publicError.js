/* What a caller may be told about something that went wrong.

   Several routes raise errors on purpose, with wording written for the
   person using the app ("Document is required", "You are not authorized to
   sell in this location"), and answer with that wording. The same answer
   was given for every other error too: a slip in the code ("Cannot read
   properties of null"), the database refusing a record ("E11000 duplicate
   key error collection: …"), the file store's own reply. That text is about
   the inside of the server and is of no use to the person reading it.

   An error raised on purpose is a plain Error. Anything else gets the
   fallback, and is for the log. */

/**
 * @param {unknown} error
 * @param {string} fallback  what to say when the error's own text is not for the caller
 * @returns {string}
 */
export const publicMessage = (error, fallback) => {
  // The record's own rules refused a field (a pincode that is not six digits, say)
  if (error?.name === "ValidationError") {
    const first = Object.values(error.errors || {})[0];
    const field = typeof first?.path === "string" ? first.path.split(".").pop() : null;
    return field ? `${field} is not valid` : fallback;
  }

  const raisedOnPurpose =
    error instanceof Error &&
    error.name === "Error" &&
    error.code === undefined &&
    error.http_code === undefined &&
    typeof error.message === "string" &&
    error.message.length > 0 &&
    error.message.length <= 200;

  return raisedOnPurpose ? error.message : fallback;
};
