if (req.headers.upgrade?.toLowerCase() === 'websocket' &&
    req.headers.connection.match(/\bupgrade\b/i) && 
    req.headers["sec-websocket-key"]) {
  const wss = new (new require("ws")).WebSocketServer({noServer: true});
  wss.handleUpgrade(req, req.socket, Buffer.alloc(0), function (ws) {
    pty.addMember(ws);
  });
}
