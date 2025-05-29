#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Path to .env.local file
const envPath = path.join(__dirname, '.env.local');

// Template for the .env file
const envTemplate = `# MongoDB connection string
MONGODB_URI=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/contextual-memory?retryWrites=true&w=majority

# JWT Secret for authentication
JWT_SECRET={{JWT_SECRET}}

# OpenAI API key for semantic search
OPENAI_API_KEY={{OPENAI_API_KEY}}
`;

console.log('Welcome to Mosaic - Contextual Memory App setup!');
console.log('This script will help you set up your environment variables.\n');

const promptForValues = async () => {
  return new Promise((resolve) => {
    rl.question('Enter your MongoDB connection string (or press Enter to use the placeholder): ', (mongoUri) => {
      rl.question('Enter your OpenAI API key (required for semantic search): ', (openaiKey) => {
        // Generate a secure random JWT secret
        const jwtSecret = crypto.randomBytes(32).toString('hex');
        
        resolve({
          mongoUri: mongoUri.trim() || 'mongodb+srv://your-username:your-password@your-cluster.mongodb.net/contextual-memory?retryWrites=true&w=majority',
          jwtSecret,
          openaiKey: openaiKey.trim() || 'your-openai-api-key-here'
        });
      });
    });
  });
};

const createEnvFile = async () => {
  try {
    // Check if .env.local already exists
    if (fs.existsSync(envPath)) {
      const answer = await new Promise((resolve) => {
        rl.question('.env.local already exists. Do you want to overwrite it? (y/n): ', resolve);
      });
      
      if (answer.toLowerCase() !== 'y') {
        console.log('Setup cancelled. Your existing .env.local file was not modified.');
        rl.close();
        return;
      }
    }
    
    // Get values from user input
    const { mongoUri, jwtSecret, openaiKey } = await promptForValues();
    
    // Replace placeholders in the template
    let envContent = envTemplate
      .replace('{{JWT_SECRET}}', jwtSecret)
      .replace('{{OPENAI_API_KEY}}', openaiKey);
    
    if (mongoUri !== 'mongodb+srv://your-username:your-password@your-cluster.mongodb.net/contextual-memory?retryWrites=true&w=majority') {
      envContent = envContent.replace('mongodb+srv://your-username:your-password@your-cluster.mongodb.net/contextual-memory?retryWrites=true&w=majority', mongoUri);
    }
    
    // Write to .env.local file
    fs.writeFileSync(envPath, envContent);
    
    console.log('\n.env.local file created successfully!');
    console.log('Next steps:');
    console.log('1. Set up MongoDB Atlas with vector search capabilities (see README.md)');
    console.log('2. Install dependencies with npm install');
    console.log('3. Start the development server with npm run dev');
  } catch (error) {
    console.error('Error creating .env.local file:', error);
  } finally {
    rl.close();
  }
};

createEnvFile(); 