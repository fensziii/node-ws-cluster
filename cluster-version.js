import fs from "node:fs";
import net from "node:net";
import cluster from 'node:cluster';
import { cpus } from 'node:os';


const PIPEPATH  = `/tmp/mysocket.sock`;


if (cluster.isPrimary) {

    const workers   = {};
    const cpuCount  = cpus().length;

    console.log(`Primary ${process.pid} is running`);

    for (let i = 0; i < cpuCount; i++) {
        workers[i] = cluster.fork({
            FORK_ID : i
        });
    }

    cluster.on('exit', (worker, code, signal) => {

        console.log(`worker ${worker.process.pid} died`);

    });


} else {
    

    const clients   = {};
    const server    = createServer();
    const wss       = new WebSocketServer({ noServer: true });
    const forkId    = process.env.FORK_ID;
    
    var ipcConnect = net.connect(PIPEPATH, { allowHalfOpen : true }); 
    ipcConnect.on('data', function(data) {
        for (const key in clients) {
            if (Object.hasOwnProperty.call(clients, key)) {
                clients[key].send(data.toString());
            }
        }
    });
    
    const writeToIPC = (action, method, body) => {
        if(ipcConnect === null) return;    
        const template = JSON.stringify({ action, method, body });
        ipcConnect.write(Buffer.from(template)) 
    };
    
    // Broadcast via IPC to all Clients in all Threads
    const broadcast = (data) => writeToIPC('broadcast', null, data);
    
    // Ineresting idea would be this.
    //const sendToUser    = (channel, data) => writeToIPC('user:private', channel, data);
    //const sendToChannel = (channel, data) => writeToIPC('channel:private', channel, data);
    
    wss.on('connection', function (ws, request, socket) {
    
        clients[ws.uuid] = ws;
        console.log(`[worker${forkId}] ${Object.keys(clients).length} client online.`);
    
        // Hello Broadcast :)
        broadcast("test")
    
        ws.on('message', function (data) {
            
            console.log('message', data.toString())
    
        });
    
        ws.on('close', function (code) {
            delete clients[ws.uuid];
            console.log(`[worker${forkId}] ${Object.keys(clients).length} client online.`);
        });
    
    });
    
    server.on('upgrade', function (request, socket, head) {
    
        wss.handleUpgrade(request, socket, head, function (ws) {
            ws['uuid'] = randomUUID();
            wss.emit('connection', ws, request);
        });
    
    });
    
    server.listen(4001, '127.0.0.1');

}