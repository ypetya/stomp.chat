#!/usr/bin/env node

const net = require('net');

const ARGS = {};
function parseArgs() {
    console.log('Node STOMP chat.\n\n' +
        'Valid command line options:\n' +
        '[nickname:<nickname>] : nickname to use instead of /clients/<sessionid>\n' +
        '[host:<host>] : host to connect to, default: localhost\n' +
        '[port:<port>] : port to connect to, default: 3490\n' +
        '[noEcho:<true|false>] : echo messages back sent by this client,default: false\n');


    console.log('Command line arguments: ')
    process.argv.forEach((val) => {
        const arg = val.split(":");
        if (arg[1]) {
            console.log(`${arg[0]}: ${arg[1]}`);
            ARGS[arg[0]] = arg[1];
        }
    });
    return ARGS;
}

class Chat {
    constructor(props) {
        this.nickname = props.nickname;
        this.conn = net.connect(props.port || 3490, props.host || 'localhost');
        this.noEcho = props.noEcho;
        this.conn.setNoDelay(true);
        this.conn.once('ready', this.connect.bind(this));
    }

    connect() {
        this.conn.write("STOMP\naccept-version:1.2\nhost:localhost\n\n");
        this.conn.once('data', d => {
            if (d.toString().indexOf('CONNECTED') === 0) {
                console.log('Connected.');
                const sessionId = d.toString().match(/session:(\d+)/)[1];
                if (sessionId !== undefined) {
                    this.connected(sessionId);
                    this.conn.on('data', m => {
                        const arr = m.toString().split('\n');

                        const headers = {};

                        for (let i = 1; i < arr.length ||
                            (arr[i] && arr[i].length === 0); i++) {
                            const header = arr[i].split(':');
                            headers[header[0]] = header[1];
                        }

                        let body = '', str;
                        try {
                            str = arr[arr.length - 1];
                            str = str.substring(0, str.length - 1);
                            body = JSON.parse(str);
                        } catch (e) {
                            // TODO handle diag message
                            // console.error('Error', e);
                            console.log('Message', arr.join('\n'));
                            return;
                        }

                        if (this.noEcho && body.from === this.id)
                            return;
                        
                        this.message.call(this, arr[0], headers, body);
                    });
                } else {
                    console.log('could not parse session id!');
                    process.exit(1);
                }
            }
        });
        this.conn.once('error', (e) => {
            console.error(`Connection error: ${e.toString()}`);
        });
        this.conn.once('close', () => {
            console.log('Connection closed.');
            process.exit(0);
        });
    }

    connected(sessionId) {
        console.log('Connected to stomp. Override this method.');
    }

    message(cmd, headers, body) {
        console.log('New message arrived. Override this method.');
    }

    request(m) {
        return new Promise((resolve, reject) => {
            setImmediate(() => this.conn.write(m));
            setTimeout(resolve, 0);
            setTimeout(reject, 1000);
        });
    }

    async subscribe(topic) {
        console.log(`Subscribing to : ${topic}`);
        return await this.request(`SUBSCRIBE\ndestination:${topic}\nid:1\n\0`);
    }

    async unsubscribe(topic) {
        return await this.request(`UNSUBSCRIBE\ndestination:${topic}\nid:1\n\0`);
    }

    async send(topic, body) {
        return await this.request(`SEND\ndestination:${topic}\ncontent-type:text/plain\n\n` +
            `${JSON.stringify(body)}\0"`);
    }

    async diag(stat) {
        return await this.request(`DIAG\n\n${stat}\0`);
    }

    async disconnect() {
        return await this.request('DISCONNECT\n\0');
    }

}

const readline = require('readline');

function nTimes(n, cb) {
    if (n <= 0 || !Number.isFinite(n))
        return;

    cb(n).then(() => {
        nTimes.call(this, n - 1, cb);
    });
}

class ChatClient extends Chat {
    constructor(props) {
        super(props);
        this.onUserInput = this.onUserInput.bind(this);
        this.repeat = nTimes.bind(this);
    }

    connected(sessionId) {
        this.id = `/clients/${this.nickname || sessionId}`;
        this.subscribe(this.id)
            .then(() => this.subscribe('/chat-servers'))
            .then(() => this.send('/chat-servers',
                { content: 'New client', from: this.id }))
    }

    message(cmd, headers, body) {
        if (cmd === 'MESSAGE') {
            console.log(`${headers.destination} : ${body.from} : ${body.content}`);
        }
    }

    onUserInput(line) {
        const l = line.split(' ');
        let body = line.split(' ');

        if (l[0] == 'send') {
            body.splice(0, 2);
            let msg = { content: body.join(' '), from: this.id };
            this.send(l[1], msg);
        } else if (l[0] == 'repeat') {
            body.splice(0, 3);
            this.repeat(Number(l[1]), i => this.send(l[2],
                { content: `${i}:` + body.join(' '), from: this.id }));
        } else if (l[0] == 'subscribe') {
            this.subscribe(l[1]);
        } else if (l[0] == 'unsubscribe') {
            this.unsubscribe(l[1]);
        } else if (l[0] == 'diag') {
            this.diag(l[1]);
        } else {
            console.log('Please use a command in the following format:\n\n' +
                'list\t\t- sends a list clients message to /chat-servers\n' +
                'send <topic> message body\t\t- sends a message to a specific topic\n' +
                'repeat <count> <topic> message body\t\t- sends a message count times to a specific topic\n' +
                'subscribe <topic>\t\t- subscribe to a topic. can contain * as a whiledcard character\n' +
                'unsubscribe <topic>\t\t- ask to remove subscription from a topic\n\n' +
                'diag <session-size|pubsub-size>\t\t- send diagnostic message'
            );
        }
    }
}

class ChatServer extends Chat {
    constructor({ host, port, noEcho = true }) {
        super({ host, port, noEcho });
        this.rooms = [];
        this.clients = [];
    }

    connected(sessionId) {
        this.id = sessionId;
        this.subscribe(`/chat-servers`);
        this.send('/chat-servers', { content: 'new server', from: sessionId });
    }

    message(cmd, headers, body) {
        switch (cmd) {
            case 'MESSAGE':
                if (body.content === 'new server') {
                    this.send('/chat-servers', { content: 'already listening', from: this.id });
                } else if (body.content === 'already listening') {
                    console.log(`There is already a chat server listening with sessionId:${body.from}.`);
                    this.disconnect();
                } else if (body.content === 'clients') {
                    if (!this.clients.includes(body.from)) {
                        this.clients.push(body.from);
                    }
                    this.send(body.from, { content: this.clients, from: this.id });
                } else if (body.content === 'bye') {
                    if (this.clients.includes(body.from)) {
                        const c = this.clients.indexOf(body.from);
                        this.clients = this.clients.splice(c, 1);
                    }
                }
                break;
        }
    }
}

module.exports = {
    parseArgs,
    ChatClient,
    ChatServer
};