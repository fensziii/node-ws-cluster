import fs from "node:fs";
import net from "node:net";


const PIPEPATH  = `/tmp/mysocket.sock`;
const socket    = [];

if(fs.existsSync(PIPEPATH)) fs.rmSync(PIPEPATH);

const server    = net.createServer((stream) => {
    socket.push(stream);
    stream.on('data', stream_data => {
        const raw = JSON.parse(stream_data);
        if(raw.action === 'broadcast'){
            socket.forEach(sock => sock.write(raw.body));
        }
    });
});

server.listen(PIPEPATH, () => {
    console.log(`[${process.pid}] IPC Socket bound at ${PIPEPATH}`);
});

process.on('SIGINT', function() {
    fs.rm(PIPEPATH, (err)=>{
        process.exit(err ? 1 : 0);
    });
});
