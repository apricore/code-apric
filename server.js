const PORT = require("./src/server/config").PORT;
const app = require("./src/server/app");
const server = require("http").createServer(app);

server.headersTimeout = server.requestTimeout = 0;
server.listen(PORT);