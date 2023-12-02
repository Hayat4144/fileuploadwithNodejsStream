import http from "http";
import { Server } from "socket.io";
import Handler from "./routes/index.js";

let port = process.env.PORT || 8000;
let routes = new Handler();

let server = http.createServer(routes.handler.bind(routes));

let io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  },
});

routes.setSocketInstanace(io);

io.on("connection", (socket) => {
  console.info(`someone connected: ${socket.id}`);
  socket.join(socket.id);
});

server.listen(port, () => {
  console.info(`server is running at the port: http://localhost:${port}`);
});
