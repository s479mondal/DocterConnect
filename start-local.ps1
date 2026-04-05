Write-Host "Creating .env files for microservices (Required to run locally)..."

# 1. API Gateway
$gatewayEnv = @"
PORT=3000
USER_SERVICE_URL=http://localhost:3001
DOCTOR_SERVICE_URL=http://localhost:3002
APPOINTMENT_SERVICE_URL=http://localhost:3003
NOTIFICATION_SERVICE_URL=http://localhost:3004
JWT_SECRET=dpm_jwt_secret_key_2024
"@
Set-Content -Path "api-gateway\.env" -Value $gatewayEnv

# 2. User Service
$userEnv = @"
PORT=3001
MONGODB_URI=mongodb://localhost:27017/user_db
JWT_SECRET=dpm_jwt_secret_key_2024
JWT_EXPIRES_IN=7d
RABBITMQ_URL=amqp://localhost:5672
"@
Set-Content -Path "services\user-service\.env" -Value $userEnv

# 3. Doctor Service
$doctorEnv = @"
PORT=3002
MONGODB_URI=mongodb://localhost:27017/doctor_db
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://localhost:5672
"@
Set-Content -Path "services\doctor-service\.env" -Value $doctorEnv

# 4. Appointment Service
$appointmentEnv = @"
PORT=3003
MONGODB_URI=mongodb://localhost:27017/appointment_db
RABBITMQ_URL=amqp://localhost:5672
REDIS_URL=redis://localhost:6379
DOCTOR_SERVICE_URL=http://localhost:3002
USER_SERVICE_URL=http://localhost:3001
"@
Set-Content -Path "services\appointment-service\.env" -Value $appointmentEnv

# 5. Notification Service
$notificationEnv = @"
PORT=3004
RABBITMQ_URL=amqp://localhost:5672
"@
Set-Content -Path "services\notification-service\.env" -Value $notificationEnv

# 6. Frontend
$frontendEnv = @"
VITE_API_BASE_URL=http://localhost:3000/api
"@
Set-Content -Path "frontend\.env" -Value $frontendEnv


Write-Host "Starting services in separate terminal windows..."

Start-Process powershell -ArgumentList "-NoExit -Command `"cd api-gateway; Write-Host '--- API GATEWAY ---'; npm install; npm run dev`""
Start-Process powershell -ArgumentList "-NoExit -Command `"cd services\user-service; Write-Host '--- USER SERVICE ---'; npm install; npm run dev`""
Start-Process powershell -ArgumentList "-NoExit -Command `"cd services\doctor-service; Write-Host '--- DOCTOR SERVICE ---'; npm install; npm run dev`""
Start-Process powershell -ArgumentList "-NoExit -Command `"cd services\appointment-service; Write-Host '--- APPOINTMENT SERVICE ---'; npm install; npm run dev`""
Start-Process powershell -ArgumentList "-NoExit -Command `"cd services\notification-service; Write-Host '--- NOTIFICATION SERVICE ---'; npm install; npm run dev`""
Start-Process powershell -ArgumentList "-NoExit -Command `"cd frontend; Write-Host '--- FRONTEND ---'; npm install; npm run dev`""

Write-Host "All 6 terminal windows have been launched successfully!"
