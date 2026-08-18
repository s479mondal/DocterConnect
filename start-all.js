const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 1. Create .env files for microservices and frontend
const envFiles = [
  {
    path: path.join(__dirname, 'api-gateway', '.env'),
    content: `PORT=3000
USER_SERVICE_URL=http://localhost:3001
DOCTOR_SERVICE_URL=http://localhost:3002
APPOINTMENT_SERVICE_URL=http://localhost:3003
NOTIFICATION_SERVICE_URL=http://localhost:3004
JWT_SECRET=dpm_jwt_secret_key_2024`
  },
  {
    path: path.join(__dirname, 'services', 'user-service', '.env'),
    content: `PORT=3001
MONGODB_URI=mongodb+srv://soumenmondal741150_db_user:SoumenDa123@cluster0.982qcmr.mongodb.net/user_db?retryWrites=true&w=majority
JWT_SECRET=dpm_jwt_secret_key_2024
JWT_EXPIRES_IN=7d
RABBITMQ_URL=amqp://admin:admin123@localhost:5672`
  },
  {
    path: path.join(__dirname, 'services', 'doctor-service', '.env'),
    content: `PORT=3002
MONGODB_URI=mongodb+srv://soumenmondal741150_db_user:SoumenDa123@cluster0.982qcmr.mongodb.net/doctor_db?retryWrites=true&w=majority
REDIS_URL=rediss://default:gQAAAAAAAbdQAAIgcDExNWYyNjY3MjkwMGU0M2MzOTM1Zjk2OTIwMDE3MDUzYg@central-cowbird-112464.upstash.io:6379
RABBITMQ_URL=amqp://admin:admin123@localhost:5672`
  },
  {
    path: path.join(__dirname, 'services', 'appointment-service', '.env'),
    content: `PORT=3003
MONGODB_URI=mongodb+srv://soumenmondal741150_db_user:SoumenDa123@cluster0.982qcmr.mongodb.net/appointment_db?retryWrites=true&w=majority
RABBITMQ_URL=amqp://admin:admin123@localhost:5672
REDIS_URL=rediss://default:gQAAAAAAAbdQAAIgcDExNWYyNjY3MjkwMGU0M2MzOTM1Zjk2OTIwMDE3MDUzYg@central-cowbird-112464.upstash.io:6379
DOCTOR_SERVICE_URL=http://localhost:3002
USER_SERVICE_URL=http://localhost:3001
RAZORPAY_KEY_ID=rzp_test_SZ9vgZQjij4g7j
RAZORPAY_KEY_SECRET=eU3taZ4ADVpI3HT3sfnjRfvf`
  },
  {
    path: path.join(__dirname, 'services', 'notification-service', '.env'),
    content: `PORT=3004
RABBITMQ_URL=amqp://admin:admin123@localhost:5672`
  },
  {
    path: path.join(__dirname, 'frontend', '.env'),
    content: `VITE_API_BASE_URL=http://localhost:3000/api
VITE_RAZORPAY_KEY_ID=rzp_test_SZ9vgZQjij4g7j`
  }
];

console.log('📝 Writing .env files...');
for (const env of envFiles) {
  fs.mkdirSync(path.dirname(env.path), { recursive: true });
  fs.writeFileSync(env.path, env.content.trim() + '\n');
}
console.log('✅ .env files written successfully!\n');

// 2. Service configurations
const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

const services = [
  { name: 'MongoDB', cmd: 'node', args: ['start-mongo.js'], cwd: __dirname, color: '\x1b[35m' },
  { name: 'API Gateway', cmd: npmCmd, args: ['run', 'dev'], cwd: path.join(__dirname, 'api-gateway'), color: '\x1b[36m' },
  { name: 'User Service', cmd: npmCmd, args: ['run', 'dev'], cwd: path.join(__dirname, 'services', 'user-service'), color: '\x1b[32m' },
  { name: 'Doctor Service', cmd: npmCmd, args: ['run', 'dev'], cwd: path.join(__dirname, 'services', 'doctor-service'), color: '\x1b[33m' },
  { name: 'Appointment Service', cmd: npmCmd, args: ['run', 'dev'], cwd: path.join(__dirname, 'services', 'appointment-service'), color: '\x1b[34m' },
  { name: 'Notification Service', cmd: npmCmd, args: ['run', 'dev'], cwd: path.join(__dirname, 'services', 'notification-service'), color: '\x1b[31m' },
  { name: 'Frontend', cmd: npmCmd, args: ['run', 'dev'], cwd: path.join(__dirname, 'frontend'), color: '\x1b[37m' }
];

console.log('🚀 Starting all services...\n');

services.forEach((service) => {
  const child = spawn(service.cmd, service.args, {
    cwd: service.cwd,
    shell: true,
    env: process.env
  });

  const prefix = `${service.color}[${service.name}]\x1b[0m`;

  child.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => console.log(`${prefix} ${line}`));
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => console.error(`${prefix} \x1b[91m${line}\x1b[0m`));
  });

  child.on('close', (code) => {
    console.log(`${prefix} exited with code ${code}`);
  });
});
