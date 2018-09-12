#!/usr/bin/env node

require('dotenv').config();

'host,port,nickname'.split(',').forEach(config => {
    if (!process.env[config]) {
        console.log(`Missing config for environment: ${config}
        Please add it to your environment variables or into the .env file as line
        key=value`);
        process.exit(1);
    }
});

const { ChatClient } = require('./stomp.chat.lib');

const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'CHAT> '
});

class SimpleTalk extends ChatClient {

    connected(sessionId) {
        this.id = `${this.nickname}`;
        this.subscribe('/chat')
            .then(() => this.send('/chat',
                { content: 'Joined.', from: this.id }))
    }

    message(cmd, headers, body) {
        if (cmd === 'MESSAGE' && headers.destination == '/chat') {
            console.log(`${body.from} : ${body.content}`);
        }
    }

    onUserInput(line) {
        let msg = { content: line, from: this.id };
        this.send('/chat', msg);
    }
}

const { host, port, nickname, noEcho = true } = process.env;
const client = new SimpleTalk({ host, port, nickname, noEcho });

rl.prompt();

rl.on('line', client.onUserInput);