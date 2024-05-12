import request from 'supertest';
import { Server } from 'http';
import { app } from './server';

describe('HTTP Endpoints', () => {
    let server: Server;

    beforeAll((done) => {
        server = app.listen(4000, done);
    });

    afterAll((done) => {
        server.close(done);
    });

    describe('POST /url', () => {
        it('should respond with 400 if url or clientId is missing', async () => {
            const response = await request(app).post('/url').query({ url: 'https://example.com' });
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('URL parameter or clientId is missing');
        });

        it('should process request and send 202 when url and clientId are provided', async () => {
            const response = await request(app).post('/url').query({ url: 'https://example.com', clientId: '12345' });
            expect(response.status).toBe(202);
            expect(response.body.message).toBe('Processing your request.');
        });
    });

    describe('GET /:code', () => {
        it('should return 404 if URL not found', async () => {
            const response = await request(app).get('/nonexistentcode');
            expect(response.status).toBe(404);
            expect(response.body.error).toBe('URL not found');
        });
    });
});
