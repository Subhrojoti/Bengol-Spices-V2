/* =====================================================================
   LIVE EVENTS FOR THE ADMIN AND EMPLOYEE PANELS

   A one-way stream from the server to each open panel (Server-Sent
   Events over a plain HTTP response), so a new order appears on the
   admin's screen the moment it is placed, with no page refresh.

   Each event names the employee permission it is for; admins get
   everything. Clients live in memory — right for one server process.
   ===================================================================== */

const clients = new Set();

// nginx closes an idle proxied connection after 60s; a comment line every
// 25s keeps the stream open and is ignored by the browser
const HEARTBEAT_MS = 25 * 1000;

/* 🔒 Who is listening is checked when a stream opens, and a stream then
   stays open for as long as the panel does: all day, or for as long as
   anything else cares to hold the connection. Nothing looked again. An
   employee who was deactivated, or whose permission was taken away, went on
   being sent every new order and every cash payment for as long as they
   kept the connection, and so did a sign-in that had since run out.

   So no stream lives longer than this. The panel reconnects by itself
   within a second (hooks/useLiveOrders.jsx), and reconnecting goes through
   the same sign-in check as any other request: the account must still be
   active, the sign-in still valid, and the permissions are read afresh. */
const MAX_STREAM_MS = Number(process.env.EVENT_STREAM_MAX_MS) || 30 * 60 * 1000;

const mayReceive = (user, permission) =>
  user.role === "ADMIN" ||
  (user.role === "EMPLOYEE" && user.permissions?.[permission] === true);

/** Route handler: keeps the response open and registers the panel. */
export const openEventStream = (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // nginx: pass each event through at once
  });
  res.write("event: ready\ndata: {}\n\n");

  const client = { res, user: req.user };
  clients.add(client);

  /* Everything that ends a stream goes through here, and takes it off the
     list first: writing to a response that has already ended is an error
     nothing would be listening for. */
  let open = true;
  const drop = () => {
    if (!open) return;
    open = false;
    clearInterval(heartbeat);
    clearTimeout(recycle);
    clients.delete(client);
  };

  const heartbeat = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      drop();
    }
  }, HEARTBEAT_MS);

  const recycle = setTimeout(() => {
    drop();
    try {
      res.end();
    } catch {
      /* already gone */
    }
  }, MAX_STREAM_MS);
  recycle.unref();

  req.on("close", drop);
};

/**
 * Sends an event to every connected panel allowed to see it. Never throws:
 * a notification must not be able to fail the action that caused it.
 *
 * @param {string} type        e.g. "ORDER_PLACED"
 * @param {object} payload     data for the panel
 * @param {string} permission  employee permission that unlocks this event
 */
export const publish = (type, payload, permission) => {
  const message = `event: ${type}\ndata: ${JSON.stringify({
    type,
    at: new Date().toISOString(),
    ...payload,
  })}\n\n`;

  for (const client of clients) {
    if (!mayReceive(client.user, permission)) continue;
    try {
      client.res.write(message);
    } catch {
      clients.delete(client);
    }
  }
};

/**
 * Ends every open stream. For shutdown: these responses never finish on
 * their own, and the server will not stop while one is still open. Each
 * panel reconnects by itself once the server is back.
 */
export const closeEventStreams = () => {
  for (const client of clients) {
    try {
      client.res.end();
    } catch {
      /* already gone */
    }
  }
  clients.clear();
};
