#!/usr/bin/env node

const {ChatServer, parseArgs} = require('./stomp.chat.lib');
const {host, port, noEcho} = parseArgs();

const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'STOMP-CHAT> '
});

const server = new ChatServer({host,port});