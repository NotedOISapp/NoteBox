// Simple backend server for NoteBox
import { createServer } from "http";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

const server = createServer((req, res) => {
  const body = JSON.stringify({ status: "ok", timestamp: new Date().toISOString() });
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(body);
});

server.listen(PORT, () => {
  console.log(`NoteBox backend server listening on port ${PORT}`);
});
