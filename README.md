# URL Shortening Service with Real-Time and Reliable Messaging

This project provides a URL shortening service implemented using Express.js, enhanced with real-time communications via WebSocket and reliable messaging via MQTT as a fallback method. Additionally, it features email notifications for each processed request, using Nodemailer.

## Technologies and Frameworks

- **Express.js**: Handles HTTP requests and server setup.
- **WebSocket (ws library)**: Enables real-time bidirectional communication.
- **MQTT (mqtt library)**: Ensures reliable messaging when WebSocket fails.
- **Nodemailer**: Manages sending of email notifications.
- **CORS**: Manages Cross-Origin Resource Sharing for the API.

## Setup and Installation

Ensure you have Node.js installed. Clone the repository and install dependencies:

```bash
npm install express ws mqtt nodemailer cors
```

To start the server, navigate to the project directory and run:

```bash
npm start
```

The server will listen on port 3000.

## Functional Overview

### URL Shortening

**POST Request** - Shortens a given URL:

- **Endpoint**: `POST /url`
- **Parameters**: Accepts `url` and `clientId` via query parameters.
- **Function**: Generates a unique short code for the URL.
- **Sample Request**:
  ```bash
  curl -X POST "http://localhost:3000/url?url=http://example.com&clientId=12345"
  ```
- **Response**: Returns the shortened URL in the response body.

**GET Request** - Retrieves the original URL using a short code:

- **Endpoint**: `GET /:code`
- **Sample Request**:
  ```bash
  curl "http://localhost:3000/b1a2bc3d"
  ```
- **Response**: Returns the original URL or returns an error if not found.

### Real-Time Communication via WebSocket

- Establishes connections using a `clientId`.
- Sends messages with the shortened URL.
- Implements a retry mechanism if the client does not acknowledge.

### Reliable Messaging via MQTT

- Used as a fallback when WebSocket communication fails.
- Ensures message delivery at least once using QoS level 1.

### Email Notifications

Sends an email for every URL processed, successful or not, using an Ethereal test account for demonstration purposes.

## Retry and Fallback Mechanism

If no acknowledgment is received via WebSocket:

- Retries up to three times with exponential backoff.
- If retries exceed, falls back to sending the message via MQTT.

## Testing the Application

To easily test the functionality, open the `client.html` file in a browser. This HTML client allows you to:

- Send URLs to be shortened.
- Receive and display responses via WebSocket and MQTT.
- Test the retry and fallback mechanisms.

## Security and Error Handling

Includes input validation and error handling to manage malformed URLs and client IDs, ensuring the server's robust operation.

## Running the HTML Client

The client can be opened directly in a web browser:

- File: `client.html`
- Functionality: Interacts with the server to shorten URLs, receive responses via WebSocket, and fallback to MQTT if necessary.

## Conclusion

This server architecture is designed for reliability and scalability, ensuring consistent operation under various network conditions, with comprehensive notification and error management strategies.
