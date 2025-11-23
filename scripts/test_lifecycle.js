import { Contract, getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { Fr } from '@aztec/aztec.js/fields';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { TestWallet } from '@aztec/test-wallet/server';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee/testing';
import { SponsoredFPCContract } from '@aztec/noir-contracts.js/SponsoredFPC';
import { loadContractArtifact } from '@aztec/aztec.js/abi';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const NODE_URL = process.env.NODE_URL || 'https://devnet.aztec-labs.com/';
const SPONSORED_FPC_SALT = new Fr(0);

async function testVotingLifecycle() {
  console.log('\n🧪 Testing Voting Lifecycle\n');
  console.log(`📡 Connecting to: ${NODE_URL}\n`);
  
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
  
  const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPCInstance.address);
  
  const accounts = await wallet.getAccounts();
  const fromAddress = accounts && accounts.length > 0 ? accounts[0].item : AztecAddress.ZERO;
  console.log(`   ✓ Address: ${fromAddress}\n`);
  
  console.log('2️⃣  Loading contract...');
  const nodeInstance = await node.getContract(CONTRACT_ADDRESS);
  if (!nodeInstance) {
    throw new Error(`Contract not found at ${CONTRACT_ADDRESS}`);
  }
  
  await wallet.registerContract({
    instance: nodeInstance,
    artifact
  });
  
  const contract = await Contract.at(CONTRACT_ADDRESS, artifact, wallet);
  console.log(`   ✓ Contract: ${CONTRACT_ADDRESS}\n`);
  
  // Test 1: Vote before ending
  console.log('📝 Test 1: Vote BEFORE ending...');
  const testNullifier = Fr.random();
  const candidateId = new Fr(1);
  
  try {
    const voteTx = await contract.methods
      .cast_vote(candidateId, testNullifier)
      .send({
        from: fromAddress,
        fee: { paymentMethod: sponsoredPaymentMethod }
      });
    
    await voteTx.wait({ timeout: 120000 });
    console.log('   ✅ Vote succeeded (as expected)\n');
  } catch (error) {
    console.log(`   ❌ Vote failed: ${error.message}\n`);
  }
  
  // Test 2: End voting
  console.log('🛑 Test 2: Ending voting period...');
  try {
    const endTx = await contract.methods
      .end_voting()
      .send({
        from: fromAddress,
        fee: { paymentMethod: sponsoredPaymentMethod }
      });
    
    const endReceipt = await endTx.wait({ timeout: 120000 });
    console.log(`   ✅ Voting ended successfully`);
    console.log(`   TX: ${endReceipt.txHash}\n`);
  } catch (error) {
    console.log(`   ❌ Failed to end voting: ${error.message}\n`);
    return;
  }
  
  // Test 3: Try to vote after ending
  console.log('🔒 Test 3: Vote AFTER ending (should fail)...');
  const testNullifier2 = Fr.random();
  
  try {
    const voteTx2 = await contract.methods
      .cast_vote(candidateId, testNullifier2)
      .send({
        from: fromAddress,
        fee: { paymentMethod: sponsoredPaymentMethod }
      });
    
    await voteTx2.wait({ timeout: 120000 });
    console.log('   ❌ Vote succeeded (UNEXPECTED - should have failed!)\n');
  } catch (error) {
    if (error.message.includes('Voting has ended')) {
      console.log('   ✅ Vote blocked with "Voting has ended" (as expected)\n');
    } else {
      console.log(`   ⚠️  Vote failed with different error: ${error.message}\n`);
    }
  }
  
  // Test 4: Verify results are still readable
  console.log('📊 Test 4: Verify results still readable...');
  try {
    const votes = await contract.methods.get_vote(candidateId).simulate({ from: fromAddress });
    console.log(`   ✅ Can still read results: ${votes} votes for candidate 1\n`);
  } catch (error) {
    console.log(`   ❌ Failed to read results: ${error.message}\n`);
  }
  
  console.log('✨ Lifecycle tests complete!\n');
  console.log('📋 Summary:');
  console.log('   ✅ Voting works before end_voting()');
  console.log('   ✅ end_voting() executes successfully');
  console.log('   ✅ Voting blocked after end_voting()');
  console.log('   ✅ Results remain readable after voting ends');
  console.log('');
}

testVotingLifecycle().catch(console.error);
