import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { TestWallet } from '@aztec/test-wallet/server';
import { Contract } from '@aztec/aztec.js/contracts';
import { Fr, GrumpkinScalar } from '@aztec/aztec.js/fields';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee/testing';
import { SponsoredFPCContract } from '@aztec/noir-contracts.js/SponsoredFPC';
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { loadContractArtifact } from '@aztec/aztec.js/abi';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NODE_URL = process.env.NODE_URL || 'https://devnet.aztec-labs.com/';
const SPONSORED_FPC_SALT = new Fr(0);

async function main() {
  console.log(`Connecting to Aztec Devnet at ${NODE_URL}...`);
  const node = createAztecNodeClient(NODE_URL);
  
  console.log('Creating wallet (local PXE)...');
  const testWallet = await TestWallet.create(node);
  
  console.log('💰 Setting up Sponsored FPC...');
  const sponsoredFPCInstance = await getContractInstanceFromInstantiationParams(
    SponsoredFPCContract.artifact,
    { salt: SPONSORED_FPC_SALT }
  );
  console.log(`💰 Sponsored FPC address: ${sponsoredFPCInstance.address}`);

  await testWallet.registerContract({
    instance: sponsoredFPCInstance,
    artifact: SponsoredFPCContract.artifact
  });
  
  const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(
    sponsoredFPCInstance.address
  );
  
  console.log('👤 Creating Schnorr account...');
  // Use deterministic keys for consistent admin across deployments
  const secretKey = Fr.fromString('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
  const signingKey = GrumpkinScalar.fromString('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
  const salt = Fr.fromString('0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba');
  
  const account = await testWallet.createSchnorrAccount(secretKey, salt, signingKey);
  const deployerAddress = account.address;
  console.log(`Using account: ${deployerAddress.toString()}`);
  
  // Try to deploy account, skip if already exists
  console.log('📝 Deploying account with sponsored fees (or using existing)...');
  try {
      const deployMethod = await account.getDeployMethod();
      const tx = await deployMethod.send({ 
        from: AztecAddress.ZERO,
        fee: { paymentMethod: sponsoredPaymentMethod }
      }).wait();
      console.log(`✓ Account deployed (tx: ${tx.txHash})`);
  } catch (e) {
      if (e.message && e.message.includes('Existing nullifier')) {
        console.log(`✓ Account already exists on devnet, continuing...`);
      } else {
        console.error("Error deploying account:", e);
        throw e;
      }
  }
  
  // Load contract artifact
  const artifactPath = path.join(__dirname, '../contracts/target/private_voting-PrivateVoting.json');
  const artifact = loadContractArtifact(JSON.parse(fs.readFileSync(artifactPath, 'utf8')));
  
  // Set voting period: starts now, ends in 7 days
  const now = Math.floor(Date.now() / 1000);
  const startTime = now;
  const endTime = now + (7 * 24 * 60 * 60); // 7 days from now
  
  console.log('Deploying PrivateVoting contract to Devnet...');
  console.log('Note: This may take ~36 seconds due to Devnet block times');
  console.log(`Initializer args: [start: ${startTime}, end: ${endTime}]`);
  console.log(`Voting period: ${new Date(startTime * 1000).toISOString()} to ${new Date(endTime * 1000).toISOString()}`);
  
  try {
    // Deploy with initializer args (start_time, end_time)
    const deploymentTx = Contract.deploy(testWallet, artifact, [startTime, endTime])
      .send({
        from: deployerAddress,
        fee: {
          paymentMethod: sponsoredPaymentMethod
        }
      });
    
    const txHash = await deploymentTx.getTxHash();
    console.log(`📝 Deployment transaction sent: ${txHash}`);
    
    const receipt = await deploymentTx.wait({ timeout: 120000 });
    console.log(`⛏️ Transaction mined in block ${receipt.blockNumber}`);
    
    const contract = await deploymentTx.deployed();
    console.log(`✅ Contract deployed and initialized at: ${contract.address.toString()}`);
    console.log(`   Creator set to: ${deployerAddress.toString()} (from msg.sender)`);
    
    // Save contract address for frontend
    const addressFile = path.join(__dirname, '../frontend/public/contract-address.json');
    fs.writeFileSync(addressFile, JSON.stringify({
      address: contract.address.toString(),
      deployedAt: new Date().toISOString(),
      network: 'devnet',
      nodeUrl: NODE_URL,
      adminAddress: deployerAddress.toString(),
      txHash: txHash.toString()
    }, null, 2));
    
    console.log(`Contract address saved to ${addressFile}`);
    console.log(`\n🔍 View on explorer: https://devnet-explorer.aztec.network/`);
  } catch (error) {
    console.error('❌ Deployment error:', error);
    if (error.message) {
      console.error('Error message:', error.message);
    }
    throw error;
  }
}

main().catch(console.error);
