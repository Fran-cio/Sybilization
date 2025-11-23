import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { TestWallet } from '@aztec/test-wallet/server';
import { Contract } from '@aztec/aztec.js/contracts';
import { Fr } from '@aztec/aztec.js/fields';
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
  console.log(`📸 Taking Results Snapshot\n`);
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
  
  // Load contract
  const addressFile = path.join(__dirname, '../frontend/public/contract-address.json');
  const { address: contractAddress, adminAddress } = JSON.parse(fs.readFileSync(addressFile, 'utf8'));
  
  const artifactPath = path.join(__dirname, '../contracts/target/private_voting-PrivateVoting.json');
  const artifact = loadContractArtifact(JSON.parse(fs.readFileSync(artifactPath, 'utf8')));
  
  const contractInstance = await node.getContract(AztecAddress.fromString(contractAddress));
  await testWallet.registerContract({ instance: contractInstance, artifact: artifact });
  
  const contract = await Contract.at(AztecAddress.fromString(contractAddress), artifact, testWallet);
  
  console.log(`📜 Contract: ${contractAddress}\n`);
  
  // Check if snapshot already taken
  const alreadyTaken = await contract.methods.is_snapshot_taken().simulate({ from: AztecAddress.ZERO });
  
  if (alreadyTaken) {
    console.log('⚠️  Snapshot already taken!');
    console.log('Reading snapshot results...\n');
    
    const snapshot1 = await contract.methods.get_snapshot(new Fr(1)).simulate({ from: AztecAddress.ZERO });
    const snapshot2 = await contract.methods.get_snapshot(new Fr(2)).simulate({ from: AztecAddress.ZERO });
    const snapshot3 = await contract.methods.get_snapshot(new Fr(3)).simulate({ from: AztecAddress.ZERO });
    
    console.log('📊 Final Results (Snapshot):');
    console.log(`   Candidate A: ${snapshot1}`);
    console.log(`   Candidate B: ${snapshot2}`);
    console.log(`   Candidate C: ${snapshot3}`);
    
    return;
  }
  
  // Check current results before snapshot
  console.log('📊 Current Results:');
  const vote1 = await contract.methods.get_vote(new Fr(1)).simulate({ from: AztecAddress.ZERO });
  const vote2 = await contract.methods.get_vote(new Fr(2)).simulate({ from: AztecAddress.ZERO });
  const vote3 = await contract.methods.get_vote(new Fr(3)).simulate({ from: AztecAddress.ZERO });
  console.log(`   Candidate A: ${vote1}`);
  console.log(`   Candidate B: ${vote2}`);
  console.log(`   Candidate C: ${vote3}\n`);
  
  console.log('📸 Taking snapshot...');
  
  try {
    const tx = await contract.methods.take_snapshot()
      .send({
        from: AztecAddress.ZERO,
        fee: { paymentMethod: sponsoredPaymentMethod }
      })
      .wait({ timeout: 120000 });
    
    console.log(`✅ Snapshot taken successfully!`);
    console.log(`   TX Hash: ${tx.txHash}\n`);
    
    // Read snapshot
    const snapshot1 = await contract.methods.get_snapshot(new Fr(1)).simulate({ from: AztecAddress.ZERO });
    const snapshot2 = await contract.methods.get_snapshot(new Fr(2)).simulate({ from: AztecAddress.ZERO });
    const snapshot3 = await contract.methods.get_snapshot(new Fr(3)).simulate({ from: AztecAddress.ZERO });
    
    console.log('📊 Final Results (Snapshot):');
    console.log(`   Candidate A: ${snapshot1}`);
    console.log(`   Candidate B: ${snapshot2}`);
    console.log(`   Candidate C: ${snapshot3}`);
    
  } catch (error) {
    console.error('❌ Failed to take snapshot:', error.message);
  }
}

main().catch(console.error);
