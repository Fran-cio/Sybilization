import { Contract, getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { TestWallet } from '@aztec/test-wallet/server';
import { loadContractArtifact } from '@aztec/aztec.js/abi';
import { Fr } from '@aztec/aztec.js/fields';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const NODE_URL = process.env.NODE_URL || 'https://devnet.aztec-labs.com/';

async function readVotes() {
  console.log('\n📊 Reading Voting Results\n');
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
  
  const accounts = await wallet.getAccounts();
  const fromAddress = accounts && accounts.length > 0 ? accounts[0].item : AztecAddress.ZERO;
  
  console.log('   ✓ Connected');
  
  console.log('\n2️⃣  Loading contract...');
  
  // Get the contract instance from the node
  const nodeInstance = await node.getContract(CONTRACT_ADDRESS);
  if (!nodeInstance) {
    throw new Error(`Contract not found at ${CONTRACT_ADDRESS}`);
  }
  
  // Register with wallet
  await wallet.registerContract({
    instance: nodeInstance,
    artifact
  });
  
  const contract = await Contract.at(CONTRACT_ADDRESS, artifact, wallet);
  console.log(`   ✓ Contract: ${CONTRACT_ADDRESS}\n`);
  
  console.log('3️⃣  Reading vote counts...\n');
  
  // Read votes for each candidate
  const candidates = [
    { id: 1, name: 'Candidate A' },
    { id: 2, name: 'Candidate B' },
    { id: 3, name: 'Candidate C' }
  ];
  
  let totalVotes = 0;
  const results = [];
  
  for (const candidate of candidates) {
    try {
      const votes = await contract.methods.get_vote(new Fr(candidate.id)).simulate({ from: fromAddress });
      const voteCount = Number(votes);
      totalVotes += voteCount;
      results.push({ ...candidate, votes: voteCount });
      console.log(`   ${candidate.name}: ${voteCount} vote(s)`);
    } catch (error) {
      console.log(`   ${candidate.name}: 0 votes (${error.message})`);
      results.push({ ...candidate, votes: 0 });
    }
  }
  
  console.log(`\n   Total votes cast: ${totalVotes}\n`);
  
  // Display results with percentages
  if (totalVotes > 0) {
    console.log('📈 Results:\n');
    results.forEach(result => {
      const percentage = ((result.votes / totalVotes) * 100).toFixed(1);
      const barLength = Math.round((result.votes / totalVotes) * 30);
      const bar = '█'.repeat(barLength) + '░'.repeat(30 - barLength);
      console.log(`   ${result.name.padEnd(15)} ${bar} ${percentage}% (${result.votes})`);
    });
    console.log('');
  }
  
  // Show contract info
  console.log('ℹ️  Contract Info:');
  console.log(`   Address: ${CONTRACT_ADDRESS}`);
  console.log(`   Network: ${contractInfo.network || 'devnet'}`);
  console.log(`   Deployed: ${contractInfo.deployedAt || 'N/A'}`);
  console.log('');
}

readVotes().catch(console.error);
