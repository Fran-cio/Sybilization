/**
 * API Server for ZKPassport Private Voting
 * 
 * Provides REST API endpoints for:
 * - Passport registration (simulated ZKPassport)
 * - Vote casting with passport identity
 * - Reading vote results
 * - Checking voting status
 * 
 * Architecture: Express server + Aztec.js client
 * - Server handles Aztec wallet management
 * - Client (frontend) sends passport data and vote choices
 * - Server generates proofs and submits to Aztec devnet
 */

import express from 'express';
import cors from 'cors';
import { Contract, getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { Fr, GrumpkinScalar } from '@aztec/aztec.js/fields';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { TestWallet } from '@aztec/test-wallet/server';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee/testing';
import { SponsoredFPCContract } from '@aztec/noir-contracts.js/SponsoredFPC';
import { loadContractArtifact } from '@aztec/aztec.js/abi';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const NODE_URL = process.env.NODE_URL || 'https://devnet.aztec-labs.com/';
const SPONSORED_FPC_SALT = new Fr(0);

// Load contract artifact
const artifactPath = join(__dirname, '../contracts/target/private_voting-PrivateVoting.json');
const PrivateVotingArtifact = loadContractArtifact(
  JSON.parse(readFileSync(artifactPath, 'utf-8'))
);

// Load contract address path
const contractInfoPath = join(__dirname, '../frontend/public/contract-address.json');

// Function to get current contract address (reloads from file each time)
function getCurrentContractAddress() {
  const contractInfo = JSON.parse(readFileSync(contractInfoPath, 'utf-8'));
  return AztecAddress.fromString(contractInfo.address);
}

// Wallet cache
let cachedWallet = null;
let sponsoredPaymentMethod = null;
let cachedNode = null;
let adminAccount = null;

// Deterministic admin keys (same as deploy_devnet.js)
const ADMIN_SECRET_KEY = Fr.fromString('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
const ADMIN_SIGNING_KEY = GrumpkinScalar.fromString('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
const ADMIN_SALT = Fr.fromString('0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba');

async function getWallet() {
  if (!cachedWallet) {
    console.log('🔧 Initializing admin wallet and Sponsored FPC...');
    cachedNode = createAztecNodeClient(NODE_URL);
    cachedWallet = await TestWallet.create(cachedNode);
    
    // Create the same Schnorr account used in deployment
    console.log('👤 Creating admin Schnorr account...');
    adminAccount = await cachedWallet.createSchnorrAccount(
      ADMIN_SECRET_KEY,
      ADMIN_SALT,
      ADMIN_SIGNING_KEY
    );
    console.log(`✓ Admin account: ${adminAccount.address.toString()}`);
    
    // Setup Sponsored FPC
    const sponsoredFPCInstance = await getContractInstanceFromInstantiationParams(
      SponsoredFPCContract.artifact,
      { salt: SPONSORED_FPC_SALT }
    );
    
    await cachedWallet.registerContract({
      instance: sponsoredFPCInstance,
      artifact: SponsoredFPCContract.artifact
    });
    
    sponsoredPaymentMethod = new SponsoredFeePaymentMethod(
      sponsoredFPCInstance.address
    );
    
    console.log('✓ Wallet ready');
  }
  return cachedWallet;
}

async function getContract() {
  const wallet = await getWallet();
  
  // Get current contract address (reloads from file)
  const contractAddress = getCurrentContractAddress();
  
  // Get contract instance from node
  const nodeInstance = await cachedNode.getContract(contractAddress);
  if (!nodeInstance) {
    throw new Error(`Contract not found at ${contractAddress}`);
  }
  
  // Register with wallet
  await wallet.registerContract({
    instance: nodeInstance,
    artifact: PrivateVotingArtifact
  });
  
  return await Contract.at(contractAddress, PrivateVotingArtifact, wallet);
}

// ============================================================================
// PASSPORT REGISTRATION ENDPOINT
// ============================================================================

/**
 * POST /api/register-passport
 * 
 * Simulates ZKPassport registration by generating a passport_hash from passport data.
 * In production, this would verify a ZK proof from register_identity circuit.
 * 
 * Body: { name, dateOfBirth, nationality, passportNumber }
 * Returns: { passportHash, ageVerified }
 */
app.post('/api/register-passport', async (req, res) => {
  try {
    console.log('\n📋 Passport registration request:', req.body);
    
    const { name, dateOfBirth, nationality, passportNumber } = req.body;
    
    if (!name || !dateOfBirth || !nationality || !passportNumber) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields: name, dateOfBirth, nationality, passportNumber' 
      });
    }
    
    // Age verification (simulate ZK proof verification)
    const dob = new Date(dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    const actualAge = (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) 
      ? age - 1 
      : age;
    
    if (actualAge < 18) {
      return res.status(400).json({
        success: false,
        error: 'Must be 18 years or older to vote'
      });
    }
    
    // Generate passport_hash (simulates register_identity output)
    const passportData = `${passportNumber}|${nationality}|${dateOfBirth}|${name}`;
    const hash = createHash('sha256').update(passportData).digest('hex');
    const passportHash = '0x' + hash;
    
    console.log('✓ Passport registered:', passportHash.substring(0, 20) + '...');
    console.log('✓ Age verified:', actualAge, 'years');
    
    res.json({
      success: true,
      passportHash,
      ageVerified: true,
      age: actualAge,
      registeredAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Registration error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// VOTE CASTING ENDPOINT
// ============================================================================

/**
 * POST /api/cast-vote
 * 
 * Cast a vote using passport_hash as nullifier.
 * 
 * Body: { passportHash, candidateId, reason? }
 * Returns: { txHash, blockNumber }
 */
app.post('/api/cast-vote', async (req, res) => {
  try {
    console.log('\n🗳️  Vote casting request:', req.body);
    
    const { passportHash, candidateId, reason } = req.body;
    
    if (!passportHash || !candidateId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: passportHash, candidateId'
      });
    }
    
    if (![1, 2, 3].includes(candidateId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid candidateId. Must be 1, 2, or 3'
      });
    }
    
    const wallet = await getWallet();
    const contract = await getContract();
    
    // Get address like in scripts
    const accounts = await wallet.getAccounts();
    const fromAddress = accounts && accounts.length > 0 ? accounts[0].item : AztecAddress.ZERO;
    
    // Prepare fields
    const candidateField = new Fr(candidateId);
    const nullifierField = Fr.fromString(passportHash);
    
    // Encrypt reason if provided
    let reasonField = new Fr(0);
    if (reason) {
      const reasonHash = createHash('sha256').update(reason).digest('hex');
      reasonField = new Fr(BigInt('0x' + reasonHash.substring(0, 62)));
    }
    
    const candidateNames = { 1: 'A', 2: 'B', 3: 'C' };
    console.log(`✓ Voting for Candidate ${candidateNames[candidateId]}`);
    console.log(`✓ Nullifier: ${passportHash.substring(0, 20)}...`);
    
    // Cast vote
    const tx = await contract.methods
      .cast_vote(candidateField, nullifierField, reasonField)
      .send({
        from: fromAddress,
        fee: { paymentMethod: sponsoredPaymentMethod }
      });
    
    console.log('⏳ Waiting for transaction...');
    const receipt = await tx.wait({ timeout: 180 });
    
    console.log('✅ Vote cast successfully!');
    console.log('   TX:', receipt.txHash.toString());
    console.log('   Block:', receipt.blockNumber);
    
    res.json({
      success: true,
      txHash: receipt.txHash.toString(),
      blockNumber: receipt.blockNumber,
      candidate: candidateNames[candidateId],
      explorerUrl: `https://devnet.aztecscan.xyz/tx/${receipt.txHash.toString()}`
    });
    
  } catch (error) {
    console.error('❌ Vote error:', error.message);
    
    let errorMessage = error.message;
    if (errorMessage.includes('nullifier')) {
      errorMessage = 'This passport has already voted! Sybil resistance active.';
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

// ============================================================================
// VOTE RESULTS ENDPOINT
// ============================================================================

/**
 * GET /api/results
 * 
 * Read current vote tallies from contract.
 * 
 * Returns: { candidateA, candidateB, candidateC, total }
 */
app.get('/api/results', async (req, res) => {
  try {
    console.log('\n📊 Reading vote results...');
    
    const wallet = await getWallet();
    const contract = await getContract();
    
    const accounts = await wallet.getAccounts();
    const fromAddress = accounts && accounts.length > 0 ? accounts[0].item : AztecAddress.ZERO;
    
    const tallyA = await contract.methods.get_vote(new Fr(1)).simulate({ from: fromAddress });
    const tallyB = await contract.methods.get_vote(new Fr(2)).simulate({ from: fromAddress });
    const tallyC = await contract.methods.get_vote(new Fr(3)).simulate({ from: fromAddress });
    
    const total = Number(tallyA) + Number(tallyB) + Number(tallyC);
    
    console.log(`✓ A: ${tallyA}, B: ${tallyB}, C: ${tallyC} (Total: ${total})`);
    
    res.json({
      success: true,
      results: {
        candidateA: Number(tallyA),
        candidateB: Number(tallyB),
        candidateC: Number(tallyC),
        total
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Results error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// VOTING STATUS ENDPOINT
// ============================================================================

/**
 * GET /api/status
 * 
 * Check voting period status.
 * 
 * Returns: { isActive, startTime, endTime, currentTime }
 */
app.get('/api/status', async (req, res) => {
  try {
    console.log('\n⏰ Checking voting status...');
    
    const wallet = await getWallet();
    const contract = await getContract();
    
    const accounts = await wallet.getAccounts();
    const fromAddress = accounts && accounts.length > 0 ? accounts[0].item : AztecAddress.ZERO;
    
    const startTime = await contract.methods.get_start_time().simulate({ from: fromAddress });
    const endTime = await contract.methods.get_end_time().simulate({ from: fromAddress });
    
    const currentTime = Math.floor(Date.now() / 1000);
    const isActive = currentTime >= Number(startTime) && currentTime <= Number(endTime);
    
    console.log(`✓ Active: ${isActive}`);
    console.log(`✓ Period: ${new Date(Number(startTime) * 1000).toISOString()} → ${new Date(Number(endTime) * 1000).toISOString()}`);
    
    res.json({
      success: true,
      isActive,
      startTime: Number(startTime),
      endTime: Number(endTime),
      currentTime,
      startDate: new Date(Number(startTime) * 1000).toISOString(),
      endDate: new Date(Number(endTime) * 1000).toISOString()
    });
    
  } catch (error) {
    console.error('❌ Status error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// ADMIN ENDPOINTS
// ============================================================================

// Extend voting period (admin only)
app.post('/api/admin/extend-voting', async (req, res) => {
  try {
    const { newEndTime } = req.body;
    
    if (!newEndTime) {
      return res.status(400).json({
        success: false,
        error: 'newEndTime (Unix timestamp) is required'
      });
    }
    
    console.log(`🔧 Admin: Extending voting to ${new Date(newEndTime * 1000).toISOString()}...`);
    
    const contract = await getContract();
    const wallet = await getWallet();
    
    if (!adminAccount) {
      throw new Error('Admin account not initialized');
    }
    
    const tx = contract.methods.extend_voting(newEndTime).send({
      from: adminAccount.address,
      fee: {
        paymentMethod: sponsoredPaymentMethod
      }
    });
    
    await tx.wait();
    const receipt = await tx.getReceipt();
    
    console.log(`✅ Voting extended! TX: ${receipt.txHash}`);
    
    res.json({
      success: true,
      txHash: receipt.txHash.toString(),
      newEndTime,
      newEndDate: new Date(newEndTime * 1000).toISOString()
    });
    
  } catch (error) {
    console.error('❌ Extend voting error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// End voting early (admin only)
app.post('/api/admin/end-voting', async (req, res) => {
  try {
    console.log(`🛑 Admin: Ending voting early...`);
    
    const contract = await getContract();
    const wallet = await getWallet();
    
    if (!adminAccount) {
      throw new Error('Admin account not initialized');
    }
    
    const tx = contract.methods.end_voting().send({
      from: adminAccount.address,
      fee: {
        paymentMethod: sponsoredPaymentMethod
      }
    });
    
    await tx.wait();
    const receipt = await tx.getReceipt();
    
    console.log(`✅ Voting ended! TX: ${receipt.txHash}`);
    
    res.json({
      success: true,
      txHash: receipt.txHash.toString(),
      endedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ End voting error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Take snapshot (admin or anyone after voting ends)
app.post('/api/admin/take-snapshot', async (req, res) => {
  try {
    console.log(`📸 Admin: Taking results snapshot...`);
    
    const contract = await getContract();
    const wallet = await getWallet();
    
    if (!adminAccount) {
      throw new Error('Admin account not initialized');
    }
    
    const tx = contract.methods.take_snapshot().send({
      from: adminAccount.address,
      fee: {
        paymentMethod: sponsoredPaymentMethod
      }
    });
    
    await tx.wait();
    const receipt = await tx.getReceipt();
    
    console.log(`✅ Snapshot taken! TX: ${receipt.txHash}`);
    
    // Read snapshot results
    const accounts = await wallet.getAccounts();
    const fromAddress = accounts && accounts.length > 0 ? accounts[0].item : AztecAddress.ZERO;
    
    const snapshotA = await contract.methods.get_snapshot(new Fr(1)).simulate({ from: fromAddress });
    const snapshotB = await contract.methods.get_snapshot(new Fr(2)).simulate({ from: fromAddress });
    const snapshotC = await contract.methods.get_snapshot(new Fr(3)).simulate({ from: fromAddress });
    
    res.json({
      success: true,
      txHash: receipt.txHash.toString(),
      snapshot: {
        candidateA: Number(snapshotA),
        candidateB: Number(snapshotB),
        candidateC: Number(snapshotC),
        total: Number(snapshotA) + Number(snapshotB) + Number(snapshotC)
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Take snapshot error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get admin info
app.get('/api/admin/info', async (req, res) => {
  try {
    const contract = await getContract();
    const wallet = await getWallet();
    
    // Use the admin account address
    const adminAddress = adminAccount ? adminAccount.address : AztecAddress.ZERO;
    
    const creator = await contract.methods.get_creator().simulate({ from: adminAddress });
    const isSnapshotTaken = await contract.methods.is_snapshot_taken().simulate({ from: adminAddress });
    
    // Compare the admin account with creator
    // The creator is returned as a Field, which toString() gives decimal
    // The adminAddress.toField() toString() gives hex
    // Convert creator decimal string to hex for comparison
    const creatorStr = creator.toString();
    const adminFieldStr = adminAddress.toField().toString();
    
    // Convert creator from decimal to hex if it doesn't start with 0x
    let creatorHex;
    if (creatorStr.startsWith('0x')) {
      creatorHex = creatorStr;
    } else {
      // Convert decimal string to BigInt to hex with proper padding (64 chars)
      const hexWithoutPrefix = BigInt(creatorStr).toString(16).padStart(64, '0');
      creatorHex = '0x' + hexWithoutPrefix;
    }
    
    const adminHex = adminFieldStr.startsWith('0x') ? adminFieldStr : '0x' + adminFieldStr;
    
    const isAdmin = creatorHex.toLowerCase() === adminHex.toLowerCase();
    
    console.log('Admin check:', {
      creator: creatorStr,
      adminField: adminFieldStr,
      creatorHex,
      adminHex,
      isAdmin
    });
    
    res.json({
      success: true,
      creator: creatorStr,
      walletAddress: adminAddress.toString(),
      adminField: adminFieldStr,
      isAdmin,
      isSnapshotTaken
    });
    
  } catch (error) {
    console.error('❌ Admin info error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Deploy new voting contract
app.post('/api/admin/deploy-new-voting', async (req, res) => {
  try {
    const { startTime, endTime } = req.body;
    
    if (!startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: 'startTime and endTime (Unix timestamps) are required'
      });
    }
    
    if (endTime <= startTime) {
      return res.status(400).json({
        success: false,
        error: 'endTime must be greater than startTime'
      });
    }
    
    console.log(`🚀 Admin: Deploying new voting contract...`);
    console.log(`   Period: ${new Date(startTime * 1000).toISOString()} → ${new Date(endTime * 1000).toISOString()}`);
    
    const wallet = await getWallet();
    
    if (!adminAccount) {
      throw new Error('Admin account not initialized');
    }
    
    // Deploy with initializer args (start_time, end_time)
    const deploymentTx = Contract.deploy(wallet, PrivateVotingArtifact, [startTime, endTime])
      .send({
        from: adminAccount.address,
        fee: {
          paymentMethod: sponsoredPaymentMethod
        }
      });
    
    const txHash = await deploymentTx.getTxHash();
    console.log(`📝 Deployment transaction sent: ${txHash}`);
    
    const receipt = await deploymentTx.wait({ timeout: 120000 });
    console.log(`⛏️ Transaction mined in block ${receipt.blockNumber}`);
    
    const contract = await deploymentTx.deployed();
    const newContractAddress = contract.address.toString();
    console.log(`✅ New contract deployed at: ${newContractAddress}`);
    
    // Save admin address before clearing cache
    const deployerAddress = adminAccount.address.toString();
    
    const newContractInfo = {
      address: newContractAddress,
      deployedAt: new Date().toISOString(),
      network: 'devnet',
      nodeUrl: NODE_URL,
      adminAddress: deployerAddress,
      txHash: txHash.toString(),
      startTime,
      endTime,
      startDate: new Date(startTime * 1000).toISOString(),
      endDate: new Date(endTime * 1000).toISOString()
    };
    
    const { writeFileSync } = await import('fs');
    writeFileSync(contractInfoPath, JSON.stringify(newContractInfo, null, 2));
    console.log(`📝 Updated contract-address.json`);
    
    // Clear cached wallet and contract to force reload
    cachedWallet = null;
    sponsoredPaymentMethod = null;
    adminAccount = null;
    console.log(`🔄 Cleared cache - server will use new contract on next request`);
    
    res.json({
      success: true,
      contractAddress: newContractAddress,
      txHash: txHash.toString(),
      blockNumber: receipt.blockNumber,
      adminAddress: deployerAddress,
      startTime,
      endTime,
      startDate: new Date(startTime * 1000).toISOString(),
      endDate: new Date(endTime * 1000).toISOString(),
      message: 'Contract deployed and server updated. Reload frontend to use new contract.'
    });
    
  } catch (error) {
    console.error('❌ Deploy error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    nodeUrl: NODE_URL,
    contractAddress: getCurrentContractAddress().toString()
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log('\n🚀 ZKPassport Voting API Server');
  console.log('━'.repeat(60));
  console.log(`   Port:              http://localhost:${PORT}`);
  console.log(`   Aztec Node:        ${NODE_URL}`);
  console.log(`   Contract:          ${getCurrentContractAddress()}`);
  console.log('━'.repeat(60));
  console.log('\n📡 Endpoints:');
  console.log(`   POST /api/register-passport      - Register with ZKPassport`);
  console.log(`   POST /api/cast-vote              - Cast vote with passport`);
  console.log(`   GET  /api/results                - Read vote tallies`);
  console.log(`   GET  /api/status                 - Check voting period`);
  console.log('\n👑 Admin Endpoints:');
  console.log(`   POST /api/admin/extend-voting    - Extend voting period`);
  console.log(`   POST /api/admin/end-voting       - End voting early`);
  console.log(`   POST /api/admin/take-snapshot    - Take results snapshot`);
  console.log(`   POST /api/admin/deploy-new-voting - Deploy new voting contract`);
  console.log(`   GET  /api/admin/info             - Get admin info`);
  console.log('\n📋 Other:');
  console.log(`   GET  /health                     - Health check`);
  console.log('\n✨ Ready to accept requests!\n');
});
