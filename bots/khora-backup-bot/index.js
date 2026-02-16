// Khora Backup Presence Bot
//
// Simple Matrix appservice bot that auto-accepts all room invites.
// Its sole purpose is to sit in every Khora room so hyphae.social
// always has a federated copy of encrypted room data.
//
// It never sends messages, never reads content, never stores anything.
// It just joins rooms when invited and stays there.

const { Cli, Bridge, AppServiceRegistration } = require('matrix-appservice-bridge');
const path = require('path');

new Cli({
  registrationPath: path.join(__dirname, 'registration.yaml'),
  generateRegistration(reg, callback) {
    reg.setId(AppServiceRegistration.generateToken());
    reg.setHomeserverToken(AppServiceRegistration.generateToken());
    reg.setAppServiceToken(AppServiceRegistration.generateToken());
    reg.setSenderLocalpart('khora-backup');
    reg.addRegexPattern('users', '@khora-backup:hyphae\\.social', true);
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
        async onEvent(request) {
          const event = request.getData();
          if (event.type === 'm.room.member'
              && event.content?.membership === 'invite'
              && event.state_key === '@khora-backup:hyphae.social') {
            try {
              await bridge.getIntent().join(event.room_id);
              console.log(`[backup] joined ${event.room_id}`);
            } catch (err) {
              console.error(`[backup] failed ${event.room_id}:`, err.message);
            }
          }
        },
      },
    });
    bridge.run(port, config);
    console.log(`[bot] Khora Backup Bot running on port ${port}`);
  },
}).run();
