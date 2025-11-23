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

const NODE_URL = process.env.NODE_URL || 'http://localhost:8080';
const SPONSORED_FPC_SALT = new Fr(0);

async function castVote(candidateName, uniqueIdentifier) {
  console.log('\n=== CASTING VOTE ===\n');
  
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
  const candidateId = candidateName === "Candidate A" ? 1 : 2;
  const candidateField = new Fr(candidateId);
  
  // Generate nullifier from unique identifier
  const hash = crypto.createHash('sha256').update(uniqueIdentifier).digest('hex');
  const nullifierField = new Fr(BigInt('0x' + hash.substring(0, 62)));
  
  console.log(`   ✓ Candidate: ${candidateName} (${candidateId})`);
  console.log(`   ✓ Nullifier: ${nullifierField.toString().substring(0, 20)}...`);
  
  console.log('\n4️⃣  Casting vote...');
  const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPCInstance.address);
  
  const tx = await contract.methods
    .cast_vote(candidateField, nullifierField)
    .send({
      from: fromAddress,
      fee: { paymentMethod: sponsoredPaymentMethod }
    });
  
  console.log('   ⏳ Waiting for transaction...');
  const receipt = await tx.wait();
  
  console.log(`\n✅ Vote cast successfully!`);
  console.log(`   TX Hash: ${receipt.txHash}`);
  console.log(`   Block: ${receipt.blockNumber}\n`);
}

// Get args from command line
const candidate = process.argv[2] || 'Candidate A';
const uniqueId = process.argv[3] || crypto.randomBytes(32).toString('hex');

castVote(candidate, uniqueId).catch(console.error);
