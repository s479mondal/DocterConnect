@echo off
echo Creating .env files for microservices...

echo PORT=3000> api-gateway\.env
echo USER_SERVICE_URL=http://localhost:3001>> api-gateway\.env
echo DOCTOR_SERVICE_URL=http://localhost:3002>> api-gateway\.env
echo APPOINTMENT_SERVICE_URL=http://localhost:3003>> api-gateway\.env
echo NOTIFICATION_SERVICE_URL=http://localhost:3004>> api-gateway\.env
echo JWT_SECRET=dpm_jwt_secret_key_2024>> api-gateway\.env

echo PORT=3001> services\user-service\.env
echo MONGODB_URI=mongodb://localhost:27017/user_db>> services\user-service\.env
echo JWT_SECRET=dpm_jwt_secret_key_2024>> services\user-service\.env
echo JWT_EXPIRES_IN=7d>> services\user-service\.env
echo RABBITMQ_URL=amqp://localhost:5672>> services\user-service\.env

echo PORT=3002> services\doctor-service\.env
echo MONGODB_URI=mongodb://localhost:27017/doctor_db>> services\doctor-service\.env
echo REDIS_URL=redis://localhost:6379>> services\doctor-service\.env
echo RABBITMQ_URL=amqp://localhost:5672>> services\doctor-service\.env

echo PORT=3003> services\appointment-service\.env
echo MONGODB_URI=mongodb://localhost:27017/appointment_db>> services\appointment-service\.env
echo RABBITMQ_URL=amqp://localhost:5672>> services\appointment-service\.env
echo REDIS_URL=redis://localhost:6379>> services\appointment-service\.env
echo DOCTOR_SERVICE_URL=http://localhost:3002>> services\appointment-service\.env
echo USER_SERVICE_URL=http://localhost:3001>> services\appointment-service\.env

echo PORT=3004> services\notification-service\.env
echo RABBITMQ_URL=amqp://localhost:5672>> services\notification-service\.env

echo VITE_API_BASE_URL=http://localhost:3000/api> frontend\.env

echo Starting MongoDB In-Memory Server...
start "MongoDB Server" cmd /k "node start-mongo.js"

echo Starting Microservices and Frontend...
start "API Gateway" cmd /k "cd api-gateway && npm.cmd install && npm.cmd run dev"
start "User Service" cmd /k "cd services\user-service && npm.cmd install && npm.cmd run dev"
start "Doctor Service" cmd /k "cd services\doctor-service && npm.cmd install && npm.cmd run dev"
start "Appointment Service" cmd /k "cd services\appointment-service && npm.cmd install && npm.cmd run dev"
start "Notification Service" cmd /k "cd services\notification-service && npm.cmd install && npm.cmd run dev"
start "Frontend" cmd /k "cd frontend && npm.cmd install && npm.cmd run dev"

echo All services launched!
