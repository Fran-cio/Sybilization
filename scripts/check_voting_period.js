import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { TestWallet } from '@aztec/test-wallet/server';
import { Contract } from '@aztec/aztec.js/contracts';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { loadContractArtifact } from '@aztec/aztec.js/abi';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NODE_URL = process.env.NODE_URL || 'https://devnet.aztec-labs.com/';

async function main() {
  console.log(`🔗 Connecting to ${NODE_URL}...`);
  const node = createAztecNodeClient(NODE_URL);
  const testWallet = await TestWallet.create(node);
  
  // Load contract
  const addressFile = path.join(__dirname, '../frontend/public/contract-address.json');
  const { address: contractAddress } = JSON.parse(fs.readFileSync(addressFile, 'utf8'));
  
  const artifactPath = path.join(__dirname, '../contracts/target/private_voting-PrivateVoting.json');
  const artifact = loadContractArtifact(JSON.parse(fs.readFileSync(artifactPath, 'utf8')));
  
  const contractInstance = await node.getContract(AztecAddress.fromString(contractAddress));
  await testWallet.registerContract({ instance: contractInstance, artifact: artifact });
  
  const contract = await Contract.at(AztecAddress.fromString(contractAddress), artifact, testWallet);
  
  console.log(`\n📜 Contract: ${contractAddress}`);
  
  // Read contract state
  try {
    const fromAddress = AztecAddress.ZERO;
    const startTime = await contract.methods.get_start_time().simulate({ from: fromAddress });
    const endTime = await contract.methods.get_end_time().simulate({ from: fromAddress });
    const creator = await contract.methods.get_creator().simulate({ from: fromAddress });
    
    console.log(`\n⏰ Voting Period:`);
    console.log(`   Start Time: ${startTime} (${new Date(Number(startTime) * 1000).toISOString()})`);
    console.log(`   End Time: ${endTime} (${new Date(Number(endTime) * 1000).toISOString()})`);
    console.log(`   Creator: ${creator.toString()}`);
    
    const now = Math.floor(Date.now() / 1000);
    console.log(`\n🕐 Current Time:`);
    console.log(`   Unix Timestamp: ${now} (${new Date(now * 1000).toISOString()})`);
    console.log(`   Voting Active: ${now >= Number(startTime) && now <= Number(endTime)}`);
    
  } catch (error) {
    console.error(`Error reading contract state:`, error.message);
  }
}

main().catch(console.error);
