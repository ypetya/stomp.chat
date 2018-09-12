#!/usr/bin/env node

require('./config');

const { ChatClient } = require('./stomp.chat.lib');
const { host, port, nickname, noEcho = true } = process.env;

class LatencyCheck extends ChatClient {

    connected(sessionId) {
        this.id = `${this.sessionId}`;
        this.subscribe(`/latency/${this.id}`)
            .then(() => this.tick())
    }

    async tick() {
        return await this.request(
            `SEND\nts:${Date.now()}\ndestination:/latency/${this.id}\ncontent-type:text/plain\n\n{}\0"`);
    }

    message(cmd, headers, body) {
        console.log(`${Date.now() - Number(headers.ts)} ms`);
        setTimeout(this.tick.bind(this),1000);
    }
}

const client = new LatencyCheck({ host, port, nickname, noEcho });
