// server.js
import express from "express";
import { ImapFlow } from "imapflow";

const app = express();
const PORT = process.env.PORT || 3000;

// Damit Browser/Proxies nicht "alte" Antworten cachen
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// Eine feste Versionsnummer, damit du im Browser sofort siehst,
// ob Render wirklich den neuen Code ausliefert:
const GATEWAY_VERSION = "2026-01-16-v2";

app.get("/", (req, res) => {
  res.send(`WEDU Mail Gateway läuft (${GATEWAY_VERSION})`);
});

app.get("/version", (req, res) => {
  res.json({
    ok: true,
    version: GATEWAY_VERSION,
    hasUser: Boolean(process.env.ICLOUD_IMAP_USER),
    hasPass: Boolean(process.env.ICLOUD_IMAP_PASS),
  });
});

app.get("/icloud-test", async (req, res) => {
  const user = process.env.ICLOUD_IMAP_USER;
  const pass = process.env.ICLOUD_IMAP_PASS;

  if (!user || !pass) {
    return res.status(500).json({
      ok: false,
      error: "iCloud Zugangsdaten fehlen",
      version: GATEWAY_VERSION,
    });
  }

  const client = new ImapFlow({
    host: "imap.mail.me.com",
    port: 993,
    secure: true,
    auth: { user, pass },
  });

  try {
    await client.connect();

    const lock = await client.getMailboxLock("INBOX");
    try {
      const status = await client.status("INBOX", { messages: true });
      const total = status.messages || 0;

      const fromSeq = Math.max(1, total - 9);
      const range = `${fromSeq}:${total}`;

      const items = [];

      for await (const msg of client.fetch(range, {
        uid: true,
        envelope: true,
        flags: true,
        internalDate: true,
      })) {
        // flags ist bei ImapFlow i. d. R. ein Set -> .has() (NICHT includes)
        const flags = msg.flags;
        const seen =
          flags && typeof flags.has === "function" ? flags.has("\\Seen") : false;

        const fromObj = msg.envelope?.from?.[0];
        const from =
          fromObj?.name && fromObj?.address
            ? `${fromObj.name} <${fromObj.address}>`
            : fromObj?.address || fromObj?.name || "";

        items.push({
          uid: msg.uid ?? null,
          subject: msg.envelope?.subject || "",
          from,
          date: msg.internalDate ? msg.internalDate.toISOString() : "",
          seen,
        });
      }

      return res.json({
        ok: true,
        version: GATEWAY_VERSION,
        totalMessages: total,
        items,
      });
    } finally {
      lock.release();
    }
  } catch (e) {
    return res.status(500).json({
      ok: false,
      version: GATEWAY_VERSION,
      error: String(e?.message || e),
    });
  } finally {
    try {
      await client.logout();
    } catch {}
  }
});

app.listen(PORT, () => {
  console.log(`Mail-Gateway läuft (${GATEWAY_VERSION}) auf Port ${PORT}`);
});
