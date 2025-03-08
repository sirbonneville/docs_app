# Documentation Chatbot with Claude 200k

A documentation-focused chatbot using Anthropic's Claude 200k context model, embeddable in an iframe, with user-friendly configuration.

## Project Overview

This application provides a chatbot interface that can answer questions based on a documentation corpus. It uses Anthropic's Claude model with 200k context window to provide accurate and contextually relevant responses.

### Key Features

- React frontend for a responsive user interface
- Node.js/Express backend for API handling
- Supabase for document storage and retrieval
- Single API endpoint (`/api/anthropic`) for handling user queries
- Embeddable in an iframe for easy integration
- User-friendly configuration
- Comprehensive testing suite

## Tech Stack

- **Frontend**: React.js
- **Backend**: Node.js with Express
- **Database**: Supabase
- **AI Model**: Anthropic Claude (200k context)
- **Testing**: Jest, React Testing Library, Supertest
- **Containerization**: Docker (optional)

## Project Structure

```
├── client/                 # React frontend
│   ├── public/             # Static files
│   ├── src/                # Source files
│   ├── tests/              # Frontend tests
│   └── package.json        # Frontend dependencies
├── server/                 # Node.js/Express backend
│   ├── src/                # Source files
│   │   ├── controllers/    # Request handlers
│   │   ├── middleware/     # Express middleware
│   │   ├── models/         # Data models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── utils/          # Utility functions
│   │   └── app.js          # Express app setup
│   ├── tests/              # Backend tests
│   └── package.json        # Backend dependencies
├── data/                   # Documentation data
│   └── llm-full.txt        # Knowledge base for Claude
├── .env.example            # Example environment variables
├── docker-compose.yml      # Docker configuration
├── Dockerfile              # Docker build instructions
├── package.json            # Root package.json
└── README.md               # Project documentation
```

## Setup and Installation

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Supabase account
- Anthropic API key

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Server Configuration
PORT=3001
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# Anthropic API Configuration
ANTHROPIC_API_KEY=your_anthropic_api_key
```

### Installation

1. Clone the repository

```bash
git clone https://github.com/yourusername/docs-chatbot.git
cd docs-chatbot
```

2. Install dependencies

```bash
# Install root dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..

# Install server dependencies
cd server
npm install
cd ..
```

3. Start the development servers

```bash
# Start both client and server in development mode
npm run dev
```

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run frontend tests
npm run test:client

# Run backend tests
npm run test:server
```

### Building for Production

```bash
# Build the client
cd client
npm run build
cd ..

# Start the production server
npm start
```

## Docker Deployment

```bash
# Build and start the Docker containers
docker-compose up -d
```

## API Documentation

### `/api/anthropic` Endpoint

**Request:**

```json
{
  "query": "How do I install the application?",
  "conversationId": "optional-conversation-id"
}
```

**Response:**

```json
{
  "answer": "To install the application, you need to follow these steps: 1) Clone the repository, 2) Install dependencies with npm install, 3) Set up environment variables, 4) Run npm run dev to start the development servers.",
  "conversationId": "generated-or-provided-conversation-id"
}
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.