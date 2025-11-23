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
  console.log(`\n🏁 FINALIZING VOTING PROCESS\n`);
  console.log(`${'='.repeat(50)}\n`);
  
  console.log(`🔗 Connecting to ${NODE_URL}...`);
  const node = createAztecNodeClient(NODE_URL);
  const testWallet = await TestWallet.create(node);
  
  // Setup Sponsored FPC
  const sponsoredFPCInstance = await getContractInstanceFromInstantiationParams(
    SponsoredFPCContract.artifact,
    { salt: SPONSORED_FPC_SALT }
  );
  
  await testWallet.registerContract({
    instance: sponsoredFPCInstance,
    artifact: SponsoredFPCContract.artifact
  });
  
  const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(
    sponsoredFPCInstance.address
  );
  
  // Load contract info
  const addressFile = path.join(__dirname, '../frontend/public/contract-address.json');
  const contractInfo = JSON.parse(fs.readFileSync(addressFile, 'utf8'));
  const { address: contractAddress, adminAddress } = contractInfo;
  
  const artifactPath = path.join(__dirname, '../contracts/target/private_voting-PrivateVoting.json');
  const artifact = loadContractArtifact(JSON.parse(fs.readFileSync(artifactPath, 'utf8')));
  
  const contractInstance = await node.getContract(AztecAddress.fromString(contractAddress));
  await testWallet.registerContract({ instance: contractInstance, artifact: artifact });
  
  const contract = await Contract.at(AztecAddress.fromString(contractAddress), artifact, testWallet);
  
  console.log(`📜 Contract: ${contractAddress}\n`);
  
  // Step 1: Check current voting status
  console.log(`📊 STEP 1: Checking Voting Status\n`);
  console.log(`${'─'.repeat(50)}`);
  
  const startTime = await contract.methods.get_start_time().simulate({ from: AztecAddress.ZERO });
  const endTime = await contract.methods.get_end_time().simulate({ from: AztecAddress.ZERO });
  const creator = await contract.methods.get_creator().simulate({ from: AztecAddress.ZERO });
  
  const now = Math.floor(Date.now() / 1000);
  let votingActive = now >= Number(startTime) && now <= Number(endTime);
  
  console.log(`   Start Time: ${new Date(Number(startTime) * 1000).toISOString()}`);
  console.log(`   End Time: ${new Date(Number(endTime) * 1000).toISOString()}`);
  console.log(`   Current Time: ${new Date(now * 1000).toISOString()}`);
  console.log(`   Status: ${votingActive ? '🟢 ACTIVE' : '🔴 ENDED'}`);
  console.log(`   Creator: ${creator.toString()}\n`);
  
  // Check current vote counts
  console.log(`📈 Current Vote Counts:\n`);
  const vote1 = await contract.methods.get_vote(new Fr(1)).simulate({ from: AztecAddress.ZERO });
  const vote2 = await contract.methods.get_vote(new Fr(2)).simulate({ from: AztecAddress.ZERO });
  const vote3 = await contract.methods.get_vote(new Fr(3)).simulate({ from: AztecAddress.ZERO });
  const total = Number(vote1) + Number(vote2) + Number(vote3);
  
  console.log(`   Candidate A: ${vote1} vote(s)`);
  console.log(`   Candidate B: ${vote2} vote(s)`);
  console.log(`   Candidate C: ${vote3} vote(s)`);
  console.log(`   Total: ${total} vote(s)\n`);
  
  // Step 2: End voting if still active
  if (votingActive) {
    console.log(`🛑 STEP 2: Ending Voting Early\n`);
    console.log(`${'─'.repeat(50)}`);
    console.log(`⚠️  Voting is still active.`);
    console.log(`   The admin address is: ${adminAddress}\n`);
    
    // Ask user if they want to use admin to end voting
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const useAdmin = await new Promise((resolve) => {
      rl.question('   Do you want to end voting now using admin account? (y/N): ', (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
    
    if (useAdmin) {
      console.log(`\n🔑 Using admin account to end voting...\n`);
      
      // Use the same deterministic keys as deployment
      const adminSecretKey = Fr.fromString('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
      const adminSigningKey = GrumpkinScalar.fromString('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
      const adminSalt = Fr.fromString('0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba');
      
      const adminAccount = await testWallet.createSchnorrAccount(adminSecretKey, adminSalt, adminSigningKey);
      console.log(`   Admin account recreated: ${adminAccount.address.toString()}`);
      console.log(`   Expected admin: ${adminAddress}\n`);
      
      // End voting (account already deployed from initial deployment)
      console.log(`🛑 Calling end_voting()...`);
      // Use existing contract but with admin address
      const endTx = contract.methods.end_voting().send({ 
        from: AztecAddress.fromString(adminAddress),
        fee: { paymentMethod: sponsoredPaymentMethod }
      });
      const receipt = await endTx.wait();
      console.log(`✅ Voting ended! Transaction: ${receipt.txHash}\n`);
      
      // Update voting status
      votingActive = false;
    } else {
      console.log(`\n⏭️  Skipping early termination. Voting will end at: ${new Date(Number(endTime) * 1000).toISOString()}\n`);
    }
  } else {
    console.log(`✅ STEP 2: Voting Already Ended\n`);
    console.log(`${'─'.repeat(50)}`);
    console.log(`   Voting period has naturally concluded.\n`);
  }
  
  // Step 3: Check if snapshot already taken
  console.log(`📸 STEP 3: Checking Snapshot Status\n`);
  console.log(`${'─'.repeat(50)}`);
  
  let snapshotTaken = await contract.methods.is_snapshot_taken().simulate({ from: AztecAddress.ZERO });
  let snapshotTotal = 0;
  
  if (snapshotTaken) {
    console.log(`✅ Snapshot already taken!\n`);
    
    const snapshot1 = await contract.methods.get_snapshot(new Fr(1)).simulate({ from: AztecAddress.ZERO });
    const snapshot2 = await contract.methods.get_snapshot(new Fr(2)).simulate({ from: AztecAddress.ZERO });
    const snapshot3 = await contract.methods.get_snapshot(new Fr(3)).simulate({ from: AztecAddress.ZERO });
    snapshotTotal = Number(snapshot1) + Number(snapshot2) + Number(snapshot3);
    
    console.log(`📊 Final Results (Immutable Snapshot):\n`);
    console.log(`   Candidate A: ${snapshot1} vote(s) - ${snapshotTotal > 0 ? ((Number(snapshot1) / snapshotTotal) * 100).toFixed(1) : 0}%`);
    console.log(`   Candidate B: ${snapshot2} vote(s) - ${snapshotTotal > 0 ? ((Number(snapshot2) / snapshotTotal) * 100).toFixed(1) : 0}%`);
    console.log(`   Candidate C: ${snapshot3} vote(s) - ${snapshotTotal > 0 ? ((Number(snapshot3) / snapshotTotal) * 100).toFixed(1) : 0}%`);
    console.log(`   Total: ${snapshotTotal} vote(s)\n`);
    
  } else {
    console.log(`⏳ Snapshot not yet taken. Taking snapshot now...\n`);
    
    try {
      const tx = await contract.methods.take_snapshot()
        .send({
          from: AztecAddress.ZERO,
          fee: { paymentMethod: sponsoredPaymentMethod }
        })
        .wait({ timeout: 120000 });
      
      console.log(`✅ Snapshot taken successfully!`);
      console.log(`   TX Hash: ${tx.txHash}\n`);
      
      // Read and display snapshot
      const snapshot1 = await contract.methods.get_snapshot(new Fr(1)).simulate({ from: AztecAddress.ZERO });
      const snapshot2 = await contract.methods.get_snapshot(new Fr(2)).simulate({ from: AztecAddress.ZERO });
      const snapshot3 = await contract.methods.get_snapshot(new Fr(3)).simulate({ from: AztecAddress.ZERO });
      snapshotTotal = Number(snapshot1) + Number(snapshot2) + Number(snapshot3);
      
      console.log(`📊 Final Results (Immutable Snapshot):\n`);
      console.log(`   Candidate A: ${snapshot1} vote(s) - ${snapshotTotal > 0 ? ((Number(snapshot1) / snapshotTotal) * 100).toFixed(1) : 0}%`);
      console.log(`   Candidate B: ${snapshot2} vote(s) - ${snapshotTotal > 0 ? ((Number(snapshot2) / snapshotTotal) * 100).toFixed(1) : 0}%`);
      console.log(`   Candidate C: ${snapshot3} vote(s) - ${snapshotTotal > 0 ? ((Number(snapshot3) / snapshotTotal) * 100).toFixed(1) : 0}%`);
      console.log(`   Total: ${snapshotTotal} vote(s)\n`);
      
      // Update snapshot status
      snapshotTaken = true;
      
    } catch (error) {
      console.error(`❌ Failed to take snapshot: ${error.message}\n`);
      
      if (!votingActive) {
        console.log(`✅ Good news: Voting has ended, so anyone can call take_snapshot()`);
      } else {
        console.log(`⚠️  Voting is still active. Only the creator can take snapshot early.`);
      }
    }
  }
  
  // Final Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`\n🎉 VOTING FINALIZATION SUMMARY\n`);
  console.log(`   Contract: ${contractAddress}`);
  console.log(`   Voting Status: ${votingActive ? '🟢 ACTIVE' : '🔴 ENDED'}`);
  console.log(`   Snapshot Status: ${snapshotTaken ? '✅ TAKEN' : '⏳ PENDING'}`);
  console.log(`   Total Votes: ${total}`);
  console.log(`\n${'='.repeat(50)}\n`);
  
  if (snapshotTaken) {
    console.log(`✅ Voting is fully finalized and results are immutable!`);
  } else {
    console.log(`⚠️  Snapshot still needs to be taken to finalize results.`);
  }
  
  console.log();
}

main().catch(console.error);
