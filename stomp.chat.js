#!/usr/bin/env node

const {ChatClient, parseArgs} = require('./stomp.chat.lib');
const {host, port, noEcho, nickname} = parseArgs();

const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'STOMP-CHAT> '
});

const client = new ChatClient({host, port, noEcho, nickname});

rl.prompt();

rl.on('line', client.onUserInput);