import express, { Express, Request, Response } from 'express';
import { createServer, Server } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import * as mqtt from 'mqtt';
import nodemailer from 'nodemailer';
import cors from 'cors';

// Constants and environment configuration
const PORT: number = 3000;
const MQTT_BROKER_URL: string = 'mqtt://test.mosquitto.org:1883';

// App setup
const app: Express = express();
const server: Server = createServer(app);
const wss: WebSocketServer = new WebSocketServer({ server });
const mqttClient: mqtt.MqttClient = mqtt.connect(MQTT_BROKER_URL);
const baseUrl: string = `http://localhost:${PORT}`;

app.use(express.json());
app.use(cors());

// Utilities
interface Utils {
    generateRandomCode: () => string;
    fallbackToMQTT: (clientId: string, url: string) => void
}

const utils: Utils = {
    generateRandomCode: (): string => Math.random().toString(36).substring(2, 10),
    fallbackToMQTT: (clientId: string, url: string): void => {
        mqttClient.publish('url', JSON.stringify({ clientId, url }), { qos: 1 });
        console.log(`Fallback to MQTT for clientId: ${clientId} and URL: ${url}`);
    }
};

// Data stores
const urlHashMap: Map<string, string> = new Map();
const messages: Map<string, MessageState> = new Map();
const clientSockets: Map<string, WebSocket> = new Map();

// Interfaces and types
interface MessageState {
    clientId: string;
    attempts: number;
    maxRetries: number;
    timerId?: NodeJS.Timeout;
}

export class EmailService {
    private transporter?: nodemailer.Transporter;

    constructor() {
        this.setupTransporter();
    }

    private async setupTransporter() {
        try {
            const account = await nodemailer.createTestAccount();
            this.transporter = nodemailer.createTransport({
                host: account.smtp.host,
                port: account.smtp.port,
                secure: account.smtp.secure, // true for 465, false for other ports
                auth: {
                    user: account.user,
                    pass: account.pass
                }
            });
            console.log('Nodemailer transporter is set up with Ethereal.');
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error('Failed to create a testing account. ' + error.message);
            } else {
                console.error('Failed to create a testing account.')
            } 
        }
    }

    public async sendEmail(to: string, subject: string, url: string, shortenedUrl: string) {
        if (!this.transporter) {
            console.log('Mail transporter is not initialized.');
            return;
        }

        const mailOptions = {
            from: '"Test Server" <foo@example.com>',
            to: to,
            subject: subject,
            text: `Your URL ${url} has been processed. The shortened URL is ${shortenedUrl}`,
            html: `<p>Your URL ${url} has been processed. The shortened URL is <a href="${shortenedUrl}">${shortenedUrl}</a></p>`,
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log('Email sent:', info.response);
            console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
        } catch (error) {
            console.error('Error sending email:', error);
        }
    }
}

// WebSocket Controller
class WebSocketController {
    constructor() {
        wss.on('connection', this.handleConnection);
    }

    handleConnection = (ws: WebSocket, req: Request): void => {
        const clientId = new URL(req.url!, `http://${req.headers.host}`).searchParams.get('clientId');
        if (!clientId) {
            console.log('WebSocket connection attempt without clientId');
            ws.close();
            return;
        }
        clientSockets.set(clientId, ws);
        console.log(`WebSocket connected for client ID: ${clientId}`);

        ws.on('message', this.handleMessage(clientId));
        ws.on('close', () => {
            clientSockets.delete(clientId);
            console.log(`WebSocket disconnected for client ID: ${clientId}`);
        });
    };

    handleMessage = (clientId: string) => (message: string): void => {
        const msg = JSON.parse(message);
        if (msg.type === 'ack' && msg.url) {
            this.handleAcknowledgment(clientId, msg.url);
        }
    };

    handleAcknowledgment = (clientId: string, url: string): void => {
        console.log(`Acknowledgment received for message ID: ${url}`);
        const messageState = messages.get(url);
        if (messageState && messageState.clientId === clientId) {
            clearTimeout(messageState.timerId);
            messages.delete(url);
        }
    };

    attemptToSendViaWebSocket = (clientId: string, messageId: string, url: string, retryCount: number = 0): void => {
        const socket = clientSockets.get(clientId);
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ shortenedURL: url, retryCount }));
            RetryLogic.setupRetry(clientId, messageId, url, retryCount);
        } else {
            utils.fallbackToMQTT(clientId, url);
        }
    };


}

// Retry logic as a separate class
class RetryLogic {
    static setupRetry(clientId: string, messageId: string, url: string, attempts: number = 0): void {
        const maxRetries: number = 3;
        const delay: number = Math.pow(2, attempts) * 1000;
        const timerId: NodeJS.Timeout = setTimeout(() => this.retry(clientId, messageId, url), delay);
        messages.set(url, { clientId, attempts, maxRetries, timerId });
        console.log(`Scheduled retry in ${delay}ms for message ID: ${messageId}`);
    }

    static retry(clientId: string, messageId: string, url: string): void {
        const state = messages.get(url);
        if (!state) return;

        if (state.attempts < state.maxRetries) {
            state.attempts++;
            const webSocketController = new WebSocketController();
            webSocketController.attemptToSendViaWebSocket(clientId, messageId, url, state.attempts);
            messages.set(url, state);
        } else {
            console.log(`Max retries reached for ${messageId}, falling back to MQTT.`);
            clearTimeout(state.timerId);
            const webSocketController = new WebSocketController();
            utils.fallbackToMQTT(clientId, url);
        }
    }
}

// Main setup function to initialize components
async function setup(): Promise<void> {
    const mailService = new EmailService()
    const webSocketController = new WebSocketController();

    app.post('/url', async (req: Request, res: Response): Promise<void> => {
        const { url, clientId } = req.query as { url?: string; clientId?: string };
        if (!url || !clientId) {
            res.status(400).json({ error: 'URL parameter or clientId is missing' });
            return;
        }
        const messageId: string = utils.generateRandomCode();
        const shortenedUrl: string = `${baseUrl}/${messageId}`;
        urlHashMap.set(messageId, url);
        webSocketController.attemptToSendViaWebSocket(clientId, messageId, shortenedUrl);

        if (mailService) await mailService.sendEmail('recipient@example.com', 'URL Processed', url, shortenedUrl)

        res.status(202).send({ message: 'Processing your request.' });
    });

    app.get('/:code', (req: Request, res: Response): void => {
        const originalUrl: string | undefined = urlHashMap.get(req.params.code);
        if (originalUrl) {
            res.status(202).send({ url: originalUrl });
        } else {
            res.status(404).json({ error: 'URL not found' });
        }
    });

    server.listen(PORT, (): void => {
        console.log(`Server running on ${baseUrl}`);
    });
}

setup();
