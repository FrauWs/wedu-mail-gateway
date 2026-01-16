// server.js
import express from "express";
import { ImapFlow } from "imapflow";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("WEDU Mail Gateway läuft");
});

app.get("/icloud-test", async (req, res) => {
  const user = process.env.ICLOUD_IMAP_USER;
  const pass = process.env.ICLOUD_IMAP_PASS;

  if (!user || !pass) {
    return res.status(500).json({
      ok: false,
      error: "iCloud Zugangsdaten fehlen",
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

      for await (const msg of
