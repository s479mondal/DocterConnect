const https = require('https');
const http = require('http');
const mongoose = require('mongoose');

const ATLAS_URI = 'mongodb+srv://soumenmondal741150_db_user:SoumenDa123@cluster0.982qcmr.mongodb.net/';
// Inside Docker, we talk to the gateway or service directly. 
// Using the service name 'api-gateway' inside the docket network.
const GATEWAY_URL = 'http://api-gateway:3000/api';

async function request(url, method, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = lib.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        const parsed = body ? JSON.parse(body) : {};
        if (res.statusCode >= 200 && res.statusCode < 300) resolve({ data: parsed });
        else {
          console.error(`Request failed with status ${res.statusCode}:`, parsed);
          reject({ response: { data: parsed, status: res.statusCode } });
        }
      });
    });

    req.on('error', (err) => {
      console.error('Network error during request:', err.message);
      reject(err);
    });
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function verifyFlow() {
  let doctorConn;
  try {
    console.log('🔍 Phase 1: Checking initial state in Atlas doctor_db...');
    doctorConn = await mongoose.createConnection(`${ATLAS_URI}doctor_db?retryWrites=true&w=majority`).asPromise();
    
    const doctorSchema = new mongoose.Schema({
      email: String,
      isVerified: Boolean
    });
    const Doctor = doctorConn.model('Doctor', doctorSchema);
    
    let doctor = await Doctor.findOne({ email: 'pending.doctor@dpm.com' });
    if (!doctor) {
      console.log('❌ Could not find test doctor. Please run setup-atlas-data.js first.');
      return;
    }
    
    // RESET TO FALSE for testing purposes
    console.log('🔄 Resetting isVerified to false for a clean test...');
    doctor.isVerified = false;
    await doctor.save();
    
    console.log(`📊 Current Status for ${doctor.email}: isVerified = ${doctor.isVerified}`);

    console.log('\n🔐 Phase 2: Logging in as Admin to get Token...');
    const loginRes = await request(`${GATEWAY_URL}/auth/login`, 'POST', {
      email: 'admin@dpm.com',
      password: 'Admin@123'
    });
    const token = loginRes.data.token;
    console.log('✅ Admin Token obtained.');

    console.log('\n⚡ Phase 3: Calling Verification API via Gateway...');
    const verifyRes = await request(`${GATEWAY_URL}/doctors/admin/${doctor._id}/verify`, 'PATCH', {}, {
      Authorization: `Bearer ${token}`
    });
    console.log(`✅ API Response: ${verifyRes.data.message}`);

    console.log('\n🔍 Phase 4: Re-checking Atlas doctor_db for the change...');
    // Refresh document
    doctor = await Doctor.findById(doctor._id);
    console.log(`📊 NEW Status for ${doctor.email}: isVerified = ${doctor.isVerified}`);

    if (doctor.isVerified === true) {
      console.log('\n🏆 SUCCESS: The verification "thing" happened exactly as it should!');
    } else {
      console.log('\n❌ FAILURE: Verification flag did not update.');
    }

  } catch (error) {
    console.error('❌ Error testing flow:', error.response ? error.response.data : error.message);
  } finally {
    if (doctorConn) await doctorConn.close();
    process.exit(0);
  }
}

verifyFlow();
