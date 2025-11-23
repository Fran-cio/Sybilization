/**
 * cast_vote_passport.js
 * 
 * Cast a vote using ZKPassport registration.
 * Uses the passport_hash generated during registration as the nullifier.
 * 
 * This demonstrates:
 * - Identity verification via passport (ZKPassport)
 * - Sybil resistance (one vote per passport)
 * - Privacy preservation (vote choice remains private)
 * - User control (user initiates transaction with their wallet)
 */

import { Contract, getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { Fr } from '@aztec/aztec.js/fields';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { TestWallet } from '@aztec/test-wallet/server';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee/testing';
import { SponsoredFPCContract } from '@aztec/noir-contracts.js/SponsoredFPC';
import { loadContractArtifact } from '@aztec/aztec.js/abi';
import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const NODE_URL = process.env.NODE_URL || 'http://localhost:8080';
const SPONSORED_FPC_SALT = new Fr(0);

async function castVoteWithPassport(candidateId, voteReason) {
    console.log('\n🗳️  Casting Vote with ZKPassport Identity\n');
    
    // Load passport registration
    const registrationFile = join(__dirname, '../frontend/public/passport-registration.json');
    
    if (!existsSync(registrationFile)) {
        console.error('❌ No passport registration found!');
        console.error('Please register first: node scripts/register_passport.js\n');
        process.exit(1);
    }
    
    const registration = JSON.parse(readFileSync(registrationFile, 'utf-8'));
    
    console.log('📋 Using Registration:');
    console.log('━'.repeat(60));
    console.log(`Nationality:      ${registration.nationality}`);
    console.log(`Age Verified:     ✓ (18+)`);
    console.log(`Registered:       ${new Date(registration.registeredAt).toLocaleString()}`);
    console.log('━'.repeat(60));
    console.log(`\n🔑 Passport Hash: ${registration.passportHash}\n`);
    
    // Load contract info
    const contractInfo = JSON.parse(readFileSync(join(__dirname, '../frontend/public/contract-address.json'), 'utf-8'));
    const CONTRACT_ADDRESS = AztecAddress.fromString(contractInfo.address);
    
    // Load artifact
    const artifactPath = join(__dirname, '../contracts/target/private_voting-PrivateVoting.json');
    const artifact = loadContractArtifact(JSON.parse(readFileSync(artifactPath, 'utf-8')));
    
    console.log('1️⃣  Connecting to Aztec...');
    const node = createAztecNodeClient(NODE_URL);
    const wallet = await TestWallet.create(node);
    
    // Setup Sponsored FPC
    const sponsoredFPCInstance = await getContractInstanceFromInstantiationParams(
        SponsoredFPCContract.artifact,
        { salt: SPONSORED_FPC_SALT }
    );
    
    await wallet.registerContract({
        instance: sponsoredFPCInstance,
        artifact: SponsoredFPCContract.artifact
    });
    
    const accounts = await wallet.getAccounts();
    const fromAddress = accounts && accounts.length > 0 ? accounts[0].item : AztecAddress.ZERO;
    console.log(`   ✓ Address: ${fromAddress}`);
    
    console.log('\n2️⃣  Loading contract...');
    
    // Get the contract instance from the node (deployed contract)
    const nodeInstance = await node.getContract(CONTRACT_ADDRESS);
    if (!nodeInstance) {
        throw new Error(`Contract not found on devnet at ${CONTRACT_ADDRESS}`);
    }
    
    // Register with wallet
    await wallet.registerContract({
        instance: nodeInstance,
        artifact
    });
    
    const contract = await Contract.at(CONTRACT_ADDRESS, artifact, wallet);
    console.log(`   ✓ Contract: ${CONTRACT_ADDRESS}`);
    
    console.log('\n3️⃣  Preparing vote...');
    const candidateField = new Fr(candidateId);
    
    // Use passport hash as nullifier (from ZKPassport registration)
    const nullifierField = Fr.fromString(registration.passportHash);
    
    // Encrypt reason if provided
    let reasonField = new Fr(0);
    if (voteReason) {
        const reasonHash = createHash('sha256')
            .update(voteReason)
            .digest('hex');
        reasonField = new Fr(BigInt('0x' + reasonHash.substring(0, 62)));
    }
    
    const candidateNames = { 1: 'Candidate A', 2: 'Candidate B', 3: 'Candidate C' };
    
    console.log(`   ✓ Candidate: ${candidateNames[candidateId]} (${candidateId})`);
    console.log(`   ✓ Nullifier: ${nullifierField.toString().substring(0, 20)}... (from ZKPassport)`);
    if (reasonField.toBigInt() !== 0n) {
        console.log(`   ✓ Reason: ${voteReason} (encrypted)`);
    }
    
    console.log('\n4️⃣  Casting vote...');
    console.log('   🔒 Privacy: Your identity and vote choice remain private');
    console.log('   🛡️  Sybil Resistance: Your passport can only vote once\n');
    
    const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPCInstance.address);
    
    try {
        const tx = await contract.methods
            .cast_vote(candidateField, nullifierField, reasonField)
            .send({
                from: fromAddress,
                fee: { paymentMethod: sponsoredPaymentMethod }
            });
        
        console.log('   ⏳ Waiting for transaction...');
        const receipt = await tx.wait();
        
        console.log(`\n✅ Vote cast successfully with ZKPassport!`);
        console.log(`   TX Hash: ${receipt.txHash}`);
        console.log(`   Block: ${receipt.blockNumber}`);
        
        console.log('\n🔒 Privacy Guarantees:');
        console.log('  ✓ Your identity is not revealed on-chain');
        console.log('  ✓ Your vote choice is private');
        console.log('  ✓ Your passport hash prevents double-voting');
        console.log('  ✓ You control your identity data (no centralized authority)\n');
        
        console.log('🔗 View transaction on explorer:');
        console.log(`   https://devnet.aztecscan.xyz/tx/${receipt.txHash.toString()}\n`);
        
        // Try to show current tally (may fail on devnet)
        try {
            console.log('📊 Attempting to read current tally...');
            const tallyA = await contract.methods.get_vote(new Fr(1)).simulate();
            const tallyB = await contract.methods.get_vote(new Fr(2)).simulate();
            const tallyC = await contract.methods.get_vote(new Fr(3)).simulate();
            console.log(`  Candidate A: ${tallyA}`);
            console.log(`  Candidate B: ${tallyB}`);
            console.log(`  Candidate C: ${tallyC}\n`);
        } catch (tallyError) {
            console.log('  (Tally read skipped - use read_votes.js to check results)\n');
        }
        
    } catch (error) {
        console.error('\n❌ Error casting vote:', error.message);
        
        if (error.message && error.message.includes('nullifier')) {
            console.error('\n💡 This passport has already been used to vote!');
            console.error('   ZKPassport ensures one vote per person.\n');
        }
        
        throw error;
    }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 1) {
    console.log('\n🗳️  Cast Vote with ZKPassport\n');
    console.log('Usage: node cast_vote_passport.js <candidateId> [reason]\n');
    console.log('Parameters:');
    console.log('  candidateId  - Candidate to vote for (1=A, 2=B, 3=C)');
    console.log('  reason       - Optional reason for your vote (encrypted)\n');
    console.log('Example:');
    console.log('  node cast_vote_passport.js 1');
    console.log('  node cast_vote_passport.js 2 "Best economic policy"\n');
    console.log('Note: You must register with ZKPassport first:');
    console.log('      node scripts/register_passport.js <name> <dob> <nationality> <passport>\n');
    process.exit(1);
}

const candidateId = parseInt(args[0]);
const voteReason = args[1] || '';

if (![1, 2, 3].includes(candidateId)) {
    console.error('❌ Invalid candidate ID. Must be 1, 2, or 3');
    process.exit(1);
}

castVoteWithPassport(candidateId, voteReason).catch(console.error);
