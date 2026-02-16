// Khora Escrow Bot
//
// Matrix appservice bot that manages encrypted key escrow for Khora users.
// Runs on hyphae.social, holds encrypted key bundles in private rooms.
//
// Commands:
//   Self-service (anyone via DM):
//     !self-recover @old_account:server  — Start recovery, bot asks for phrase
//     (send phrase as next message)      — Bot verifies hash, invites into escrow room
//
//   Admin commands:
//     !recover @old:server @new:server   — Bypass phrase, invite new account
//     !escrow-status @user:server        — Check if escrow room exists
//     !escrow-help                       — Show help

const { Cli, Bridge, AppServiceRegistration } = require('matrix-appservice-bridge');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

// ─── Database ───

const db = new Database(path.join(__dirname, 'escrow.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS escrow_rooms (
    user_id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS recovery_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    old_user_id TEXT NOT NULL,
    new_user_id TEXT NOT NULL,
    method TEXT NOT NULL,
    performed_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

const upsertEscrowRoom = db.prepare(
  `INSERT INTO escrow_rooms (user_id, room_id) VALUES (?, ?)
   ON CONFLICT(user_id) DO UPDATE SET room_id = excluded.room_id`
);
const getEscrowRoom = db.prepare(
  `SELECT room_id FROM escrow_rooms WHERE user_id = ?`
);
const logRecovery = db.prepare(
  `INSERT INTO recovery_log (old_user_id, new_user_id, method) VALUES (?, ?, ?)`
);

// ─── Config ───

const ADMIN_USERS = [
  '@michael:hyphae.social',
];

const EVENT_ESCROW_VERIFY = 'social.khora.escrow.verify';

// Pending self-recovery: new_user_id -> { oldUserId, escrowRoomId, timeout }
const pendingRecoveries = new Map();

// ─── Bridge ───

new Cli({
  registrationPath: path.join(__dirname, 'registration.yaml'),
  generateRegistration(reg, callback) {
    reg.setId(AppServiceRegistration.generateToken());
    reg.setHomeserverToken(AppServiceRegistration.generateToken());
    reg.setAppServiceToken(AppServiceRegistration.generateToken());
    reg.setSenderLocalpart('khora-escrow');
    reg.addRegexPattern('users', '@khora-escrow:hyphae\\.social', true);
    callback(reg);
  },
  bridgeConfig: { schema: {} },
  run(port, config) {
    const bridge = new Bridge({
      homeserverUrl: 'http://localhost:8008',
      domain: 'hyphae.social',
      registration: path.join(__dirname, 'registration.yaml'),
      controller: {
        onUserQuery() { return {}; },

        async onEvent(request, context) {
          const event = request.getData();
          const intent = bridge.getIntent();

          // ── Auto-accept invites ──
          if (event.type === 'm.room.member'
              && event.content?.membership === 'invite'
              && event.state_key === '@khora-escrow:hyphae.social') {
            console.log(`[invite] ${event.room_id} from ${event.sender}`);
            try {
              await intent.join(event.room_id);
              upsertEscrowRoom.run(event.sender, event.room_id);
              console.log(`[escrow] mapped ${event.sender} -> ${event.room_id}`);
            } catch (err) {
              console.error(`[error] join failed ${event.room_id}:`, err.message);
            }
            return;
          }

          // ── Handle messages ──
          if (event.type !== 'm.room.message' || event.content?.msgtype !== 'm.text') return;

          const sender = event.sender;
          const body = (event.content.body || '').trim();
          const roomId = event.room_id;

          // Self-service recovery: step 1
          const selfRecoverMatch = body.match(/^!self-recover\s+(@\S+:\S+)$/);
          if (selfRecoverMatch) {
            await handleSelfRecoverRequest(intent, roomId, sender, selfRecoverMatch[1]);
            return;
          }

          // Self-service recovery: step 2 (phrase verification)
          if (pendingRecoveries.has(sender)) {
            await handlePhraseVerification(intent, roomId, sender, body);
            return;
          }

          // Admin commands
          if (ADMIN_USERS.includes(sender)) {
            // Admin recovery (bypass phrase)
            const recoverMatch = body.match(/^!recover\s+(@\S+:\S+)\s+(@\S+:\S+)$/);
            if (recoverMatch) {
              await handleAdminRecovery(intent, roomId, sender, recoverMatch[1], recoverMatch[2]);
              return;
            }

            // Status check
            const statusMatch = body.match(/^!escrow-status\s+(@\S+:\S+)$/);
            if (statusMatch) {
              const row = getEscrowRoom.get(statusMatch[1]);
              await intent.sendText(roomId, row
                ? `Escrow room exists for ${statusMatch[1]}: ${row.room_id}`
                : `No escrow room found for ${statusMatch[1]}`
              );
              return;
            }

            if (body === '!escrow-help') {
              await intent.sendText(roomId, [
                'Khora Escrow Bot',
                '',
                'Self-service (anyone):',
                '  !self-recover @old_account:server',
                '  -> Bot asks for recovery phrase, verifies, grants access',
                '',
                'Admin commands:',
                '  !recover @old:server @new:server',
                '  -> Bypass phrase check, invite new account (they still need phrase to decrypt)',
                '',
                '  !escrow-status @user:server',
                '  -> Check if escrow room exists',
              ].join('\n'));
              return;
            }
          }
        },
      },
    });

    // ─── Recovery handlers ───

    async function handleSelfRecoverRequest(intent, roomId, newUserId, oldUserId) {
      const row = getEscrowRoom.get(oldUserId);
      if (!row) {
        await intent.sendText(roomId,
          `No safety deposit box found for ${oldUserId}. Contact a Khora admin.`
        );
        return;
      }

      const timeout = setTimeout(() => {
        pendingRecoveries.delete(newUserId);
      }, 5 * 60 * 1000); // 5 min timeout

      pendingRecoveries.set(newUserId, {
        oldUserId,
        escrowRoomId: row.room_id,
        timeout,
      });

      await intent.sendText(roomId,
        `Found a safety deposit box for ${oldUserId}. ` +
        `Send your 12-word recovery phrase to verify. You have 5 minutes.`
      );
    }

    async function handlePhraseVerification(intent, roomId, newUserId, phrase) {
      const pending = pendingRecoveries.get(newUserId);
      if (!pending) return;

      try {
        // Read verification hash from escrow room state
        const stateEvent = await intent.getStateEvent(
          pending.escrowRoomId, EVENT_ESCROW_VERIFY, ''
        );

        if (!stateEvent?.phrase_hash) {
          await intent.sendText(roomId,
            'Escrow room missing verification data. Contact a Khora admin.'
          );
          clearPending(newUserId);
          return;
        }

        // Verify phrase against stored bcrypt hash
        const normalized = phrase.trim().toLowerCase().replace(/\s+/g, ' ');
        const match = bcrypt.compareSync(normalized, stateEvent.phrase_hash);

        if (!match) {
          await intent.sendText(roomId,
            'Phrase does not match. Check your written copy and try again with !self-recover.'
          );
          clearPending(newUserId);
          return;
        }

        // Match — invite new account into escrow room
        await intent.invite(pending.escrowRoomId, newUserId);
        upsertEscrowRoom.run(newUserId, pending.escrowRoomId);
        logRecovery.run(pending.oldUserId, newUserId, 'self-service');

        await intent.sendText(roomId,
          `Verified. You've been invited to your safety deposit box. ` +
          `Your Khora app will now prompt you to decrypt your keys.`
        );

        console.log(`[recovery] self-service: ${pending.oldUserId} -> ${newUserId}`);
        clearPending(newUserId);

      } catch (err) {
        console.error('[error] phrase verification:', err.message);
        await intent.sendText(roomId, `Verification error: ${err.message}`);
        clearPending(newUserId);
      }
    }

    async function handleAdminRecovery(intent, roomId, adminId, oldUserId, newUserId) {
      const row = getEscrowRoom.get(oldUserId);
      if (!row) {
        await intent.sendText(roomId, `No escrow room found for ${oldUserId}.`);
        return;
      }

      try {
        await intent.invite(row.room_id, newUserId);
        upsertEscrowRoom.run(newUserId, row.room_id);
        logRecovery.run(oldUserId, newUserId, `admin:${adminId}`);

        await intent.sendText(roomId,
          `Invited ${newUserId} to escrow room for ${oldUserId}. ` +
          `They still need their recovery phrase to decrypt.`
        );
        console.log(`[recovery] admin: ${oldUserId} -> ${newUserId}, by ${adminId}`);
      } catch (err) {
        await intent.sendText(roomId, `Failed: ${err.message}`);
      }
    }

    function clearPending(userId) {
      const p = pendingRecoveries.get(userId);
      if (p) clearTimeout(p.timeout);
      pendingRecoveries.delete(userId);
    }

    bridge.run(port, config);
    console.log(`[bot] Khora Escrow Bot running on port ${port}`);
  },
}).run();
