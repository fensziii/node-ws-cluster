import fs from "node:fs";
import net from "node:net";
import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';



const PMID      = process.env.pm_id;
const PIPEPATH  = `/tmp/mysocket.sock`;

const clients   = {};
const server    = createServer();
const wss       = new WebSocketServer({ noServer: true });

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
    console.log(`[worker${PMID}] ${Object.keys(clients).length} client online.`);

    // Hello Broadcast :)
    broadcast("test")

    ws.on('message', function (data) {
        
        console.log('message', data.toString())

    });

    ws.on('close', function (code) {
        delete clients[ws.uuid];
        console.log(`[worker${PMID}] ${Object.keys(clients).length} client online.`);
    });

});

server.on('upgrade', function (request, socket, head) {

    wss.handleUpgrade(request, socket, head, function (ws) {
        ws['uuid'] = randomUUID();
        wss.emit('connection', ws, request);
    });

});

server.listen(4001, '127.0.0.1');