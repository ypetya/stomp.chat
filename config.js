
require('dotenv').config();

'host,port,nickname'.split(',').forEach(config => {
    if (!process.env[config]) {
        console.log(`Missing config for environment: ${config}
        Please add it to your environment variables or into the .env file as line
        key=value`);
        process.exit(1);
    }
});