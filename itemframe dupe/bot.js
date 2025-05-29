import socks from 'socks';
import { ProxyAgent } from 'proxy-agent';
import mineflayer from 'mineflayer';
import pkg from 'mineflayer-pathfinder';
import minecraftData from 'minecraft-data';
const { pathfinder, Movements, goals } = pkg;
import { Vec3 } from 'vec3';
import { solveCaptcha } from './captchaSolver.js';

export function startSingleBot({ username, password, proxy, x, y, z }) {
    const cred = { username, password };
    let isRestarting = false;
    const bot = mineflayer.createBot({
        username: cred.username,
        password: cred.password,
        version: '1.20.4',
        hideErrors: false,
        connect: (client) => {
            socks.SocksClient.createConnection(
                {
                    proxy: {
                        host: proxy.host,
                        port: proxy.port,
                        userId: proxy.username,
                        password: proxy.password,
                        type: 5,
                    },
                    command: 'connect',
                    destination: {
                        host: 'anarchy.6b6t.org',
                        port: 25565,
                    },
                },
                (err, info) => {
                    if (err) {
                        console.error(`[${cred.username}] Proxy connection error:`, err);
                        return;
                    }
                    client.setSocket(info.socket);
                    client.emit('connect');
                }
            );
        },
        agent: new ProxyAgent({
            protocol: 'socks5:',
            host: proxy.host,
            port: proxy.port,
            username: proxy.username,
            password: proxy.password,
        }),
        host: 'pl.6b6t.org',
        port: 25565,
        checkTimeoutInterval: 120 * 1000,
        viewDistance: 'tiny',
    });

    bot.once('spawn', () => {
        console.log(`Bot ${cred.username} has spawned.`);
        bot.loadPlugin(pathfinder);
    });

    bot.on('login', () => {
        console.log(`Bot ${cred.username} logged in using proxy ${proxy.host}:${proxy.port}.`);
        setupMessageHandlers(bot, cred.password);
    });

    bot.on('error', (err) => {
        console.error(`Bot ${cred.username} encountered an error:`, err);
    });

    bot.on('kicked', (reason) => {
        console.error(`Bot ${cred.username} was kicked: ${reason}`);
    });

    bot.on('end', () => {
        console.log(`[${bot.username}] Disconnected.`);
        if (isRestarting) {
            console.log('Waiting 10 minutes before reconnecting due to server restart...');
            setTimeout(() => {
                isRestarting = false;
                startSingleBot(cred, proxy, x, y, z);
            }, 7 * 60 * 1000);
        } else {
            console.log('Reconnecting in 5 seconds...');
            setTimeout(startSingleBot(cred, proxy, x, y, z), 5000);
        }
    });
}
function setupMessageHandlers(bot, mcPassword) {
    
    bot.on('message', async (jsonMsg) => {
        const message = jsonMsg.toString();

        if (message === `${bot.username}, please login with the command: /login <password>`){
            console.log(`Logging in as ${bot.username}...`);
            bot.chat(`/login ${mcPassword}`);
            setTimeout(() => navigateToPortal(bot), 5000);
        }

        const restartMessages = [
            'Server restarts in 60s',
            'Server restarts in 30s',
            'Server restarts in 15s',
            'Server restarts in 10s',
            'Server restarts in 5s',
            'Server restarts in 4s',
            'Server restarts in 3s',
            'Server restarts in 2s',
            'Server restarts in 1s',
            'The target server is offline now! You have been sent to the backup server while it goes back online.',
            'You were kicked from main-server: Server closed',
            'The main server is restarting. We will be back soon! Join our Discord with /discord command in the meantime.'
        ];

        if (restartMessages.includes(message)) {

            console.log('Server restart detected. Disconnecting bot...');
            bot.end();
        }
    });
}
async function navigateToPortal(bot) {
    console.log(`Bot position: ${bot.entity.position}`);
    await solveCaptcha(bot, false);
    console.log(`Bot position: ${bot.entity.position}`);
    
    // Ensure pathfinder is loaded
    if (!bot.pathfinder) {
        console.error('Pathfinder not loaded!');
        return;
    }
    const mcData = minecraftData(bot.version);
    const movements = new Movements(bot, mcData);
    bot.pathfinder.setMovements(movements);
    bot.pathfinder.setGoal(new goals.GoalBlock(-1001, 101, -988));
    return;
}


