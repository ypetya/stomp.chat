
const { Chat } = require('./stomp.chat.lib');

module.exports.adapter = class ServiceAdapter extends Chat {

    constructor({host, port, onConnected, onMessage}) {
        super({host,port, noEcho: true});
        this.onConnected = onConnected;
        this.onMessage = onMessage;
    }

    connected(sessionId) {
        this.id = sessionId;
        this.onConnected(this);
    }

    message(cmd, headers, body) {
        this.onMessage(cmd, headers, body);
    }

    async send(topic, headers, body) {
        let _headers= Object.keys(headers).map(k=>`${k}:${headers[k]}\n`).join('');
        return await this.request(`SEND\ndestination:${topic}\n${_headers}content-type:text/plain\n\n` +
            `${JSON.stringify(body)}\0"`);
    }
}
