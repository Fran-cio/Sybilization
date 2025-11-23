/**
 * register_passport.js
 * 
 * Simulates ZKPassport registration for voting.
 * In production, this would:
 * 1. Process actual passport data (MRZ, signature, etc.)
 * 2. Generate proof using register_identity circuit
 * 3. Extract passport_hash from proof outputs
 * 
 * For hackathon demo, we simulate this by:
 * - Taking passport-like data (name, DOB, nationality, passport number)
 * - Hashing it to generate a unique passport_hash (nullifier)
 * - Saving to local storage for voting
 * 
 * This demonstrates the concept while being testable without real passports.
 */

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simulated passport data structure
// In production, this would come from passport-zk-circuits-noir/register_identity
function generatePassportHash(passportData) {
    // Simulate the passport_hash output from register_identity circuit
    // In production: passport_hash = register_identity(...).outputs[1]
    
    // Create a deterministic hash from passport fields
    const data = [
        passportData.passportNumber,
        passportData.nationality,
        passportData.dateOfBirth,
        passportData.name
    ].join('|');
    
    const hash = createHash('sha256')
        .update(data)
        .digest('hex');
    
    return '0x' + hash;
}

// Simulate age verification (would be part of register_identity proof)
function verifyAge(dateOfBirth, minAge = 18) {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        return age - 1 >= minAge;
    }
    return age >= minAge;
}

function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 4) {
        console.log('\n📘 ZKPassport Registration for Private Voting\n');
        console.log('Usage: node register_passport.js <name> <dob> <nationality> <passport_number>\n');
        console.log('Example:');
        console.log('  node register_passport.js "John Doe" "1990-05-15" "USA" "P123456789"\n');
        console.log('Parameters:');
        console.log('  name             - Full name as in passport');
        console.log('  dob              - Date of birth (YYYY-MM-DD)');
        console.log('  nationality      - 3-letter country code (e.g., USA, ARG, BRA)');
        console.log('  passport_number  - Passport number\n');
        console.log('Note: This simulates ZKPassport registration. In production, this would');
        console.log('      use actual passport data and generate a zero-knowledge proof.\n');
        process.exit(1);
    }
    
    const [name, dateOfBirth, nationality, passportNumber] = args;
    
    console.log('\n🛂 Processing ZKPassport Registration...\n');
    
    // Verify age (simulated - would be in ZK proof)
    if (!verifyAge(dateOfBirth, 18)) {
        console.error('❌ Error: Must be 18 years or older to vote');
        process.exit(1);
    }
    
    const passportData = {
        name,
        dateOfBirth,
        nationality,
        passportNumber
    };
    
    // Generate passport hash (simulates register_identity output)
    const passportHash = generatePassportHash(passportData);
    
    // Save registration data
    const registrationData = {
        ...passportData,
        passportHash,
        registeredAt: new Date().toISOString(),
        ageVerified: true
    };
    
    // Save to file for later use in voting
    const registrationFile = path.join(__dirname, '..', 'frontend', 'public', 'passport-registration.json');
    fs.writeFileSync(registrationFile, JSON.stringify(registrationData, null, 2));
    
    console.log('✅ ZKPassport Registration Successful!\n');
    console.log('Registration Details:');
    console.log('━'.repeat(60));
    console.log(`Name:             ${name}`);
    console.log(`Date of Birth:    ${dateOfBirth}`);
    console.log(`Nationality:      ${nationality}`);
    console.log(`Passport Number:  ${passportNumber}`);
    console.log(`Age Verified:     ✓ (18+)`);
    console.log('━'.repeat(60));
    console.log(`\n🔑 Your Passport Hash (Nullifier):`);
    console.log(`${passportHash}\n`);
    console.log('This hash is your unique voting identifier. It:');
    console.log('  • Proves you are a unique person (via passport)');
    console.log('  • Cannot be used twice (Aztec nullifier tree prevents it)');
    console.log('  • Does not reveal your identity on-chain\n');
    console.log('📝 Registration saved to: frontend/public/passport-registration.json\n');
    console.log('Next step: Vote using your passport registration');
    console.log('  node scripts/cast_vote_passport.js <candidateId> [reason]\n');
}

main();
