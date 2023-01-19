const PMID      = process.env.pm_id;
const PIPEPATH  = `/tmp/mysocket.sock`;

const clients   = {};
const server    = createServer();
const wss       = new WebSocketServer({ noServer: true });

var ipcConnect  = null;



// CREATE ONE IPC SERVER bound to an PM ID (in this case 0)
// Better approach is move this into separate file and run it.
if(parseInt(process.env.pm_id) === 0){
    if(fs.existsSync(PIPEPATH)) fs.rmSync(PIPEPATH);
    const socket = [];
    const server = net.createServer((stream) => {
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
}


// Connect to IPC Server with Timeout
setTimeout(() => {
    ipcConnect = net.connect(PIPEPATH, { allowHalfOpen : true }); 
    ipcConnect.on('data', function(data) {
        for (const key in clients) {
            if (Object.hasOwnProperty.call(clients, key)) {
                clients[key].send(data.toString());
            }
        }
    });
}, 1000);



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